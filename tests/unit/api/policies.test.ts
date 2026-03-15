import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    policy: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    policyExecution: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({
      policy: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({
          id: "p-new", name: "New Policy", description: null,
          isActive: true, dryRun: true, priority: 100,
          conditions: JSON.stringify([{ field: "anomaly.type", operator: "eq", value: "jailing" }]),
          actions: JSON.stringify([{ type: "log" }]),
          cooldownMinutes: 15, lastTriggeredAt: null,
          createdAt: new Date("2026-01-01"),
        }),
      },
    })),
  },
}));

vi.mock("@/lib/api-helpers", () => ({
  withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
}));

vi.mock("@/lib/workspace-auth", () => ({
  requireWorkspace: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace-auth";

const mockWorkspace = { id: "ws-1", name: "Test", slug: "test" };

function authSuccess() {
  vi.mocked(requireWorkspace).mockResolvedValue({ workspace: mockWorkspace });
}

function authFail() {
  vi.mocked(requireWorkspace).mockResolvedValue({
    error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
  });
}

describe("GET /api/policies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("returns policy list", async () => {
    vi.mocked(prisma.policy.findMany).mockResolvedValue([
      {
        id: "p-1", name: "Test Policy", description: null,
        isActive: true, dryRun: true, priority: 100,
        conditions: JSON.stringify([{ field: "anomaly.type", operator: "eq", value: "jailing" }]),
        actions: JSON.stringify([{ type: "log" }]),
        cooldownMinutes: 15, lastTriggeredAt: null,
        createdAt: new Date("2026-01-01"),
      },
    ] as never);

    const { GET } = await import("@/app/api/policies/route");
    const req = new NextRequest("http://localhost/api/policies", {
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.policies).toHaveLength(1);
    expect(body.policies[0].conditions).toHaveLength(1);
    expect(body.policies[0].actions).toHaveLength(1);
  });

  it("returns 401 without auth", async () => {
    authFail();
    const { GET } = await import("@/app/api/policies/route");
    const req = new NextRequest("http://localhost/api/policies");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/policies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
    vi.mocked(prisma.policy.count).mockResolvedValue(0);
    vi.mocked(prisma.policy.create).mockResolvedValue({
      id: "p-new", name: "New Policy", description: null,
      isActive: true, dryRun: true, priority: 100,
      conditions: JSON.stringify([{ field: "anomaly.type", operator: "eq", value: "jailing" }]),
      actions: JSON.stringify([{ type: "log" }]),
      cooldownMinutes: 15, lastTriggeredAt: null,
      createdAt: new Date("2026-01-01"),
    } as never);
  });

  it("creates a policy", async () => {
    const { POST } = await import("@/app/api/policies/route");
    const req = new NextRequest("http://localhost/api/policies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({
        name: "New Policy",
        conditions: [{ field: "anomaly.type", operator: "eq", value: "jailing" }],
        actions: [{ type: "log" }],
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.name).toBe("New Policy");
    expect(body.dryRun).toBe(true);
  });

  it("returns 400 for missing conditions", async () => {
    const { POST } = await import("@/app/api/policies/route");
    const req = new NextRequest("http://localhost/api/policies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({ name: "No Conditions", actions: [{ type: "log" }] }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid action type", async () => {
    const { POST } = await import("@/app/api/policies/route");
    const req = new NextRequest("http://localhost/api/policies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({
        name: "Bad Action",
        conditions: [{ field: "anomaly.type", operator: "eq", value: "jailing" }],
        actions: [{ type: "invalid_type" }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 409 when limit reached", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      Object.assign(new Error("LIMIT_REACHED"), { message: "LIMIT_REACHED" }),
    );

    const { POST } = await import("@/app/api/policies/route");
    const req = new NextRequest("http://localhost/api/policies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({
        name: "Over Limit",
        conditions: [{ field: "anomaly.type", operator: "eq", value: "jailing" }],
        actions: [{ type: "log" }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});

describe("PATCH /api/policies/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("updates policy fields", async () => {
    vi.mocked(prisma.policy.findFirst).mockResolvedValue({ id: "p-1", workspaceId: "ws-1" } as never);
    vi.mocked(prisma.policy.update).mockResolvedValue({
      id: "p-1", name: "Updated", description: null,
      isActive: true, dryRun: false, priority: 50,
      conditions: JSON.stringify([{ field: "anomaly.type", operator: "eq", value: "jailing" }]),
      actions: JSON.stringify([{ type: "log" }]),
      cooldownMinutes: 15, lastTriggeredAt: null,
      createdAt: new Date(),
    } as never);

    const { PATCH } = await import("@/app/api/policies/[id]/route");
    const req = new NextRequest("http://localhost/api/policies/p-1", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({ name: "Updated", dryRun: false, priority: 50 }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "p-1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.name).toBe("Updated");
  });

  it("returns 404 for wrong workspace", async () => {
    vi.mocked(prisma.policy.findFirst).mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/policies/[id]/route");
    const req = new NextRequest("http://localhost/api/policies/p-other", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({ name: "Test" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "p-other" }) });
    expect(res.status).toBe(404);
  });
});

describe("DELETE /api/policies/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("deletes policy", async () => {
    vi.mocked(prisma.policy.findFirst).mockResolvedValue({ id: "p-1", workspaceId: "ws-1" } as never);
    vi.mocked(prisma.policy.delete).mockResolvedValue({} as never);

    const { DELETE } = await import("@/app/api/policies/[id]/route");
    const req = new NextRequest("http://localhost/api/policies/p-1", {
      method: "DELETE",
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "p-1" }) });
    expect(res.status).toBe(204);
  });
});

describe("POST /api/policies - atomic creation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
    // Restore $transaction mock implementation (may have been overridden by previous tests)
    vi.mocked(prisma.$transaction).mockImplementation(((fn: (tx: unknown) => unknown) => fn({
      policy: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({
          id: "p-new", name: "New Policy", description: null,
          isActive: true, dryRun: true, priority: 100,
          conditions: JSON.stringify([{ field: "anomaly.type", operator: "eq", value: "jailing" }]),
          actions: JSON.stringify([{ type: "log" }]),
          cooldownMinutes: 15, lastTriggeredAt: null,
          createdAt: new Date("2026-01-01"),
        }),
      },
    })) as never);
  });

  it("uses transaction for atomic count+create", async () => {
    const { POST } = await import("@/app/api/policies/route");
    const req = new NextRequest("http://localhost/api/policies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({
        name: "Atomic Policy",
        conditions: [{ field: "anomaly.type", operator: "eq", value: "jailing" }],
        actions: [{ type: "log" }],
      }),
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("returns 409 when transaction detects limit reached", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValue(
      Object.assign(new Error("LIMIT_REACHED"), { message: "LIMIT_REACHED" }),
    );

    const { POST } = await import("@/app/api/policies/route");
    const req = new NextRequest("http://localhost/api/policies", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({
        name: "Over Limit",
        conditions: [{ field: "anomaly.type", operator: "eq", value: "jailing" }],
        actions: [{ type: "log" }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });
});
