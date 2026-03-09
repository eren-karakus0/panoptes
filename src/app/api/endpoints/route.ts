import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, jsonResponse, serializeBigInt } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const endpoints = await prisma.endpoint.findMany({
    where: { isActive: true },
    include: {
      healthChecks: {
        orderBy: { timestamp: "desc" },
        take: 1,
      },
    },
  });

  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const items = await Promise.all(
    endpoints.map(async (ep) => {
      const checks24h = await prisma.endpointHealth.findMany({
        where: {
          endpointId: ep.id,
          timestamp: { gte: twentyFourHoursAgo },
        },
      });

      const checkCount = checks24h.length;
      const healthyCount = checks24h.filter((c) => c.isHealthy).length;
      const errorCount = checkCount - healthyCount;
      const avgLatency =
        checkCount > 0
          ? Math.round(
              checks24h.reduce((sum, c) => sum + c.latencyMs, 0) / checkCount,
            )
          : 0;
      const uptimePercent =
        checkCount > 0
          ? Math.round((healthyCount / checkCount) * 10000) / 100
          : 0;

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
        stats24h: { uptimePercent, avgLatency, checkCount, errorCount },
      };
    }),
  );

  return jsonResponse({ endpoints: items }, rl.headers);
}
