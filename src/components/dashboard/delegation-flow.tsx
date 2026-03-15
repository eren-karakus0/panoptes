"use client";

import { useDelegationFlow } from "@/hooks/use-delegations";
import { ErrorState } from "./error-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeftRight, TrendingUp, TrendingDown } from "lucide-react";

export function DelegationFlow() {
  const { data, error, isLoading } = useDelegationFlow(7);

  if (error) return <ErrorState message="Failed to load delegation flow" />;

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-soft-violet" />
      </div>
    );
  }

  const flow = data.flow;

  if (flow.length === 0) {
    return (
      <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
        <CardContent className="flex flex-col items-center py-12">
          <ArrowLeftRight className="mb-3 size-8 text-dusty-lavender/30" />
          <p className="text-sm text-dusty-lavender/50">No delegation flow data yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-slate-DEFAULT/20 bg-midnight-plum">
      <CardHeader>
        <CardTitle className="text-sm text-mist">
          Validator Delegation Flow (Last {data.days} days)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          <div className="grid grid-cols-4 gap-4 px-3 pb-2 text-[10px] font-medium uppercase tracking-wider text-dusty-lavender/30">
            <span>Validator</span>
            <span className="text-right">Delegators</span>
            <span className="text-right">Total Delegated</span>
            <span className="text-right">Churn Rate</span>
          </div>
          {flow.map((v) => (
            <div key={v.validatorId} className="grid grid-cols-4 gap-4 rounded bg-slate-dark/20 px-3 py-2 text-xs">
              <span className="font-mono text-dusty-lavender truncate">{v.validatorId}</span>
              <span className="text-right text-mist">{v.latestDelegators}</span>
              <span className="text-right font-mono text-mist">
                {BigInt(v.latestDelegated) > 1_000_000n
                  ? `${(Number(BigInt(v.latestDelegated)) / 1_000_000).toFixed(1)}M`
                  : v.latestDelegated}
              </span>
              <span className="flex items-center justify-end gap-1">
                {v.avgChurnRate > 5 ? (
                  <TrendingUp className="size-3 text-rose-DEFAULT" />
                ) : (
                  <TrendingDown className="size-3 text-teal-DEFAULT" />
                )}
                <span className={v.avgChurnRate > 5 ? "text-rose-DEFAULT" : "text-teal-DEFAULT"}>
                  {v.avgChurnRate.toFixed(1)}%
                </span>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
