import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: RouteContext) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const { id } = await ctx.params;

  const proposal = await prisma.governanceProposal.findUnique({
    where: { id },
    include: {
      votes: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!proposal) {
    return NextResponse.json({ error: "Proposal not found" }, { status: 404, headers: rl.headers });
  }

  return jsonResponse({
    ...proposal,
    voteCount: proposal.votes.length,
    voteSummary: {
      yes: proposal.votes.filter((v) => v.option === "VOTE_OPTION_YES").length,
      no: proposal.votes.filter((v) => v.option === "VOTE_OPTION_NO").length,
      abstain: proposal.votes.filter((v) => v.option === "VOTE_OPTION_ABSTAIN").length,
      veto: proposal.votes.filter((v) => v.option === "VOTE_OPTION_NO_WITH_VETO").length,
    },
  }, rl.headers);
}
