import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  // Get whale movement anomalies (recent)
  const whales = await prisma.anomaly.findMany({
    where: { type: "whale_movement" },
    orderBy: { detectedAt: "desc" },
    take: 50,
    select: {
      id: true,
      severity: true,
      entityId: true,
      title: true,
      description: true,
      metadata: true,
      resolved: true,
      detectedAt: true,
      resolvedAt: true,
    },
  });

  const parsed = whales.map((w) => ({
    ...w,
    metadata: w.metadata ? JSON.parse(w.metadata) : null,
  }));

  return jsonResponse({ whales: parsed, total: parsed.length }, rl.headers);
}
