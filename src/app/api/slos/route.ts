import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { requireWorkspace } from "@/lib/workspace-auth";
import { validateSloCreate } from "@/lib/slo-validation";
import { SLO_DEFAULTS } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request);
  if (auth.error) return auth.error;

  const slos = await prisma.slo.findMany({
    where: { workspaceId: auth.workspace.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ slos }, { headers: rl.headers });
}

export async function POST(request: NextRequest) {
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

  const validated = validateSloCreate(body);
  if ("error" in validated) {
    return NextResponse.json(
      { error: validated.error },
      { status: 400, headers: rl.headers },
    );
  }

  // Entity existence check
  if (validated.entityType === "endpoint") {
    const endpoint = await prisma.endpoint.findUnique({
      where: { id: validated.entityId },
      select: { id: true },
    });
    if (!endpoint) {
      return NextResponse.json(
        { error: "Endpoint not found" },
        { status: 404, headers: rl.headers },
      );
    }
  } else {
    const validator = await prisma.validator.findUnique({
      where: { id: validated.entityId },
      select: { id: true },
    });
    if (!validator) {
      return NextResponse.json(
        { error: "Validator not found" },
        { status: 404, headers: rl.headers },
      );
    }
  }

  const slo = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${auth.workspace.id} FOR UPDATE`;
    const count = await tx.slo.count({
      where: { workspaceId: auth.workspace.id },
    });
    if (count >= SLO_DEFAULTS.MAX_PER_WORKSPACE) {
      return null;
    }
    return tx.slo.create({
      data: {
        workspaceId: auth.workspace.id,
        name: validated.name,
        indicator: validated.indicator,
        entityType: validated.entityType,
        entityId: validated.entityId,
        target: validated.target,
        windowDays: validated.windowDays,
      },
    });
  });

  if (!slo) {
    return NextResponse.json(
      {
        error: `Workspace SLO limit reached (max ${SLO_DEFAULTS.MAX_PER_WORKSPACE})`,
      },
      { status: 409, headers: rl.headers },
    );
  }

  return NextResponse.json(slo, { status: 201, headers: rl.headers });
}
