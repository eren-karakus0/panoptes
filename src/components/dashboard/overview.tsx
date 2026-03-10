"use client";

import dynamic from "next/dynamic";
import { useNetworkStats } from "@/hooks/use-stats";
import { useEndpoints } from "@/hooks/use-endpoints";
import { useAnomalies } from "@/hooks/use-anomalies";
import { StatCard } from "./stat-card";
import { ErrorState } from "./error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "./status-badge";

const StakingTrendChart = dynamic(
  () => import("@/components/charts/staking-trend-chart").then((m) => m.StakingTrendChart),
  { ssr: false }
);
const BlockHeightChart = dynamic(
  () => import("@/components/charts/block-height-chart").then((m) => m.BlockHeightChart),
  { ssr: false }
);
import {
  formatTokensShort,
  formatBlockHeight,
  formatNumber,
  tokensToNumber,
} from "@/lib/formatters";
import { timeAgo } from "@/lib/time";
import {
  Shield,
  Blocks,
  Coins,
  Globe,
  Activity,
  AlertTriangle,
} from "lucide-react";

export function Overview() {
  const {
    data: stats,
    error: statsError,
    isLoading: statsLoading,
    mutate: mutateStats,
  } = useNetworkStats();
  const {
    data: endpoints,
    isLoading: endpointsLoading,
  } = useEndpoints();
  const { data: anomalyData } = useAnomalies({ resolved: false });

  const current = stats?.current;
  const history = stats?.history ?? [];

  const healthyEndpoints =
    endpoints?.endpoints.filter((e) => e.latestCheck?.isHealthy).length ?? 0;
  const totalEndpoints = endpoints?.endpoints.length ?? 0;

  // Sparkline data from history (reversed for chronological order)
  const stakingSparkline = history
    .slice()
    .reverse()
    .map((h) => tokensToNumber(h.totalStaked));
  const blockSparkline = history
    .slice()
    .reverse()
    .map((h) => Number(h.blockHeight));
  const validatorSparkline = history
    .slice()
    .reverse()
    .map((h) => h.activeValidators);

  if (statsError && !stats) {
    return <ErrorState message="Failed to load network stats" onRetry={() => mutateStats()} />;
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Validators"
          value={
            current
              ? `${formatNumber(current.activeValidators)} / ${formatNumber(current.totalValidators)}`
              : "--"
          }
          subtitle="active / total"
          icon={<Shield className="size-4" />}
          sparklineData={validatorSparkline}
          isLoading={statsLoading}
        />
        <StatCard
          title="Block Height"
          value={current ? formatBlockHeight(current.blockHeight) : "--"}
          subtitle={current?.avgBlockTime ? `~${current.avgBlockTime.toFixed(1)}s block time` : undefined}
          icon={<Blocks className="size-4" />}
          sparklineData={blockSparkline}
          isLoading={statsLoading}
        />
        <StatCard
          title="Total Staked"
          value={current ? formatTokensShort(current.totalStaked) : "--"}
          subtitle={
            current?.bondedRatio !== null && current?.bondedRatio !== undefined
              ? `${(current.bondedRatio * 100).toFixed(1)}% bonded`
              : undefined
          }
          icon={<Coins className="size-4" />}
          sparklineData={stakingSparkline}
          isLoading={statsLoading}
        />
        <StatCard
          title="Endpoints"
          value={
            !endpointsLoading
              ? `${healthyEndpoints} / ${totalEndpoints}`
              : "--"
          }
          subtitle={healthyEndpoints === totalEndpoints ? "all healthy" : `${totalEndpoints - healthyEndpoints} unhealthy`}
          icon={<Globe className="size-4" />}
          isLoading={endpointsLoading}
        />
      </div>

      {/* Trend charts */}
      {history.length > 1 && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-dusty-lavender/70">
                <Coins className="size-4" />
                Staking Trend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <StakingTrendChart data={history} />
            </CardContent>
          </Card>
          <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-dusty-lavender/70">
                <Blocks className="size-4" />
                Block Height
              </CardTitle>
            </CardHeader>
            <CardContent>
              <BlockHeightChart data={history} />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active anomalies */}
      {anomalyData && anomalyData.total > 0 && (
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-dusty-lavender/70">
              <AlertTriangle className="size-4" />
              Active Anomalies ({anomalyData.total})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {anomalyData.anomalies.slice(0, 5).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-lg border border-slate-DEFAULT/10 bg-slate-dark/30 px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-mist">
                      {a.title}
                    </p>
                    <p className="truncate text-xs text-dusty-lavender/50">
                      {a.entityType} &middot; {a.type}
                    </p>
                  </div>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.severity === "critical"
                        ? "bg-rose-dark/50 text-rose-light"
                        : a.severity === "high"
                          ? "bg-amber-dark/50 text-amber-light"
                          : "bg-slate-dark/50 text-slate-light"
                    }`}
                  >
                    {a.severity}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Endpoint health summary */}
      {endpoints && endpoints.endpoints.length > 0 && (
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-dusty-lavender/70">
              <Activity className="size-4" />
              System Health
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {endpoints.endpoints.map((ep) => (
                <div
                  key={ep.id}
                  className="flex items-center justify-between rounded-lg border border-slate-DEFAULT/10 bg-slate-dark/30 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-mist">
                      {ep.type.toUpperCase()}
                    </p>
                    <p className="truncate text-xs text-dusty-lavender/50">
                      {ep.latestCheck ? timeAgo(ep.latestCheck.timestamp) : "No checks"}
                    </p>
                  </div>
                  <StatusBadge
                    status={ep.latestCheck?.isHealthy ? "healthy" : "unhealthy"}
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
