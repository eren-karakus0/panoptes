import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 100);
  const offset = Number(url.searchParams.get("offset")) || 0;

  const where = status ? { status } : {};

  const [proposals, total] = await Promise.all([
    prisma.governanceProposal.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        proposer: true,
        submitTime: true,
        votingStartTime: true,
        votingEndTime: true,
        yesVotes: true,
        noVotes: true,
        abstainVotes: true,
        vetoVotes: true,
      },
    }),
    prisma.governanceProposal.count({ where }),
  ]);

  return jsonResponse({ proposals, total, limit, offset }, rl.headers);
}
