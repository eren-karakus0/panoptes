import { describe, it, expect, beforeEach } from "vitest";

// Need to reset module state between tests
let checkRateLimit: typeof import("@/lib/rate-limit").checkRateLimit;

describe("checkRateLimit", () => {
  beforeEach(async () => {
    // Re-import to reset the store
    const mod = await import("@/lib/rate-limit");
    checkRateLimit = mod.checkRateLimit;
  });

  it("allows requests under the limit", () => {
    const result = checkRateLimit("192.168.1.1");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
  });

  it("decrements remaining on subsequent calls", () => {
    checkRateLimit("192.168.1.2");
    const result = checkRateLimit("192.168.1.2");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(58);
  });

  it("blocks after exceeding limit", () => {
    const ip = "192.168.1.3";
    for (let i = 0; i < 60; i++) {
      checkRateLimit(ip);
    }

    const result = checkRateLimit(ip);

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("tracks different IPs independently", () => {
    for (let i = 0; i < 60; i++) {
      checkRateLimit("10.0.0.1");
    }

    const result = checkRateLimit("10.0.0.2");

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(59);
  });
});
