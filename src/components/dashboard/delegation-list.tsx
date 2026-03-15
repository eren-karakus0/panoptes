"use client";

import { useDelegationEvents, useWhaleMovements } from "@/hooks/use-delegations";
import { ErrorState } from "./error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { timeAgo } from "@/lib/time";
import { Loader2, ArrowLeftRight, ArrowUpRight, ArrowDownRight, AlertTriangle } from "lucide-react";

const TYPE_CONFIG = {
  delegate: { label: "Delegate", color: "text-teal-DEFAULT", icon: ArrowUpRight },
  undelegate: { label: "Undelegate", color: "text-rose-DEFAULT", icon: ArrowDownRight },
  redelegate: { label: "Redelegate", color: "text-amber-DEFAULT", icon: ArrowLeftRight },
};

export function DelegationList() {
  const { data: eventsData, error: eventsError, isLoading: eventsLoading } = useDelegationEvents({ limit: 30 });
  const { data: whalesData, error: whalesError, isLoading: whalesLoading } = useWhaleMovements();

  if (eventsError || whalesError) return <ErrorState message="Failed to load delegation data" />;

  if (eventsLoading || whalesLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-soft-violet" />
      </div>
    );
  }

  const events = eventsData?.events ?? [];
  const whales = whalesData?.whales ?? [];
  const unresolvedWhales = whales.filter((w) => !w.resolved);

  return (
    <div className="space-y-6">
      {/* Whale Alerts */}
      {unresolvedWhales.length > 0 && (
        <Card className="border-amber-DEFAULT/30 bg-midnight-plum">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-amber-DEFAULT">
              <AlertTriangle className="size-4" />
              Whale Movements ({unresolvedWhales.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {unresolvedWhales.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded bg-amber-DEFAULT/5 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-mist">{w.title}</p>
                  <p className="text-xs text-dusty-lavender/50">{timeAgo(w.detectedAt)}</p>
                </div>
                <span className={`text-xs font-medium ${
                  w.severity === "critical" ? "text-rose-DEFAULT" : "text-amber-DEFAULT"
                }`}>
                  {w.severity.toUpperCase()}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent Events */}
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardHeader>
          <CardTitle className="text-sm text-mist">
            Recent Delegation Events ({eventsData?.total ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <div className="flex flex-col items-center py-8">
              <ArrowLeftRight className="mb-2 size-6 text-dusty-lavender/30" />
              <p className="text-xs text-dusty-lavender/40">No delegation events yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {events.map((e) => {
                const config = TYPE_CONFIG[e.type] || TYPE_CONFIG.delegate;
                const Icon = config.icon;
                return (
                  <div key={e.id} className="flex items-center gap-3 rounded bg-slate-dark/20 px-3 py-2">
                    <Icon className={`size-3.5 shrink-0 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`font-medium ${config.color}`}>{config.label}</span>
                        <span className="font-mono text-dusty-lavender/50 truncate max-w-[120px]">
                          {e.delegator}
                        </span>
                        <span className="text-dusty-lavender/30">→</span>
                        <span className="font-mono text-dusty-lavender/50 truncate max-w-[120px]">
                          {e.validatorTo}
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-xs text-mist shrink-0">
                      {BigInt(e.amount) > 1_000_000n
                        ? `${(Number(BigInt(e.amount)) / 1_000_000).toFixed(1)}M`
                        : e.amount}
                    </span>
                    <span className="text-[10px] text-dusty-lavender/40 shrink-0">
                      {timeAgo(e.timestamp)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
