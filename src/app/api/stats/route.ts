import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, jsonResponse, serializeBigInt } from "@/lib/api-helpers";

function formatStats(s: {
  totalValidators: number;
  activeValidators: number;
  totalStaked: string;
  bondedRatio: number | null;
  blockHeight: bigint;
  avgBlockTime: number | null;
  timestamp: Date;
}) {
  return {
    totalValidators: s.totalValidators,
    activeValidators: s.activeValidators,
    totalStaked: s.totalStaked,
    bondedRatio: s.bondedRatio,
    blockHeight: s.blockHeight.toString(),
    avgBlockTime: s.avgBlockTime,
    timestamp: s.timestamp.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const current = await prisma.networkStats.findFirst({
    orderBy: { timestamp: "desc" },
  });

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const history = await prisma.networkStats.findMany({
    where: { timestamp: { gte: ninetyDaysAgo } },
    orderBy: { timestamp: "asc" },
  });

  return jsonResponse(
    serializeBigInt({
      current: current ? formatStats(current) : null,
      history: history.map(formatStats),
    }),
    rl.headers,
  );
}
