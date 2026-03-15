import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    governanceProposal: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    governanceVote: { count: vi.fn(), groupBy: vi.fn() },
    validator: { findMany: vi.fn() },
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

describe("GET /api/governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns proposal list", async () => {
    vi.mocked(prisma.governanceProposal.findMany).mockResolvedValue([
      {
        id: "1", title: "Test Proposal", description: null,
        status: "PROPOSAL_STATUS_PASSED", proposer: null,
        submitTime: new Date(), votingStartTime: null, votingEndTime: null,
        yesVotes: "100", noVotes: "10", abstainVotes: "5", vetoVotes: "2",
      },
    ] as never);
    vi.mocked(prisma.governanceProposal.count).mockResolvedValue(1);

    const { GET } = await import("@/app/api/governance/route");
    const req = new NextRequest("http://localhost/api/governance");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.proposals).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it("filters by status", async () => {
    vi.mocked(prisma.governanceProposal.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.governanceProposal.count).mockResolvedValue(0);

    const { GET } = await import("@/app/api/governance/route");
    const req = new NextRequest("http://localhost/api/governance?status=PROPOSAL_STATUS_VOTING_PERIOD");
    const res = await GET(req);
    const body = await res.json();

    expect(body.proposals).toHaveLength(0);
  });
});

describe("GET /api/governance/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns proposal with votes", async () => {
    vi.mocked(prisma.governanceProposal.findUnique).mockResolvedValue({
      id: "1", title: "Test", description: null,
      status: "PROPOSAL_STATUS_PASSED", proposer: null,
      submitTime: null, votingStartTime: null, votingEndTime: null,
      yesVotes: "10", noVotes: "2", abstainVotes: "1", vetoVotes: "0",
      votes: [
        { id: "v-1", proposalId: "1", voter: "val-1", option: "VOTE_OPTION_YES", votedAt: null, createdAt: new Date() },
        { id: "v-2", proposalId: "1", voter: "val-2", option: "VOTE_OPTION_NO", votedAt: null, createdAt: new Date() },
      ],
    } as never);

    const { GET } = await import("@/app/api/governance/[id]/route");
    const req = new NextRequest("http://localhost/api/governance/1");
    const res = await GET(req, { params: Promise.resolve({ id: "1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.voteCount).toBe(2);
    expect(body.voteSummary.yes).toBe(1);
    expect(body.voteSummary.no).toBe(1);
  });

  it("returns 404 for missing proposal", async () => {
    vi.mocked(prisma.governanceProposal.findUnique).mockResolvedValue(null);

    const { GET } = await import("@/app/api/governance/[id]/route");
    const req = new NextRequest("http://localhost/api/governance/999");
    const res = await GET(req, { params: Promise.resolve({ id: "999" }) });

    expect(res.status).toBe(404);
  });
});

describe("GET /api/governance/participation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns participation rates", async () => {
    vi.mocked(prisma.governanceProposal.count).mockResolvedValue(5);
    vi.mocked(prisma.validator.findMany).mockResolvedValue([
      { id: "val-1" },
    ] as never);
    vi.mocked(prisma.governanceVote.groupBy).mockResolvedValue([
      { voter: "val-1", _count: { id: 3 } },
    ] as never);

    const { GET } = await import("@/app/api/governance/participation/route");
    const req = new NextRequest("http://localhost/api/governance/participation");
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.validators).toHaveLength(1);
    expect(body.validators[0].participationRate).toBeCloseTo(0.6);
  });
});
