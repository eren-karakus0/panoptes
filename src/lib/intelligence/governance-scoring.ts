import { prisma } from "@/lib/db";

export interface ValidatorGovernanceScore {
  validatorId: string;
  proposalsVoted: number;
  totalProposals: number;
  participationRate: number;
}

export async function computeGovernanceScores(): Promise<ValidatorGovernanceScore[]> {
  // Get total proposals that have passed voting period
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

  if (totalProposals === 0) return [];

  const validators = await prisma.validator.findMany({
    select: { id: true },
  });

  const voteCounts = await prisma.governanceVote.groupBy({
    by: ["voter"],
    _count: { id: true },
  });
  const voteMap = new Map(voteCounts.map((v) => [v.voter, v._count.id]));

  return validators.map((val) => {
    const proposalsVoted = voteMap.get(val.id) ?? 0;
    return {
      validatorId: val.id,
      proposalsVoted,
      totalProposals,
      participationRate: totalProposals > 0 ? proposalsVoted / totalProposals : 0,
    };
  });
}

export function computeGovernanceWeight(participationRate: number): number {
  // 0-1 range: fully participating validator = 1, non-participating = 0
  return Math.min(1, Math.max(0, participationRate));
}
