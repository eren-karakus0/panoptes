import { prisma } from "@/lib/db";
import { RETENTION } from "@/lib/constants";
import { IndexerError } from "@/lib/errors";

export async function cleanupOldData(): Promise<{
  deletedSnapshots: number;
  deletedHealthChecks: number;
  deletedStats: number;
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

    const [snapshots, healthChecks, stats] = await prisma.$transaction([
      prisma.validatorSnapshot.deleteMany({
        where: { timestamp: { lt: snapshotCutoff } },
      }),
      prisma.endpointHealth.deleteMany({
        where: { timestamp: { lt: healthCutoff } },
      }),
      prisma.networkStats.deleteMany({
        where: { timestamp: { lt: statsCutoff } },
      }),
    ]);

    return {
      deletedSnapshots: snapshots.count,
      deletedHealthChecks: healthChecks.count,
      deletedStats: stats.count,
      duration: Date.now() - start,
    };
  } catch (error) {
    throw new IndexerError(
      `Failed to cleanup old data: ${error instanceof Error ? error.message : String(error)}`,
      "cleanup",
    );
  }
}
