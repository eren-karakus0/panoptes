import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    validator: {
      count: vi.fn(),
    },
    networkStats: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/republic", () => ({
  getRepublicClient: vi.fn(() => ({
    getStatus: vi.fn(),
  })),
}));

vi.mock("@/lib/events/publish", () => ({
  publishEvent: vi.fn().mockResolvedValue(1),
  publishEvents: vi.fn().mockResolvedValue(undefined),
}));

import { aggregateStats } from "@/lib/indexer/stats";
import { prisma } from "@/lib/db";
import { getRepublicClient } from "@/lib/republic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetClient = getRepublicClient as any;

describe("aggregateStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetClient.mockReturnValue({
      getStatus: vi.fn().mockResolvedValue({
        syncInfo: { latestBlockHeight: "100000" },
      }),
    });

    mockPrisma.validator.count
      .mockResolvedValueOnce(50) // total
      .mockResolvedValueOnce(30); // active (bonded)

    mockPrisma.$queryRaw
      .mockResolvedValueOnce([{ total: "1000000" }]) // bonded tokens (TEXT)
      .mockResolvedValueOnce([{ total: "2000000" }]); // all tokens (TEXT)

    mockPrisma.networkStats.findMany.mockResolvedValue([]);
    mockPrisma.networkStats.create.mockResolvedValue({});
  });

  it("aggregates stats from chain and DB", async () => {
    const result = await aggregateStats();

    expect(result.blockHeight).toBe("100000");
    expect(result.totalValidators).toBe(50);
    expect(result.activeValidators).toBe(30);
    expect(result.totalStaked).toBe("1000000");
  });

  it("calculates avg block time from last two records", async () => {
    const now = Date.now();
    mockPrisma.networkStats.findMany.mockResolvedValue([
      {
        id: "s1",
        totalValidators: 50,
        activeValidators: 30,
        totalStaked: "1000000",
        bondedRatio: 0.5,
        blockHeight: BigInt(99990),
        avgBlockTime: null,
        timestamp: new Date(now),
      },
      {
        id: "s2",
        totalValidators: 50,
        activeValidators: 30,
        totalStaked: "1000000",
        bondedRatio: 0.5,
        blockHeight: BigInt(99980),
        avgBlockTime: null,
        timestamp: new Date(now - 60000),
      },
    ]);

    const result = await aggregateStats();

    expect(result.blockHeight).toBe("100000");
    expect(mockPrisma.networkStats.create).toHaveBeenCalled();
  });

  it("handles zero total tokens gracefully", async () => {
    mockPrisma.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([{ total: "0" }])
      .mockResolvedValueOnce([{ total: "0" }]);

    const result = await aggregateStats();

    expect(result.totalStaked).toBe("0");
  });

  it("throws IndexerError on failure", async () => {
    mockGetClient.mockReturnValue({
      getStatus: vi.fn().mockRejectedValue(new Error("Connection failed")),
    });

    await expect(aggregateStats()).rejects.toThrow("Failed to aggregate stats");
  });
});
