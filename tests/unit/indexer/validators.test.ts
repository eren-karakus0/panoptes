import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock prisma
vi.mock("@/lib/db", () => ({
  prisma: {
    validator: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
    validatorSnapshot: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock republic client
vi.mock("@/lib/republic", () => ({
  getRepublicClient: vi.fn(() => ({
    getValidators: vi.fn(),
  })),
}));

import { syncValidators } from "@/lib/indexer/validators";
import { prisma } from "@/lib/db";
import { getRepublicClient } from "@/lib/republic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGetClient = getRepublicClient as any;

function makeValidator(overrides = {}) {
  return {
    operatorAddress: "raivaloper1abc",
    moniker: "TestValidator",
    status: "BOND_STATUS_BONDED",
    tokens: "1000000",
    commission: "0.050000000000000000",
    jailed: false,
    ...overrides,
  };
}

function makeDbValidator(overrides = {}) {
  return {
    id: "raivaloper1abc",
    moniker: "TestValidator",
    status: "BOND_STATUS_BONDED",
    tokens: "1000000",
    commission: 0.05,
    jailed: false,
    votingPower: "1000000",
    uptime: 0,
    missedBlocks: 0,
    jailCount: 0,
    lastJailedAt: null,
    firstSeen: new Date(),
    lastUpdated: new Date(),
    ...overrides,
  };
}

describe("syncValidators", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      if (typeof fn === "function") {
        return fn({
          validator: { upsert: vi.fn() },
          validatorSnapshot: { create: vi.fn() },
        });
      }
      return fn;
    });
  });

  it("syncs new validators and creates snapshots", async () => {
    const val = makeValidator();
    mockGetClient.mockReturnValue({
      getValidators: vi.fn().mockResolvedValue([val]),
    });
    mockPrisma.validator.findMany.mockResolvedValue([]);

    const result = await syncValidators();

    expect(result.synced).toBe(1);
    expect(result.newValidators).toBe(1);
    expect(result.snapshotsCreated).toBe(1);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it("skips snapshot when data is unchanged", async () => {
    const val = makeValidator();
    mockGetClient.mockReturnValue({
      getValidators: vi.fn().mockResolvedValue([val]),
    });
    mockPrisma.validator.findMany.mockResolvedValue([makeDbValidator()]);

    const result = await syncValidators();

    expect(result.synced).toBe(1);
    expect(result.snapshotsCreated).toBe(0);
    expect(result.newValidators).toBe(0);
  });

  it("creates snapshot when tokens change", async () => {
    const val = makeValidator({ tokens: "2000000" });
    mockGetClient.mockReturnValue({
      getValidators: vi.fn().mockResolvedValue([val]),
    });
    mockPrisma.validator.findMany.mockResolvedValue([makeDbValidator()]);

    const result = await syncValidators();

    expect(result.snapshotsCreated).toBe(1);
  });

  it("forces daily snapshot when option is set", async () => {
    const val = makeValidator();
    mockGetClient.mockReturnValue({
      getValidators: vi.fn().mockResolvedValue([val]),
    });
    mockPrisma.validator.findMany.mockResolvedValue([makeDbValidator()]);

    const result = await syncValidators({ forceDailySnapshot: true });

    expect(result.snapshotsCreated).toBe(1);
  });

  it("tracks jail count when validator becomes jailed", async () => {
    const val = makeValidator({ jailed: true });
    mockGetClient.mockReturnValue({
      getValidators: vi.fn().mockResolvedValue([val]),
    });
    mockPrisma.validator.findMany.mockResolvedValue([
      makeDbValidator({ jailed: false, jailCount: 0 }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let upsertData: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      if (typeof fn === "function") {
        return fn({
          validator: {
            upsert: vi.fn().mockImplementation((args: unknown) => {
              upsertData = args;
            }),
          },
          validatorSnapshot: { create: vi.fn() },
        });
      }
      return fn;
    });

    await syncValidators();

    expect(upsertData.update.jailCount).toBe(1);
  });

  it("handles empty validator list", async () => {
    mockGetClient.mockReturnValue({
      getValidators: vi.fn().mockResolvedValue([]),
    });
    mockPrisma.validator.findMany.mockResolvedValue([]);

    const result = await syncValidators();

    expect(result.synced).toBe(0);
    expect(result.snapshotsCreated).toBe(0);
  });

  it("throws IndexerError on SDK failure", async () => {
    mockGetClient.mockReturnValue({
      getValidators: vi.fn().mockRejectedValue(new Error("RPC timeout")),
    });

    await expect(syncValidators()).rejects.toThrow("Failed to sync validators");
  });

  it("parses commission string to float", async () => {
    const val = makeValidator({ commission: "0.100000000000000000" });
    mockGetClient.mockReturnValue({
      getValidators: vi.fn().mockResolvedValue([val]),
    });
    mockPrisma.validator.findMany.mockResolvedValue([]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let upsertData: any = null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockPrisma.$transaction.mockImplementation(async (fn: any) => {
      if (typeof fn === "function") {
        return fn({
          validator: {
            upsert: vi.fn().mockImplementation((args: unknown) => {
              upsertData = args;
            }),
          },
          validatorSnapshot: { create: vi.fn() },
        });
      }
      return fn;
    });

    await syncValidators();

    expect(upsertData.create.commission).toBe(0.1);
  });
});
