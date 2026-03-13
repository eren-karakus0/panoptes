import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    $transaction: vi.fn(),
    validatorSnapshot: { deleteMany: vi.fn() },
    endpointHealth: { deleteMany: vi.fn() },
    networkStats: { deleteMany: vi.fn() },
    endpointScore: { deleteMany: vi.fn() },
    validatorScore: { deleteMany: vi.fn() },
    anomaly: { deleteMany: vi.fn() },
    outboxEvent: { deleteMany: vi.fn() },
    webhookDelivery: { deleteMany: vi.fn() },
    sloEvaluation: { deleteMany: vi.fn() },
  },
}));

import { cleanupOldData } from "@/lib/indexer/cleanup";
import { prisma } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

describe("cleanupOldData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes old data within retention periods", async () => {
    mockPrisma.$transaction.mockResolvedValue([
      { count: 100 },
      { count: 50 },
      { count: 25 },
      { count: 10 },
      { count: 5 },
      { count: 3 },
      { count: 7 },
      { count: 12 },
      { count: 4 },
      { count: 8 },
    ]);

    const result = await cleanupOldData();

    expect(result.deletedSnapshots).toBe(100);
    expect(result.deletedHealthChecks).toBe(50);
    expect(result.deletedStats).toBe(25);
    expect(result.deletedScores).toBe(10);
    expect(result.deletedValidatorScores).toBe(5);
    expect(result.deletedAnomalies).toBe(3);
    expect(result.deletedOutboxEvents).toBe(7);
    expect(result.deletedDeliveries).toBe(16);
    expect(result.deletedSloEvaluations).toBe(8);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });

  it("handles empty tables", async () => {
    mockPrisma.$transaction.mockResolvedValue([
      { count: 0 },
      { count: 0 },
      { count: 0 },
      { count: 0 },
      { count: 0 },
      { count: 0 },
      { count: 0 },
      { count: 0 },
      { count: 0 },
      { count: 0 },
    ]);

    const result = await cleanupOldData();

    expect(result.deletedSnapshots).toBe(0);
    expect(result.deletedHealthChecks).toBe(0);
    expect(result.deletedStats).toBe(0);
    expect(result.deletedOutboxEvents).toBe(0);
    expect(result.deletedDeliveries).toBe(0);
    expect(result.deletedSloEvaluations).toBe(0);
  });

  it("throws IndexerError on failure", async () => {
    mockPrisma.$transaction.mockRejectedValue(
      new Error("Transaction failed"),
    );

    await expect(cleanupOldData()).rejects.toThrow("Failed to cleanup old data");
  });
});
