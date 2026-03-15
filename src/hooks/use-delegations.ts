"use client";

import useSWR from "swr";
import { defaultSwrConfig } from "./use-api";
import type { DelegationEventItem } from "@/types";

export function useDelegationEvents(opts?: { type?: string; validatorId?: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (opts?.type) params.set("type", opts.type);
  if (opts?.validatorId) params.set("validatorId", opts.validatorId);
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const query = params.toString();
  const url = `/api/delegations${query ? `?${query}` : ""}`;

  return useSWR<{ events: DelegationEventItem[]; total: number; limit: number; offset: number }>(
    url,
    defaultSwrConfig,
  );
}

export function useDelegationFlow(days?: number) {
  const params = days ? `?days=${days}` : "";
  return useSWR<{
    flow: Array<{
      validatorId: string;
      latestDelegators: number;
      latestDelegated: string;
      avgChurnRate: number;
      snapshotCount: number;
    }>;
    days: number;
  }>(`/api/delegations/flow${params}`, defaultSwrConfig);
}

export function useWhaleMovements() {
  return useSWR<{
    whales: Array<{
      id: string;
      severity: string;
      entityId: string;
      title: string;
      description: string;
      metadata: Record<string, unknown> | null;
      resolved: boolean;
      detectedAt: string;
    }>;
    total: number;
  }>("/api/delegations/whales", defaultSwrConfig);
}
