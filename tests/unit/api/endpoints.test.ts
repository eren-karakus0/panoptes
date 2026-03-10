import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    endpoint: {
      findMany: vi.fn(),
    },
    endpointHealth: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/api-helpers", () => ({
  withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
  jsonResponse: vi.fn((data, headers, status = 200) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(data, { status, headers });
  }),
  serializeBigInt: vi.fn((obj) =>
    JSON.parse(
      JSON.stringify(obj, (_: string, v: unknown) =>
        typeof v === "bigint" ? v.toString() : v,
      ),
    ),
  ),
}));

import { prisma } from "@/lib/db";

const mockEndpoint = {
  id: "ep1",
  url: "https://rpc.republicai.io",
  type: "rpc",
  provider: "Republic AI",
  isOfficial: true,
  isActive: true,
  createdAt: new Date("2025-01-01"),
  healthChecks: [
    {
      id: "hc1",
      endpointId: "ep1",
      latencyMs: 150,
      statusCode: 200,
      isHealthy: true,
      blockHeight: BigInt(12345),
      error: null,
      timestamp: new Date("2025-06-01T12:00:00Z"),
    },
  ],
};

const mockHealthChecks = [
  {
    id: "hc1",
    endpointId: "ep1",
    latencyMs: 150,
    statusCode: 200,
    isHealthy: true,
    blockHeight: BigInt(12345),
    error: null,
    timestamp: new Date("2025-06-01T12:00:00Z"),
  },
  {
    id: "hc2",
    endpointId: "ep1",
    latencyMs: 200,
    statusCode: 200,
    isHealthy: true,
    blockHeight: BigInt(12346),
    error: null,
    timestamp: new Date("2025-06-01T12:05:00Z"),
  },
];

describe("GET /api/endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns active endpoints with 24h stats", async () => {
    vi.mocked(prisma.endpoint.findMany).mockResolvedValue([mockEndpoint] as never);
    vi.mocked(prisma.endpointHealth.findMany).mockResolvedValue(
      mockHealthChecks as never,
    );

    const { GET } = await import("@/app/api/endpoints/route");
    const req = new NextRequest("http://localhost/api/endpoints");
    const res = await GET(req);
    const body = await res.json();

    expect(body.endpoints).toHaveLength(1);
    expect(body.endpoints[0].url).toBe("https://rpc.republicai.io");
    expect(body.endpoints[0].stats24h).toBeDefined();
    expect(body.endpoints[0].stats24h.checkCount).toBe(2);
    expect(body.endpoints[0].latestCheck).toBeDefined();
  });

  it("handles empty endpoints", async () => {
    vi.mocked(prisma.endpoint.findMany).mockResolvedValue([]);

    const { GET } = await import("@/app/api/endpoints/route");
    const req = new NextRequest("http://localhost/api/endpoints");
    const res = await GET(req);
    const body = await res.json();

    expect(body.endpoints).toHaveLength(0);
  });

  it("calculates uptime percentage correctly", async () => {
    const mixedChecks = [
      { ...mockHealthChecks[0], isHealthy: true },
      { ...mockHealthChecks[1], isHealthy: false },
    ];
    vi.mocked(prisma.endpoint.findMany).mockResolvedValue([mockEndpoint] as never);
    vi.mocked(prisma.endpointHealth.findMany).mockResolvedValue(
      mixedChecks as never,
    );

    const { GET } = await import("@/app/api/endpoints/route");
    const req = new NextRequest("http://localhost/api/endpoints");
    const res = await GET(req);
    const body = await res.json();

    expect(body.endpoints[0].stats24h.uptimePercent).toBe(50);
    expect(body.endpoints[0].stats24h.errorCount).toBe(1);
  });
});
