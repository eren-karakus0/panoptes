import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, rateLimitHeaders } from "@/lib/rate-limit";

export function getClientIp(request: NextRequest): string {
  // Vercel/Cloudflare sets these headers - trust only platform headers
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    // @ts-expect-error -- request.ip exists at runtime on Vercel/Node
    (request.ip as string) ||
    "unknown"
  );
}

export function withRateLimit(
  request: NextRequest,
): { response: NextResponse } | { headers: Record<string, string> } {
  const ip = getClientIp(request);
  const limit = checkRateLimit(ip);
  const headers = rateLimitHeaders(limit);

  if (!limit.allowed) {
    return {
      response: NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers },
      ),
    };
  }

  return { headers };
}

export function jsonResponse(
  data: unknown,
  headers: Record<string, string>,
  status = 200,
  options?: { cache?: boolean },
): NextResponse {
  const allHeaders =
    options?.cache !== false
      ? {
          ...headers,
          "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
        }
      : headers;
  return NextResponse.json(data, { status, headers: allHeaders });
}

/** Convert BigInt fields to string for JSON serialization */
export function serializeBigInt<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === "bigint" ? value.toString() : value,
    ),
  ) as T;
}
