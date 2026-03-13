export type HealthStatus = "healthy" | "degraded" | "down";

export type EndpointType = "rpc" | "rest" | "evm-rpc" | "grpc";

export type ValidatorStatus =
  | "BOND_STATUS_BONDED"
  | "BOND_STATUS_UNBONDING"
  | "BOND_STATUS_UNBONDED";

export type PreflightStatus = "pass" | "warn" | "fail";

// Intelligence Types
export type AnomalyType = "jailing" | "large_stake_change" | "commission_spike" | "endpoint_down" | "block_stale" | "mass_unbonding";
export type AnomalySeverity = "low" | "medium" | "high" | "critical";
export type AnomalyEntityType = "validator" | "endpoint" | "network";

export type IncidentStatus = "open" | "acknowledged" | "resolved";
export type IncidentEventType = "created" | "slo_linked" | "anomaly_linked" | "acknowledged" | "resolved" | "comment";

export interface EndpointScoreItem {
  score: number;
  uptime: number;
  latency: number;
  freshness: number;
  errorRate: number;
  timestamp: string;
}

export interface ValidatorScoreItem {
  score: number;
  missedBlockRate: number;
  jailPenalty: number;
  stakeStability: number;
  commissionScore: number;
  timestamp: string;
}

export interface AnomalyItem {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  entityType: AnomalyEntityType;
  entityId: string | null;
  title: string;
  description: string;
  metadata: Record<string, unknown> | null;
  resolved: boolean;
  detectedAt: string;
  resolvedAt: string | null;
}

export interface AnomalyApiResponse {
  anomalies: AnomalyItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface PreflightCheck {
  name: string;
  status: PreflightStatus;
  message: string;
  details?: Record<string, unknown>;
}

export interface PreflightResponse {
  overall: PreflightStatus;
  checks: PreflightCheck[];
  timestamp: string;
  duration: number;
}

export interface SmartRouteResponse {
  endpoint: (EndpointItem & { score?: EndpointScoreItem | null }) | null;
  alternatives: (EndpointItem & { score?: EndpointScoreItem | null })[];
  strategy: "score_weighted" | "fallback";
}

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
  score?: ValidatorScoreItem | null;
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
  score?: EndpointScoreItem | null;
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
