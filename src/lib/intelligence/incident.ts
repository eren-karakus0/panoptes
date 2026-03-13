import { prisma } from "@/lib/db";
import { INCIDENT_DEFAULTS } from "@/lib/constants";
import { CHANNELS } from "@/lib/events/event-types";

export interface CorrelationResult {
  created: number;
  linked: number;
  resolved: number;
  duration: number;
}

function computeSeverity(currentValue: number | null, target: number): string {
  const sliRatio = (currentValue ?? 0) / target;
  if (sliRatio < 0.95) return "critical";
  if (sliRatio < 0.98) return "high";
  return "medium";
}

async function findOrCreateIncident(
  workspaceId: string,
  entityType: string,
  entityId: string,
  severity: string,
  title: string,
  description: string,
  linkType: "slo_linked" | "anomaly_linked",
  linkMessage: string,
  counters: { created: number; linked: number },
): Promise<void> {
  const correlationCutoff = new Date(
    Date.now() - INCIDENT_DEFAULTS.CORRELATION_WINDOW_HOURS * 3600_000,
  );

  const existing = await prisma.incident.findFirst({
    where: {
      workspaceId,
      entityType,
      entityId,
      status: { in: ["open", "acknowledged"] },
      detectedAt: { gte: correlationCutoff },
    },
    orderBy: { detectedAt: "desc" },
  });

  if (existing) {
    await prisma.incidentEvent.create({
      data: {
        incidentId: existing.id,
        eventType: linkType,
        message: linkMessage,
      },
    });
    counters.linked++;
    return;
  }

  await prisma.$transaction(async (tx) => {
    const incident = await tx.incident.create({
      data: {
        workspaceId,
        entityType,
        entityId,
        severity,
        title,
        description,
      },
    });

    await tx.incidentEvent.create({
      data: {
        incidentId: incident.id,
        eventType: "created",
        message: title,
      },
    });

    await tx.incidentEvent.create({
      data: {
        incidentId: incident.id,
        eventType: linkType,
        message: linkMessage,
      },
    });

    await tx.outboxEvent.create({
      data: {
        channel: CHANNELS.INCIDENT,
        type: "incident.created",
        visibility: "workspace",
        workspaceId,
        payload: JSON.stringify({
          incidentId: incident.id,
          entityType,
          entityId,
          severity,
          title,
        }),
      },
    });
  });

  counters.created++;
}

export async function correlateIncidents(): Promise<CorrelationResult> {
  const start = Date.now();
  const counters = { created: 0, linked: 0, resolved: 0 };

  const recentCutoff = new Date(Date.now() - 15 * 60_000);

  // Step 1: SLO breach → incident
  const breachingSlos = await prisma.slo.findMany({
    where: {
      isActive: true,
      isBreaching: true,
      lastEvaluatedAt: { gte: recentCutoff },
    },
  });

  for (const slo of breachingSlos) {
    const severity = computeSeverity(slo.currentValue, slo.target);
    await findOrCreateIncident(
      slo.workspaceId,
      slo.entityType,
      slo.entityId,
      severity,
      `SLO breach: ${slo.name}`,
      `SLO "${slo.name}" (${slo.indicator}) is breaching — current: ${slo.currentValue?.toFixed(4) ?? "N/A"}, target: ${slo.target}`,
      "slo_linked",
      `SLO "${slo.name}" breach detected (value: ${slo.currentValue?.toFixed(4) ?? "N/A"}, target: ${slo.target})`,
      counters,
    );
  }

  // Step 2: Anomaly → incident (only for entities with workspace SLOs)
  const unresolvedAnomalies = await prisma.anomaly.findMany({
    where: {
      resolved: false,
      detectedAt: { gte: recentCutoff },
      entityId: { not: null },
    },
  });

  for (const anomaly of unresolvedAnomalies) {
    if (!anomaly.entityId) continue;

    const workspaceSlos = await prisma.slo.findMany({
      where: {
        isActive: true,
        entityId: anomaly.entityId,
      },
      select: { workspaceId: true, entityType: true },
      distinct: ["workspaceId"],
    });

    for (const slo of workspaceSlos) {
      await findOrCreateIncident(
        slo.workspaceId,
        slo.entityType,
        anomaly.entityId,
        anomaly.severity,
        `Anomaly: ${anomaly.title}`,
        anomaly.description,
        "anomaly_linked",
        `Anomaly "${anomaly.title}" (${anomaly.type}) linked`,
        counters,
      );
    }
  }

  // Step 3: Auto-resolve
  const recoveredSlos = await prisma.slo.findMany({
    where: {
      isActive: true,
      isBreaching: false,
      lastEvaluatedAt: { gte: recentCutoff },
    },
  });

  const entityWorkspaceMap = new Map<string, Set<string>>();
  for (const slo of recoveredSlos) {
    const key = `${slo.workspaceId}:${slo.entityType}:${slo.entityId}`;
    if (!entityWorkspaceMap.has(key)) {
      entityWorkspaceMap.set(key, new Set());
    }
  }

  for (const key of entityWorkspaceMap.keys()) {
    const [workspaceId, entityType, entityId] = key.split(":");

    const stillBreaching = await prisma.slo.count({
      where: {
        workspaceId,
        entityType,
        entityId,
        isActive: true,
        isBreaching: true,
      },
    });

    if (stillBreaching > 0) continue;

    // Don't auto-resolve if entity still has unresolved anomalies
    const unresolvedEntityAnomalies = await prisma.anomaly.count({
      where: {
        entityId,
        resolved: false,
      },
    });

    if (unresolvedEntityAnomalies > 0) continue;

    const openIncidents = await prisma.incident.findMany({
      where: {
        workspaceId,
        entityType,
        entityId,
        status: { in: ["open", "acknowledged"] },
      },
    });

    for (const incident of openIncidents) {
      await prisma.$transaction(async (tx) => {
        await tx.incident.update({
          where: { id: incident.id },
          data: { status: "resolved", resolvedAt: new Date() },
        });

        await tx.incidentEvent.create({
          data: {
            incidentId: incident.id,
            eventType: "resolved",
            message: "All SLOs recovered — incident auto-resolved",
            metadata: JSON.stringify({ autoResolved: true }),
          },
        });

        await tx.outboxEvent.create({
          data: {
            channel: CHANNELS.INCIDENT,
            type: "incident.resolved",
            visibility: "workspace",
            workspaceId,
            payload: JSON.stringify({
              incidentId: incident.id,
              entityType,
              entityId,
              autoResolved: true,
            }),
          },
        });
      });

      counters.resolved++;
    }
  }

  return {
    created: counters.created,
    linked: counters.linked,
    resolved: counters.resolved,
    duration: Date.now() - start,
  };
}
