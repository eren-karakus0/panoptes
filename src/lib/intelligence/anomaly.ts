import { prisma } from "@/lib/db";
import { ANOMALY_THRESHOLDS } from "@/lib/constants";
import type { AnomalySeverity } from "@/types";
import { publishEvents } from "@/lib/events/publish";
import {
  CHANNELS,
  ANOMALY_CREATE_EVENT_MAP,
  ANOMALY_RESOLVE_EVENT_MAP,
} from "@/lib/events/event-types";

interface DetectionResult {
  detected: number;
  resolved: number;
}

async function createOrSkipAnomaly(params: {
  type: string;
  severity: AnomalySeverity;
  entityType: string;
  entityId: string | null;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  // Check for existing unresolved anomaly of same type+entity
  const existing = await prisma.anomaly.findFirst({
    where: {
      type: params.type,
      entityId: params.entityId,
      resolved: false,
    },
  });

  if (existing) return false; // duplicate prevention

  await prisma.anomaly.create({
    data: {
      type: params.type,
      severity: params.severity,
      entityType: params.entityType,
      entityId: params.entityId,
      title: params.title,
      description: params.description,
      metadata: params.metadata ? JSON.stringify(params.metadata) : null,
    },
  });

  const eventTypes = ANOMALY_CREATE_EVENT_MAP[params.type] ?? ["anomaly.created"];
  await publishEvents(
    eventTypes.map((type) => ({
      channel: CHANNELS.ANOMALY,
      type,
      payload: {
        anomalyType: params.type,
        severity: params.severity,
        entityType: params.entityType,
        entityId: params.entityId,
        title: params.title,
        description: params.description,
        metadata: params.metadata ?? null,
      },
    })),
  );

  return true;
}

async function resolveAnomalies(type: string, entityId: string | null): Promise<number> {
  const result = await prisma.anomaly.updateMany({
    where: {
      type,
      entityId,
      resolved: false,
    },
    data: {
      resolved: true,
      resolvedAt: new Date(),
    },
  });

  if (result.count > 0) {
    const eventTypes = ANOMALY_RESOLVE_EVENT_MAP[type] ?? ["anomaly.resolved"];
    await publishEvents(
      eventTypes.map((evType) => ({
        channel: CHANNELS.ANOMALY,
        type: evType,
        payload: { anomalyType: type, entityId, resolvedCount: result.count },
      })),
    );
  }

  return result.count;
}

async function detectJailing(): Promise<DetectionResult> {
  let detected = 0;
  let resolved = 0;

  // Find validators that have recent snapshots showing jailed transition
  const validators = await prisma.validator.findMany({
    include: {
      snapshots: {
        orderBy: { timestamp: "desc" },
        take: 2,
      },
    },
  });

  for (const val of validators) {
    if (val.snapshots.length < 2) continue;

    const current = val.snapshots[0];
    const previous = val.snapshots[1];

    if (current.jailed && !previous.jailed) {
      // Transition: not jailed -> jailed
      const created = await createOrSkipAnomaly({
        type: "jailing",
        severity: "high",
        entityType: "validator",
        entityId: val.id,
        title: `Validator ${val.moniker} jailed`,
        description: `Validator ${val.moniker} (${val.id}) has been jailed.`,
        metadata: { moniker: val.moniker, tokens: val.tokens },
      });
      if (created) detected++;
    } else if (!current.jailed && val.jailed === false) {
      // Resolved: was jailed, now not
      resolved += await resolveAnomalies("jailing", val.id);
    }
  }

  return { detected, resolved };
}

async function detectLargeStakeChange(): Promise<DetectionResult> {
  let detected = 0;
  let resolved = 0;

  const validators = await prisma.validator.findMany({
    include: {
      snapshots: {
        orderBy: { timestamp: "desc" },
        take: 2,
      },
    },
  });

  for (const val of validators) {
    if (val.snapshots.length < 2) continue;

    const currentTokens = BigInt(val.snapshots[0].tokens);
    const previousTokens = BigInt(val.snapshots[1].tokens);

    if (previousTokens === 0n) continue;

    const changePct = Number(
      ((currentTokens - previousTokens) * 10000n) / previousTokens,
    ) / 100;
    const absChangePct = Math.abs(changePct);

    if (absChangePct > ANOMALY_THRESHOLDS.LARGE_STAKE_CHANGE_PCT) {
      const severity: AnomalySeverity = absChangePct > 30 ? "critical" : "high";
      const direction = changePct > 0 ? "increased" : "decreased";

      const created = await createOrSkipAnomaly({
        type: "large_stake_change",
        severity,
        entityType: "validator",
        entityId: val.id,
        title: `${val.moniker}: stake ${direction} by ${absChangePct.toFixed(1)}%`,
        description: `Validator ${val.moniker} stake ${direction} by ${absChangePct.toFixed(1)}% (${previousTokens} → ${currentTokens}).`,
        metadata: { moniker: val.moniker, changePct, previousTokens: previousTokens.toString(), currentTokens: currentTokens.toString() },
      });
      if (created) detected++;
    } else {
      // Condition cleared
      resolved += await resolveAnomalies("large_stake_change", val.id);
    }
  }

  return { detected, resolved };
}

async function detectCommissionSpike(): Promise<DetectionResult> {
  let detected = 0;
  let resolved = 0;

  const validators = await prisma.validator.findMany({
    include: {
      snapshots: {
        orderBy: { timestamp: "desc" },
        take: 2,
      },
    },
  });

  for (const val of validators) {
    if (val.snapshots.length < 2) continue;

    const currentComm = val.snapshots[0].commission;
    const previousComm = val.snapshots[1].commission;
    const changePct = Math.abs(currentComm - previousComm) * 100;

    if (changePct > ANOMALY_THRESHOLDS.COMMISSION_SPIKE_PCT) {
      const created = await createOrSkipAnomaly({
        type: "commission_spike",
        severity: "medium",
        entityType: "validator",
        entityId: val.id,
        title: `${val.moniker}: commission changed by ${changePct.toFixed(1)}%`,
        description: `Validator ${val.moniker} commission changed from ${(previousComm * 100).toFixed(1)}% to ${(currentComm * 100).toFixed(1)}%.`,
        metadata: { moniker: val.moniker, previousComm, currentComm },
      });
      if (created) detected++;
    } else {
      resolved += await resolveAnomalies("commission_spike", val.id);
    }
  }

  return { detected, resolved };
}

async function detectEndpointDown(): Promise<DetectionResult> {
  let detected = 0;
  let resolved = 0;

  const endpoints = await prisma.endpoint.findMany({
    where: { isActive: true },
    include: {
      healthChecks: {
        orderBy: { timestamp: "desc" },
        take: ANOMALY_THRESHOLDS.ENDPOINT_DOWN_CONSECUTIVE,
      },
    },
  });

  for (const ep of endpoints) {
    const checks = ep.healthChecks;

    if (checks.length < ANOMALY_THRESHOLDS.ENDPOINT_DOWN_CONSECUTIVE) continue;

    const allDown = checks.every((c) => !c.isHealthy);

    if (allDown) {
      const severity: AnomalySeverity = ep.isOfficial ? "critical" : "high";
      const created = await createOrSkipAnomaly({
        type: "endpoint_down",
        severity,
        entityType: "endpoint",
        entityId: ep.id,
        title: `Endpoint ${ep.url} is down`,
        description: `Endpoint ${ep.url} (${ep.type}) has ${ANOMALY_THRESHOLDS.ENDPOINT_DOWN_CONSECUTIVE}+ consecutive failures.`,
        metadata: { url: ep.url, type: ep.type, isOfficial: ep.isOfficial },
      });
      if (created) detected++;
    } else {
      resolved += await resolveAnomalies("endpoint_down", ep.id);
    }
  }

  return { detected, resolved };
}

async function detectBlockStale(): Promise<DetectionResult> {
  let detected = 0;
  let resolved = 0;

  const endpoints = await prisma.endpoint.findMany({
    where: { isActive: true },
    include: {
      healthChecks: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
  });

  // Get max block height across all endpoints
  const maxBlockHeight = endpoints.reduce((max, ep) => {
    const block = ep.healthChecks[0]?.blockHeight;
    return block && block > max ? block : max;
  }, 0n);

  if (maxBlockHeight === 0n) return { detected: 0, resolved: 0 };

  for (const ep of endpoints) {
    const latestBlock = ep.healthChecks[0]?.blockHeight;
    if (!latestBlock) continue;

    const blocksBehind = Number(maxBlockHeight - latestBlock);

    if (blocksBehind >= ANOMALY_THRESHOLDS.BLOCK_STALE_BEHIND) {
      const created = await createOrSkipAnomaly({
        type: "block_stale",
        severity: "medium",
        entityType: "endpoint",
        entityId: ep.id,
        title: `Endpoint ${ep.url} is ${blocksBehind} blocks behind`,
        description: `Endpoint ${ep.url} block height is ${blocksBehind} blocks behind the network (${latestBlock} vs ${maxBlockHeight}).`,
        metadata: { url: ep.url, blocksBehind, latestBlock: latestBlock.toString(), maxBlockHeight: maxBlockHeight.toString() },
      });
      if (created) detected++;
    } else {
      resolved += await resolveAnomalies("block_stale", ep.id);
    }
  }

  return { detected, resolved };
}

async function detectMassUnbonding(): Promise<DetectionResult> {
  let detected = 0;
  let resolved = 0;

  // Use current validator state instead of snapshots to avoid duplicates/gaps
  const totalResult: Array<{ total: string }> = await prisma.$queryRaw`
    SELECT COALESCE(SUM(CAST(tokens AS NUMERIC)), 0)::TEXT as total
    FROM "Validator"
  `;
  const totalTokens = BigInt(totalResult[0]?.total ?? "0");

  if (totalTokens === 0n) return { detected: 0, resolved: 0 };

  // Sum tokens of validators currently in UNBONDING state (deduplicated by design)
  const unbondingResult: Array<{ total: string }> = await prisma.$queryRaw`
    SELECT COALESCE(SUM(CAST(tokens AS NUMERIC)), 0)::TEXT as total
    FROM "Validator"
    WHERE status = 'BOND_STATUS_UNBONDING'
  `;
  const unbondingTokens = BigInt(unbondingResult[0]?.total ?? "0");

  const unbondingPct = Number((unbondingTokens * 10000n) / totalTokens) / 100;

  if (unbondingPct > ANOMALY_THRESHOLDS.MASS_UNBONDING_PCT) {
    const created = await createOrSkipAnomaly({
      type: "mass_unbonding",
      severity: "critical",
      entityType: "network",
      entityId: null,
      title: `Mass unbonding detected: ${unbondingPct.toFixed(1)}% of stake`,
      description: `${unbondingPct.toFixed(1)}% of total stake is currently unbonding (threshold: ${ANOMALY_THRESHOLDS.MASS_UNBONDING_PCT}%).`,
      metadata: { unbondingPct, unbondingTokens: unbondingTokens.toString(), totalTokens: totalTokens.toString() },
    });
    if (created) detected++;
  } else {
    resolved += await resolveAnomalies("mass_unbonding", null);
  }

  return { detected, resolved };
}

export async function detectAnomalies(): Promise<{ detected: number; resolved: number; duration: number }> {
  const start = Date.now();

  const results = await Promise.all([
    detectJailing(),
    detectLargeStakeChange(),
    detectCommissionSpike(),
    detectEndpointDown(),
    detectBlockStale(),
    detectMassUnbonding(),
  ]);

  const detected = results.reduce((sum, r) => sum + r.detected, 0);
  const resolved = results.reduce((sum, r) => sum + r.resolved, 0);

  return { detected, resolved, duration: Date.now() - start };
}

export {
  detectJailing,
  detectLargeStakeChange,
  detectCommissionSpike,
  detectEndpointDown,
  detectBlockStale,
  detectMassUnbonding,
};
