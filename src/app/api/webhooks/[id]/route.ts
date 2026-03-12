import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { requireWorkspace } from "@/lib/workspace-auth";
import { validateWebhookUpdate } from "@/lib/webhook-validation";

interface RouteContext {
  params: Promise<{ id: string }>;
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

  const validated = validateWebhookUpdate(body);
  if ("error" in validated) {
    return NextResponse.json(
      { error: validated.error },
      { status: 400, headers: rl.headers },
    );
  }

  const existing = await prisma.webhook.findFirst({
    where: { id, workspaceId: auth.workspace.id },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Webhook not found" },
      { status: 404, headers: rl.headers },
    );
  }

  const updated = await prisma.webhook.update({
    where: { id },
    data: validated,
    select: {
      id: true,
      name: true,
      url: true,
      events: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(updated, { headers: rl.headers });
}

export async function DELETE(request: NextRequest, context: RouteContext) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request);
  if (auth.error) return auth.error;

  const { id } = await context.params;

  const existing = await prisma.webhook.findFirst({
    where: { id, workspaceId: auth.workspace.id },
  });
  if (!existing) {
    return NextResponse.json(
      { error: "Webhook not found" },
      { status: 404, headers: rl.headers },
    );
  }

  await prisma.webhook.delete({ where: { id } });

  return new NextResponse(null, { status: 204, headers: rl.headers });
}
