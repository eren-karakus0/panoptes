import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { requireWorkspace } from "@/lib/workspace-auth";
import { parseIntParam } from "@/lib/validation";

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
    select: { id: true },
  });
  if (!slo) {
    return NextResponse.json(
      { error: "SLO not found" },
      { status: 404, headers: rl.headers },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = parseIntParam(searchParams.get("limit"), 100, 1, 500);
  const offset = parseIntParam(searchParams.get("offset"), 0, 0, 10000);

  const [evaluations, total] = await Promise.all([
    prisma.sloEvaluation.findMany({
      where: { sloId: id },
      orderBy: { evaluatedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.sloEvaluation.count({ where: { sloId: id } }),
  ]);

  return NextResponse.json(
    { evaluations, total, limit, offset },
    { headers: rl.headers },
  );
}
