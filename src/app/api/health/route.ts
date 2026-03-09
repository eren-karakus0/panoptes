import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getRepublicClient } from "@/lib/republic";
import { APP_VERSION } from "@/lib/constants";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import type { HealthStatus } from "@/types";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  let dbStatus: HealthStatus = "down";
  let dbLatency = 0;

  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    dbLatency = Date.now() - dbStart;
    dbStatus = "healthy";
  } catch {
    dbStatus = "down";
  }

  let chainStatus: HealthStatus = "down";
  let blockHeight: string | undefined;

  try {
    const client = getRepublicClient();
    const status = await client.getStatus();
    blockHeight = status.syncInfo?.latestBlockHeight;
    chainStatus = blockHeight ? "healthy" : "degraded";
  } catch {
    chainStatus = "down";
  }

  // Last cron run
  let lastCronRun: string | undefined;
  try {
    const lastHealth = await prisma.endpointHealth.findFirst({
      orderBy: { timestamp: "desc" },
      select: { timestamp: true },
    });
    lastCronRun = lastHealth?.timestamp.toISOString();
  } catch {
    // ignore
  }

  const overall: HealthStatus =
    dbStatus === "healthy" && chainStatus === "healthy"
      ? "healthy"
      : dbStatus === "down" && chainStatus === "down"
        ? "down"
        : "degraded";

  return jsonResponse(
    {
      status: overall,
      version: APP_VERSION,
      timestamp: new Date().toISOString(),
      checks: {
        database: { status: dbStatus, latencyMs: dbLatency },
        chain: { status: chainStatus, blockHeight },
        lastCronRun,
      },
    },
    rl.headers,
  );
}
