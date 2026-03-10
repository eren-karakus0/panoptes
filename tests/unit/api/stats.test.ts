import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    networkStats: {
      findFirst: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/api-helpers", async () => {
  const { NextResponse } = await import("next/server");
  return {
    withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
    jsonResponse: vi.fn((data: unknown, headers: Record<string, string>, status = 200) =>
      NextResponse.json(data, { status, headers }),
    ),
    serializeBigInt: vi.fn((obj: unknown) =>
      JSON.parse(
        JSON.stringify(obj, (_: string, v: unknown) =>
          typeof v === "bigint" ? v.toString() : v,
        ),
      ),
    ),
  };
});

import { prisma } from "@/lib/db";

const mockStats = {
  id: "stats1",
  totalValidators: 50,
  activeValidators: 40,
  totalStaked: "5000000000000000000000000",
  bondedRatio: 0.8,
  blockHeight: BigInt(12345),
  avgBlockTime: 6.5,
  timestamp: new Date("2025-06-01T12:00:00Z"),
};

describe("GET /api/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns current stats and 90-day history", async () => {
    vi.mocked(prisma.networkStats.findFirst).mockResolvedValue(mockStats as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([mockStats] as never);

    const { GET } = await import("@/app/api/stats/route");
    const req = new NextRequest("http://localhost/api/stats");
    const res = await GET(req);
    const body = await res.json();

    expect(body.current).toBeDefined();
    expect(body.current.totalValidators).toBe(50);
    expect(body.current.blockHeight).toBe("12345");
    expect(body.history).toHaveLength(1);
  });

  it("handles missing current stats", async () => {
    vi.mocked(prisma.networkStats.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

    const { GET } = await import("@/app/api/stats/route");
    const req = new NextRequest("http://localhost/api/stats");
    const res = await GET(req);
    const body = await res.json();

    expect(body.current).toBeNull();
    expect(body.history).toHaveLength(0);
  });

  it("serializes BigInt values to strings", async () => {
    vi.mocked(prisma.networkStats.findFirst).mockResolvedValue(mockStats as never);
    vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

    const { GET } = await import("@/app/api/stats/route");
    const req = new NextRequest("http://localhost/api/stats");
    const res = await GET(req);
    const body = await res.json();

    expect(typeof body.current.blockHeight).toBe("string");
  });
});
