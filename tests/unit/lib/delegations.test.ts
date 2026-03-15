import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    validator: { findMany: vi.fn() },
    delegationSnapshot: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    delegationEvent: { create: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";

describe("syncDelegations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates snapshots for all validators", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        delegation_responses: [
          {
            delegation: { delegator_address: "rai1abc", validator_address: "raivaloper1xyz", shares: "1000" },
            balance: { denom: "urai", amount: "1000000" },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    vi.mocked(prisma.validator.findMany).mockResolvedValue([
      { id: "raivaloper1xyz", moniker: "Test Validator" },
    ] as never);
    vi.mocked(prisma.delegationSnapshot.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.delegationSnapshot.create).mockResolvedValue({} as never);

    const { syncDelegations } = await import("@/lib/indexer/delegations");
    const result = await syncDelegations();

    expect(result.snapshotsTaken).toBe(1);
    expect(prisma.delegationSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          validatorId: "raivaloper1xyz",
          totalDelegators: 1,
        }),
      }),
    );

    vi.unstubAllGlobals();
  });

  it("detects new delegations from snapshot comparison", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        delegation_responses: [
          {
            delegation: { delegator_address: "rai1new", validator_address: "raivaloper1xyz", shares: "500" },
            balance: { denom: "urai", amount: "500000" },
          },
          {
            delegation: { delegator_address: "rai1old", validator_address: "raivaloper1xyz", shares: "100" },
            balance: { denom: "urai", amount: "100000" },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    vi.mocked(prisma.validator.findMany).mockResolvedValue([
      { id: "raivaloper1xyz", moniker: "Test" },
    ] as never);

    // Previous snapshot had only rai1old
    vi.mocked(prisma.delegationSnapshot.findFirst).mockResolvedValue({
      id: "snap-1",
      validatorId: "raivaloper1xyz",
      totalDelegators: 1,
      totalDelegated: "100000",
      topDelegators: JSON.stringify([{ address: "rai1old", amount: "100000" }]),
      churnRate: 0,
      timestamp: new Date(),
    } as never);
    vi.mocked(prisma.delegationSnapshot.create).mockResolvedValue({} as never);
    vi.mocked(prisma.delegationEvent.create).mockResolvedValue({} as never);

    const { syncDelegations } = await import("@/lib/indexer/delegations");
    const result = await syncDelegations();

    expect(result.eventsSynced).toBeGreaterThan(0);
    expect(prisma.delegationEvent.create).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("detects undelegations", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ delegation_responses: [] }),
    });
    vi.stubGlobal("fetch", mockFetch);

    vi.mocked(prisma.validator.findMany).mockResolvedValue([
      { id: "raivaloper1xyz", moniker: "Test" },
    ] as never);

    vi.mocked(prisma.delegationSnapshot.findFirst).mockResolvedValue({
      id: "snap-1",
      validatorId: "raivaloper1xyz",
      totalDelegators: 1,
      totalDelegated: "500000",
      topDelegators: JSON.stringify([{ address: "rai1old", amount: "500000" }]),
      churnRate: 0,
      timestamp: new Date(),
    } as never);
    vi.mocked(prisma.delegationSnapshot.create).mockResolvedValue({} as never);
    vi.mocked(prisma.delegationEvent.create).mockResolvedValue({} as never);

    const { syncDelegations } = await import("@/lib/indexer/delegations");
    const result = await syncDelegations();

    expect(result.eventsSynced).toBe(1);
    expect(prisma.delegationEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "undelegate", delegator: "rai1old" }),
      }),
    );

    vi.unstubAllGlobals();
  });

  it("handles empty validator list", async () => {
    vi.mocked(prisma.validator.findMany).mockResolvedValue([]);

    const { syncDelegations } = await import("@/lib/indexer/delegations");
    const result = await syncDelegations();

    expect(result.snapshotsTaken).toBe(0);
    expect(result.eventsSynced).toBe(0);
  });

  it("handles fetch failure gracefully", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", mockFetch);

    vi.mocked(prisma.validator.findMany).mockResolvedValue([
      { id: "raivaloper1xyz", moniker: "Test" },
    ] as never);
    vi.mocked(prisma.delegationSnapshot.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.delegationSnapshot.create).mockResolvedValue({} as never);

    const { syncDelegations } = await import("@/lib/indexer/delegations");
    const result = await syncDelegations();

    // Should still take snapshot (with 0 delegators)
    expect(result.snapshotsTaken).toBe(1);

    vi.unstubAllGlobals();
  });
});

