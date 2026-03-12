import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";

vi.mock("@/lib/db", () => {
  const webhookModel = {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
  return {
    prisma: {
      webhook: webhookModel,
      webhookDelivery: {
        findMany: vi.fn(),
        count: vi.fn(),
      },
      $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
        fn({ webhook: webhookModel, $queryRaw: vi.fn().mockResolvedValue([]) }),
      ),
    },
  };
});

vi.mock("@/lib/api-helpers", async () => {
  return {
    withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
    jsonResponse: vi.fn(),
  };
});

vi.mock("@/lib/workspace-auth", () => ({
  requireWorkspace: vi.fn(),
}));

vi.mock("@/lib/webhook-crypto", () => ({
  generateWebhookSecret: vi.fn(() => "whsec_" + "ab".repeat(32)),
  encryptSecret: vi.fn(() => "encrypted-secret-base64"),
  decryptSecret: vi.fn(() => "whsec_" + "ab".repeat(32)),
  signPayload: vi.fn(() => "mocked-signature"),
}));

vi.mock("@/lib/webhook-validation", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/webhook-validation")>();
  return {
    ...original,
    assertUrlNotPrivate: vi.fn().mockResolvedValue(undefined),
  };
});

import { prisma } from "@/lib/db";
import { requireWorkspace } from "@/lib/workspace-auth";
import { assertUrlNotPrivate } from "@/lib/webhook-validation";

const mockWorkspace = { id: "ws-1", name: "Test", slug: "test" };

const mockWebhook = {
  id: "wh-1",
  workspaceId: "ws-1",
  name: "My Webhook",
  url: "https://example.com/hook",
  secretEncrypted: "encrypted-secret-base64",
  events: ["anomaly.created"],
  isActive: true,
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

describe("GET /api/webhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("returns webhook list without secret", async () => {
    const selectResult = [
      {
        id: "wh-1",
        name: "My Webhook",
        url: "https://example.com/hook",
        events: ["anomaly.created"],
        isActive: true,
        createdAt: new Date("2026-01-01"),
      },
    ];
    vi.mocked(prisma.webhook.findMany).mockResolvedValue(selectResult as never);

    const { GET } = await import("@/app/api/webhooks/route");
    const req = new NextRequest("http://localhost/api/webhooks", {
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await GET(req);
    const body = await res.json();

    expect(body.webhooks).toHaveLength(1);
    expect(body.webhooks[0]).not.toHaveProperty("secretEncrypted");
    expect(body.webhooks[0].name).toBe("My Webhook");
  });

  it("returns 401 without auth", async () => {
    authFail();
    const { GET } = await import("@/app/api/webhooks/route");
    const req = new NextRequest("http://localhost/api/webhooks");
    const res = await GET(req);
    expect(res.status).toBe(401);
  });
});

