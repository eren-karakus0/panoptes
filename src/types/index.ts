export type HealthStatus = "healthy" | "degraded" | "down";

export type EndpointType = "rpc" | "rest" | "evm-rpc" | "grpc";

export type ValidatorStatus =
  | "BOND_STATUS_BONDED"
  | "BOND_STATUS_UNBONDING"
  | "BOND_STATUS_UNBONDED";

export type PreflightStatus = "pass" | "warn" | "fail";

// API Response Types

export interface ValidatorListItem {
  id: string;
  moniker: string;
  status: string;
  tokens: string;
  commission: number;
  jailed: boolean;
  uptime: number;
  votingPower: string;
  missedBlocks: number;
  jailCount: number;
  lastJailedAt: string | null;
  firstSeen: string;
  lastUpdated: string;
}

export interface ValidatorApiResponse {
  validators: ValidatorListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface ValidatorSnapshotItem {
  id: string;
  tokens: string;
  status: string;
  commission: number;
  jailed: boolean;
  votingPower: string;
  timestamp: string;
}

export interface ValidatorDetailResponse {
  validator: ValidatorListItem;
  snapshots: ValidatorSnapshotItem[];
  snapshotCount: number;
  period: { from: string; to: string };
}

export interface EndpointHealthCheck {
  latencyMs: number;
  statusCode: number;
  isHealthy: boolean;
  blockHeight: string | null;
  error: string | null;
  timestamp: string;
}

export interface EndpointStats24h {
  uptimePercent: number;
  avgLatency: number;
  checkCount: number;
  errorCount: number;
}

export interface EndpointItem {
  id: string;
  url: string;
  type: string;
  provider: string | null;
  isOfficial: boolean;
  latestCheck: EndpointHealthCheck | null;
  stats24h: EndpointStats24h;
}

export interface EndpointApiResponse {
  endpoints: EndpointItem[];
}

export interface BestEndpointResponse {
  endpoint: EndpointItem | null;
  alternatives: EndpointItem[];
}

export interface NetworkStatsItem {
  totalValidators: number;
  activeValidators: number;
  totalStaked: string;
  bondedRatio: number | null;
  blockHeight: string;
  avgBlockTime: number | null;
  timestamp: string;
}

export interface NetworkStatsResponse {
  current: NetworkStatsItem | null;
  history: NetworkStatsItem[];
}

export interface CronResult {
  success: boolean;
  duration: number;
  [key: string]: unknown;
}

export interface HealthCheckResult {
  status: HealthStatus;
  version: string;
  timestamp: string;
  checks: {
    database: { status: HealthStatus; latencyMs: number };
    chain: { status: HealthStatus; blockHeight?: string };
    lastCronRun?: string;
  };
}