describe("syncDelegations - pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("follows pagination.next_key for delegations", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          delegation_responses: [
            {
              delegation: { delegator_address: "rai1abc", validator_address: "raivaloper1xyz", shares: "1000" },
              balance: { denom: "urai", amount: "1000000" },
            },
          ],
          pagination: { next_key: "page2" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          delegation_responses: [
            {
              delegation: { delegator_address: "rai1def", validator_address: "raivaloper1xyz", shares: "2000" },
              balance: { denom: "urai", amount: "2000000" },
            },
          ],
          pagination: { next_key: null },
        }),
      });
    vi.stubGlobal("fetch", mockFetch);

    vi.mocked(prisma.validator.findMany).mockResolvedValue([
      { id: "raivaloper1xyz", moniker: "Test" },
    ] as never);
    vi.mocked(prisma.delegationSnapshot.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.delegationSnapshot.create).mockResolvedValue({} as never);

    const { syncDelegations } = await import("@/lib/indexer/delegations");
    const result = await syncDelegations();

    expect(result.snapshotsTaken).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(2);
    // Verify snapshot has 2 delegators
    expect(prisma.delegationSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalDelegators: 2,
        }),
      }),
    );

    vi.unstubAllGlobals();
  });

  it("logs errors on fetch failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", mockFetch);

    vi.mocked(prisma.validator.findMany).mockResolvedValue([
      { id: "raivaloper1xyz", moniker: "Test" },
    ] as never);
    vi.mocked(prisma.delegationSnapshot.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.delegationSnapshot.create).mockResolvedValue({} as never);

    const { syncDelegations } = await import("@/lib/indexer/delegations");
    await syncDelegations();

    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});

describe("syncDelegations - BigInt edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("handles zero delegation amount", async () => {
    // Arrange
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        delegation_responses: [
          {
            delegation: { delegator_address: "rai1zero", validator_address: "raivaloper1xyz", shares: "0" },
            balance: { denom: "urai", amount: "0" },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    vi.mocked(prisma.validator.findMany).mockResolvedValue([
      { id: "raivaloper1xyz", moniker: "Test" },
    ] as never);
    vi.mocked(prisma.delegationSnapshot.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.delegationSnapshot.create).mockResolvedValue({} as never);

    // Act
    const { syncDelegations } = await import("@/lib/indexer/delegations");
    const result = await syncDelegations();

    // Assert
    expect(result.snapshotsTaken).toBe(1);
    expect(prisma.delegationSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalDelegated: "0",
          totalDelegators: 1,
        }),
      }),
    );

    vi.unstubAllGlobals();
  });

  it("handles very large delegation amounts", async () => {
    // Arrange
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        delegation_responses: [
          {
            delegation: { delegator_address: "rai1whale", validator_address: "raivaloper1xyz", shares: "999999999999999999999999" },
            balance: { denom: "urai", amount: "999999999999999999999999" },
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    vi.mocked(prisma.validator.findMany).mockResolvedValue([
      { id: "raivaloper1xyz", moniker: "Test" },
    ] as never);
    vi.mocked(prisma.delegationSnapshot.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.delegationSnapshot.create).mockResolvedValue({} as never);

    // Act
    const { syncDelegations } = await import("@/lib/indexer/delegations");
    const result = await syncDelegations();

    // Assert
    expect(result.snapshotsTaken).toBe(1);
    expect(prisma.delegationSnapshot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          totalDelegated: "999999999999999999999999",
          totalDelegators: 1,
        }),
      }),
    );

    vi.unstubAllGlobals();
  });
});
