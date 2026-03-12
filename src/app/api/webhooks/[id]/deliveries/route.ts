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

  const webhook = await prisma.webhook.findFirst({
    where: { id, workspaceId: auth.workspace.id },
    select: { id: true },
  });
  if (!webhook) {
    return NextResponse.json(
      { error: "Webhook not found" },
      { status: 404, headers: rl.headers },
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const limit = parseIntParam(searchParams.get("limit"), 20, 1, 100);
  const offset = parseIntParam(searchParams.get("offset"), 0, 0, 10000);

  const [deliveries, total] = await Promise.all([
    prisma.webhookDelivery.findMany({
      where: { webhookId: id },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
      select: {
        id: true,
        eventType: true,
        statusCode: true,
        success: true,
        attempts: true,
        deliveredAt: true,
        createdAt: true,
      },
    }),
    prisma.webhookDelivery.count({ where: { webhookId: id } }),
  ]);

  return NextResponse.json(
    { deliveries, total, limit, offset },
    { headers: rl.headers },
  );
}
