import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/cron-auth", () => ({
  validateCronAuth: vi.fn(),
}));

vi.mock("@/lib/api-helpers", () => ({
  withRateLimit: vi.fn(() => ({ headers: { "X-RateLimit-Limit": "60" } })),
}));

vi.mock("@/lib/indexer", () => ({
  checkEndpoints: vi.fn(),
  aggregateStats: vi.fn(),
  cleanupOldData: vi.fn(),
}));

import { validateCronAuth } from "@/lib/cron-auth";
import { withRateLimit } from "@/lib/api-helpers";
import { checkEndpoints, aggregateStats, cleanupOldData } from "@/lib/indexer";

function makeCronRequest(): NextRequest {
  return new NextRequest("http://localhost/api/cron/health", {
    method: "POST",
    headers: { authorization: "Bearer test-secret" },
  });
}

describe("Cron Routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(validateCronAuth).mockReturnValue(null);
    vi.mocked(withRateLimit).mockReturnValue({
      headers: { "X-RateLimit-Limit": "60" },
    });
  });

  describe("shared cron guards", () => {
    it("returns 401 when auth fails (before rate limit runs)", async () => {
      const { NextResponse } = await import("next/server");
      vi.mocked(validateCronAuth).mockReturnValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );

      const { POST } = await import("@/app/api/cron/health/route");
      const res = await POST(makeCronRequest());

      expect(res.status).toBe(401);
      expect(withRateLimit).not.toHaveBeenCalled();
    });

    it("returns 429 when rate limited (after auth passes)", async () => {
      const { NextResponse } = await import("next/server");
      vi.mocked(withRateLimit).mockReturnValue({
        response: NextResponse.json(
          { error: "Too many requests" },
          { status: 429 },
        ),
      });

      const { POST } = await import("@/app/api/cron/health/route");
      const res = await POST(makeCronRequest());

      expect(res.status).toBe(429);
    });
  });

  describe("POST /api/cron/health", () => {
    it("returns success on checkEndpoints", async () => {
      vi.mocked(checkEndpoints).mockResolvedValue({
        checked: 3,
        healthy: 2,
        unhealthy: 1,
        duration: 1500,
      } as never);

      const { POST } = await import("@/app/api/cron/health/route");
      const res = await POST(makeCronRequest());
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.checked).toBe(3);
    });

    it("returns 500 on error", async () => {
      vi.mocked(checkEndpoints).mockRejectedValue(new Error("DB timeout"));

      const { POST } = await import("@/app/api/cron/health/route");
      const res = await POST(makeCronRequest());
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.success).toBe(false);
    });
  });

  describe("POST /api/cron/stats", () => {
    it("returns success on aggregateStats", async () => {
      vi.mocked(aggregateStats).mockResolvedValue({
        totalValidators: 50,
        activeValidators: 40,
        blockHeight: 12345,
      } as never);

      const { POST } = await import("@/app/api/cron/stats/route");
      const res = await POST(makeCronRequest());
      const body = await res.json();

      expect(body.success).toBe(true);
    });

    it("returns 500 on error", async () => {
      vi.mocked(aggregateStats).mockRejectedValue(new Error("Stats failed"));

      const { POST } = await import("@/app/api/cron/stats/route");
      const res = await POST(makeCronRequest());
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.success).toBe(false);
    });
  });

  describe("POST /api/cron/cleanup", () => {
    it("returns success on cleanupOldData", async () => {
      vi.mocked(cleanupOldData).mockResolvedValue({
        deletedSnapshots: 100,
        deletedHealth: 50,
        deletedStats: 10,
      } as never);

      const { POST } = await import("@/app/api/cron/cleanup/route");
      const res = await POST(makeCronRequest());
      const body = await res.json();

      expect(body.success).toBe(true);
      expect(body.deletedSnapshots).toBe(100);
    });

    it("returns 500 on error", async () => {
      vi.mocked(cleanupOldData).mockRejectedValue(
        new Error("Cleanup failed"),
      );

      const { POST } = await import("@/app/api/cron/cleanup/route");
      const res = await POST(makeCronRequest());
      const body = await res.json();

      expect(res.status).toBe(500);
      expect(body.success).toBe(false);
    });
  });
});
