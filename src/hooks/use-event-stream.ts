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
