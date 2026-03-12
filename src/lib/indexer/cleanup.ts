import { prisma } from "@/lib/db";
import { RETENTION, OUTBOX_RETENTION } from "@/lib/constants";
import { IndexerError } from "@/lib/errors";

export async function cleanupOldData(): Promise<{
  deletedSnapshots: number;
  deletedHealthChecks: number;
  deletedStats: number;
  deletedScores: number;
  deletedValidatorScores: number;
  deletedAnomalies: number;
  deletedOutboxEvents: number;
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

    const [snapshots, healthChecks, stats, scores, vScores, anomalies, outboxEvents] = await prisma.$transaction([
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
    ]);

    return {
      deletedSnapshots: snapshots.count,
      deletedHealthChecks: healthChecks.count,
      deletedStats: stats.count,
      deletedScores: scores.count,
      deletedValidatorScores: vScores.count,
      deletedAnomalies: anomalies.count,
      deletedOutboxEvents: outboxEvents.count,
      duration: Date.now() - start,
    };
  } catch (error) {
    throw new IndexerError(
      `Failed to cleanup old data: ${error instanceof Error ? error.message : String(error)}`,
      "cleanup",
    );
  }
}
