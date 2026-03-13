import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/db", () => {
  const sloModel = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return {
    prisma: {
      slo: sloModel,
      sloEvaluation: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      endpoint: { findUnique: vi.fn() },
      validator: { findUnique: vi.fn() },
      $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
        fn({ slo: sloModel, $queryRaw: vi.fn().mockResolvedValue([]) }),
      ),
    },
  };
});

vi.mock("@/lib/api-helpers", () => ({
  withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
}));

vi.mock("@/lib/workspace-auth", () => ({
  requireWorkspace: vi.fn(),
}));

vi.mock("@/lib/intelligence", () => ({
  computeEndpointScores: vi.fn().mockResolvedValue({ scored: 3, duration: 100 }),
  computeValidatorScores: vi.fn().mockResolvedValue({ scored: 5, duration: 200 }),
  detectAnomalies: vi.fn().mockResolvedValue({ detected: 0, resolved: 0, duration: 50 }),
  evaluateSlos: vi.fn().mockResolvedValue({
    evaluated: 2,
    breached: 0,
    recovered: 0,
    exhausted: 0,
    skipped: 0,
    duration: 100,
  }),
  correlateIncidents: vi.fn().mockResolvedValue({ created: 0, linked: 0, resolved: 0, duration: 10 }),
}));

import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace-auth";

const mockWorkspace = { id: "ws-1", name: "Test", slug: "test" };

