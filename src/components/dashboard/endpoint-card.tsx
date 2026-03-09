"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "./status-badge";
import { getEndpointTypeLabel } from "@/lib/status";
import { formatLatency, formatUptime, formatBlockHeight, formatNumber } from "@/lib/formatters";
import { timeAgo } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ExternalLink, Award } from "lucide-react";
import type { EndpointItem } from "@/types";

interface EndpointCardProps {
  endpoint: EndpointItem;
}

export function EndpointCard({ endpoint: ep }: EndpointCardProps) {
  const isHealthy = ep.latestCheck?.isHealthy ?? false;

  return (
    <Card className="border-slate-DEFAULT/20 bg-midnight-plum transition-colors hover:border-soft-violet/20">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-mist">
              <span className="truncate">{getEndpointTypeLabel(ep.type)}</span>
              {ep.isOfficial && (
                <span className="inline-flex items-center gap-1 rounded-full bg-soft-violet/15 px-2 py-0.5 text-[10px] font-medium text-soft-violet">
                  <Award className="size-3" />
                  Official
                </span>
              )}
            </CardTitle>
            <a
              href={ep.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex items-center gap-1 text-xs text-dusty-lavender/50 transition-colors hover:text-dusty-lavender"
            >
              <span className="truncate">{ep.url}</span>
              <ExternalLink className="size-3 shrink-0" />
            </a>
          </div>
          <StatusBadge status={isHealthy ? "healthy" : "unhealthy"} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Latest check */}
        {ep.latestCheck && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-dusty-lavender/40">
                Latency
              </p>
              <p className="font-mono text-sm font-medium text-mist">
                {formatLatency(ep.latestCheck.latencyMs)}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-dusty-lavender/40">
                Status
              </p>
              <p className="font-mono text-sm font-medium text-mist">
                {ep.latestCheck.statusCode}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-dusty-lavender/40">
                Block Height
              </p>
              <p className="font-mono text-sm font-medium text-mist">
                {ep.latestCheck.blockHeight
                  ? formatBlockHeight(ep.latestCheck.blockHeight)
                  : "--"}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-dusty-lavender/40">
                Checked
              </p>
              <p className="text-sm text-mist">
                {timeAgo(ep.latestCheck.timestamp)}
              </p>
            </div>
          </div>
        )}

        {/* 24h stats bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-dusty-lavender/40">24h Uptime</span>
            <span className="font-mono font-medium text-mist">
              {formatUptime(ep.stats24h.uptimePercent)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-dark/50">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                ep.stats24h.uptimePercent >= 99
                  ? "bg-teal-DEFAULT"
                  : ep.stats24h.uptimePercent >= 90
                    ? "bg-amber-DEFAULT"
                    : "bg-rose-DEFAULT"
              )}
              style={{ width: `${Math.min(ep.stats24h.uptimePercent, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-dusty-lavender/30">
            <span>Avg {formatLatency(ep.stats24h.avgLatency)}</span>
            <span>
              {formatNumber(ep.stats24h.checkCount)} checks / {ep.stats24h.errorCount} errors
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
