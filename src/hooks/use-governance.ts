"use client";

import useSWR from "swr";
import { defaultSwrConfig } from "./use-api";
import type { GovernanceProposalItem, GovernanceVoteItem } from "@/types";

export function useGovernanceProposals(opts?: { status?: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (opts?.status) params.set("status", opts.status);
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const query = params.toString();
  const url = `/api/governance${query ? `?${query}` : ""}`;

  return useSWR<{ proposals: GovernanceProposalItem[]; total: number; limit: number; offset: number }>(
    url,
    defaultSwrConfig,
  );
}

export function useGovernanceProposal(id: string | null) {
  return useSWR<GovernanceProposalItem & {
    votes: GovernanceVoteItem[];
    voteCount: number;
    voteSummary: { yes: number; no: number; abstain: number; veto: number };
  }>(
    id ? `/api/governance/${id}` : null,
    defaultSwrConfig,
  );
}

export function useGovernanceParticipation() {
  return useSWR<{
    validators: Array<{
      validatorId: string;
      proposalsVoted: number;
      totalProposals: number;
      participationRate: number;
    }>;
    totalValidators: number;
  }>("/api/governance/participation", defaultSwrConfig);
}
