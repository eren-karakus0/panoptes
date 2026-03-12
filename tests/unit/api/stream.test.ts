import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    outboxEvent: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/api-helpers", () => ({
  withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
  getClientIp: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => ({
    allowed: true,
    remaining: 59,
    resetAt: Date.now() + 60000,
  })),
}));

vi.mock("@/lib/workspace-auth", () => ({
  requireWorkspace: vi.fn(),
  authenticateWorkspace: vi.fn(),
  extractApiKey: vi.fn(),
}));

vi.mock("@/lib/stream-token", () => ({
  createStreamToken: vi.fn(() => "mock-token.mock-sig"),
  verifyStreamToken: vi.fn(),
}));

import { prisma } from "@/lib/db";
import {
  authenticateWorkspace,
  extractApiKey,
} from "@/lib/workspace-auth";
import { verifyStreamToken } from "@/lib/stream-token";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;
const mockWorkspace = { id: "ws-1", name: "Test", slug: "test" };

describe("POST /api/stream/token", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(extractApiKey).mockReturnValue(null);
  });

  it("returns token when authenticated via Bearer", async () => {
    vi.mocked(authenticateWorkspace).mockResolvedValue(mockWorkspace);

    const { POST } = await import("@/app/api/stream/token/route");
    const req = new NextRequest("http://localhost/api/stream/token", {
      method: "POST",
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.token).toBe("mock-token.mock-sig");
    expect(body.expiresIn).toBe(300);
  });

  it("returns token when authenticated via x-api-key (stream-only bridge)", async () => {
    // First call: Bearer auth fails (no header)
    // Second call: synthetic Bearer request with API key succeeds
    vi.mocked(authenticateWorkspace)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(mockWorkspace);
    vi.mocked(extractApiKey).mockReturnValue("ws_api_key_123");

    const { POST } = await import("@/app/api/stream/token/route");
    const req = new NextRequest("http://localhost/api/stream/token", {
      method: "POST",
      headers: { "x-api-key": "ws_api_key_123" },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.token).toBeDefined();
    expect(body.expiresIn).toBe(300);

    // authenticateWorkspace called twice: once for Bearer, once for API key
    expect(authenticateWorkspace).toHaveBeenCalledTimes(2);
  });

  it("returns 401 without any auth", async () => {
    vi.mocked(authenticateWorkspace).mockResolvedValue(null);

    const { POST } = await import("@/app/api/stream/token/route");
    const req = new NextRequest("http://localhost/api/stream/token", {
      method: "POST",
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toContain("Unauthorized");
  });

  it("returns 401 when x-api-key is invalid", async () => {
    vi.mocked(authenticateWorkspace).mockResolvedValue(null);
    vi.mocked(extractApiKey).mockReturnValue("ws_bad_key");

    const { POST } = await import("@/app/api/stream/token/route");
    const req = new NextRequest("http://localhost/api/stream/token", {
      method: "POST",
      headers: { "x-api-key": "ws_bad_key" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

describe("GET /api/stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when token is missing", async () => {
    const { GET } = await import("@/app/api/stream/route");
    const req = new NextRequest("http://localhost/api/stream");
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Missing token query parameter");
  });

  it("returns 401 when token is invalid", async () => {
    vi.mocked(verifyStreamToken).mockReturnValue({
      valid: false,
      error: "Invalid signature",
    });

    const { GET } = await import("@/app/api/stream/route");
    const req = new NextRequest(
      "http://localhost/api/stream?token=bad-token",
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Invalid signature");
  });

  it("returns SSE stream with valid token", async () => {
    vi.mocked(verifyStreamToken).mockReturnValue({
      valid: true,
      workspaceId: "ws-1",
    });

    mockPrisma.outboxEvent.findFirst.mockResolvedValue({ seq: 100 });
    mockPrisma.outboxEvent.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/stream/route");
    const controller = new AbortController();
    const req = new NextRequest(
      "http://localhost/api/stream?token=valid-token",
      { signal: controller.signal },
    );

    const res = await GET(req);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache, no-transform");

    controller.abort();
  });

  it("tail cursor is scoped to visible events (public + workspace)", async () => {
    vi.mocked(verifyStreamToken).mockReturnValue({
      valid: true,
      workspaceId: "ws-1",
    });

    mockPrisma.outboxEvent.findFirst.mockResolvedValue({ seq: 50 });
    mockPrisma.outboxEvent.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/stream/route");
    const controller = new AbortController();
    const req = new NextRequest(
      "http://localhost/api/stream?token=valid-token",
      { signal: controller.signal },
    );

    await GET(req);

    // findFirst must filter by visibility (public OR this workspace)
    expect(mockPrisma.outboxEvent.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { visibility: "public" },
          { visibility: "workspace", workspaceId: "ws-1" },
        ],
      },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });

    controller.abort();
  });

  it("channels filter applies to both tail cursor and poll query", async () => {
    vi.mocked(verifyStreamToken).mockReturnValue({
      valid: true,
      workspaceId: "ws-1",
    });

    mockPrisma.outboxEvent.findFirst.mockResolvedValue({ seq: 10 });
    mockPrisma.outboxEvent.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/stream/route");
    const controller = new AbortController();
    const req = new NextRequest(
      "http://localhost/api/stream?token=valid-token&channels=anomaly,network",
      { signal: controller.signal },
    );

    await GET(req);

    // Tail cursor (findFirst) must include channel scope
    expect(mockPrisma.outboxEvent.findFirst).toHaveBeenCalledWith({
      where: {
        OR: [
          { visibility: "public" },
          { visibility: "workspace", workspaceId: "ws-1" },
        ],
        channel: { in: ["anomaly", "network"] },
      },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });

    // Wait a tick for the first poll inside run()
    await new Promise((r) => setTimeout(r, 50));

    // Poll query must also include channel scope
    expect(mockPrisma.outboxEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          channel: { in: ["anomaly", "network"] },
        }),
      }),
    );

    controller.abort();
  });
});

describe("GET /api/stream/public", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns SSE stream without authentication", async () => {
    mockPrisma.outboxEvent.findFirst.mockResolvedValue({ seq: 50 });
    mockPrisma.outboxEvent.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/stream/public/route");
    const controller = new AbortController();
    const req = new NextRequest("http://localhost/api/stream/public", {
      signal: controller.signal,
    });

    const res = await GET(req);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");

    controller.abort();
  });

  it("uses tail mode when no Last-Event-ID header", async () => {
    mockPrisma.outboxEvent.findFirst.mockResolvedValue({ seq: 99 });
    mockPrisma.outboxEvent.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/stream/public/route");
    const controller = new AbortController();
    const req = new NextRequest("http://localhost/api/stream/public", {
      signal: controller.signal,
    });

    await GET(req);

    expect(mockPrisma.outboxEvent.findFirst).toHaveBeenCalledWith({
      where: { visibility: "public" },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });

    controller.abort();
  });

  it("resumes from Last-Event-ID when provided", async () => {
    mockPrisma.outboxEvent.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/stream/public/route");
    const controller = new AbortController();
    const req = new NextRequest("http://localhost/api/stream/public", {
      headers: { "Last-Event-ID": "42" },
      signal: controller.signal,
    });

    await GET(req);

    // findFirst should NOT be called when Last-Event-ID is present
    expect(mockPrisma.outboxEvent.findFirst).not.toHaveBeenCalled();

    controller.abort();
  });

  it("channels filter applies to both tail cursor and poll query", async () => {
    mockPrisma.outboxEvent.findFirst.mockResolvedValue({ seq: 5 });
    mockPrisma.outboxEvent.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/stream/public/route");
    const controller = new AbortController();
    const req = new NextRequest(
      "http://localhost/api/stream/public?channels=network",
      { signal: controller.signal },
    );

    await GET(req);

    // Tail cursor (findFirst) must include channel scope
    expect(mockPrisma.outboxEvent.findFirst).toHaveBeenCalledWith({
      where: {
        visibility: "public",
        channel: { in: ["network"] },
      },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });

    await new Promise((r) => setTimeout(r, 50));

    // Poll query must also include channel scope
    expect(mockPrisma.outboxEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          channel: { in: ["network"] },
        }),
      }),
    );

    controller.abort();
  });
});

