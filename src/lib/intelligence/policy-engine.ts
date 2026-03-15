import { prisma } from "@/lib/db";
import { publishEvent } from "@/lib/events/publish";
import { CHANNELS } from "@/lib/events/event-types";
import type { PolicyCondition, PolicyAction } from "@/types";
import { evaluateAllConditions, type EvaluationContext } from "./policy-conditions";
import { canExecute, executeAction, rollbackExpired, type ActionResult } from "./policy-actions";

export interface PolicyEvaluationResult {
  evaluated: number;
  triggered: number;
  actionsExecuted: number;
  rolledBack: number;
  duration: number;
}

function buildContextsFromState(state: {
  anomalies: Array<{
    type: string;
    severity: string;
    entityType: string;
    entityId: string | null;
  }>;
  endpoints: Array<{
    id: string;
    score: number;
    uptime: number;
    latency: number;
    isHealthy: boolean;
  }>;
  validators: Array<{
    id: string;
    score: number;
    jailed: boolean;
    missedBlocks: number;
    commission: number;
  }>;
  slos: Array<{
    entityId: string;
    isBreaching: boolean;
    budgetConsumed: number;
    currentValue: number;
  }>;
}): Array<{ entityType: string; entityId: string; context: EvaluationContext }> {
  const contexts: Array<{ entityType: string; entityId: string; context: EvaluationContext }> = [];

  for (const anomaly of state.anomalies) {
    const entityId = anomaly.entityId || "network";
    const context: EvaluationContext = {
      anomaly: {
        type: anomaly.type,
        severity: anomaly.severity,
        entityType: anomaly.entityType,
        entityId: anomaly.entityId,
      },
    };

    // Enrich with entity data
    if (anomaly.entityType === "endpoint") {
      const ep = state.endpoints.find((e) => e.id === anomaly.entityId);
      if (ep) context.endpoint = ep;
    }
    if (anomaly.entityType === "validator") {
      const val = state.validators.find((v) => v.id === anomaly.entityId);
      if (val) context.validator = val;
    }

    const slo = state.slos.find((s) => s.entityId === entityId);
    if (slo) context.slo = slo;

    contexts.push({ entityType: anomaly.entityType, entityId, context });
  }

  return contexts;
}

export async function evaluatePolicies(): Promise<PolicyEvaluationResult> {
  const start = Date.now();
  let evaluated = 0;
  let triggered = 0;
  let actionsExecuted = 0;

  // Step 0: Rollback expired actions
  const rolledBack = await rollbackExpired();

  // Step 1: Gather current state
  const recentCutoff = new Date(Date.now() - 15 * 60_000);

  const [unresolvedAnomalies, endpoints, validators, slos] = await Promise.all([
    prisma.anomaly.findMany({
      where: { resolved: false, detectedAt: { gte: recentCutoff } },
    }),
    prisma.endpoint.findMany({
      where: { isActive: true },
      include: {
        scores: { orderBy: { timestamp: "desc" }, take: 1 },
        healthChecks: { orderBy: { timestamp: "desc" }, take: 1 },
      },
    }),
    prisma.validator.findMany({
      include: {
        scores: { orderBy: { timestamp: "desc" }, take: 1 },
      },
    }),
    prisma.slo.findMany({ where: { isActive: true } }),
  ]);

  const state = {
    anomalies: unresolvedAnomalies.map((a) => ({
      type: a.type,
      severity: a.severity,
      entityType: a.entityType,
      entityId: a.entityId,
    })),
    endpoints: endpoints.map((ep) => ({
      id: ep.id,
      score: ep.scores[0]?.score ?? 0,
      uptime: ep.scores[0]?.uptime ?? 0,
      latency: ep.healthChecks[0]?.latencyMs ?? 0,
      isHealthy: ep.healthChecks[0]?.isHealthy ?? false,
    })),
    validators: validators.map((v) => ({
      id: v.id,
      score: v.scores[0]?.score ?? 0,
      jailed: v.jailed,
      missedBlocks: v.missedBlocks,
      commission: v.commission,
    })),
    slos: slos.map((s) => ({
      entityId: s.entityId,
      isBreaching: s.isBreaching,
      budgetConsumed: s.budgetConsumed ?? 0,
      currentValue: s.currentValue ?? 0,
    })),
  };

  const contexts = buildContextsFromState(state);

  if (contexts.length === 0) {
    return { evaluated: 0, triggered: 0, actionsExecuted: 0, rolledBack, duration: Date.now() - start };
  }

  // Step 2: Load active policies
  const policies = await prisma.policy.findMany({
    where: { isActive: true },
    orderBy: { priority: "asc" },
  });

  // Step 3: Evaluate each policy against each context
  for (const policy of policies) {
    evaluated++;

    const conditions: PolicyCondition[] = JSON.parse(policy.conditions);
    const actions: PolicyAction[] = JSON.parse(policy.actions);

    for (const { entityType, entityId, context } of contexts) {
      const { allMet, metConditions } = evaluateAllConditions(conditions, context);

      if (!allMet) continue;

      // Atomic cooldown check + lastTriggeredAt update
      const canTrigger = await prisma.$transaction(async (tx) => {
        const fresh = await tx.policy.findUnique({ where: { id: policy.id } });
        if (!fresh || !fresh.isActive) return false;
        if (fresh.lastTriggeredAt) {
          const cooldownMs = fresh.cooldownMinutes * 60_000;
          if (Date.now() - fresh.lastTriggeredAt.getTime() < cooldownMs) return false;
        }
        await tx.policy.update({
          where: { id: policy.id },
          data: { lastTriggeredAt: new Date() },
        });
        return true;
      });

      if (!canTrigger) continue;

      // Circuit breaker check
      if (!policy.dryRun) {
        const allowed = await canExecute(policy.workspaceId);
        if (!allowed) continue;
      }

      // Execute actions
      const results: ActionResult[] = [];
      for (const action of actions) {
        const result = await executeAction(action, {
          workspaceId: policy.workspaceId,
          policyId: policy.id,
          entityType,
          entityId,
          dryRun: policy.dryRun,
        });
        results.push(result);
        if (result.success && !policy.dryRun) actionsExecuted++;
      }

      // Record execution
      await prisma.policyExecution.create({
        data: {
          policyId: policy.id,
          triggerEntity: `${entityType}/${entityId}`,
          conditionsMet: JSON.stringify(metConditions),
          actionsTaken: JSON.stringify(actions),
          actionsResults: JSON.stringify(results),
          dryRun: policy.dryRun,
        },
      });

      // Publish event
      await publishEvent({
        channel: CHANNELS.POLICY,
        type: "policy.triggered",
        visibility: "workspace",
        workspaceId: policy.workspaceId,
        payload: {
          policyId: policy.id,
          policyName: policy.name,
          entityType,
          entityId,
          dryRun: policy.dryRun,
          conditionsMet: metConditions.length,
          actionsExecuted: results.filter((r) => r.success).length,
        },
      });

      triggered++;
      break; // One trigger per policy per evaluation cycle
    }
  }

  return {
    evaluated,
    triggered,
    actionsExecuted,
    rolledBack,
    duration: Date.now() - start,
  };
}
