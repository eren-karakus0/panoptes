import type { WebhookEventType } from "@/lib/constants";

export const CHANNELS = {
  NETWORK: "network",
  ANOMALY: "anomaly",
  WORKSPACE: "workspace",
  SLO: "slo",
} as const;

export type Channel = (typeof CHANNELS)[keyof typeof CHANNELS];
export type EventVisibility = "public" | "workspace";

export const ANOMALY_CREATE_EVENT_MAP: Record<string, WebhookEventType[]> = {
  jailing: ["anomaly.created", "validator.jailed"],
  endpoint_down: ["anomaly.created", "endpoint.down"],
  large_stake_change: ["anomaly.created"],
  commission_spike: ["anomaly.created"],
  block_stale: ["anomaly.created"],
  mass_unbonding: ["anomaly.created"],
};

export const ANOMALY_RESOLVE_EVENT_MAP: Record<string, WebhookEventType[]> = {
  jailing: ["anomaly.resolved", "validator.unjailed"],
  endpoint_down: ["anomaly.resolved", "endpoint.recovered"],
  large_stake_change: ["anomaly.resolved"],
  commission_spike: ["anomaly.resolved"],
  block_stale: ["anomaly.resolved"],
  mass_unbonding: ["anomaly.resolved"],
};

export interface PublishEventInput {
  channel: Channel;
  type: WebhookEventType;
  visibility?: EventVisibility;
  workspaceId?: string | null;
  payload: Record<string, unknown>;
}
