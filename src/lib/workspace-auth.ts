import { NextRequest, NextResponse } from "next/server";
import { createHash, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";

export interface WorkspaceContext {
  id: string;
  name: string;
  slug: string;
}

/**
 * Hash a raw workspace token using SHA-256.
 * Used both at seed time (to store the hash) and at request time (to look up).
 */
export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Extract Bearer token from Authorization header.
 * Returns null if header is missing or malformed.
 */
export function extractBearerToken(request: NextRequest): string | null {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Extract API key from x-api-key header.
 * Used as fallback auth for SDK/external clients.
 */
export function extractApiKey(request: NextRequest): string | null {
  const key = request.headers.get("x-api-key");
  if (!key) return null;
  const trimmed = key.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Authenticate a request using workspace Bearer token.
 *
 * Flow:
 * 1. Extract Bearer token from Authorization header
 * 2. SHA-256 hash the token
 * 3. Look up workspace by adminTokenHash
 * 4. Return workspace context if found and active
 *
 * Returns null if authentication fails (no token, invalid, inactive).
 */
export async function authenticateWorkspace(
  request: NextRequest,
): Promise<WorkspaceContext | null> {
  const rawToken = extractBearerToken(request);
  if (!rawToken) return null;

  const tokenHash = hashToken(rawToken);

  const workspace = await prisma.workspace.findFirst({
    where: { adminTokenHash: tokenHash, isActive: true },
    select: { id: true, name: true, slug: true, adminTokenHash: true },
  });

  if (!workspace) return null;

  // Timing-safe comparison to prevent timing attacks
  const storedHash = Buffer.from(workspace.adminTokenHash, "utf-8");
  const providedHash = Buffer.from(tokenHash, "utf-8");
  if (
    storedHash.length !== providedHash.length ||
    !timingSafeEqual(storedHash, providedHash)
  ) {
    return null;
  }

  return { id: workspace.id, name: workspace.name, slug: workspace.slug };
}

/**
 * Require workspace authentication for a route handler.
 * Returns 401 if not authenticated.
 * Use in write endpoints (POST/PATCH/DELETE for webhooks, SLOs, policies).
 */
export function requireWorkspace(
  request: NextRequest,
): Promise<
  | { workspace: WorkspaceContext; error?: never }
  | { workspace?: never; error: NextResponse }
> {
  return authenticateWorkspace(request).then((workspace) => {
    if (!workspace) {
      return {
        error: NextResponse.json(
          { error: "Unauthorized — valid workspace token required" },
          { status: 401 },
        ),
      };
    }
    return { workspace };
  });
}
