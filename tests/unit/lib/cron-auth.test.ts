import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

describe("validateCronAuth", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns 500 when CRON_SECRET not configured", async () => {
    delete process.env.CRON_SECRET;
    const { validateCronAuth } = await import("@/lib/cron-auth");
    const req = new NextRequest("http://localhost/api/cron/health", {
      method: "POST",
    });
    const res = validateCronAuth(req);

    expect(res).not.toBeNull();
    expect(res!.status).toBe(500);
    const body = await res!.json();
    expect(body.error).toBe("CRON_SECRET not configured");
  });

  it("returns 401 when authorization header missing", async () => {
    process.env.CRON_SECRET = "test-secret";
    const { validateCronAuth } = await import("@/lib/cron-auth");
    const req = new NextRequest("http://localhost/api/cron/health", {
      method: "POST",
    });
    const res = validateCronAuth(req);

    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it("returns 401 when wrong secret", async () => {
    process.env.CRON_SECRET = "test-secret";
    const { validateCronAuth } = await import("@/lib/cron-auth");
    const req = new NextRequest("http://localhost/api/cron/health", {
      method: "POST",
      headers: { authorization: "Bearer wrong-secret" },
    });
    const res = validateCronAuth(req);

    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });

  it("returns null (success) with valid auth", async () => {
    process.env.CRON_SECRET = "test-secret";
    const { validateCronAuth } = await import("@/lib/cron-auth");
    const req = new NextRequest("http://localhost/api/cron/health", {
      method: "POST",
      headers: { authorization: "Bearer test-secret" },
    });
    const res = validateCronAuth(req);

    expect(res).toBeNull();
  });

  it("rejects different-length strings safely", async () => {
    process.env.CRON_SECRET = "test-secret";
    const { validateCronAuth } = await import("@/lib/cron-auth");
    const req = new NextRequest("http://localhost/api/cron/health", {
      method: "POST",
      headers: { authorization: "Bearer x" },
    });
    const res = validateCronAuth(req);

    expect(res).not.toBeNull();
    expect(res!.status).toBe(401);
  });
});
