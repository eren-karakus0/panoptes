import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, jsonResponse, serializeBigInt } from "@/lib/api-helpers";
import { parseStringParam } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const type =
    parseStringParam(request.nextUrl.searchParams.get("type"), [
      "rpc",
      "rest",
      "evm-rpc",
    ]) ?? "rpc";

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const endpoints = await prisma.endpoint.findMany({
    where: { isActive: true, type },
    include: {
      healthChecks: {
        where: { timestamp: { gte: twentyFourHoursAgo } },
        orderBy: { timestamp: "desc" },
      },
    },
  });

  // Score: average latency of healthy checks (lower = better)
  const scored = endpoints
    .map((ep) => {
      const healthyChecks = ep.healthChecks.filter((c) => c.isHealthy);
      const checkCount = ep.healthChecks.length;
      const healthyCount = healthyChecks.length;

      const avgLatency =
        healthyCount > 0
          ? healthyChecks.reduce((sum, c) => sum + c.latencyMs, 0) /
            healthyCount
          : Infinity;

      const latestCheck = ep.healthChecks[0] ?? null;

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
          avgLatency: avgLatency === Infinity ? 0 : Math.round(avgLatency),
          checkCount,
          errorCount: checkCount - healthyCount,
        },
        _avgLatency: avgLatency,
        _isHealthy: healthyCount > 0,
      };
    })
    .sort((a, b) => {
      // Healthy first, then lowest latency
      if (a._isHealthy && !b._isHealthy) return -1;
      if (!a._isHealthy && b._isHealthy) return 1;
      return a._avgLatency - b._avgLatency;
    });

  const best = scored[0] ?? null;
  const alternatives = scored.slice(1);

  // Remove internal scoring fields
  const clean = (
    item: (typeof scored)[number] | null,
  ) => {
    if (!item) return null;
    const { _avgLatency, _isHealthy, ...rest } = item;
    void _avgLatency;
    void _isHealthy;
    return rest;
  };

  return jsonResponse(
    {
      endpoint: clean(best),
      alternatives: alternatives.map(clean),
    },
    rl.headers,
  );
}
