import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    governanceProposal: { count: vi.fn() },
    governanceVote: { count: vi.fn(), groupBy: vi.fn() },
    validator: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";

describe("computeGovernanceScores", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty array when no proposals", async () => {
    vi.mocked(prisma.governanceProposal.count).mockResolvedValue(0);

    const { computeGovernanceScores } = await import("@/lib/intelligence/governance-scoring");
    const scores = await computeGovernanceScores();

    expect(scores).toEqual([]);
  });

  it("calculates participation rates", async () => {
    vi.mocked(prisma.governanceProposal.count).mockResolvedValue(10);
    vi.mocked(prisma.validator.findMany).mockResolvedValue([
      { id: "val-1" },
      { id: "val-2" },
    ] as never);
    vi.mocked(prisma.governanceVote.groupBy).mockResolvedValue([
      { voter: "val-1", _count: { id: 8 } },
      { voter: "val-2", _count: { id: 3 } },
    ] as never);

    const { computeGovernanceScores } = await import("@/lib/intelligence/governance-scoring");
    const scores = await computeGovernanceScores();

    expect(scores).toHaveLength(2);
    expect(scores[0].participationRate).toBeCloseTo(0.8);
    expect(scores[1].participationRate).toBeCloseTo(0.3);
  });
});

describe("computeGovernanceWeight", () => {
  it("returns clamped value between 0 and 1", async () => {
    const { computeGovernanceWeight } = await import("@/lib/intelligence/governance-scoring");

    expect(computeGovernanceWeight(0)).toBe(0);
    expect(computeGovernanceWeight(0.5)).toBe(0.5);
    expect(computeGovernanceWeight(1)).toBe(1);
    expect(computeGovernanceWeight(1.5)).toBe(1);
    expect(computeGovernanceWeight(-0.2)).toBe(0);
  });
});

describe("computeGovernanceScores - groupBy optimization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses groupBy instead of N+1 queries", async () => {
    vi.mocked(prisma.governanceProposal.count).mockResolvedValue(10);
    vi.mocked(prisma.validator.findMany).mockResolvedValue([
      { id: "val-1" },
      { id: "val-2" },
      { id: "val-3" },
    ] as never);

    vi.mocked(prisma.governanceVote.groupBy).mockResolvedValue([
      { voter: "val-1", _count: { id: 8 } },
      { voter: "val-2", _count: { id: 3 } },
    ] as never);

    const { computeGovernanceScores } = await import("@/lib/intelligence/governance-scoring");
    const scores = await computeGovernanceScores();

    expect(scores).toHaveLength(3);
    expect(scores[0].participationRate).toBeCloseTo(0.8);
    expect(scores[1].participationRate).toBeCloseTo(0.3);
    expect(scores[2].participationRate).toBe(0); // val-3 has no votes

    // Verify groupBy was called instead of individual counts
    expect(prisma.governanceVote.groupBy).toHaveBeenCalledWith({
      by: ["voter"],
      _count: { id: true },
    });
    // count should NOT have been called for individual validators
    expect(prisma.governanceVote.count).not.toHaveBeenCalled();
  });
});
