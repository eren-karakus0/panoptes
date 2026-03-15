import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { requireWorkspace } from "@/lib/workspace-auth";
import { WORKSPACE_DEFAULTS } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request);
  if (auth.error) return auth.error;

  const workspace = await prisma.workspace.findUnique({
    where: { id: auth.workspace.id },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!workspace) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404, headers: rl.headers });
  }

  const [sloCount, webhookCount, incidentCount] = await Promise.all([
    prisma.slo.count({ where: { workspaceId: auth.workspace.id } }),
    prisma.webhook.count({ where: { workspaceId: auth.workspace.id } }),
    prisma.incident.count({ where: { workspaceId: auth.workspace.id } }),
  ]);

  return NextResponse.json({
    workspace,
    resources: {
      slos: sloCount,
      webhooks: webhookCount,
      incidents: incidentCount,
    },
  }, { headers: rl.headers });
}

export async function PATCH(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request);
  if (auth.error) return auth.error;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: rl.headers },
    );
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400, headers: rl.headers });
  }

  const { name } = body as Record<string, unknown>;

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length < WORKSPACE_DEFAULTS.NAME_MIN_LENGTH) {
      return NextResponse.json(
        { error: `Name must be at least ${WORKSPACE_DEFAULTS.NAME_MIN_LENGTH} characters` },
        { status: 400, headers: rl.headers },
      );
    }
    if (name.trim().length > WORKSPACE_DEFAULTS.NAME_MAX_LENGTH) {
      return NextResponse.json(
        { error: `Name must be at most ${WORKSPACE_DEFAULTS.NAME_MAX_LENGTH} characters` },
        { status: 400, headers: rl.headers },
      );
    }
  } else {
    return NextResponse.json(
      { error: "At least one field (name) must be provided" },
      { status: 400, headers: rl.headers },
    );
  }

  const updated = await prisma.workspace.update({
    where: { id: auth.workspace.id },
    data: { name: (name as string).trim() },
    select: { id: true, name: true, slug: true },
  });

  return NextResponse.json({ workspace: updated }, { headers: rl.headers });
}
