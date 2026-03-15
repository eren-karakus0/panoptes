import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    delegationEvent: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    delegationSnapshot: { findMany: vi.fn() },
    anomaly: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/api-helpers")>();
  return {
    ...original,
    withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
  };
});

import { prisma } from "@/lib/db";

describe("GET /api/delegations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns delegation events with pagination", async () => {
    vi.mocked(prisma.delegationEvent.findMany).mockResolvedValue([
      {
        id: "e-1", type: "delegate", delegator: "rai1abc",
        validatorFrom: null, validatorTo: "val-1",
        amount: "1000000", txHash: null, blockHeight: null,
        timestamp: new Date(),
      },
    ] as never);
    vi.mocked(prisma.delegationEvent.count).mockResolvedValue(1);

    const { GET } = await import("@/app/api/delegations/route");
    const req = new NextRequest("http://localhost/api/delegations");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.events).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.limit).toBe(20);
    expect(body.offset).toBe(0);
  });

  it("filters by type", async () => {
    vi.mocked(prisma.delegationEvent.findMany).mockResolvedValue([]);
    vi.mocked(prisma.delegationEvent.count).mockResolvedValue(0);

    const { GET } = await import("@/app/api/delegations/route");
    const req = new NextRequest("http://localhost/api/delegations?type=undelegate");
    const res = await GET(req);
    const body = await res.json();

    expect(body.events).toHaveLength(0);
    expect(prisma.delegationEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "undelegate" }),
      }),
    );
  });

  it("filters by validatorId", async () => {
    vi.mocked(prisma.delegationEvent.findMany).mockResolvedValue([]);
    vi.mocked(prisma.delegationEvent.count).mockResolvedValue(0);

    const { GET } = await import("@/app/api/delegations/route");
    const req = new NextRequest("http://localhost/api/delegations?validatorId=val-1");
    await GET(req);

    expect(prisma.delegationEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ validatorTo: "val-1" }, { validatorFrom: "val-1" }],
        }),
      }),
    );
  });

  it("clamps limit to 100", async () => {
    vi.mocked(prisma.delegationEvent.findMany).mockResolvedValue([]);
    vi.mocked(prisma.delegationEvent.count).mockResolvedValue(0);

    const { GET } = await import("@/app/api/delegations/route");
    const req = new NextRequest("http://localhost/api/delegations?limit=999");
    const res = await GET(req);
    const body = await res.json();

    expect(body.limit).toBe(100);
  });
});

describe("GET /api/delegations/flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns flow data grouped by validator", async () => {
    vi.mocked(prisma.delegationSnapshot.findMany).mockResolvedValue([
      {
        validatorId: "val-1",
        totalDelegators: 10,
        totalDelegated: "5000000",
        churnRate: 3.2,
        timestamp: new Date(),
      },
      {
        validatorId: "val-1",
        totalDelegators: 9,
        totalDelegated: "4800000",
        churnRate: 1.5,
        timestamp: new Date(Date.now() - 3600_000),
      },
    ] as never);

    const { GET } = await import("@/app/api/delegations/flow/route");
    const req = new NextRequest("http://localhost/api/delegations/flow?days=7");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.flow).toHaveLength(1);
    expect(body.flow[0].validatorId).toBe("val-1");
    expect(body.flow[0].snapshotCount).toBe(2);
    expect(body.days).toBe(7);
  });

  it("clamps days to 30 max", async () => {
    vi.mocked(prisma.delegationSnapshot.findMany).mockResolvedValue([]);

    const { GET } = await import("@/app/api/delegations/flow/route");
    const req = new NextRequest("http://localhost/api/delegations/flow?days=365");
    const res = await GET(req);
    const body = await res.json();

    expect(body.days).toBe(30);
  });

  it("returns empty flow when no snapshots", async () => {
    vi.mocked(prisma.delegationSnapshot.findMany).mockResolvedValue([]);

    const { GET } = await import("@/app/api/delegations/flow/route");
    const req = new NextRequest("http://localhost/api/delegations/flow");
    const res = await GET(req);
    const body = await res.json();

    expect(body.flow).toHaveLength(0);
  });
});

describe("GET /api/delegations/whales", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns whale movement anomalies", async () => {
    vi.mocked(prisma.anomaly.findMany).mockResolvedValue([
      {
        id: "a-1",
        severity: "high",
        entityId: "rai1whale",
        title: "Whale movement: 2.5% of stake",
        description: "Large movement detected",
        metadata: JSON.stringify({ delegator: "rai1whale", movementPct: 2.5 }),
        resolved: false,
        detectedAt: new Date(),
        resolvedAt: null,
      },
    ] as never);

    const { GET } = await import("@/app/api/delegations/whales/route");
    const req = new NextRequest("http://localhost/api/delegations/whales");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.whales).toHaveLength(1);
    expect(body.whales[0].metadata.delegator).toBe("rai1whale");
    expect(body.total).toBe(1);
  });

  it("returns empty when no whale anomalies", async () => {
    vi.mocked(prisma.anomaly.findMany).mockResolvedValue([]);

    const { GET } = await import("@/app/api/delegations/whales/route");
    const req = new NextRequest("http://localhost/api/delegations/whales");
    const res = await GET(req);
    const body = await res.json();

    expect(body.whales).toHaveLength(0);
    expect(body.total).toBe(0);
  });
});
