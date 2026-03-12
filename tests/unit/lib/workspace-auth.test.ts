import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    workspace: {
      findFirst: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import {
  hashToken,
  extractBearerToken,
  extractApiKey,
  authenticateWorkspace,
  requireWorkspace,
} from "@/lib/workspace-auth";

const TEST_TOKEN = "ws_test-token-abc123";

describe("hashToken", () => {
  it("returns consistent SHA-256 hex digest", () => {
    const hash1 = hashToken("test-token");
    const hash2 = hashToken("test-token");
    expect(hash1).toBe(hash2);
    expect(hash1).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns different hash for different tokens", () => {
    const hash1 = hashToken("token-a");
    const hash2 = hashToken("token-b");
    expect(hash1).not.toBe(hash2);
  });

  it("returns 64-char hex string", () => {
    const hash = hashToken("any-token");
    expect(hash).toHaveLength(64);
  });
});

describe("extractBearerToken", () => {
  it("extracts token from valid Bearer header", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { Authorization: "Bearer ws_my-token" },
    });
    expect(extractBearerToken(req)).toBe("ws_my-token");
  });

  it("returns null when no Authorization header", () => {
    const req = new NextRequest("http://localhost/api/test");
    expect(extractBearerToken(req)).toBeNull();
  });

  it("returns null for non-Bearer auth", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { Authorization: "Basic abc123" },
    });
    expect(extractBearerToken(req)).toBeNull();
  });

  it("returns null for empty Bearer value", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { Authorization: "Bearer " },
    });
    expect(extractBearerToken(req)).toBeNull();
  });

  it("trims whitespace from token", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { Authorization: "Bearer  ws_my-token  " },
    });
    expect(extractBearerToken(req)).toBe("ws_my-token");
  });
});

describe("extractApiKey", () => {
  it("extracts key from x-api-key header", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-api-key": "ws_my-api-key" },
    });
    expect(extractApiKey(req)).toBe("ws_my-api-key");
  });

  it("returns null when no x-api-key header", () => {
    const req = new NextRequest("http://localhost/api/test");
    expect(extractApiKey(req)).toBeNull();
  });

  it("returns null for empty x-api-key value", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-api-key": "  " },
    });
    expect(extractApiKey(req)).toBeNull();
  });

  it("trims whitespace from key", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-api-key": "  ws_my-key  " },
    });
    expect(extractApiKey(req)).toBe("ws_my-key");
  });
});

describe("authenticateWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns workspace context for valid token", async () => {
    const tokenHash = hashToken(TEST_TOKEN);
    vi.mocked(prisma.workspace.findFirst).mockResolvedValue({
      id: "ws-1",
      name: "Test Workspace",
      slug: "test",
      adminTokenHash: tokenHash,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = new NextRequest("http://localhost/api/test", {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    });

    const result = await authenticateWorkspace(req);
    expect(result).toEqual({
      id: "ws-1",
      name: "Test Workspace",
      slug: "test",
    });
  });

  it("returns null when no Authorization header", async () => {
    const req = new NextRequest("http://localhost/api/test");
    const result = await authenticateWorkspace(req);
    expect(result).toBeNull();
    expect(prisma.workspace.findFirst).not.toHaveBeenCalled();
  });

  it("returns null for invalid token", async () => {
    vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/test", {
      headers: { Authorization: "Bearer ws_invalid-token" },
    });

    const result = await authenticateWorkspace(req);
    expect(result).toBeNull();
  });

  it("returns null for inactive workspace", async () => {
    vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/test", {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    });

    const result = await authenticateWorkspace(req);
    expect(result).toBeNull();
  });

  it("does not fall back to x-api-key (Bearer only)", async () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-api-key": TEST_TOKEN },
    });

    const result = await authenticateWorkspace(req);
    expect(result).toBeNull();
    expect(prisma.workspace.findFirst).not.toHaveBeenCalled();
  });

  it("queries with hashed token and isActive filter", async () => {
    vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/test", {
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    });

    await authenticateWorkspace(req);

    expect(prisma.workspace.findFirst).toHaveBeenCalledWith({
      where: {
        adminTokenHash: hashToken(TEST_TOKEN),
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        adminTokenHash: true,
      },
    });
  });
});

describe("requireWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns workspace when authenticated", async () => {
    const tokenHash = hashToken(TEST_TOKEN);
    vi.mocked(prisma.workspace.findFirst).mockResolvedValue({
      id: "ws-1",
      name: "Test Workspace",
      slug: "test",
      adminTokenHash: tokenHash,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const req = new NextRequest("http://localhost/api/webhooks", {
      method: "POST",
      headers: { Authorization: `Bearer ${TEST_TOKEN}` },
    });

    const result = await requireWorkspace(req);
    expect(result.workspace).toBeDefined();
    expect(result.error).toBeUndefined();
    expect(result.workspace!.id).toBe("ws-1");
  });

  it("returns 401 error when not authenticated", async () => {
    const req = new NextRequest("http://localhost/api/webhooks", {
      method: "POST",
    });

    const result = await requireWorkspace(req);
    expect(result.workspace).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(401);

    const body = await result.error!.json();
    expect(body.error).toContain("Unauthorized");
  });

  it("returns 401 for invalid token", async () => {
    vi.mocked(prisma.workspace.findFirst).mockResolvedValue(null);

    const req = new NextRequest("http://localhost/api/webhooks", {
      method: "POST",
      headers: { Authorization: "Bearer ws_wrong-token" },
    });

    const result = await requireWorkspace(req);
    expect(result.workspace).toBeUndefined();
    expect(result.error).toBeDefined();
    expect(result.error!.status).toBe(401);
  });
});
