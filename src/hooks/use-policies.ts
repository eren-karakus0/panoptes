"use client";

import useSWR from "swr";
import { workspaceSwrConfig } from "./use-api";
import type { PolicyItem, PolicyExecutionItem } from "@/types";

export function usePolicies(token: string | null) {
  return useSWR<{ policies: PolicyItem[] }>(
    token ? "/api/policies" : null,
    workspaceSwrConfig(token),
  );
}

export function usePolicyDetail(token: string | null, id: string | null) {
  return useSWR<PolicyItem & { executions: PolicyExecutionItem[] }>(
    token && id ? `/api/policies/${id}` : null,
    workspaceSwrConfig(token),
  );
}

export function usePolicyExecutions(
  token: string | null,
  id: string | null,
  opts?: { limit?: number; offset?: number },
) {
  const params = new URLSearchParams();
  if (opts?.limit) params.set("limit", String(opts.limit));
  if (opts?.offset) params.set("offset", String(opts.offset));
  const query = params.toString();
  const url = `/api/policies/${id}/executions${query ? `?${query}` : ""}`;

  return useSWR<{ executions: PolicyExecutionItem[]; total: number; limit: number; offset: number }>(
    token && id ? url : null,
    workspaceSwrConfig(token),
  );
}

export async function createPolicy(
  token: string,
  data: {
    name: string;
    description?: string;
    conditions: unknown[];
    actions: unknown[];
    dryRun?: boolean;
    priority?: number;
    cooldownMinutes?: number;
  },
) {
  const res = await fetch("/api/policies", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create policy");
  return res.json();
}

export async function updatePolicy(
  token: string,
  id: string,
  data: Record<string, unknown>,
) {
  const res = await fetch(`/api/policies/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update policy");
  return res.json();
}

export async function deletePolicy(token: string, id: string) {
  const res = await fetch(`/api/policies/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error("Failed to delete policy");
}

export async function testPolicy(
  token: string,
  id: string,
  context?: Record<string, unknown>,
) {
  const res = await fetch(`/api/policies/${id}/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(context || {}),
  });
  if (!res.ok) throw new Error("Failed to test policy");
  return res.json();
}
