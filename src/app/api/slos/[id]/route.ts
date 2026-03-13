import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { requireWorkspace } from "@/lib/workspace-auth";
import { validateSloUpdate } from "@/lib/slo-validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request);
  if (auth.error) return auth.error;

  const { id } = await context.params;

  const slo = await prisma.slo.findFirst({
    where: { id, workspaceId: auth.workspace.id },
  });
  if (!slo) {
    return NextResponse.json(
      { error: "SLO not found" },
      { status: 404, headers: rl.headers },
    );
  }

  return NextResponse.json(slo, { headers: rl.headers });
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request);
  if (auth.error) return auth.error;

  const { id } = await context.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: rl.headers },
    );
  }

  const validated = validateSloUpdate(body);
  if ("error" in validated) {
    return NextResponse.json(
      { error: validated.error },
      { status: 400, headers: rl.headers },
    );
  }

  const existing = await prisma.slo.findFirst({
    where: { id, workspaceId: auth.workspace.id },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "SLO not found" },
      { status: 404, headers: rl.headers },
    );
  }

  const updated = await prisma.slo.update({
    where: { id },
    data: validated,
  });

  return NextResponse.json(updated, { headers: rl.headers });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request);
  if (auth.error) return auth.error;

  const { id } = await context.params;

  const existing = await prisma.slo.findFirst({
    where: { id, workspaceId: auth.workspace.id },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "SLO not found" },
      { status: 404, headers: rl.headers },
    );
  }

  await prisma.slo.delete({ where: { id } });

  return new NextResponse(null, { status: 204, headers: rl.headers });
}
