import { prisma } from "@/lib/db";
import { REMEDIATION_DEFAULTS } from "@/lib/constants";

export interface RemediationStatus {
  actionsLastHour: number;
  maxAllowed: number;
  canExecute: boolean;
  activeExclusions: number;
}

export async function getRemediationStatus(workspaceId: string): Promise<RemediationStatus> {
  const oneHourAgo = new Date(Date.now() - 3600_000);
  const now = new Date();

  const [actionsLastHour, activeExclusions] = await Promise.all([
    prisma.actionRecord.count({
      where: { workspaceId, appliedAt: { gte: oneHourAgo } },
    }),
    prisma.actionRecord.count({
      where: {
        actionType: "routing_exclude",
        rolledBackAt: null,
        expiresAt: { gt: now },
      },
    }),
  ]);

  return {
    actionsLastHour,
    maxAllowed: REMEDIATION_DEFAULTS.MAX_ACTIONS_PER_HOUR,
    canExecute: actionsLastHour < REMEDIATION_DEFAULTS.MAX_ACTIONS_PER_HOUR,
    activeExclusions,
  };
}

export async function getActiveExcludedEndpointIds(): Promise<string[]> {
  const now = new Date();
  const records = await prisma.actionRecord.findMany({
    where: {
      actionType: "routing_exclude",
      entityType: "endpoint",
      rolledBackAt: null,
      expiresAt: { gt: now },
    },
    select: { entityId: true },
  });

  return records.map((r) => r.entityId);
}
