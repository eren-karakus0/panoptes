import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: vi.fn(),
    endpointHealth: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("@/lib/republic", () => ({
  getRepublicClient: vi.fn(),
}));

vi.mock("@/lib/api-helpers", () => ({
  withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
  jsonResponse: vi.fn((data, headers, status = 200) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(data, { status, headers });
  }),
}));

import { prisma } from "@/lib/db";
import { getRepublicClient } from "@/lib/republic";

describe("GET /api/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns healthy when all systems are up", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);
    vi.mocked(getRepublicClient).mockReturnValue({
      getStatus: vi.fn().mockResolvedValue({
        syncInfo: { latestBlockHeight: "12345" },
      }),
    } as never);
    vi.mocked(prisma.endpointHealth.findFirst).mockResolvedValue({
      timestamp: new Date(),
    } as never);

    const { GET } = await import("@/app/api/health/route");
    const req = new NextRequest("http://localhost/api/health");
    const res = await GET(req);
    const body = await res.json();

    expect(body.status).toBe("healthy");
    expect(body.version).toBeDefined();
    expect(body.timestamp).toBeDefined();
    expect(body.checks.database.status).toBe("healthy");
    expect(body.checks.chain.status).toBe("healthy");
  });

  it("returns degraded when DB is down", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error("DB down"));
    vi.mocked(getRepublicClient).mockReturnValue({
      getStatus: vi.fn().mockResolvedValue({
        syncInfo: { latestBlockHeight: "12345" },
      }),
    } as never);
    vi.mocked(prisma.endpointHealth.findFirst).mockRejectedValue(
      new Error("DB down"),
    );

    const { GET } = await import("@/app/api/health/route");
    const req = new NextRequest("http://localhost/api/health");
    const res = await GET(req);
    const body = await res.json();

    expect(body.status).toBe("degraded");
    expect(body.checks.database.status).toBe("down");
    expect(body.checks.chain.status).toBe("healthy");
  });

  it("returns degraded when chain is unreachable", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);
    vi.mocked(getRepublicClient).mockReturnValue({
      getStatus: vi.fn().mockRejectedValue(new Error("Connection refused")),
    } as never);
    vi.mocked(prisma.endpointHealth.findFirst).mockResolvedValue({
      timestamp: new Date(),
    } as never);

    const { GET } = await import("@/app/api/health/route");
    const req = new NextRequest("http://localhost/api/health");
    const res = await GET(req);
    const body = await res.json();

    expect(body.status).toBe("degraded");
    expect(body.checks.database.status).toBe("healthy");
    expect(body.checks.chain.status).toBe("down");
  });

  it("includes version and timestamp", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ "?column?": 1 }]);
    vi.mocked(getRepublicClient).mockReturnValue({
      getStatus: vi.fn().mockResolvedValue({
        syncInfo: { latestBlockHeight: "12345" },
      }),
    } as never);
    vi.mocked(prisma.endpointHealth.findFirst).mockResolvedValue(null);

    const { GET } = await import("@/app/api/health/route");
    const req = new NextRequest("http://localhost/api/health");
    const res = await GET(req);
    const body = await res.json();

    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(new Date(body.timestamp).getTime()).not.toBeNaN();
  });
});
