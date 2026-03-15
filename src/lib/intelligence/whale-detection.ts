import { prisma } from "@/lib/db";
import { ANOMALY_THRESHOLDS } from "@/lib/constants";
import type { AnomalySeverity } from "@/types";
import { createOrSkipAnomaly } from "./anomaly";

interface WhaleResult {
  detected: number;
}

export async function detectWhaleMovement(): Promise<WhaleResult> {
  let detected = 0;

  // Get recent delegation events (last 15 minutes)
  const recentCutoff = new Date(Date.now() - 15 * 60_000);
  const recentEvents = await prisma.delegationEvent.findMany({
    where: { timestamp: { gte: recentCutoff } },
  });

  if (recentEvents.length === 0) return { detected: 0 };

  // Get total supply from latest network stats
  const latestStats = await prisma.networkStats.findFirst({
    orderBy: { timestamp: "desc" },
  });

  if (!latestStats) return { detected: 0 };

  const totalStaked = BigInt(latestStats.totalStaked);
  if (totalStaked === 0n) return { detected: 0 };

  // Group events by delegator to sum their movements
  const delegatorMovements = new Map<string, bigint>();

  for (const event of recentEvents) {
    const amount = BigInt(event.amount);
    const current = delegatorMovements.get(event.delegator) ?? 0n;
    delegatorMovements.set(event.delegator, current + amount);
  }

  // Check for whale movements
  for (const [delegator, totalMovement] of delegatorMovements) {
    const movementPct = Number((totalMovement * 10000n) / totalStaked) / 100;

    if (movementPct < ANOMALY_THRESHOLDS.WHALE_MOVEMENT_PCT) continue;

    const severity: AnomalySeverity = movementPct >= ANOMALY_THRESHOLDS.WHALE_CRITICAL_PCT ? "critical" : "high";

    const created = await createOrSkipAnomaly({
      type: "whale_movement",
      severity,
      entityType: "network",
      entityId: delegator,
      title: `Whale movement: ${movementPct.toFixed(2)}% of stake`,
      description: `Delegator ${delegator} moved ${movementPct.toFixed(2)}% of total staked supply.`,
      metadata: {
        delegator,
        movementPct,
        totalMovement: totalMovement.toString(),
      },
    });

    if (created) detected++;
  }

  return { detected };
}
