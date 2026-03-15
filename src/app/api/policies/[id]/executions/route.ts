import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { requireWorkspace } from "@/lib/workspace-auth";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, ctx: RouteContext) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request);
  if (auth.error) return auth.error;

  const { id } = await ctx.params;

  const policy = await prisma.policy.findFirst({
    where: { id, workspaceId: auth.workspace.id },
    select: { id: true },
  });

  if (!policy) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404, headers: rl.headers });
  }

  const url = new URL(request.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 100);
  const offset = Number(url.searchParams.get("offset")) || 0;

  const [executions, total] = await Promise.all([
    prisma.policyExecution.findMany({
      where: { policyId: id },
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.policyExecution.count({ where: { policyId: id } }),
  ]);

  return NextResponse.json({
    executions: executions.map((e) => ({
      ...e,
      conditionsMet: JSON.parse(e.conditionsMet),
      actionsTaken: JSON.parse(e.actionsTaken),
      actionsResults: JSON.parse(e.actionsResults),
    })),
    total,
    limit,
    offset,
  }, { headers: rl.headers });
}