describe("POST /api/webhooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
    vi.mocked(prisma.webhook.count).mockResolvedValue(0);
    vi.mocked(prisma.webhook.create).mockResolvedValue({
      id: "wh-new",
      name: "New Webhook",
      url: "https://example.com/hook",
      events: ["anomaly.created"],
      isActive: true,
      createdAt: new Date("2026-01-01"),
    } as never);
  });

  it("creates webhook and returns secret once", async () => {
    const { POST } = await import("@/app/api/webhooks/route");
    const req = new NextRequest("http://localhost/api/webhooks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({
        name: "New Webhook",
        url: "https://example.com/hook",
        events: ["anomaly.created"],
      }),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.secret).toMatch(/^whsec_/);
    expect(body.id).toBe("wh-new");
  });

  it("returns 400 on invalid body", async () => {
    const { POST } = await import("@/app/api/webhooks/route");
    const req = new NextRequest("http://localhost/api/webhooks", {
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
    vi.mocked(prisma.webhook.count).mockResolvedValue(10);

    const { POST } = await import("@/app/api/webhooks/route");
    const req = new NextRequest("http://localhost/api/webhooks", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({
        name: "New",
        url: "https://example.com/hook",
        events: ["anomaly.created"],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(409);
  });

  it("returns 400 on invalid JSON", async () => {
    const { POST } = await import("@/app/api/webhooks/route");
    const req = new NextRequest("http://localhost/api/webhooks", {
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

describe("PATCH /api/webhooks/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("updates webhook fields", async () => {
    vi.mocked(prisma.webhook.findFirst).mockResolvedValue(mockWebhook as never);
    vi.mocked(prisma.webhook.update).mockResolvedValue({
      ...mockWebhook,
      name: "Updated",
      updatedAt: new Date(),
    } as never);

    const { PATCH } = await import("@/app/api/webhooks/[id]/route");
    const req = new NextRequest("http://localhost/api/webhooks/wh-1", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({ name: "Updated" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "wh-1" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.name).toBe("Updated");
    expect(body).not.toHaveProperty("secret");
  });

  it("returns 404 on wrong workspace (isolation)", async () => {
    vi.mocked(prisma.webhook.findFirst).mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/webhooks/[id]/route");
    const req = new NextRequest("http://localhost/api/webhooks/wh-other", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({ name: "Updated" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "wh-other" }) });
    expect(res.status).toBe(404);
  });

  it("returns 400 on invalid body", async () => {
    const { PATCH } = await import("@/app/api/webhooks/[id]/route");
    const req = new NextRequest("http://localhost/api/webhooks/wh-1", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer ws_token",
      },
      body: JSON.stringify({}),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: "wh-1" }) });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/webhooks/:id", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("deletes webhook and returns 204", async () => {
    vi.mocked(prisma.webhook.findFirst).mockResolvedValue(mockWebhook as never);
    vi.mocked(prisma.webhook.delete).mockResolvedValue(mockWebhook as never);

    const { DELETE } = await import("@/app/api/webhooks/[id]/route");
    const req = new NextRequest("http://localhost/api/webhooks/wh-1", {
      method: "DELETE",
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "wh-1" }) });
    expect(res.status).toBe(204);
  });

  it("returns 404 on wrong workspace", async () => {
    vi.mocked(prisma.webhook.findFirst).mockResolvedValue(null);

    const { DELETE } = await import("@/app/api/webhooks/[id]/route");
    const req = new NextRequest("http://localhost/api/webhooks/wh-other", {
      method: "DELETE",
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await DELETE(req, { params: Promise.resolve({ id: "wh-other" }) });
    expect(res.status).toBe(404);
  });
});

describe("GET /api/webhooks/:id/deliveries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("returns paginated delivery list", async () => {
    vi.mocked(prisma.webhook.findFirst).mockResolvedValue({ id: "wh-1" } as never);
    const mockDelivery = {
      id: "del-1",
      eventType: "anomaly.created",
      statusCode: 200,
      success: true,
      attempts: 1,
      deliveredAt: new Date(),
      createdAt: new Date(),
    };
    vi.mocked(prisma.webhookDelivery.findMany).mockResolvedValue([mockDelivery] as never);
    vi.mocked(prisma.webhookDelivery.count).mockResolvedValue(1);

    const { GET } = await import("@/app/api/webhooks/[id]/deliveries/route");
    const req = new NextRequest("http://localhost/api/webhooks/wh-1/deliveries", {
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "wh-1" }) });
    const body = await res.json();

    expect(body.deliveries).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it("returns 404 on wrong workspace", async () => {
    vi.mocked(prisma.webhook.findFirst).mockResolvedValue(null);

    const { GET } = await import("@/app/api/webhooks/[id]/deliveries/route");
    const req = new NextRequest("http://localhost/api/webhooks/wh-other/deliveries", {
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await GET(req, { params: Promise.resolve({ id: "wh-other" }) });
    expect(res.status).toBe(404);
  });
});

describe("POST /api/webhooks/:id/test", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authSuccess();
  });

  it("sends test request and returns result", async () => {
    vi.mocked(prisma.webhook.findFirst).mockResolvedValue(mockWebhook as never);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", mockFetch);

    const { POST } = await import("@/app/api/webhooks/[id]/test/route");
    const req = new NextRequest("http://localhost/api/webhooks/wh-1/test", {
      method: "POST",
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "wh-1" }) });
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.statusCode).toBe(200);
    expect(body.responseTime).toBeGreaterThanOrEqual(0);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/hook",
      expect.objectContaining({
        method: "POST",
        redirect: "manual",
        headers: expect.objectContaining({
          "X-Webhook-Signature": "mocked-signature",
          "X-Webhook-Event": "webhook.test",
        }),
      }),
    );

    vi.unstubAllGlobals();
  });

  it("returns 400 when URL resolves to private IP (SSRF)", async () => {
    vi.mocked(prisma.webhook.findFirst).mockResolvedValue(mockWebhook as never);
    vi.mocked(assertUrlNotPrivate).mockRejectedValue(
      new Error("URL resolves to a blocked private/internal address"),
    );

    const { POST } = await import("@/app/api/webhooks/[id]/test/route");
    const req = new NextRequest("http://localhost/api/webhooks/wh-1/test", {
      method: "POST",
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "wh-1" }) });
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error).toContain("blocked");

    // Reset mock
    vi.mocked(assertUrlNotPrivate).mockResolvedValue(undefined);
  });

  it("returns 404 on wrong workspace", async () => {
    vi.mocked(prisma.webhook.findFirst).mockResolvedValue(null);

    const { POST } = await import("@/app/api/webhooks/[id]/test/route");
    const req = new NextRequest("http://localhost/api/webhooks/wh-other/test", {
      method: "POST",
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "wh-other" }) });
    expect(res.status).toBe(404);
  });

  it("handles fetch error gracefully", async () => {
    vi.mocked(prisma.webhook.findFirst).mockResolvedValue(mockWebhook as never);

    const mockFetch = vi.fn().mockRejectedValue(new Error("Connection refused"));
    vi.stubGlobal("fetch", mockFetch);

    const { POST } = await import("@/app/api/webhooks/[id]/test/route");
    const req = new NextRequest("http://localhost/api/webhooks/wh-1/test", {
      method: "POST",
      headers: { Authorization: "Bearer ws_token" },
    });
    const res = await POST(req, { params: Promise.resolve({ id: "wh-1" }) });
    const body = await res.json();

    expect(body.success).toBe(false);
    expect(body.error).toBe("Connection refused");

    vi.unstubAllGlobals();
  });
});
