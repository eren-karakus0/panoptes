import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    delegationEvent: { findMany: vi.fn() },
    networkStats: { findFirst: vi.fn() },
  },
}));

vi.mock("@/lib/intelligence/anomaly", () => ({
  createOrSkipAnomaly: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { createOrSkipAnomaly } from "@/lib/intelligence/anomaly";

describe("detectWhaleMovement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns zero when no recent events", async () => {
    vi.mocked(prisma.delegationEvent.findMany).mockResolvedValue([]);

    const { detectWhaleMovement } = await import("@/lib/intelligence/whale-detection");
    const result = await detectWhaleMovement();

    expect(result.detected).toBe(0);
  });

  it("returns zero when no network stats", async () => {
    vi.mocked(prisma.delegationEvent.findMany).mockResolvedValue([
      { id: "e-1", type: "delegate", delegator: "rai1whale", validatorTo: "val-1", amount: "1000000", timestamp: new Date() },
    ] as never);
    vi.mocked(prisma.networkStats.findFirst).mockResolvedValue(null);

    const { detectWhaleMovement } = await import("@/lib/intelligence/whale-detection");
    const result = await detectWhaleMovement();

    expect(result.detected).toBe(0);
  });

  it("detects whale movement when above threshold", async () => {
    vi.mocked(prisma.delegationEvent.findMany).mockResolvedValue([
      {
        id: "e-1", type: "delegate", delegator: "rai1whale",
        validatorFrom: null, validatorTo: "val-1",
        amount: "20000000", txHash: null, blockHeight: null,
        timestamp: new Date(),
      },
    ] as never);

    vi.mocked(prisma.networkStats.findFirst).mockResolvedValue({
      totalStaked: "1000000000", // 1B
    } as never);

    vi.mocked(createOrSkipAnomaly).mockResolvedValue(true);

    const { detectWhaleMovement } = await import("@/lib/intelligence/whale-detection");
    const result = await detectWhaleMovement();

    // 20M / 1B = 2% > 1% threshold
    expect(result.detected).toBe(1);
    expect(createOrSkipAnomaly).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "whale_movement",
        severity: "high",
        entityId: "rai1whale",
      }),
    );
  });

  it("creates critical severity for large movements", async () => {
    vi.mocked(prisma.delegationEvent.findMany).mockResolvedValue([
      {
        id: "e-1", type: "delegate", delegator: "rai1megawhale",
        validatorFrom: null, validatorTo: "val-1",
        amount: "60000000", txHash: null, blockHeight: null,
        timestamp: new Date(),
      },
    ] as never);

    vi.mocked(prisma.networkStats.findFirst).mockResolvedValue({
      totalStaked: "1000000000",
    } as never);

    vi.mocked(createOrSkipAnomaly).mockResolvedValue(true);

    const { detectWhaleMovement } = await import("@/lib/intelligence/whale-detection");
    const result = await detectWhaleMovement();

    // 60M / 1B = 6% > 5% critical threshold
    expect(result.detected).toBe(1);
    expect(createOrSkipAnomaly).toHaveBeenCalledWith(
      expect.objectContaining({
        severity: "critical",
      }),
    );
  });

  it("skips delegator with existing unresolved anomaly", async () => {
    vi.mocked(prisma.delegationEvent.findMany).mockResolvedValue([
      {
        id: "e-1", type: "delegate", delegator: "rai1whale",
        validatorFrom: null, validatorTo: "val-1",
        amount: "20000000", txHash: null, blockHeight: null,
        timestamp: new Date(),
      },
    ] as never);

    vi.mocked(prisma.networkStats.findFirst).mockResolvedValue({
      totalStaked: "1000000000",
    } as never);

    vi.mocked(createOrSkipAnomaly).mockResolvedValue(false); // duplicate prevention

    const { detectWhaleMovement } = await import("@/lib/intelligence/whale-detection");
    const result = await detectWhaleMovement();

    expect(result.detected).toBe(0);
    expect(createOrSkipAnomaly).toHaveBeenCalled();
  });

  it("ignores movements below threshold", async () => {
    vi.mocked(prisma.delegationEvent.findMany).mockResolvedValue([
      {
        id: "e-1", type: "delegate", delegator: "rai1small",
        validatorFrom: null, validatorTo: "val-1",
        amount: "1000", txHash: null, blockHeight: null,
        timestamp: new Date(),
      },
    ] as never);

    vi.mocked(prisma.networkStats.findFirst).mockResolvedValue({
      totalStaked: "1000000000",
    } as never);

    const { detectWhaleMovement } = await import("@/lib/intelligence/whale-detection");
    const result = await detectWhaleMovement();

    expect(result.detected).toBe(0);
    expect(createOrSkipAnomaly).not.toHaveBeenCalled();
  });

  it("aggregates movements from same delegator", async () => {
    vi.mocked(prisma.delegationEvent.findMany).mockResolvedValue([
      {
        id: "e-1", type: "delegate", delegator: "rai1whale",
        validatorFrom: null, validatorTo: "val-1",
        amount: "8000000", txHash: null, blockHeight: null,
        timestamp: new Date(),
      },
      {
        id: "e-2", type: "delegate", delegator: "rai1whale",
        validatorFrom: null, validatorTo: "val-2",
        amount: "7000000", txHash: null, blockHeight: null,
        timestamp: new Date(),
      },
    ] as never);

    vi.mocked(prisma.networkStats.findFirst).mockResolvedValue({
      totalStaked: "1000000000",
    } as never);

    vi.mocked(createOrSkipAnomaly).mockResolvedValue(true);

    const { detectWhaleMovement } = await import("@/lib/intelligence/whale-detection");
    const result = await detectWhaleMovement();

    // 8M + 7M = 15M / 1B = 1.5% > 1% threshold
    expect(result.detected).toBe(1);
  });
});

describe("detectWhaleMovement - DRY createOrSkipAnomaly", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls createOrSkipAnomaly from anomaly module", async () => {
    vi.mocked(prisma.delegationEvent.findMany).mockResolvedValue([
      {
        id: "e-1", type: "delegate", delegator: "rai1whale",
        validatorFrom: null, validatorTo: "val-1",
        amount: "20000000", txHash: null, blockHeight: null,
        timestamp: new Date(),
      },
    ] as never);

    vi.mocked(prisma.networkStats.findFirst).mockResolvedValue({
      totalStaked: "1000000000",
    } as never);

    vi.mocked(createOrSkipAnomaly).mockResolvedValue(true);

    const { detectWhaleMovement } = await import("@/lib/intelligence/whale-detection");
    const result = await detectWhaleMovement();

    expect(result.detected).toBe(1);
    expect(createOrSkipAnomaly).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "whale_movement",
        entityType: "network",
        entityId: "rai1whale",
      }),
    );
  });
});
