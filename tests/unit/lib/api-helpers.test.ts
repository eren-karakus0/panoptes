import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  rateLimitHeaders: vi.fn(() => ({
    "X-RateLimit-Limit": "60",
    "X-RateLimit-Remaining": "59",
    "X-RateLimit-Reset": "1700000000",
  })),
}));

import { checkRateLimit } from "@/lib/rate-limit";
import {
  getClientIp,
  withRateLimit,
  jsonResponse,
  serializeBigInt,
} from "@/lib/api-helpers";

describe("getClientIp", () => {
  it("prioritizes x-real-ip", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: {
        "x-real-ip": "1.2.3.4",
        "x-forwarded-for": "5.6.7.8, 9.10.11.12",
      },
    });
    expect(getClientIp(req)).toBe("1.2.3.4");
  });

  it("falls back to x-forwarded-for first IP", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-forwarded-for": "5.6.7.8, 9.10.11.12" },
    });
    expect(getClientIp(req)).toBe("5.6.7.8");
  });

  it("returns unknown when no headers present", () => {
    const req = new NextRequest("http://localhost/api/test");
    expect(getClientIp(req)).toBe("unknown");
  });

  it("trims whitespace from forwarded-for", () => {
    const req = new NextRequest("http://localhost/api/test", {
      headers: { "x-forwarded-for": "  5.6.7.8  , 9.10.11.12" },
    });
    expect(getClientIp(req)).toBe("5.6.7.8");
  });
});

describe("withRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns headers when allowed", () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: true,
      remaining: 59,
      resetAt: Date.now() + 60000,
    });
    const req = new NextRequest("http://localhost/api/test");
    const result = withRateLimit(req);

    expect("headers" in result).toBe(true);
    expect("response" in result).toBe(false);
  });

  it("returns 429 response when blocked", () => {
    vi.mocked(checkRateLimit).mockReturnValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60000,
    });
    const req = new NextRequest("http://localhost/api/test");
    const result = withRateLimit(req);

    expect("response" in result).toBe(true);
    if ("response" in result) {
      expect(result.response.status).toBe(429);
    }
  });
});

describe("jsonResponse", () => {
  it("creates JSON response with correct status and headers", async () => {
    const res = jsonResponse({ test: true }, { "X-Custom": "value" }, 201);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.test).toBe(true);
    expect(res.headers.get("X-Custom")).toBe("value");
  });
});

describe("serializeBigInt", () => {
  it("converts BigInt to string", () => {
    const result = serializeBigInt({ height: BigInt(12345) });
    expect(result.height).toBe("12345");
    expect(typeof result.height).toBe("string");
  });

  it("preserves other types and handles nested objects", () => {
    const result = serializeBigInt({
      name: "test",
      count: 42,
      nested: { big: BigInt(999), flag: true },
    });
    expect(result.name).toBe("test");
    expect(result.count).toBe(42);
    expect(result.nested.big).toBe("999");
    expect(result.nested.flag).toBe(true);
  });
});
