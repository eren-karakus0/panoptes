import { prisma } from "@/lib/db";
import { HEALTH_THRESHOLDS } from "@/lib/constants";
import { CHANNELS } from "@/lib/events/event-types";
import type { WebhookEventType } from "@/lib/constants";

export interface EvaluationResult {
  evaluated: number;
  breached: number;
  recovered: number;
  exhausted: number;
  skipped: number;
  duration: number;
}

function computeErrorBudget(
  sliValue: number,
  target: number,
): { consumed: number; remaining: number; burnRate: number } {
  const errorBudget = 1 - target;
  const actualErrors = 1 - sliValue;
  const consumed =
    errorBudget > 0
      ? actualErrors / errorBudget
      : actualErrors > 0
        ? Infinity
        : 0;
  const remaining = Math.max(0, 1 - consumed);
  const burnRate = consumed;
  return { consumed, remaining, burnRate };
}

async function computeUptimeSli(
  entityId: string,
  windowStart: Date,
): Promise<number | null> {
  const checks = await prisma.endpointHealth.findMany({
    where: { endpointId: entityId, timestamp: { gte: windowStart } },
    select: { isHealthy: true },
  });

  if (checks.length === 0) return null;

  const healthy = checks.filter((c) => c.isHealthy).length;
  return healthy / checks.length;
}

async function computeLatencySli(
  entityId: string,
  windowStart: Date,
): Promise<number | null> {
  const checks = await prisma.endpointHealth.findMany({
    where: { endpointId: entityId, timestamp: { gte: windowStart } },
    select: { isHealthy: true, latencyMs: true },
  });

  if (checks.length === 0) return null;

  const good = checks.filter(
    (c) => c.isHealthy && c.latencyMs < HEALTH_THRESHOLDS.LATENCY_HEALTHY_MS,
  ).length;
  return good / checks.length;
}

async function computeErrorRateSli(
  entityId: string,
  windowStart: Date,
): Promise<number | null> {
  return computeUptimeSli(entityId, windowStart);
}

async function computeBlockProductionSli(
  entityId: string,
  windowStart: Date,
): Promise<number | null> {
  const scores = await prisma.validatorScore.findMany({
    where: { validatorId: entityId, timestamp: { gte: windowStart } },
    select: { missedBlockRate: true },
  });

  if (scores.length === 0) return null;

  const avg =
    scores.reduce((sum, s) => sum + s.missedBlockRate, 0) / scores.length;
  return avg;
}

const SLI_COMPUTERS: Record<
  string,
  (entityId: string, windowStart: Date) => Promise<number | null>
> = {
  uptime: computeUptimeSli,
  latency: computeLatencySli,
  error_rate: computeErrorRateSli,
  block_production: computeBlockProductionSli,
};

export async function evaluateSlos(): Promise<EvaluationResult> {
  const start = Date.now();

  const slos = await prisma.slo.findMany({ where: { isActive: true } });

  let evaluated = 0;
  let breached = 0;
  let recovered = 0;
  let exhausted = 0;
  let skipped = 0;

  for (const slo of slos) {
    const windowStart = new Date(
      Date.now() - slo.windowDays * 24 * 60 * 60 * 1000,
    );

    const computer = SLI_COMPUTERS[slo.indicator];
    if (!computer) {
      skipped++;
      continue;
    }

    const sliValue = await computer(slo.entityId, windowStart);
    if (sliValue === null) {
      skipped++;
      continue;
    }

    const { consumed, remaining, burnRate } = computeErrorBudget(
      sliValue,
      slo.target,
    );
    const isBreaching = sliValue < slo.target;

    const wasBreaching = slo.isBreaching;
    const wasBudgetExhausted = (slo.budgetConsumed ?? 0) >= 1.0;
    const isBudgetExhausted = consumed >= 1.0;

    // Determine state transition events before transaction
    const pendingEvents: Array<{ type: WebhookEventType }> = [];

    if (!wasBreaching && isBreaching) {
      pendingEvents.push({ type: "slo.breached" });
    }
    if (!wasBudgetExhausted && isBudgetExhausted) {
      pendingEvents.push({ type: "slo.budget_exhausted" });
    }
    if (wasBreaching && !isBreaching) {
      pendingEvents.push({ type: "slo.recovered" });
    }

    const eventPayload = {
      sloId: slo.id,
      sloName: slo.name,
      indicator: slo.indicator,
      entityType: slo.entityType,
      entityId: slo.entityId,
      target: slo.target,
      currentValue: sliValue,
      budgetConsumed: consumed,
      burnRate,
    };

    // Atomic: evaluation snapshot + state update + outbox events in one transaction
    await prisma.$transaction(async (tx) => {
      await tx.sloEvaluation.create({
        data: {
          sloId: slo.id,
          sliValue,
          budgetConsumed: consumed,
          budgetRemaining: remaining,
          burnRate,
          isBreaching,
        },
      });

      await tx.slo.update({
        where: { id: slo.id },
        data: {
          currentValue: sliValue,
          budgetConsumed: consumed,
          burnRate,
          isBreaching,
          lastEvaluatedAt: new Date(),
        },
      });

      // Write outbox events inside the same transaction
      for (const event of pendingEvents) {
        await tx.outboxEvent.create({
          data: {
            channel: CHANNELS.SLO,
            type: event.type,
            visibility: "workspace",
            workspaceId: slo.workspaceId,
            payload: JSON.stringify(eventPayload),
          },
        });
      }
    });

    evaluated++;

    for (const event of pendingEvents) {
      if (event.type === "slo.breached") breached++;
      if (event.type === "slo.budget_exhausted") exhausted++;
      if (event.type === "slo.recovered") recovered++;
    }
  }

  return {
    evaluated,
    breached,
    recovered,
    exhausted,
    skipped,
    duration: Date.now() - start,
  };
}

export { computeErrorBudget };
