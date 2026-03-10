"use client";

import { useState } from "react";
import { useAnomalies } from "@/hooks/use-anomalies";
import { PageHeader } from "@/components/dashboard/page-header";
import { FilterSelect } from "@/components/dashboard/filter-select";
import { ErrorState } from "@/components/dashboard/error-state";
import { Card, CardContent } from "@/components/ui/card";
import { timeAgo } from "@/lib/time";
import { AlertTriangle } from "lucide-react";

const TYPE_OPTIONS = [
  { label: "All Types", value: "" },
  { label: "Jailing", value: "jailing" },
  { label: "Stake Change", value: "large_stake_change" },
  { label: "Commission Spike", value: "commission_spike" },
  { label: "Endpoint Down", value: "endpoint_down" },
  { label: "Block Stale", value: "block_stale" },
  { label: "Mass Unbonding", value: "mass_unbonding" },
];

const SEVERITY_OPTIONS = [
  { label: "All Severities", value: "" },
  { label: "Critical", value: "critical" },
  { label: "High", value: "high" },
  { label: "Medium", value: "medium" },
  { label: "Low", value: "low" },
];

const RESOLVED_OPTIONS = [
  { label: "All", value: "" },
  { label: "Active", value: "false" },
  { label: "Resolved", value: "true" },
];

const severityColors: Record<string, string> = {
  critical: "bg-rose-dark/50 text-rose-light border-rose-DEFAULT/30",
  high: "bg-amber-dark/50 text-amber-light border-amber-DEFAULT/30",
  medium: "bg-orange-900/50 text-orange-300 border-orange-500/30",
  low: "bg-slate-dark/50 text-slate-light border-slate-DEFAULT/30",
};

export default function AnomaliesPage() {
  const [type, setType] = useState("");
  const [severity, setSeverity] = useState("");
  const [resolved, setResolved] = useState("");

  const { data, error, isLoading, mutate } = useAnomalies({
    type: type || undefined,
    severity: severity || undefined,
    resolved: resolved === "" ? undefined : resolved === "true",
  });

  if (error && !data) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Anomalies"
          description="Network anomaly detection and alerts"
          breadcrumbs={[{ label: "Anomalies" }]}
        />
        <ErrorState message="Failed to load anomalies" onRetry={() => mutate()} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Anomalies"
        description="Network anomaly detection and alerts"
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <FilterSelect
          label="Type"
          options={TYPE_OPTIONS}
          value={type}
          onChange={setType}
        />
        <FilterSelect
          label="Severity"
          options={SEVERITY_OPTIONS}
          value={severity}
          onChange={setSeverity}
        />
        <FilterSelect
          label="Status"
          options={RESOLVED_OPTIONS}
          value={resolved}
          onChange={setResolved}
        />
      </div>

      {isLoading && !data && (
        <div className="flex items-center justify-center py-12">
          <div className="size-6 animate-spin rounded-full border-2 border-soft-violet/30 border-t-soft-violet" />
        </div>
      )}

      {data && data.anomalies.length === 0 && (
        <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
          <CardContent className="flex flex-col items-center gap-3 py-12">
            <AlertTriangle className="size-8 text-dusty-lavender/30" />
            <p className="text-sm text-dusty-lavender/50">No anomalies found</p>
          </CardContent>
        </Card>
      )}

      {data && data.anomalies.length > 0 && (
        <div className="space-y-3">
          {data.anomalies.map((anomaly) => (
            <Card
              key={anomaly.id}
              className="border-slate-DEFAULT/20 bg-midnight-plum transition-colors hover:border-soft-violet/20"
            >
              <CardContent className="flex items-start gap-4 py-4">
                <div className="mt-0.5">
                  <AlertTriangle
                    className={`size-5 ${
                      anomaly.severity === "critical"
                        ? "text-rose-DEFAULT"
                        : anomaly.severity === "high"
                          ? "text-amber-DEFAULT"
                          : "text-dusty-lavender/50"
                    }`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-mist">
                        {anomaly.title}
                      </p>
                      <p className="mt-1 text-xs text-dusty-lavender/50">
                        {anomaly.description}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                          severityColors[anomaly.severity] ?? severityColors.low
                        }`}
                      >
                        {anomaly.severity}
                      </span>
                      {anomaly.resolved ? (
                        <span className="inline-flex items-center rounded-full border border-teal-DEFAULT/30 bg-teal-dark/50 px-2 py-0.5 text-[10px] font-medium text-teal-light">
                          resolved
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-rose-DEFAULT/30 bg-rose-dark/50 px-2 py-0.5 text-[10px] font-medium text-rose-light">
                          active
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-[10px] text-dusty-lavender/40">
                    <span>{anomaly.entityType}</span>
                    <span>{anomaly.type}</span>
                    <span>Detected {timeAgo(anomaly.detectedAt)}</span>
                    {anomaly.resolvedAt && (
                      <span>Resolved {timeAgo(anomaly.resolvedAt)}</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {data.total > data.anomalies.length && (
            <p className="text-center text-xs text-dusty-lavender/40">
              Showing {data.anomalies.length} of {data.total} anomalies
            </p>
          )}
        </div>
      )}
    </div>
  );
}
