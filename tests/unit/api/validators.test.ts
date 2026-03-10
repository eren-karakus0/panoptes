import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    validator: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/api-helpers", () => ({
  withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
  jsonResponse: vi.fn((data, headers, status = 200) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(data, { status, headers });
  }),
}));

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

describe("GET /api/validators", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.validator.findMany).mockResolvedValue([mockValidator]);
    vi.mocked(prisma.validator.count).mockResolvedValue(1);
  });

  it("returns paginated validators with defaults", async () => {
    const { GET } = await import("@/app/api/validators/route");
    const req = new NextRequest("http://localhost/api/validators");
    const res = await GET(req);
    const body = await res.json();

    expect(body.validators).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.limit).toBe(50);
    expect(body.offset).toBe(0);
    expect(prisma.validator.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { tokens: "desc" },
        skip: 0,
        take: 50,
      }),
    );
  });

  it("filters by status", async () => {
    const { GET } = await import("@/app/api/validators/route");
    const req = new NextRequest(
      "http://localhost/api/validators?status=BOND_STATUS_BONDED",
    );
    await GET(req);

    expect(prisma.validator.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "BOND_STATUS_BONDED" }),
      }),
    );
  });

  it("filters by jailed", async () => {
    const { GET } = await import("@/app/api/validators/route");
    const req = new NextRequest(
      "http://localhost/api/validators?jailed=true",
    );
    await GET(req);

    expect(prisma.validator.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ jailed: true }),
      }),
    );
  });

  it("respects sort and order params", async () => {
    const { GET } = await import("@/app/api/validators/route");
    const req = new NextRequest(
      "http://localhost/api/validators?sort=commission&order=asc",
    );
    await GET(req);

    expect(prisma.validator.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { commission: "asc" },
      }),
    );
  });

  it("respects limit and offset params", async () => {
    const { GET } = await import("@/app/api/validators/route");
    const req = new NextRequest(
      "http://localhost/api/validators?limit=10&offset=20",
    );
    await GET(req);

    expect(prisma.validator.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 10,
      }),
    );
  });

  it("enforces max limit of 200", async () => {
    const { GET } = await import("@/app/api/validators/route");
    const req = new NextRequest(
      "http://localhost/api/validators?limit=500",
    );
    await GET(req);

    expect(prisma.validator.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        take: 200,
      }),
    );
  });
});
