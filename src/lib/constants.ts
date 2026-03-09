export const APP_NAME = "Panoptes";
export const APP_TAGLINE = "Chain Intelligence, Unblinking.";
export const APP_DESCRIPTION =
  "Chain intelligence platform for Republic AI - Validator monitoring, endpoint health tracking, and smart routing.";
export const APP_VERSION = "0.2.0";

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
