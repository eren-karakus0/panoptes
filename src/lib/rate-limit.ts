import { RATE_LIMIT } from "@/lib/constants";

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

let cleanupTimer: ReturnType<typeof setInterval> | null = null;

function ensureCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, RATE_LIMIT.CLEANUP_INTERVAL);
  // Allow process to exit
  if (typeof cleanupTimer === "object" && "unref" in cleanupTimer) {
    cleanupTimer.unref();
  }
}

export function checkRateLimit(ip: string): {
  allowed: boolean;
  remaining: number;
  resetAt: number;
} {
  ensureCleanup();
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || entry.resetAt < now) {
    const resetAt = now + RATE_LIMIT.WINDOW_MS;
    store.set(ip, { count: 1, resetAt });
    return {
      allowed: true,
      remaining: RATE_LIMIT.MAX_REQUESTS - 1,
      resetAt,
    };
  }

  entry.count++;

  if (entry.count > RATE_LIMIT.MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: entry.resetAt,
    };
  }

  return {
    allowed: true,
    remaining: RATE_LIMIT.MAX_REQUESTS - entry.count,
    resetAt: entry.resetAt,
  };
}

export function rateLimitHeaders(rateLimit: {
  remaining: number;
  resetAt: number;
}): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(RATE_LIMIT.MAX_REQUESTS),
    "X-RateLimit-Remaining": String(Math.max(0, rateLimit.remaining)),
    "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
  };
}
