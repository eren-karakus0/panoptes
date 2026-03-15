import { prisma } from "@/lib/db";
import { SCORING, HEALTH_THRESHOLDS } from "@/lib/constants";
import { computeGovernanceWeight } from "./governance-scoring";

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getEmaScore(raw: number, prevScore: number | null, alpha: number): number {
  if (prevScore === null) return raw;
  return alpha * raw + (1 - alpha) * prevScore;
}

export async function computeEndpointScores(): Promise<{ scored: number; duration: number }> {
  const start = Date.now();
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const endpoints = await prisma.endpoint.findMany({
    where: { isActive: true },
    include: {
      healthChecks: {
        where: { timestamp: { gte: twentyFourHoursAgo } },
        orderBy: { timestamp: "desc" },
      },
      scores: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
  });

  // Get the max block height across all endpoints for freshness calculation
  const maxBlockHeight = endpoints.reduce((max, ep) => {
    for (const check of ep.healthChecks) {
      if (check.blockHeight && check.blockHeight > max) {
        return check.blockHeight;
      }
    }
    return max;
  }, 0n);

  let scored = 0;

  for (const ep of endpoints) {
    const checks = ep.healthChecks;
    const totalChecks = checks.length;

    if (totalChecks === 0) {
      await prisma.endpointScore.create({
        data: {
          endpointId: ep.id,
          score: 0,
          uptime: 0,
          latency: 0,
          freshness: 0,
          errorRate: 0,
        },
      });
      scored++;
      continue;
    }

    const healthyChecks = checks.filter((c) => c.isHealthy);
    const healthyCount = healthyChecks.length;

    // Uptime: healthy / total
    const uptime = healthyCount / totalChecks;

    // Latency: normalized (lower is better)
    const avgLatency =
      healthyCount > 0
        ? healthyChecks.reduce((sum, c) => sum + c.latencyMs, 0) / healthyCount
        : SCORING.LATENCY_MAX_MS;
    const latency = 1 - clamp(
      (avgLatency - SCORING.LATENCY_BASELINE_MS) / (SCORING.LATENCY_MAX_MS - SCORING.LATENCY_BASELINE_MS),
      0,
      1,
    );

    // Freshness: how close to max block height
    let freshness = 1;
    const latestBlock = checks.find((c) => c.blockHeight !== null)?.blockHeight;
    if (latestBlock !== null && latestBlock !== undefined && maxBlockHeight > 0n) {
      const blocksBehind = Number(maxBlockHeight - latestBlock);
      freshness = 1 - clamp(blocksBehind / HEALTH_THRESHOLDS.BLOCK_HEIGHT_STALE, 0, 1);
    }

    // Error rate: lower errors = higher score
    const errorCount = totalChecks - healthyCount;
    const errorRate = 1 - (errorCount / totalChecks);

    // Composite score
    const w = SCORING.ENDPOINT_WEIGHTS;
    const rawScore = (uptime * w.uptime + latency * w.latency + freshness * w.freshness + errorRate * w.errorRate) * 100;

    // EMA smoothing
    const prevScore = ep.scores[0]?.score ?? null;
    const score = getEmaScore(rawScore, prevScore, SCORING.EMA_ALPHA);

    await prisma.endpointScore.create({
      data: {
        endpointId: ep.id,
        score,
        uptime,
        latency,
        freshness,
        errorRate,
      },
    });
    scored++;
  }

  return { scored, duration: Date.now() - start };
}

export async function computeValidatorScores(): Promise<{ scored: number; duration: number }> {
  const start = Date.now();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const validators = await prisma.validator.findMany({
    include: {
      snapshots: {
        where: { timestamp: { gte: sevenDaysAgo } },
        orderBy: { timestamp: "desc" },
        take: 7,
      },
      scores: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
  });

  let scored = 0;

  for (const val of validators) {
    // Missed block rate: fewer missed = higher score
    const missedBlockRate = 1 - clamp(val.missedBlocks / 1000, 0, 1);

    // Jail penalty
    let jailPenalty = val.jailCount === 0 ? 1 : Math.max(0, 1 - val.jailCount * 0.25);
    if (val.lastJailedAt) {
      const daysSinceJail = (Date.now() - val.lastJailedAt.getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceJail < 7) {
        jailPenalty = Math.max(0, jailPenalty - 0.25);
      }
    }

    // Stake stability: low variance of token changes = high score
    // Uses BigInt arithmetic to avoid precision loss with 18-decimal tokens
    let stakeStability = 1;
    if (val.snapshots.length >= 2) {
      const tokenValues = val.snapshots.map((s) => BigInt(s.tokens));
      const changes: number[] = [];
      for (let i = 0; i < tokenValues.length - 1; i++) {
        if (tokenValues[i + 1] !== 0n) {
          // Calculate percentage change using BigInt: |a-b| * 10000 / b, then convert to ratio
          const diff = tokenValues[i] > tokenValues[i + 1]
            ? tokenValues[i] - tokenValues[i + 1]
            : tokenValues[i + 1] - tokenValues[i];
          const pctBps = (diff * 10000n) / tokenValues[i + 1]; // basis points
          changes.push(Number(pctBps) / 10000);
        }
      }
      if (changes.length > 0) {
        const mean = changes.reduce((a, b) => a + b, 0) / changes.length;
        const variance = changes.reduce((sum, c) => sum + (c - mean) ** 2, 0) / changes.length;
        stakeStability = 1 - clamp(variance * 100, 0, 1);
      }
    }

    // Commission score: lower commission = higher score
    const commissionScore = 1 - clamp(val.commission / 0.20, 0, 1);

    // Governance score: participation in governance proposals
    let governanceScore = 0;
    try {
      const totalProposals = await prisma.governanceProposal.count({
        where: {
          status: {
            in: [
              "PROPOSAL_STATUS_PASSED",
              "PROPOSAL_STATUS_REJECTED",
              "PROPOSAL_STATUS_FAILED",
              "PROPOSAL_STATUS_VOTING_PERIOD",
            ],
          },
        },
      });
      if (totalProposals > 0) {
        const votesCount = await prisma.governanceVote.count({
          where: { voter: val.id },
        });
        governanceScore = computeGovernanceWeight(votesCount / totalProposals);
      }
    } catch {
      // Non-fatal: if governance tables don't exist or have issues, skip
    }

    // Composite score
    const w = SCORING.VALIDATOR_WEIGHTS;
    const rawScore = (
      missedBlockRate * w.missedBlockRate +
      jailPenalty * w.jailPenalty +
      stakeStability * w.stakeStability +
      commissionScore * w.commissionScore +
      governanceScore * w.governanceScore
    ) * 100;

    // EMA smoothing
    const prevScore = val.scores[0]?.score ?? null;
    const score = getEmaScore(rawScore, prevScore, SCORING.EMA_ALPHA);

    await prisma.validatorScore.create({
      data: {
        validatorId: val.id,
        score,
        missedBlockRate,
        jailPenalty,
        stakeStability,
        commissionScore,
        governanceScore,
      },
    });
    scored++;
  }

  return { scored, duration: Date.now() - start };
}

export { clamp, getEmaScore };
