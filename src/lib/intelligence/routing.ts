import { prisma } from "@/lib/db";
import { serializeBigInt } from "@/lib/api-helpers";
import type { EndpointItem, EndpointScoreItem } from "@/types";
import { getActiveExcludedEndpointIds } from "./remediation";

type ScoredEndpoint = EndpointItem & { score: EndpointScoreItem | null };

function weightedRandomSelect(endpoints: ScoredEndpoint[]): ScoredEndpoint {
  const weights = endpoints.map((e) => (e.score?.score ?? 0) ** 2);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight === 0) return endpoints[0];

  let random = Math.random() * totalWeight;
  for (let i = 0; i < endpoints.length; i++) {
    random -= weights[i];
    if (random <= 0) return endpoints[i];
  }
  return endpoints[endpoints.length - 1];
}

export async function selectBestEndpoint(
  type: string,
  options?: { excludeIds?: string[]; skipPolicyExclusions?: boolean },
): Promise<{
  endpoint: ScoredEndpoint | null;
  alternatives: ScoredEndpoint[];
  strategy: "score_weighted" | "fallback";
}> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Merge explicit excludeIds with policy-based exclusions
  let allExcludeIds = options?.excludeIds ?? [];
  if (!options?.skipPolicyExclusions) {
    try {
      const policyExcluded = await getActiveExcludedEndpointIds();
      if (policyExcluded.length > 0) {
        allExcludeIds = [...new Set([...allExcludeIds, ...policyExcluded])];
      }
    } catch {
      // Non-fatal: if remediation lookup fails, proceed without exclusions
    }
  }

  const endpoints = await prisma.endpoint.findMany({
    where: {
      isActive: true,
      type,
      ...(allExcludeIds.length ? { id: { notIn: allExcludeIds } } : {}),
    },
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

  if (endpoints.length === 0) {
    return { endpoint: null, alternatives: [], strategy: "fallback" };
  }

  // Build scored endpoint items
  const scored: ScoredEndpoint[] = endpoints.map((ep) => {
    const checks = ep.healthChecks;
    const checkCount = checks.length;
    const healthyCount = checks.filter((c) => c.isHealthy).length;
    const latestCheck = checks[0] ?? null;

    const avgLatency =
      healthyCount > 0
        ? Math.round(checks.filter((c) => c.isHealthy).reduce((sum, c) => sum + c.latencyMs, 0) / healthyCount)
        : 0;

    const latestScore = ep.scores[0];

    return {
      id: ep.id,
      url: ep.url,
      type: ep.type,
      provider: ep.provider,
      isOfficial: ep.isOfficial,
      latestCheck: latestCheck
        ? serializeBigInt({
            latencyMs: latestCheck.latencyMs,
            statusCode: latestCheck.statusCode,
            isHealthy: latestCheck.isHealthy,
            blockHeight: latestCheck.blockHeight?.toString() ?? null,
            error: latestCheck.error,
            timestamp: latestCheck.timestamp.toISOString(),
          })
        : null,
      stats24h: {
        uptimePercent:
          checkCount > 0
            ? Math.round((healthyCount / checkCount) * 10000) / 100
            : 0,
        avgLatency,
        checkCount,
        errorCount: checkCount - healthyCount,
      },
      score: latestScore
        ? {
            score: latestScore.score,
            uptime: latestScore.uptime,
            latency: latestScore.latency,
            freshness: latestScore.freshness,
            errorRate: latestScore.errorRate,
            timestamp: latestScore.timestamp.toISOString(),
          }
        : null,
    };
  });

  // Try score-weighted selection: filter endpoints with score > 50
  const highScored = scored.filter((e) => e.score && e.score.score > 50);

  if (highScored.length > 0) {
    const selected = weightedRandomSelect(highScored);
    const alternatives = scored.filter((e) => e.id !== selected.id);
    return { endpoint: selected, alternatives, strategy: "score_weighted" };
  }

  // Fallback: sort by latency (healthy first)
  const sorted = [...scored].sort((a, b) => {
    const aHealthy = a.latestCheck?.isHealthy ? 1 : 0;
    const bHealthy = b.latestCheck?.isHealthy ? 1 : 0;
    if (aHealthy !== bHealthy) return bHealthy - aHealthy;
    return (a.stats24h.avgLatency || Infinity) - (b.stats24h.avgLatency || Infinity);
  });

  return {
    endpoint: sorted[0] ?? null,
    alternatives: sorted.slice(1),
    strategy: "fallback",
  };
}

export { weightedRandomSelect, type ScoredEndpoint };
