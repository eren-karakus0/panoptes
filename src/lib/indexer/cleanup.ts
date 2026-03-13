import { prisma } from "@/lib/db";
import { RETENTION, OUTBOX_RETENTION, DELIVERY_RETENTION, SLO_RETENTION, INCIDENT_RETENTION } from "@/lib/constants";
import { IndexerError } from "@/lib/errors";

export async function cleanupOldData(): Promise<{
  deletedSnapshots: number;
  deletedHealthChecks: number;
  deletedStats: number;
  deletedScores: number;
  deletedValidatorScores: number;
  deletedAnomalies: number;
  deletedOutboxEvents: number;
  deletedDeliveries: number;
  deletedSloEvaluations: number;
  deletedIncidents: number;
  duration: number;
}> {
  const start = Date.now();

  try {
    const snapshotCutoff = new Date();
    snapshotCutoff.setDate(
      snapshotCutoff.getDate() - RETENTION.VALIDATOR_SNAPSHOTS,
    );

    const healthCutoff = new Date();
    healthCutoff.setDate(
      healthCutoff.getDate() - RETENTION.ENDPOINT_HEALTH,
    );

    const statsCutoff = new Date();
    statsCutoff.setDate(
      statsCutoff.getDate() - RETENTION.NETWORK_STATS,
    );

    const scoreCutoff = new Date(Date.now() - 7 * 86400000);
    const anomalyCutoff = new Date(Date.now() - 30 * 86400000);
    const outboxCutoff = new Date(Date.now() - OUTBOX_RETENTION.HOURS * 3600_000);
    const deliverySuccessCutoff = new Date(Date.now() - DELIVERY_RETENTION.SUCCESS_DAYS * 86400_000);
    const deliveryFailureCutoff = new Date(Date.now() - DELIVERY_RETENTION.FAILURE_DAYS * 86400_000);
    const sloEvalCutoff = new Date(Date.now() - SLO_RETENTION.EVALUATION_DAYS * 86400_000);
    const incidentCutoff = new Date(Date.now() - INCIDENT_RETENTION.RESOLVED_DAYS * 86400_000);

    const [snapshots, healthChecks, stats, scores, vScores, anomalies, outboxEvents, deliveriesSuccess, deliveriesFailure, sloEvaluations, incidents] = await prisma.$transaction([
      prisma.validatorSnapshot.deleteMany({
        where: { timestamp: { lt: snapshotCutoff } },
      }),
      prisma.endpointHealth.deleteMany({
        where: { timestamp: { lt: healthCutoff } },
      }),
      prisma.networkStats.deleteMany({
        where: { timestamp: { lt: statsCutoff } },
      }),
      prisma.endpointScore.deleteMany({
        where: { timestamp: { lt: scoreCutoff } },
      }),
      prisma.validatorScore.deleteMany({
        where: { timestamp: { lt: scoreCutoff } },
      }),
      prisma.anomaly.deleteMany({
        where: { resolved: true, resolvedAt: { lt: anomalyCutoff } },
      }),
      prisma.outboxEvent.deleteMany({
        where: { createdAt: { lt: outboxCutoff } },
      }),
      prisma.webhookDelivery.deleteMany({
        where: { success: true, createdAt: { lt: deliverySuccessCutoff } },
      }),
      prisma.webhookDelivery.deleteMany({
        where: { success: false, nextRetryAt: null, createdAt: { lt: deliveryFailureCutoff } },
      }),
      prisma.sloEvaluation.deleteMany({
        where: { evaluatedAt: { lt: sloEvalCutoff } },
      }),
      prisma.incident.deleteMany({
        where: { status: "resolved", resolvedAt: { lt: incidentCutoff } },
      }),
    ]);

    return {
      deletedSnapshots: snapshots.count,
      deletedHealthChecks: healthChecks.count,
      deletedStats: stats.count,
      deletedScores: scores.count,
      deletedValidatorScores: vScores.count,
      deletedAnomalies: anomalies.count,
      deletedOutboxEvents: outboxEvents.count,
      deletedDeliveries: deliveriesSuccess.count + deliveriesFailure.count,
      deletedSloEvaluations: sloEvaluations.count,
      deletedIncidents: incidents.count,
      duration: Date.now() - start,
    };
  } catch (error) {
    throw new IndexerError(
      `Failed to cleanup old data: ${error instanceof Error ? error.message : String(error)}`,
      "cleanup",
    );
  }
}
