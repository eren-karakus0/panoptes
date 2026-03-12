import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const TEST_SECRET = "a".repeat(64);

describe("stream-token", () => {
  const originalEnv = process.env.STREAM_TOKEN_SECRET;

  beforeEach(() => {
    vi.resetModules();
    process.env.STREAM_TOKEN_SECRET = TEST_SECRET;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.STREAM_TOKEN_SECRET = originalEnv;
    } else {
      delete process.env.STREAM_TOKEN_SECRET;
    }
  });

  it("createStreamToken returns dot-separated two-part string", async () => {
    const { createStreamToken } = await import("@/lib/stream-token");
    const token = createStreamToken("ws-123");
    const parts = token.split(".");
    expect(parts).toHaveLength(2);
    expect(parts[0].length).toBeGreaterThan(0);
    expect(parts[1].length).toBeGreaterThan(0);
  });

  it("create → verify roundtrip returns correct workspaceId", async () => {
    const { createStreamToken, verifyStreamToken } = await import(
      "@/lib/stream-token"
    );
    const token = createStreamToken("ws-456");
    const result = verifyStreamToken(token);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.workspaceId).toBe("ws-456");
    }
  });

  it("rejects expired token", async () => {
    const { createStreamToken, verifyStreamToken } = await import(
      "@/lib/stream-token"
    );
    const token = createStreamToken("ws-789", -1);
    const result = verifyStreamToken(token);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("Token expired");
    }
  });

  it("rejects tampered signature", async () => {
    const { createStreamToken, verifyStreamToken } = await import(
      "@/lib/stream-token"
    );
    const token = createStreamToken("ws-123");
    const [payload] = token.split(".");
    const tampered = `${payload}.TAMPERED_SIGNATURE`;
    const result = verifyStreamToken(tampered);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("Invalid signature");
    }
  });

  it("rejects tampered payload", async () => {
    const { createStreamToken, verifyStreamToken } = await import(
      "@/lib/stream-token"
    );
    const token = createStreamToken("ws-123");
    const [, sig] = token.split(".");
    const fakePayload = Buffer.from(
      JSON.stringify({ wid: "ws-evil", exp: 9999999999 }),
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    const result = verifyStreamToken(`${fakePayload}.${sig}`);
    expect(result.valid).toBe(false);
  });

  it("rejects malformed token without dot", async () => {
    const { verifyStreamToken } = await import("@/lib/stream-token");
    const result = verifyStreamToken("nodothere");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error).toBe("Malformed token");
    }
  });

  it("rejects token signed with different secret", async () => {
    const { createStreamToken } = await import("@/lib/stream-token");
    const token = createStreamToken("ws-123");

    // Change secret
    process.env.STREAM_TOKEN_SECRET = "b".repeat(64);
    vi.resetModules();
    const { verifyStreamToken } = await import("@/lib/stream-token");
    const result = verifyStreamToken(token);
    expect(result.valid).toBe(false);
  });

  it("throws when STREAM_TOKEN_SECRET is missing", async () => {
    delete process.env.STREAM_TOKEN_SECRET;
    const { createStreamToken } = await import("@/lib/stream-token");
    expect(() => createStreamToken("ws-123")).toThrow("STREAM_TOKEN_SECRET");
  });

  it("throws when STREAM_TOKEN_SECRET is too short", async () => {
    process.env.STREAM_TOKEN_SECRET = "tooshort";
    const { createStreamToken } = await import("@/lib/stream-token");
    expect(() => createStreamToken("ws-123")).toThrow("STREAM_TOKEN_SECRET");
  });
});
