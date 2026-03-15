import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { requireWorkspace } from "@/lib/workspace-auth";
import type { PolicyCondition } from "@/types";
import { evaluateAllConditions, type EvaluationContext } from "@/lib/intelligence/policy-conditions";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, ctx: RouteContext) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request);
  if (auth.error) return auth.error;

  const { id } = await ctx.params;

  const policy = await prisma.policy.findFirst({
    where: { id, workspaceId: auth.workspace.id },
  });

  if (!policy) {
    return NextResponse.json({ error: "Policy not found" }, { status: 404, headers: rl.headers });
  }

  // Accept optional test context in body
  let testContext: EvaluationContext = {};
  try {
    const body = await request.json();
    if (body && typeof body === "object") {
      testContext = body as EvaluationContext;
    }
  } catch {
    // No body = use empty context
  }

  const conditions: PolicyCondition[] = JSON.parse(policy.conditions);
  const { allMet, metConditions } = evaluateAllConditions(conditions, testContext);

  return NextResponse.json({
    policyId: policy.id,
    policyName: policy.name,
    allConditionsMet: allMet,
    totalConditions: conditions.length,
    metConditions: metConditions.length,
    conditions: conditions.map((c) => ({
      ...c,
      met: metConditions.some(
        (m) => m.field === c.field && m.operator === c.operator,
      ),
    })),
  }, { headers: rl.headers });
}
