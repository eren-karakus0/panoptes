import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const incidentModel = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  count: vi.fn(),
  update: vi.fn(),
};

const incidentEventModel = {
  findMany: vi.fn(),
  count: vi.fn(),
  create: vi.fn(),
};

const txMock = {
  incident: { update: vi.fn() },
  incidentEvent: { create: vi.fn() },
  outboxEvent: { create: vi.fn().mockResolvedValue({ seq: 1 }) },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    incident: incidentModel,
    incidentEvent: incidentEventModel,
    $transaction: vi.fn((fn: (tx: typeof txMock) => unknown) => fn(txMock)),
  },
}));

vi.mock("@/lib/api-helpers", () => ({
  withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
}));

vi.mock("@/lib/workspace-auth", () => ({
  requireWorkspace: vi.fn(),
}));

import { requireWorkspace } from "@/lib/workspace-auth";

const mockWorkspace = { id: "ws-1", name: "Test", slug: "test" };

const mockIncident = {
  id: "inc-1",
  workspaceId: "ws-1",
  entityType: "endpoint",
  entityId: "ep-1",
  status: "open",
  severity: "high",
  title: "SLO breach: RPC Uptime",
  description: "SLO breach detected",
  detectedAt: new Date("2026-01-01"),
  acknowledgedAt: null,
  resolvedAt: null,
  events: [
    {
      id: "evt-1",
      incidentId: "inc-1",
      eventType: "created",
      message: "Incident created",
      metadata: null,
      createdAt: new Date("2026-01-01"),
    },
  ],
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

describe("GET /api/incidents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("returns incident list", async () => {
    incidentModel.findMany.mockResolvedValue([mockIncident]);
    incidentModel.count.mockResolvedValue(1);

    const { GET } = await import("@/app/api/incidents/route");
    const req = new NextRequest("http://localhost/api/incidents", {
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(body.incidents).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it("returns 401 without auth", async () => {
    authFail();

    const { GET } = await import("@/app/api/incidents/route");
    const req = new NextRequest("http://localhost/api/incidents");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("filters by status=open", async () => {
    incidentModel.findMany.mockResolvedValue([mockIncident]);
    incidentModel.count.mockResolvedValue(1);

    const { GET } = await import("@/app/api/incidents/route");
    const req = new NextRequest("http://localhost/api/incidents?status=open", {
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(body.incidents).toHaveLength(1);
    expect(incidentModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "open" }),
      }),
    );
  });

  it("filters by entityType=endpoint", async () => {
    incidentModel.findMany.mockResolvedValue([mockIncident]);
    incidentModel.count.mockResolvedValue(1);

    const { GET } = await import("@/app/api/incidents/route");
    const req = new NextRequest("http://localhost/api/incidents?entityType=endpoint", {
      headers: { Authorization: "Bearer ws_token" },
    });
    await GET(req);

    expect(incidentModel.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ entityType: "endpoint" }),
      }),
    );
  });
});

describe("GET /api/incidents/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("returns incident detail with events", async () => {
    incidentModel.findFirst.mockResolvedValue(mockIncident);

    const { GET } = await import("@/app/api/incidents/[id]/route");
    const req = new NextRequest("http://localhost/api/incidents/inc-1", {
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "inc-1" }) });
    const body = await res.json();

    expect(body.id).toBe("inc-1");
    expect(body.events).toHaveLength(1);
  });

  it("returns 404 for wrong workspace", async () => {
    incidentModel.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/incidents/[id]/route");
    const req = new NextRequest("http://localhost/api/incidents/inc-other", {
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "inc-other" }) });
    expect(res.status).toBe(404);
  });
});

