import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    validator: {
      findUnique: vi.fn(),
    },
    validatorSnapshot: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/api-helpers", async () => {
  const { NextResponse } = await import("next/server");
  return {
    withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
    jsonResponse: vi.fn((data: unknown, headers: Record<string, string>, status = 200) =>
      NextResponse.json(data, { status, headers }),
    ),
  };
});

import { prisma } from "@/lib/db";

const mockValidator = {
  id: "raivaloper1abc",
  moniker: "TestValidator",
  status: "BOND_STATUS_BONDED",
  tokens: "1000000000000000000000",
  commission: 0.1,
  jailed: false,
  uptime: 99.5,
  votingPower: "1000",
  missedBlocks: 5,
  jailCount: 0,
  lastJailedAt: null,
  firstSeen: new Date("2025-01-01"),
  lastUpdated: new Date("2025-06-01"),
};

const mockSnapshot = {
  id: "snap1",
  validatorId: "raivaloper1abc",
  tokens: "1000000000000000000000",
  status: "BOND_STATUS_BONDED",
  commission: 0.1,
  jailed: false,
  votingPower: "1000",
  timestamp: new Date("2025-06-01"),
};

describe("GET /api/validators/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for non-existent validator", async () => {
    vi.mocked(prisma.validator.findUnique).mockResolvedValue(null);

    const { GET } = await import("@/app/api/validators/[id]/route");
    const req = new NextRequest(
      "http://localhost/api/validators/nonexistent",
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "nonexistent" }),
    });
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe("Validator not found");
  });

  it("returns validator with snapshots", async () => {
    vi.mocked(prisma.validator.findUnique).mockResolvedValue(mockValidator as never);
    vi.mocked(prisma.validatorSnapshot.findMany).mockResolvedValue([
      mockSnapshot,
    ] as never);
    vi.mocked(prisma.validatorSnapshot.count).mockResolvedValue(1);

    const { GET } = await import("@/app/api/validators/[id]/route");
    const req = new NextRequest(
      "http://localhost/api/validators/raivaloper1abc",
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "raivaloper1abc" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.validator.moniker).toBe("TestValidator");
    expect(body.snapshots).toHaveLength(1);
    expect(body.snapshotCount).toBe(1);
    expect(body.period).toBeDefined();
  });

  it("filters snapshots by date range", async () => {
    vi.mocked(prisma.validator.findUnique).mockResolvedValue(mockValidator as never);
    vi.mocked(prisma.validatorSnapshot.findMany).mockResolvedValue([]);
    vi.mocked(prisma.validatorSnapshot.count).mockResolvedValue(0);

    const { GET } = await import("@/app/api/validators/[id]/route");
    const req = new NextRequest(
      "http://localhost/api/validators/raivaloper1abc?from=2025-05-01&to=2025-05-31",
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "raivaloper1abc" }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.snapshots).toHaveLength(0);
    expect(prisma.validatorSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          timestamp: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
      }),
    );
  });

  it("respects snapshot limit", async () => {
    vi.mocked(prisma.validator.findUnique).mockResolvedValue(mockValidator as never);
    vi.mocked(prisma.validatorSnapshot.findMany).mockResolvedValue([]);
    vi.mocked(prisma.validatorSnapshot.count).mockResolvedValue(0);

    const { GET } = await import("@/app/api/validators/[id]/route");
    const req = new NextRequest(
      "http://localhost/api/validators/raivaloper1abc?limit=10",
    );
    await GET(req, {
      params: Promise.resolve({ id: "raivaloper1abc" }),
    });

    expect(prisma.validatorSnapshot.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 10,
      }),
    );
  });
});
