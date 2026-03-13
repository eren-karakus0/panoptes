export const APP_NAME = "Panoptes";
export const APP_TAGLINE = "Chain Intelligence, Unblinking.";
export const APP_DESCRIPTION =
  "Chain intelligence platform for Republic AI - Validator monitoring, endpoint health tracking, and smart routing.";
export const APP_VERSION = "0.4.0";

export const REPUBLIC_CHAIN = {
  chainId: "republic-testnet-1",
  rpcUrl: process.env.REPUBLIC_RPC_URL || "https://rpc.republicai.io",
  restUrl: process.env.REPUBLIC_REST_URL || "https://rest.republicai.io",
} as const;

export const CRON_INTERVALS = {
  HEALTH_CHECK: 5,
  VALIDATOR_SYNC: 5,
  STATS_AGGREGATE: 15,
  CLEANUP: 1440,
} as const;

export const RETENTION = {
  VALIDATOR_SNAPSHOTS: 90,
  ENDPOINT_HEALTH: 7,
  NETWORK_STATS: 90,
} as const;

export const KNOWN_ENDPOINTS = [
  {
    url: "https://rpc.republicai.io",
    type: "rpc",
    provider: "Republic AI",
    isOfficial: true,
  },
  {
    url: "https://rest.republicai.io",
    type: "rest",
    provider: "Republic AI",
    isOfficial: true,
  },
  {
    url: "https://evm-rpc.republicai.io",
    type: "evm-rpc",
    provider: "Republic AI",
    isOfficial: true,
  },
] as const;

export const API_DEFAULTS = {
  VALIDATORS_LIMIT: 50,
  VALIDATORS_MAX: 200,
  SNAPSHOTS_LIMIT: 100,
  SNAPSHOTS_MAX: 500,
  DEFAULT_DAYS: 7,
} as const;

export const RATE_LIMIT = {
  WINDOW_MS: 60_000,
  MAX_REQUESTS: 60,
  CLEANUP_INTERVAL: 300_000,
} as const;

export const HEALTH_THRESHOLDS = {
  LATENCY_HEALTHY_MS: 5000,
  BLOCK_HEIGHT_STALE: 10,
  ENDPOINT_TIMEOUT_MS: 5000,
} as const;

export const SCORING = {
  ENDPOINT_WEIGHTS: {
    uptime: 0.40,
    latency: 0.25,
    freshness: 0.20,
    errorRate: 0.15,
  },
  VALIDATOR_WEIGHTS: {
    missedBlockRate: 0.45,
    jailPenalty: 0.25,
    stakeStability: 0.15,
    commissionScore: 0.15,
  },
  EMA_ALPHA: 0.3,
  LATENCY_BASELINE_MS: 200,
  LATENCY_MAX_MS: 5000,
} as const;

export const ANOMALY_THRESHOLDS = {
  LARGE_STAKE_CHANGE_PCT: 10,
  COMMISSION_SPIKE_PCT: 5,
  ENDPOINT_DOWN_CONSECUTIVE: 3,
  BLOCK_STALE_BEHIND: 10,
  MASS_UNBONDING_PCT: 5,
} as const;

export const PREFLIGHT = {
  MIN_GAS_BALANCE: "1000",
  DEFAULT_GAS_LIMIT: 200_000,
  TIMEOUT_MS: 10_000,
} as const;

export const WEBHOOK_EVENTS = [
  "anomaly.created",
  "anomaly.resolved",
  "validator.jailed",
  "validator.unjailed",
  "validator.status_changed",
  "endpoint.down",
  "endpoint.recovered",
  "stats.updated",
  "slo.breached",
  "slo.budget_exhausted",
  "slo.recovered",
  "incident.created",
  "incident.acknowledged",
  "incident.resolved",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENTS)[number];

export const WEBHOOK_DEFAULTS = {
  MAX_PER_WORKSPACE: 10,
  MAX_EVENTS: 20,
  SECRET_PREFIX: "whsec_",
} as const;

export const SLO_INDICATORS = [
  "uptime",
  "latency",
  "error_rate",
  "block_production",
] as const;

export type SloIndicator = (typeof SLO_INDICATORS)[number];

export const SLO_ENTITY_TYPES = ["endpoint", "validator"] as const;
export type SloEntityType = (typeof SLO_ENTITY_TYPES)[number];

export const SLO_INDICATOR_ENTITY_MAP: Record<SloIndicator, readonly SloEntityType[]> = {
  uptime: ["endpoint"],
  latency: ["endpoint"],
  error_rate: ["endpoint"],
  block_production: ["validator"],
} as const;

export const SLO_DEFAULTS = {
  MAX_PER_WORKSPACE: 20,
  MIN_TARGET: 0.9,
  MAX_TARGET: 0.9999,
  MIN_WINDOW_DAYS: 1,
  MAX_WINDOW_DAYS: 7,
} as const;

export const SLO_RETENTION = {
  EVALUATION_DAYS: 90,
} as const;

export const INCIDENT_STATUSES = ["open", "acknowledged", "resolved"] as const;
export type IncidentStatus = (typeof INCIDENT_STATUSES)[number];

export const INCIDENT_EVENT_TYPES = [
  "created", "slo_linked", "anomaly_linked",
  "acknowledged", "resolved", "comment",
] as const;
export type IncidentEventType = (typeof INCIDENT_EVENT_TYPES)[number];

export const INCIDENT_DEFAULTS = {
  MAX_OPEN_PER_WORKSPACE: 100,
  CORRELATION_WINDOW_HOURS: 1,
} as const;

export const INCIDENT_RETENTION = {
  RESOLVED_DAYS: 90,
} as const;

export const STREAM_DEFAULTS = {
  POLL_INTERVAL_MS: 3_000,
  HEARTBEAT_MS: 15_000,
  BATCH_SIZE: 50,
  TOKEN_TTL_SECONDS: 300,
} as const;

export const OUTBOX_RETENTION = {
  HOURS: 24,
} as const;

export const WEBHOOK_DISPATCH = {
  BATCH_SIZE: 50,
  RETRY_BATCH_SIZE: 20,
  TIMEOUT_MS: 5_000,
  MAX_ATTEMPTS: 5,
  RETRY_DELAYS_S: [30, 120, 600, 3_600, 21_600],
  BUDGET_MS: 45_000,
  STALE_CLAIM_MS: 300_000,
} as const;

export const DELIVERY_RETENTION = {
  SUCCESS_DAYS: 7,
  FAILURE_DAYS: 30,
} as const;
