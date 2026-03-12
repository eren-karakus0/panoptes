import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { requireWorkspace } from "@/lib/workspace-auth";
import { validateWebhookCreate } from "@/lib/webhook-validation";
import { encryptSecret, generateWebhookSecret } from "@/lib/webhook-crypto";
import { WEBHOOK_DEFAULTS } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request);
  if (auth.error) return auth.error;

  const webhooks = await prisma.webhook.findMany({
    where: { workspaceId: auth.workspace.id },
    select: {
      id: true,
      name: true,
      url: true,
      events: true,
      isActive: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ webhooks }, { headers: rl.headers });
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

  const validated = validateWebhookCreate(body);
  if ("error" in validated) {
    return NextResponse.json(
      { error: validated.error },
      { status: 400, headers: rl.headers },
    );
  }

  const plainSecret = generateWebhookSecret();
  const secretEncrypted = encryptSecret(plainSecret);

  const webhook = await prisma.$transaction(async (tx) => {
    // Lock workspace row to serialize concurrent webhook creation
    await tx.$queryRaw`SELECT id FROM "Workspace" WHERE id = ${auth.workspace.id} FOR UPDATE`;
    const count = await tx.webhook.count({
      where: { workspaceId: auth.workspace.id },
    });
    if (count >= WEBHOOK_DEFAULTS.MAX_PER_WORKSPACE) {
      return null;
    }
    return tx.webhook.create({
      data: {
        workspaceId: auth.workspace.id,
        name: validated.name,
        url: validated.url,
        events: validated.events,
        secretEncrypted,
      },
      select: {
        id: true,
        name: true,
        url: true,
        events: true,
        isActive: true,
        createdAt: true,
      },
    });
  });

  if (!webhook) {
    return NextResponse.json(
      {
        error: `Workspace webhook limit reached (max ${WEBHOOK_DEFAULTS.MAX_PER_WORKSPACE})`,
      },
      { status: 409, headers: rl.headers },
    );
  }

  return NextResponse.json(
    { ...webhook, secret: plainSecret },
    { status: 201, headers: rl.headers },
  );
}
