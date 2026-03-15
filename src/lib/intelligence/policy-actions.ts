import { prisma } from "@/lib/db";
import { REMEDIATION_DEFAULTS } from "@/lib/constants";
import { publishEvent } from "@/lib/events/publish";
import { CHANNELS } from "@/lib/events/event-types";
import type { PolicyAction } from "@/types";

export interface ActionResult {
  type: string;
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export async function canExecute(workspaceId: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 3600_000);
  const recentActions = await prisma.actionRecord.count({
    where: {
      workspaceId,
      appliedAt: { gte: oneHourAgo },
    },
  });
  return recentActions < REMEDIATION_DEFAULTS.MAX_ACTIONS_PER_HOUR;
}

export async function executeAction(
  action: PolicyAction,
  context: {
    workspaceId: string;
    policyId: string;
    entityType: string;
    entityId: string;
    dryRun: boolean;
  },
): Promise<ActionResult> {
  if (context.dryRun) {
    return {
      type: action.type,
      success: true,
      message: `[DRY RUN] Would execute ${action.type} on ${context.entityType}/${context.entityId}`,
    };
  }

  switch (action.type) {
    case "log":
      return executeLog(action, context);
    case "routing_exclude":
      return executeRoutingExclude(action, context);
    case "incident_create":
      return executeIncidentCreate(action, context);
    case "annotate":
      return executeAnnotate(action, context);
    case "webhook":
      return executeWebhookNotify(action, context);
    default:
      return { type: action.type, success: false, message: `Unknown action type: ${action.type}` };
  }
}

async function executeLog(
  action: PolicyAction,
  context: { entityType: string; entityId: string },
): Promise<ActionResult> {
  return {
    type: action.type,
    success: true,
    message: `Logged action for ${context.entityType}/${context.entityId}`,
  };
}

async function executeRoutingExclude(
  action: PolicyAction,
  context: {
    workspaceId: string;
    policyId: string;
    entityType: string;
    entityId: string;
  },
): Promise<ActionResult> {
  if (context.entityType !== "endpoint") {
    return {
      type: action.type,
      success: false,
      message: "routing_exclude only applies to endpoints",
    };
  }

  // Check minimum healthy endpoints
  const healthyCount = await prisma.endpoint.count({
    where: { isActive: true },
  });

  // Count already excluded
  const excludedCount = await prisma.actionRecord.count({
    where: {
      actionType: "routing_exclude",
      rolledBackAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  const effectiveHealthy = healthyCount - excludedCount;
  if (effectiveHealthy <= REMEDIATION_DEFAULTS.MIN_HEALTHY_ENDPOINTS) {
    return {
      type: action.type,
      success: false,
      message: `Cannot exclude: only ${effectiveHealthy} healthy endpoints remaining (min: ${REMEDIATION_DEFAULTS.MIN_HEALTHY_ENDPOINTS})`,
    };
  }

  const expiresAt = new Date(
    Date.now() + REMEDIATION_DEFAULTS.DEFAULT_EXPIRY_HOURS * 3600_000,
  );

  await prisma.actionRecord.create({
    data: {
      workspaceId: context.workspaceId,
      policyId: context.policyId,
      actionType: "routing_exclude",
      entityType: context.entityType,
      entityId: context.entityId,
      expiresAt,
      rollbackData: JSON.stringify({ action: "include_endpoint" }),
    },
  });

  return {
    type: action.type,
    success: true,
    message: `Excluded endpoint ${context.entityId} from routing until ${expiresAt.toISOString()}`,
    data: { expiresAt: expiresAt.toISOString() },
  };
}

async function executeIncidentCreate(
  _action: PolicyAction,
  context: {
    workspaceId: string;
    entityType: string;
    entityId: string;
  },
): Promise<ActionResult> {
  const existing = await prisma.incident.findFirst({
    where: {
      workspaceId: context.workspaceId,
      entityType: context.entityType,
      entityId: context.entityId,
      status: { in: ["open", "acknowledged"] },
    },
  });

  if (existing) {
    return {
      type: "incident_create",
      success: true,
      message: `Incident already exists: ${existing.id}`,
      data: { incidentId: existing.id },
    };
  }

  const incident = await prisma.$transaction(async (tx) => {
    const inc = await tx.incident.create({
      data: {
        workspaceId: context.workspaceId,
        entityType: context.entityType,
        entityId: context.entityId,
        severity: "medium",
        title: `Policy-triggered incident for ${context.entityType}/${context.entityId}`,
        description: `Automatically created by policy engine`,
      },
    });

    await tx.incidentEvent.create({
      data: {
        incidentId: inc.id,
        eventType: "created",
        message: "Incident created by policy engine",
        metadata: JSON.stringify({ policyTriggered: true }),
      },
    });

    await tx.outboxEvent.create({
      data: {
        channel: CHANNELS.INCIDENT,
        type: "incident.created",
        visibility: "workspace",
        workspaceId: context.workspaceId,
        payload: JSON.stringify({
          incidentId: inc.id,
          entityType: context.entityType,
          entityId: context.entityId,
          severity: "medium",
          title: inc.title,
          policyTriggered: true,
        }),
      },
    });

    return inc;
  });

  return {
    type: "incident_create",
    success: true,
    message: `Created incident ${incident.id}`,
    data: { incidentId: incident.id },
  };
}

async function executeAnnotate(
  action: PolicyAction,
  context: { entityType: string; entityId: string },
): Promise<ActionResult> {
  const note = (action.config?.note as string) || "Policy annotation";

  // Update most recent unresolved anomaly for this entity
  const anomaly = await prisma.anomaly.findFirst({
    where: {
      entityId: context.entityId,
      resolved: false,
    },
    orderBy: { detectedAt: "desc" },
  });

  if (!anomaly) {
    return {
      type: action.type,
      success: false,
      message: `No unresolved anomaly found for ${context.entityType}/${context.entityId}`,
    };
  }

  const existing = anomaly.metadata ? JSON.parse(anomaly.metadata) : {};
  const annotations = existing.annotations || [];
  annotations.push({ note, timestamp: new Date().toISOString() });

  await prisma.anomaly.update({
    where: { id: anomaly.id },
    data: {
      metadata: JSON.stringify({ ...existing, annotations }),
    },
  });

  return {
    type: action.type,
    success: true,
    message: `Annotated anomaly ${anomaly.id}`,
    data: { anomalyId: anomaly.id },
  };
}

async function executeWebhookNotify(
  action: PolicyAction,
  context: {
    workspaceId: string;
    entityType: string;
    entityId: string;
    policyId: string;
  },
): Promise<ActionResult> {
  await publishEvent({
    channel: CHANNELS.POLICY,
    type: "policy.action_executed",
    visibility: "workspace",
    workspaceId: context.workspaceId,
    payload: {
      policyId: context.policyId,
      actionType: "webhook",
      entityType: context.entityType,
      entityId: context.entityId,
    },
  });

  return {
    type: action.type,
    success: true,
    message: `Webhook event published for policy ${context.policyId}`,
  };
}

export async function rollbackExpired(): Promise<number> {
  const now = new Date();
  const result = await prisma.actionRecord.updateMany({
    where: {
      expiresAt: { lte: now },
      rolledBackAt: null,
    },
    data: { rolledBackAt: now },
  });
  return result.count;
}