describe("SSE frame format and resume behavior", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("public stream emits correct id/event/data SSE frame", async () => {
    mockPrisma.outboxEvent.findFirst.mockResolvedValue({ seq: 0 });

    const mockEvent = {
      id: "evt-1",
      seq: 1,
      channel: "anomaly",
      type: "anomaly.created",
      visibility: "public",
      workspaceId: null,
      payload: '{"anomalyType":"jailing"}',
      createdAt: new Date(),
    };
    mockPrisma.outboxEvent.findMany
      .mockResolvedValueOnce([mockEvent])
      .mockResolvedValue([]);

    const { GET } = await import("@/app/api/stream/public/route");
    const controller = new AbortController();
    const req = new NextRequest("http://localhost/api/stream/public", {
      signal: controller.signal,
    });

    const res = await GET(req);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    let output = "";
    for (let i = 0; i < 5; i++) {
      const { value, done } = await reader.read();
      if (done) break;
      output += decoder.decode(value, { stream: true });
      if (output.includes("anomaly.created")) break;
    }

    controller.abort();
    reader.releaseLock();

    expect(output).toContain("id: 1\n");
    expect(output).toContain("event: anomaly.created\n");
    expect(output).toContain('data: {"anomalyType":"jailing"}\n');
  });

  it("authenticated stream emits correct SSE frame", async () => {
    vi.mocked(verifyStreamToken).mockReturnValue({
      valid: true,
      workspaceId: "ws-1",
    });

    mockPrisma.outboxEvent.findFirst.mockResolvedValue({ seq: 0 });

    const mockEvent = {
      id: "evt-2",
      seq: 5,
      channel: "network",
      type: "stats.updated",
      visibility: "public",
      workspaceId: null,
      payload: '{"blockHeight":"100"}',
      createdAt: new Date(),
    };
    mockPrisma.outboxEvent.findMany
      .mockResolvedValueOnce([mockEvent])
      .mockResolvedValue([]);

    const { GET } = await import("@/app/api/stream/route");
    const controller = new AbortController();
    const req = new NextRequest(
      "http://localhost/api/stream?token=valid-token",
      { signal: controller.signal },
    );

    const res = await GET(req);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    let output = "";
    for (let i = 0; i < 5; i++) {
      const { value, done } = await reader.read();
      if (done) break;
      output += decoder.decode(value, { stream: true });
      if (output.includes("stats.updated")) break;
    }

    controller.abort();
    reader.releaseLock();

    expect(output).toContain("id: 5\n");
    expect(output).toContain("event: stats.updated\n");
    expect(output).toContain('data: {"blockHeight":"100"}\n');
  });

  it("public stream resumes from Last-Event-ID and polls from that seq", async () => {
    const mockEvent = {
      id: "evt-3",
      seq: 43,
      channel: "anomaly",
      type: "anomaly.resolved",
      visibility: "public",
      workspaceId: null,
      payload: '{"anomalyType":"jailing","resolvedCount":1}',
      createdAt: new Date(),
    };
    mockPrisma.outboxEvent.findMany
      .mockResolvedValueOnce([mockEvent])
      .mockResolvedValue([]);

    const { GET } = await import("@/app/api/stream/public/route");
    const controller = new AbortController();
    const req = new NextRequest("http://localhost/api/stream/public", {
      headers: { "Last-Event-ID": "42" },
      signal: controller.signal,
    });

    const res = await GET(req);
    const reader = res.body!.getReader();
    const decoder = new TextDecoder();

    let output = "";
    for (let i = 0; i < 5; i++) {
      const { value, done } = await reader.read();
      if (done) break;
      output += decoder.decode(value, { stream: true });
      if (output.includes("anomaly.resolved")) break;
    }

    controller.abort();
    reader.releaseLock();

    // Should NOT call findFirst (tail mode) when Last-Event-ID present
    expect(mockPrisma.outboxEvent.findFirst).not.toHaveBeenCalled();

    // Poll should use seq > 42
    expect(mockPrisma.outboxEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          seq: { gt: 42 },
        }),
      }),
    );

    // Frame should contain the event
    expect(output).toContain("id: 43\n");
    expect(output).toContain("event: anomaly.resolved\n");
  });
});
