import { prisma } from "@/lib/db";
import { IndexerError } from "@/lib/errors";
import { HEALTH_THRESHOLDS } from "@/lib/constants";

interface HealthCheckResult {
  endpointId: string;
  latencyMs: number;
  statusCode: number;
  isHealthy: boolean;
  blockHeight: bigint | null;
  error: string | null;
}

async function checkRpcEndpoint(
  url: string,
): Promise<Omit<HealthCheckResult, "endpointId">> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      HEALTH_THRESHOLDS.ENDPOINT_TIMEOUT_MS,
    );

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "status",
        params: [],
        id: 1,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latencyMs = Date.now() - start;
    let blockHeight: bigint | null = null;

    if (res.ok) {
      try {
        const data = await res.json();
        const height = data?.result?.sync_info?.latest_block_height;
        if (height) blockHeight = BigInt(height);
      } catch {
        // JSON parse failed, still count as reachable
      }
    }

    return {
      latencyMs,
      statusCode: res.status,
      isHealthy:
        res.ok && latencyMs < HEALTH_THRESHOLDS.LATENCY_HEALTHY_MS,
      blockHeight,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (error) {
    return {
      latencyMs: Date.now() - start,
      statusCode: 0,
      isHealthy: false,
      blockHeight: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkRestEndpoint(
  url: string,
): Promise<Omit<HealthCheckResult, "endpointId">> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      HEALTH_THRESHOLDS.ENDPOINT_TIMEOUT_MS,
    );

    const res = await fetch(
      `${url}/cosmos/base/tendermint/v1beta1/blocks/latest`,
      { signal: controller.signal },
    );
    clearTimeout(timeout);

    const latencyMs = Date.now() - start;
    let blockHeight: bigint | null = null;

    if (res.ok) {
      try {
        const data = await res.json();
        const height = data?.block?.header?.height;
        if (height) blockHeight = BigInt(height);
      } catch {
        // JSON parse failed
      }
    }

    return {
      latencyMs,
      statusCode: res.status,
      isHealthy:
        res.ok && latencyMs < HEALTH_THRESHOLDS.LATENCY_HEALTHY_MS,
      blockHeight,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (error) {
    return {
      latencyMs: Date.now() - start,
      statusCode: 0,
      isHealthy: false,
      blockHeight: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkEvmRpcEndpoint(
  url: string,
): Promise<Omit<HealthCheckResult, "endpointId">> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      HEALTH_THRESHOLDS.ENDPOINT_TIMEOUT_MS,
    );

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_blockNumber",
        params: [],
        id: 1,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latencyMs = Date.now() - start;
    let blockHeight: bigint | null = null;

    if (res.ok) {
      try {
        const data = await res.json();
        if (data?.result) blockHeight = BigInt(data.result);
      } catch {
        // JSON parse failed
      }
    }

    return {
      latencyMs,
      statusCode: res.status,
      isHealthy:
        res.ok && latencyMs < HEALTH_THRESHOLDS.LATENCY_HEALTHY_MS,
      blockHeight,
      error: res.ok ? null : `HTTP ${res.status}`,
    };
  } catch (error) {
    return {
      latencyMs: Date.now() - start,
      statusCode: 0,
      isHealthy: false,
      blockHeight: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function getChecker(
  type: string,
): (url: string) => Promise<Omit<HealthCheckResult, "endpointId">> {
  switch (type) {
    case "rpc":
      return checkRpcEndpoint;
    case "rest":
      return checkRestEndpoint;
    case "evm-rpc":
      return checkEvmRpcEndpoint;
    default:
      return checkRpcEndpoint;
  }
}

export async function checkEndpoints(): Promise<{
  checked: number;
  healthy: number;
  unhealthy: number;
  duration: number;
}> {
  const start = Date.now();

  try {
    const endpoints = await prisma.endpoint.findMany({
      where: { isActive: true },
    });

    const results = await Promise.allSettled(
      endpoints.map(async (ep) => {
        const checker = getChecker(ep.type);
        const result = await checker(ep.url);
        return { endpointId: ep.id, ...result };
      }),
    );

    const healthRecords: HealthCheckResult[] = [];
    for (const result of results) {
      if (result.status === "fulfilled") {
        healthRecords.push(result.value);
      }
    }

    if (healthRecords.length > 0) {
      await prisma.endpointHealth.createMany({
        data: healthRecords.map((r) => ({
          endpointId: r.endpointId,
          latencyMs: r.latencyMs,
          statusCode: r.statusCode,
          isHealthy: r.isHealthy,
          blockHeight: r.blockHeight,
          error: r.error,
        })),
      });
    }

    const healthy = healthRecords.filter((r) => r.isHealthy).length;

    return {
      checked: endpoints.length,
      healthy,
      unhealthy: endpoints.length - healthy,
      duration: Date.now() - start,
    };
  } catch (error) {
    throw new IndexerError(
      `Failed to check endpoints: ${error instanceof Error ? error.message : String(error)}`,
      "endpoints",
    );
  }
}
