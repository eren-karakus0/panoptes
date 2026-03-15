import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { hashToken, generateWorkspaceToken } from "@/lib/workspace-auth";
import { WORKSPACE_DEFAULTS } from "@/lib/constants";

function validateWorkspaceCreate(body: unknown): { name: string; slug: string } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body" };

  const { name, slug } = body as Record<string, unknown>;

  if (typeof name !== "string" || name.trim().length < WORKSPACE_DEFAULTS.NAME_MIN_LENGTH) {
    return { error: `Name must be at least ${WORKSPACE_DEFAULTS.NAME_MIN_LENGTH} characters` };
  }
  if (name.trim().length > WORKSPACE_DEFAULTS.NAME_MAX_LENGTH) {
    return { error: `Name must be at most ${WORKSPACE_DEFAULTS.NAME_MAX_LENGTH} characters` };
  }
  if (typeof slug !== "string" || slug.length < WORKSPACE_DEFAULTS.SLUG_MIN_LENGTH) {
    return { error: `Slug must be at least ${WORKSPACE_DEFAULTS.SLUG_MIN_LENGTH} characters` };
  }
  if (slug.length > WORKSPACE_DEFAULTS.SLUG_MAX_LENGTH) {
    return { error: `Slug must be at most ${WORKSPACE_DEFAULTS.SLUG_MAX_LENGTH} characters` };
  }
  if (!WORKSPACE_DEFAULTS.SLUG_PATTERN.test(slug)) {
    return { error: "Slug must contain only lowercase letters, numbers, and hyphens" };
  }

  return { name: name.trim(), slug };
}

export async function POST(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  // Admin secret guard
  const adminSecret = request.headers.get("x-admin-secret");
  const expectedSecret = process.env.PANOPTES_ADMIN_SECRET;
  const secretsMatch = expectedSecret && adminSecret &&
    adminSecret.length === expectedSecret.length &&
    timingSafeEqual(Buffer.from(adminSecret), Buffer.from(expectedSecret));
  if (!secretsMatch) {
    return NextResponse.json(
      { error: "Forbidden — valid admin secret required" },
      { status: 403, headers: rl.headers },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: rl.headers },
    );
  }

  const validated = validateWorkspaceCreate(body);
  if ("error" in validated) {
    return NextResponse.json(
      { error: validated.error },
      { status: 400, headers: rl.headers },
    );
  }

  // Check slug uniqueness
  const existing = await prisma.workspace.findUnique({
    where: { slug: validated.slug },
  });
  if (existing) {
    return NextResponse.json(
      { error: "Workspace slug already exists" },
      { status: 409, headers: rl.headers },
    );
  }

  // Check workspace limit
  const count = await prisma.workspace.count();
  if (count >= WORKSPACE_DEFAULTS.MAX_WORKSPACES) {
    return NextResponse.json(
      { error: `Maximum workspace limit reached (${WORKSPACE_DEFAULTS.MAX_WORKSPACES})` },
      { status: 409, headers: rl.headers },
    );
  }

  const rawToken = generateWorkspaceToken();
  const tokenHash = hashToken(rawToken);

  const workspace = await prisma.workspace.create({
    data: {
      name: validated.name,
      slug: validated.slug,
      adminTokenHash: tokenHash,
    },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    { workspace, token: rawToken },
    { status: 201, headers: rl.headers },
  );
}
