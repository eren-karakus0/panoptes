import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    governanceProposal: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    governanceVote: {
      upsert: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({
      governanceProposal: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
        update: vi.fn().mockResolvedValue({}),
      },
      governanceVote: {
        upsert: vi.fn().mockResolvedValue({}),
      },
    })),
  },
}));

vi.mock("@/lib/events/publish", () => ({
  publishEvent: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { publishEvent } from "@/lib/events/publish";

describe("syncGovernance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates new proposals from chain data", async () => {
    // Mock fetch to return proposals + votes
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          proposals: [
            {
              id: "1",
              title: "Test Proposal",
              summary: "Description",
              status: "PROPOSAL_STATUS_VOTING_PERIOD",
              submit_time: "2026-01-01T00:00:00Z",
              voting_start_time: "2026-01-01T00:00:00Z",
              voting_end_time: "2026-01-02T00:00:00Z",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ votes: [] }),
      });
    vi.stubGlobal("fetch", mockFetch);

    const txCreate = vi.fn().mockResolvedValue({});
    vi.mocked(prisma.$transaction).mockImplementation((async (fn: (tx: unknown) => unknown) => {
      return fn({
        governanceProposal: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: txCreate,
          update: vi.fn().mockResolvedValue({}),
        },
        governanceVote: { upsert: vi.fn().mockResolvedValue({}) },
      });
    }) as never);

    const { syncGovernance } = await import("@/lib/indexer/governance");
    const result = await syncGovernance();

    expect(result.proposalsSynced).toBe(1);
    expect(txCreate).toHaveBeenCalled();
    expect(publishEvent).toHaveBeenCalled(); // proposal_created event

    vi.unstubAllGlobals();
  });

  it("updates existing proposals", async () => {
    const mockFetch = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          proposals: [
            { id: "1", title: "Existing", status: "PROPOSAL_STATUS_PASSED" },
          ],
        }),
      });
    vi.stubGlobal("fetch", mockFetch);

    const txUpdate = vi.fn().mockResolvedValue({});
    vi.mocked(prisma.$transaction).mockImplementation((async (fn: (tx: unknown) => unknown) => {
      return fn({
        governanceProposal: {
          findUnique: vi.fn().mockResolvedValue({
            id: "1", title: "Existing", status: "PROPOSAL_STATUS_VOTING_PERIOD",
          }),
          create: vi.fn().mockResolvedValue({}),
          update: txUpdate,
        },
        governanceVote: { upsert: vi.fn().mockResolvedValue({}) },
      });
    }) as never);

    const { syncGovernance } = await import("@/lib/indexer/governance");
    const result = await syncGovernance();

    expect(result.proposalsSynced).toBe(1);
    expect(txUpdate).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("handles fetch failure gracefully", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", mockFetch);

    const { syncGovernance } = await import("@/lib/indexer/governance");
    const result = await syncGovernance();

    expect(result.proposalsSynced).toBe(0);
    expect(result.votesSynced).toBe(0);

    vi.unstubAllGlobals();
  });
});

describe("syncGovernance - pagination", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("follows pagination.next_key for proposals", async () => {
    const mockFetch = vi.fn()
      // First page of proposals
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          proposals: [{ id: "1", title: "Proposal 1", status: "PROPOSAL_STATUS_DEPOSIT_PERIOD" }],
          pagination: { next_key: "page2key" },
        }),
      })
      // Second page of proposals
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          proposals: [{ id: "2", title: "Proposal 2", status: "PROPOSAL_STATUS_DEPOSIT_PERIOD" }],
          pagination: { next_key: null },
        }),
      });
    vi.stubGlobal("fetch", mockFetch);

    vi.mocked(prisma.$transaction).mockImplementation((async (fn: (tx: unknown) => unknown) => {
      return fn({
        governanceProposal: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({}),
          update: vi.fn().mockResolvedValue({}),
        },
        governanceVote: { upsert: vi.fn().mockResolvedValue({}) },
      });
    }) as never);

    const { syncGovernance } = await import("@/lib/indexer/governance");
    const result = await syncGovernance();

    expect(result.proposalsSynced).toBe(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });

  it("uses $transaction for batch operations", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        proposals: [{ id: "1", title: "Test", status: "PROPOSAL_STATUS_DEPOSIT_PERIOD" }],
        pagination: { next_key: null },
      }),
    });
    vi.stubGlobal("fetch", mockFetch);

    vi.mocked(prisma.$transaction).mockImplementation((async (fn: (tx: unknown) => unknown) => {
      return fn({
        governanceProposal: {
          findUnique: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue({}),
        },
        governanceVote: { upsert: vi.fn() },
      });
    }) as never);

    const { syncGovernance } = await import("@/lib/indexer/governance");
    await syncGovernance();

    expect(prisma.$transaction).toHaveBeenCalled();

    vi.unstubAllGlobals();
  });

  it("logs errors on fetch failure", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network error"));
    vi.stubGlobal("fetch", mockFetch);

    const { syncGovernance } = await import("@/lib/indexer/governance");
    const result = await syncGovernance();

    expect(result.proposalsSynced).toBe(0);
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
    vi.unstubAllGlobals();
  });
});
