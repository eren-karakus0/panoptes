import { prisma } from "@/lib/db";
import { REPUBLIC_CHAIN, GOVERNANCE_DEFAULTS } from "@/lib/constants";
import { publishEvent } from "@/lib/events/publish";
import { CHANNELS } from "@/lib/events/event-types";

const MAX_PAGES = 50;

interface ChainProposal {
  id: string;
  title: string;
  summary?: string;
  status: string;
  proposer?: string;
  submit_time?: string;
  voting_start_time?: string;
  voting_end_time?: string;
  final_tally_result?: {
    yes_count: string;
    no_count: string;
    abstain_count: string;
    no_with_veto_count: string;
  };
}

interface ChainVote {
  voter: string;
  options: Array<{ option: string; weight: string }>;
}

export interface GovernanceSyncResult {
  proposalsSynced: number;
  votesSynced: number;
  duration: number;
}

async function fetchProposals(): Promise<ChainProposal[]> {
  const all: ChainProposal[] = [];
  let nextKey: string | null = null;
  let page = 0;
  do {
    if (page >= MAX_PAGES) {
      console.warn(`[governance] Reached max page limit (${MAX_PAGES}) for proposals, stopping pagination`);
      break;
    }
    const url: string = `${REPUBLIC_CHAIN.restUrl}/cosmos/gov/v1/proposals?pagination.limit=${GOVERNANCE_DEFAULTS.PROPOSAL_FETCH_LIMIT}${
      nextKey ? `&pagination.key=${encodeURIComponent(nextKey)}` : ""
    }`;
    try {
      const res: Response = await fetch(url, { signal: AbortSignal.timeout(GOVERNANCE_DEFAULTS.FETCH_TIMEOUT_MS) });
      if (!res.ok) {
        console.error("[governance] Failed to fetch proposals:", res.status, res.statusText);
        break;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      all.push(...((data.proposals as ChainProposal[]) ?? []));
      nextKey = (data.pagination?.next_key as string) ?? null;
    } catch (error) {
      console.error("[governance] Failed to fetch proposals:", error);
      break;
    }
    page++;
  } while (nextKey);
  return all;
}

async function fetchVotes(proposalId: string): Promise<ChainVote[]> {
  const all: ChainVote[] = [];
  let nextKey: string | null = null;
  let page = 0;
  do {
    if (page >= MAX_PAGES) {
      console.warn(`[governance] Reached max page limit (${MAX_PAGES}) for votes on proposal ${proposalId}, stopping pagination`);
      break;
    }
    const url: string = `${REPUBLIC_CHAIN.restUrl}/cosmos/gov/v1/proposals/${proposalId}/votes?pagination.limit=${GOVERNANCE_DEFAULTS.VOTE_FETCH_LIMIT}${
      nextKey ? `&pagination.key=${encodeURIComponent(nextKey)}` : ""
    }`;
    try {
      const res: Response = await fetch(url, { signal: AbortSignal.timeout(GOVERNANCE_DEFAULTS.FETCH_TIMEOUT_MS) });
      if (!res.ok) {
        console.error(`[governance] Failed to fetch votes for proposal ${proposalId}:`, res.status);
        break;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      all.push(...((data.votes as ChainVote[]) ?? []));
      nextKey = (data.pagination?.next_key as string) ?? null;
    } catch (error) {
      console.error(`[governance] Failed to fetch votes for proposal ${proposalId}:`, error);
      break;
    }
    page++;
  } while (nextKey);
  return all;
}

export async function syncGovernance(): Promise<GovernanceSyncResult> {
  const start = Date.now();
  let proposalsSynced = 0;
  let votesSynced = 0;

  const chainProposals = await fetchProposals();

  // Pre-fetch votes for all voting-period proposals outside the transaction
  // to avoid holding a DB connection open during network I/O
  const votesMap = new Map<string, ChainVote[]>();
  for (const cp of chainProposals) {
    const status = cp.status || "PROPOSAL_STATUS_UNSPECIFIED";
    if (status === "PROPOSAL_STATUS_VOTING_PERIOD") {
      votesMap.set(cp.id, await fetchVotes(cp.id));
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const cp of chainProposals) {
      const existing = await tx.governanceProposal.findUnique({
        where: { id: cp.id },
      });

      const proposalData = {
        title: cp.title || `Proposal #${cp.id}`,
        description: cp.summary || null,
        status: cp.status || "PROPOSAL_STATUS_UNSPECIFIED",
        proposer: cp.proposer || null,
        submitTime: cp.submit_time ? new Date(cp.submit_time) : null,
        votingStartTime: cp.voting_start_time ? new Date(cp.voting_start_time) : null,
        votingEndTime: cp.voting_end_time ? new Date(cp.voting_end_time) : null,
        yesVotes: cp.final_tally_result?.yes_count || "0",
        noVotes: cp.final_tally_result?.no_count || "0",
        abstainVotes: cp.final_tally_result?.abstain_count || "0",
        vetoVotes: cp.final_tally_result?.no_with_veto_count || "0",
      };

      if (existing) {
        const wasVoting = existing.status === "PROPOSAL_STATUS_VOTING_PERIOD";
        const isVoting = proposalData.status === "PROPOSAL_STATUS_VOTING_PERIOD";
        const wasActive = existing.status === "PROPOSAL_STATUS_VOTING_PERIOD";
        const isEnded = proposalData.status !== "PROPOSAL_STATUS_VOTING_PERIOD" &&
                        proposalData.status !== "PROPOSAL_STATUS_DEPOSIT_PERIOD";

        if (!wasVoting && isVoting) {
          await publishEvent({
            channel: CHANNELS.GOVERNANCE,
            type: "governance.voting_started",
            payload: { proposalId: cp.id, title: proposalData.title },
          });
        }
        if (wasActive && isEnded) {
          await publishEvent({
            channel: CHANNELS.GOVERNANCE,
            type: "governance.voting_ended",
            payload: {
              proposalId: cp.id,
              title: proposalData.title,
              status: proposalData.status,
            },
          });
        }

        await tx.governanceProposal.update({
          where: { id: cp.id },
          data: proposalData,
        });
      } else {
        await tx.governanceProposal.create({
          data: { id: cp.id, ...proposalData },
        });

        await publishEvent({
          channel: CHANNELS.GOVERNANCE,
          type: "governance.proposal_created",
          payload: { proposalId: cp.id, title: proposalData.title, status: proposalData.status },
        });
      }
      proposalsSynced++;

      const prefetchedVotes = votesMap.get(cp.id);
      if (prefetchedVotes) {
        for (const v of prefetchedVotes) {
          const option = v.options[0]?.option || "VOTE_OPTION_UNSPECIFIED";

          await tx.governanceVote.upsert({
            where: {
              proposalId_voter: { proposalId: cp.id, voter: v.voter },
            },
            create: {
              proposalId: cp.id,
              voter: v.voter,
              option,
              votedAt: new Date(),
            },
            update: { option },
          });
          votesSynced++;
        }
      }
    }
  });

  return { proposalsSynced, votesSynced, duration: Date.now() - start };
}
