import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { requireWorkspace } from "@/lib/workspace-auth";
import { POLICY_DEFAULTS } from "@/lib/constants";
import type { PolicyCondition, PolicyAction } from "@/types";
import { ALLOWED_FIELDS } from "@/lib/intelligence/policy-conditions";

function validatePolicyCreate(body: unknown): {
  name: string;
  description?: string;
  conditions: PolicyCondition[];
  actions: PolicyAction[];
  dryRun?: boolean;
  priority?: number;
  cooldownMinutes?: number;
} | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body" };

  const b = body as Record<string, unknown>;

  if (typeof b.name !== "string" || b.name.trim().length < 2) {
    return { error: "Name must be at least 2 characters" };
  }

  if (!Array.isArray(b.conditions) || b.conditions.length === 0) {
    return { error: "At least one condition is required" };
  }
  if (b.conditions.length > POLICY_DEFAULTS.MAX_CONDITIONS) {
    return { error: `Maximum ${POLICY_DEFAULTS.MAX_CONDITIONS} conditions allowed` };
  }

  for (const c of b.conditions) {
    if (!c.field || !c.operator || c.value === undefined) {
      return { error: "Each condition must have field, operator, and value" };
    }
    if (!["lt", "gt", "eq", "neq", "gte", "lte", "in"].includes(c.operator)) {
      return { error: `Invalid operator: ${c.operator}` };
    }
    if (!ALLOWED_FIELDS.has(c.field)) {
      return { error: `Invalid condition field: ${c.field}` };
    }
  }

  if (!Array.isArray(b.actions) || b.actions.length === 0) {
    return { error: "At least one action is required" };
  }
  if (b.actions.length > POLICY_DEFAULTS.MAX_ACTIONS) {
    return { error: `Maximum ${POLICY_DEFAULTS.MAX_ACTIONS} actions allowed` };
  }

  const validActionTypes = ["webhook", "routing_exclude", "log", "annotate", "incident_create"];
  for (const a of b.actions) {
    if (!validActionTypes.includes(a.type)) {
      return { error: `Invalid action type: ${a.type}` };
    }
  }

  if (b.cooldownMinutes !== undefined) {
    if (typeof b.cooldownMinutes !== "number" ||
        b.cooldownMinutes < POLICY_DEFAULTS.MIN_COOLDOWN_MINUTES ||
        b.cooldownMinutes > POLICY_DEFAULTS.MAX_COOLDOWN_MINUTES) {
      return { error: `Cooldown must be between ${POLICY_DEFAULTS.MIN_COOLDOWN_MINUTES} and ${POLICY_DEFAULTS.MAX_COOLDOWN_MINUTES} minutes` };
    }
  }

  return {
    name: b.name.trim(),
    description: typeof b.description === "string" ? b.description.trim() : undefined,
    conditions: b.conditions as PolicyCondition[],
    actions: b.actions as PolicyAction[],
    dryRun: typeof b.dryRun === "boolean" ? b.dryRun : undefined,
    priority: typeof b.priority === "number" ? b.priority : undefined,
    cooldownMinutes: b.cooldownMinutes as number | undefined,
  };
}

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request);
  if (auth.error) return auth.error;

  const policies = await prisma.policy.findMany({
    where: { workspaceId: auth.workspace.id },
    orderBy: { priority: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      dryRun: true,
      priority: true,
      conditions: true,
      actions: true,
      cooldownMinutes: true,
      lastTriggeredAt: true,
      createdAt: true,
    },
  });

  const parsed = policies.map((p) => ({
    ...p,
    conditions: JSON.parse(p.conditions),
    actions: JSON.parse(p.actions),
  }));

  return NextResponse.json({ policies: parsed }, { headers: rl.headers });
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
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: rl.headers });
  }

  const validated = validatePolicyCreate(body);
  if ("error" in validated) {
    return NextResponse.json({ error: validated.error }, { status: 400, headers: rl.headers });
  }

  let policy;
  try {
    policy = await prisma.$transaction(async (tx) => {
      const count = await tx.policy.count({ where: { workspaceId: auth.workspace.id } });
      if (count >= POLICY_DEFAULTS.MAX_PER_WORKSPACE) {
        throw new Error("LIMIT_REACHED");
      }
      return tx.policy.create({
        data: {
          workspaceId: auth.workspace.id,
          name: validated.name,
          description: validated.description,
          conditions: JSON.stringify(validated.conditions),
          actions: JSON.stringify(validated.actions),
          dryRun: validated.dryRun ?? true,
          priority: validated.priority ?? 100,
          cooldownMinutes: validated.cooldownMinutes ?? 15,
        },
        select: {
          id: true,
          name: true,
          description: true,
          isActive: true,
          dryRun: true,
          priority: true,
          conditions: true,
          actions: true,
          cooldownMinutes: true,
          lastTriggeredAt: true,
          createdAt: true,
        },
      });
    });
  } catch (e) {
    if (e instanceof Error && e.message === "LIMIT_REACHED") {
      return NextResponse.json(
        { error: `Policy limit reached (max ${POLICY_DEFAULTS.MAX_PER_WORKSPACE})` },
        { status: 409, headers: rl.headers },
      );
    }
    throw e;
  }

  return NextResponse.json(
    {
      ...policy,
      conditions: JSON.parse(policy.conditions),
      actions: JSON.parse(policy.actions),
    },
    { status: 201, headers: rl.headers },
  );
}