describe("PATCH /api/incidents/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
    txMock.incident.update.mockResolvedValue({ ...mockIncident, status: "acknowledged" });
    txMock.incidentEvent.create.mockResolvedValue({});
    txMock.outboxEvent.create.mockResolvedValue({ seq: 1 });
  });

  it("acknowledges incident + creates event + outbox", async () => {
    incidentModel.findFirst.mockResolvedValue({ ...mockIncident, status: "open" });

    const { PATCH } = await import("@/app/api/incidents/[id]/route");
    const req = new NextRequest("http://localhost/api/incidents/inc-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer ws_token" },
      body: JSON.stringify({ status: "acknowledged" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "inc-1" }) });

    expect(res.status).toBe(200);
    expect(txMock.incidentEvent.create).toHaveBeenCalled();
    expect(txMock.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "incident.acknowledged" }),
      }),
    );
  });

  it("sets acknowledgedAt when acknowledging", async () => {
    incidentModel.findFirst.mockResolvedValue({ ...mockIncident, status: "open" });

    const { PATCH } = await import("@/app/api/incidents/[id]/route");
    const req = new NextRequest("http://localhost/api/incidents/inc-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer ws_token" },
      body: JSON.stringify({ status: "acknowledged" }),
    });
    await PATCH(req, { params: Promise.resolve({ id: "inc-1" }) });

    expect(txMock.incident.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          acknowledgedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("resolves incident + sets resolvedAt + outbox event", async () => {
    incidentModel.findFirst.mockResolvedValue({ ...mockIncident, status: "open" });
    txMock.incident.update.mockResolvedValue({ ...mockIncident, status: "resolved" });

    const { PATCH } = await import("@/app/api/incidents/[id]/route");
    const req = new NextRequest("http://localhost/api/incidents/inc-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer ws_token" },
      body: JSON.stringify({ status: "resolved" }),
    });
    await PATCH(req, { params: Promise.resolve({ id: "inc-1" }) });

    expect(txMock.incident.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "resolved",
          resolvedAt: expect.any(Date),
        }),
      }),
    );
    expect(txMock.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "incident.resolved" }),
      }),
    );
  });

  it("returns 400 for invalid status", async () => {
    const { PATCH } = await import("@/app/api/incidents/[id]/route");
    const req = new NextRequest("http://localhost/api/incidents/inc-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer ws_token" },
      body: JSON.stringify({ status: "invalid" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "inc-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 409 when already resolved", async () => {
    incidentModel.findFirst.mockResolvedValue({ ...mockIncident, status: "resolved" });

    const { PATCH } = await import("@/app/api/incidents/[id]/route");
    const req = new NextRequest("http://localhost/api/incidents/inc-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer ws_token" },
      body: JSON.stringify({ status: "acknowledged" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "inc-1" }) });
    expect(res.status).toBe(409);
  });

  it("returns 404 for wrong workspace", async () => {
    incidentModel.findFirst.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/incidents/[id]/route");
    const req = new NextRequest("http://localhost/api/incidents/inc-other", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: "Bearer ws_token" },
      body: JSON.stringify({ status: "resolved" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "inc-other" }) });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/incidents/:id/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("returns paginated event list", async () => {
    incidentModel.findFirst.mockResolvedValue({ id: "inc-1" });
    incidentEventModel.findMany.mockResolvedValue([mockIncident.events[0]]);
    incidentEventModel.count.mockResolvedValue(1);

    const { GET } = await import("@/app/api/incidents/[id]/events/route");
    const req = new NextRequest("http://localhost/api/incidents/inc-1/events", {
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "inc-1" }) });
    const body = await res.json();

    expect(body.events).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it("returns 404 for wrong workspace", async () => {
    incidentModel.findFirst.mockResolvedValue(null);

    const { GET } = await import("@/app/api/incidents/[id]/events/route");
    const req = new NextRequest("http://localhost/api/incidents/inc-other/events", {
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "inc-other" }) });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/incidents/:id/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("adds comment and returns 201", async () => {
    incidentModel.findFirst.mockResolvedValue({ id: "inc-1" });
    incidentEventModel.create.mockResolvedValue({
      id: "evt-2",
      incidentId: "inc-1",
      eventType: "comment",
      message: "Investigating",
      metadata: null,
      createdAt: new Date(),
    });

    const { POST } = await import("@/app/api/incidents/[id]/events/route");
    const req = new NextRequest("http://localhost/api/incidents/inc-1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer ws_token" },
      body: JSON.stringify({ message: "Investigating" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "inc-1" }) });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.eventType).toBe("comment");
  });

  it("returns 400 for empty message", async () => {
    incidentModel.findFirst.mockResolvedValue({ id: "inc-1" });

    const { POST } = await import("@/app/api/incidents/[id]/events/route");
    const req = new NextRequest("http://localhost/api/incidents/inc-1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer ws_token" },
      body: JSON.stringify({ message: "" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "inc-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 400 for message exceeding 2000 chars", async () => {
    incidentModel.findFirst.mockResolvedValue({ id: "inc-1" });

    const { POST } = await import("@/app/api/incidents/[id]/events/route");
    const req = new NextRequest("http://localhost/api/incidents/inc-1/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer ws_token" },
      body: JSON.stringify({ message: "a".repeat(2001) }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "inc-1" }) });
    expect(res.status).toBe(400);
  });

  it("returns 404 for wrong workspace", async () => {
    incidentModel.findFirst.mockResolvedValue(null);

    const { POST } = await import("@/app/api/incidents/[id]/events/route");
    const req = new NextRequest("http://localhost/api/incidents/inc-other/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer ws_token" },
      body: JSON.stringify({ message: "test" }),
    });
    const res = await POST(req, { params: Promise.resolve({ id: "inc-other" }) });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/incidents/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("returns correct aggregation", async () => {
    incidentModel.findMany.mockResolvedValue([
      { status: "open", severity: "critical" },
      { status: "open", severity: "high" },
      { status: "acknowledged", severity: "medium" },
      { status: "resolved", severity: "critical" },
      { status: "resolved", severity: "low" },
    ]);

    const { GET } = await import("@/app/api/incidents/summary/route");
    const req = new NextRequest("http://localhost/api/incidents/summary", {
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(body.total).toBe(5);
    expect(body.open).toBe(2);
    expect(body.acknowledged).toBe(1);
    expect(body.resolved).toBe(2);
    expect(body.critical).toBe(1); // only non-resolved critical
  });

  it("returns 401 without auth", async () => {
    authFail();

    const { GET } = await import("@/app/api/incidents/summary/route");
    const req = new NextRequest("http://localhost/api/incidents/summary");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});