const mockSlo = {
  id: "slo-1",
  workspaceId: "ws-1",
  name: "RPC Uptime",
  indicator: "uptime",
  entityType: "endpoint",
  entityId: "ep-1",
  target: 0.999,
  windowDays: 7,
  isActive: true,
  isBreaching: false,
  currentValue: 0.9995,
  budgetConsumed: 0.0,
  burnRate: 0.0,
  lastEvaluatedAt: new Date(),
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

function authSuccess() {
  vi.mocked(requireWorkspace).mockResolvedValue({ workspace: mockWorkspace });
}

function authFail() {
  vi.mocked(requireWorkspace).mockResolvedValue({
    error: NextResponse.json(
      { error: "Unauthorized — valid workspace token required" },
      { status: 401 },
    ),
  });
}

describe("GET /api/slos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("returns SLO list", async () => {
    vi.mocked(prisma.slo.findMany).mockResolvedValue([mockSlo] as never);

    const { GET } = await import("@/app/api/slos/route");
    const req = new NextRequest("http://localhost/api/slos", {
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(body.slos).toHaveLength(1);
    expect(body.slos[0].name).toBe("RPC Uptime");
  });

  it("returns 401 without auth", async () => {
    authFail();
    const { GET } = await import("@/app/api/slos/route");
    const req = new NextRequest("http://localhost/api/slos");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/slos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
    vi.mocked(prisma.slo.count).mockResolvedValue(0);
    vi.mocked(prisma.slo.create).mockResolvedValue(mockSlo as never);
    vi.mocked(prisma.endpoint.findUnique).mockResolvedValue({ id: "ep-1" } as never);
  });

  it("creates SLO and returns 201", async () => {
    const { POST } = await import("@/app/api/slos/route");
    const req = new NextRequest("http://localhost/api/slos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({
        name: "RPC Uptime",
        indicator: "uptime",
        entityType: "endpoint",
        entityId: "ep-1",
        target: 0.999,
        windowDays: 7,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("returns 400 on invalid body", async () => {
    const { POST } = await import("@/app/api/slos/route");
    const req = new NextRequest("http://localhost/api/slos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({ name: "" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 409 when workspace limit reached", async () => {
    vi.mocked(prisma.slo.count).mockResolvedValue(20);

    const { POST } = await import("@/app/api/slos/route");
    const req = new NextRequest("http://localhost/api/slos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({
        name: "Test SLO",
        indicator: "uptime",
        entityType: "endpoint",
        entityId: "ep-1",
        target: 0.999,
        windowDays: 7,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("returns 404 when entity not found", async () => {
    vi.mocked(prisma.endpoint.findUnique).mockResolvedValue(null);

    const { POST } = await import("@/app/api/slos/route");
    const req = new NextRequest("http://localhost/api/slos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({
        name: "Test SLO",
        indicator: "uptime",
        entityType: "endpoint",
        entityId: "ep-nonexistent",
        target: 0.999,
        windowDays: 7,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 on incompatible indicator-entityType", async () => {
    const { POST } = await import("@/app/api/slos/route");
    const req = new NextRequest("http://localhost/api/slos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({
        name: "Bad SLO",
        indicator: "block_production",
        entityType: "endpoint",
        entityId: "ep-1",
        target: 0.999,
        windowDays: 7,
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("not compatible");
  });

  it("returns 400 on invalid JSON", async () => {
    const { POST } = await import("@/app/api/slos/route");
    const req = new NextRequest("http://localhost/api/slos", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: "not-json",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/slos/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("returns SLO detail", async () => {
    vi.mocked(prisma.slo.findFirst).mockResolvedValue(mockSlo as never);

    const { GET } = await import("@/app/api/slos/[id]/route");
    const req = new NextRequest("http://localhost/api/slos/slo-1", {
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "slo-1" }) });
    const body = await res.json();

    expect(body.name).toBe("RPC Uptime");
  });

  it("returns 404 for wrong workspace", async () => {
    vi.mocked(prisma.slo.findFirst).mockResolvedValue(null);

    const { GET } = await import("@/app/api/slos/[id]/route");
    const req = new NextRequest("http://localhost/api/slos/slo-other", {
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await GET(req, {
      params: Promise.resolve({ id: "slo-other" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/slos/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("updates SLO fields", async () => {
    vi.mocked(prisma.slo.findFirst).mockResolvedValue(mockSlo as never);
    vi.mocked(prisma.slo.update).mockResolvedValue({
      ...mockSlo,
      name: "Updated SLO",
    } as never);

    const { PATCH } = await import("@/app/api/slos/[id]/route");
    const req = new NextRequest("http://localhost/api/slos/slo-1", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({ name: "Updated SLO" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "slo-1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.name).toBe("Updated SLO");
  });

  it("returns 400 on empty body", async () => {
    const { PATCH } = await import("@/app/api/slos/[id]/route");
    const req = new NextRequest("http://localhost/api/slos/slo-1", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "slo-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 for wrong workspace", async () => {
    vi.mocked(prisma.slo.findFirst).mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/slos/[id]/route");
    const req = new NextRequest("http://localhost/api/slos/slo-other", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({ name: "Updated" }),
    });
    const res = await PATCH(req, {
      params: Promise.resolve({ id: "slo-other" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/slos/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("deletes SLO and returns 204", async () => {
    vi.mocked(prisma.slo.findFirst).mockResolvedValue(mockSlo as never);
    vi.mocked(prisma.slo.delete).mockResolvedValue(mockSlo as never);

    const { DELETE } = await import("@/app/api/slos/[id]/route");
    const req = new NextRequest("http://localhost/api/slos/slo-1", {
      method: "DELETE",
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "slo-1" }),
    });
    expect(res.status).toBe(204);
  });

  it("returns 404 for wrong workspace", async () => {
    vi.mocked(prisma.slo.findFirst).mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/slos/[id]/route");
    const req = new NextRequest("http://localhost/api/slos/slo-other", {
      method: "DELETE",
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await DELETE(req, {
      params: Promise.resolve({ id: "slo-other" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/slos/:id/evaluations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("returns paginated evaluation list", async () => {
    vi.mocked(prisma.slo.findFirst).mockResolvedValue({ id: "slo-1" } as never);
    const mockEval = {
      id: "eval-1",
      sloId: "slo-1",
      sliValue: 0.9995,
      budgetConsumed: 0.05,
      budgetRemaining: 0.95,
      burnRate: 0.05,
      isBreaching: false,
      evaluatedAt: new Date(),
    };
    vi.mocked(prisma.sloEvaluation.findMany).mockResolvedValue([mockEval] as never);
    vi.mocked(prisma.sloEvaluation.count).mockResolvedValue(1);

    const { GET } = await import("@/app/api/slos/[id]/evaluations/route");
    const req = new NextRequest("http://localhost/api/slos/slo-1/evaluations", {
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "slo-1" }) });
    const body = await res.json();

    expect(body.evaluations).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it("returns 404 for wrong workspace", async () => {
    vi.mocked(prisma.slo.findFirst).mockResolvedValue(null);

    const { GET } = await import("@/app/api/slos/[id]/evaluations/route");
    const req = new NextRequest(
      "http://localhost/api/slos/slo-other/evaluations",
      { headers: { Authorization: "Bearer ws_token" } },
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: "slo-other" }),
    });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/slos/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("returns correct aggregation", async () => {
    vi.mocked(prisma.slo.findMany).mockResolvedValue([
      { ...mockSlo, isActive: true, isBreaching: false, budgetConsumed: 0.1 },
      { ...mockSlo, id: "slo-2", isActive: true, isBreaching: true, budgetConsumed: 1.5 },
      { ...mockSlo, id: "slo-3", isActive: false, isBreaching: false, budgetConsumed: null },
      { ...mockSlo, id: "slo-4", isActive: true, isBreaching: false, budgetConsumed: 0.3 },
    ] as never);

    const { GET } = await import("@/app/api/slos/summary/route");
    const req = new NextRequest("http://localhost/api/slos/summary", {
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(body.total).toBe(4);
    expect(body.active).toBe(3);
    expect(body.breaching).toBe(1);
    expect(body.budgetExhausted).toBe(1);
    expect(body.healthyPct).toBeCloseTo(66.67, 1);
    expect(body.slos).toHaveLength(4);
  });
});

describe("Stats cron SLO integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes slos field in stats cron response", async () => {
    // Mock cron auth
    vi.mock("@/lib/cron-auth", () => ({
      validateCronAuth: vi.fn().mockReturnValue(null),
    }));
    vi.mock("@/lib/indexer", () => ({
      aggregateStats: vi.fn().mockResolvedValue({
        totalValidators: 50,
        activeValidators: 40,
        blockHeight: 12345,
      }),
    }));

    const { POST } = await import("@/app/api/cron/stats/route");
    const req = new NextRequest("http://localhost/api/cron/stats", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.slos).toBeDefined();
    expect(body.slos.evaluated).toBe(2);
    expect(body.slos.breached).toBe(0);
  });
});
