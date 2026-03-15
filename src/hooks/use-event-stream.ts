"use client";

import { useEffect, useRef } from "react";
import { useSWRConfig } from "swr";

export const DEFAULT_REVALIDATE_MAP: Record<string, string[]> = {
  "anomaly.created": ["/api/anomalies"],
  "anomaly.resolved": ["/api/anomalies"],
  "validator.jailed": ["/api/validators", "/api/anomalies"],
  "validator.unjailed": ["/api/validators", "/api/anomalies"],
  "endpoint.down": ["/api/endpoints", "/api/anomalies"],
  "endpoint.recovered": ["/api/endpoints", "/api/anomalies"],
  "stats.updated": ["/api/stats"],
  "slo.breached": ["/api/slos/summary", "/api/slos"],
  "slo.recovered": ["/api/slos/summary", "/api/slos"],
  "slo.budget_exhausted": ["/api/slos/summary", "/api/slos"],
  "incident.created": ["/api/incidents/summary", "/api/incidents"],
  "incident.acknowledged": ["/api/incidents/summary", "/api/incidents"],
  "incident.resolved": ["/api/incidents/summary", "/api/incidents"],
  "policy.triggered": ["/api/policies"],
  "policy.action_executed": ["/api/policies"],
  "governance.proposal_created": ["/api/governance"],
  "governance.voting_started": ["/api/governance"],
  "governance.voting_ended": ["/api/governance"],
  "delegation.whale_detected": ["/api/delegations", "/api/anomalies"],
};

interface UseEventStreamOptions {
  url: string;
  enabled?: boolean;
  revalidateMap?: Record<string, string[]>;
  onEvent?: (type: string, data: string) => void;
  onError?: (error: Event) => void;
}

export function useEventStream({
  url,
  enabled = true,
  revalidateMap = DEFAULT_REVALIDATE_MAP,
  onEvent,
  onError,
}: UseEventStreamOptions) {
  const { mutate } = useSWRConfig();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const es = new EventSource(url);
    esRef.current = es;

    const eventTypes = Object.keys(revalidateMap);

    const handler = (type: string) => (event: MessageEvent) => {
      onEvent?.(type, event.data);
      const keys = revalidateMap[type];
      if (keys) {
        keys.forEach((key) => mutate(key));
      }
    };

    const handlers = eventTypes.map((type) => {
      const h = handler(type);
      es.addEventListener(type, h);
      return { type, handler: h };
    });

    es.onerror = (event) => {
      onError?.(event);
    };

    return () => {
      handlers.forEach(({ type, handler: h }) =>
        es.removeEventListener(type, h),
      );
      es.close();
      esRef.current = null;
    };
  }, [url, enabled, revalidateMap, onEvent, onError, mutate]);
}
