import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { requireWorkspace } from "@/lib/workspace-auth";
import { decryptSecret, signPayload } from "@/lib/webhook-crypto";
import { assertUrlNotPrivate } from "@/lib/webhook-validation";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request);
  if (auth.error) return auth.error;

  const { id } = await context.params;

  const webhook = await prisma.webhook.findFirst({
    where: { id, workspaceId: auth.workspace.id },
  });
  if (!webhook) {
    return NextResponse.json(
      { error: "Webhook not found" },
      { status: 404, headers: rl.headers },
    );
  }

  const plainSecret = decryptSecret(webhook.secretEncrypted);
  const testPayload = JSON.stringify({
    type: "webhook.test",
    timestamp: new Date().toISOString(),
    workspace: { id: auth.workspace.id, name: auth.workspace.name },
  });

  const signature = signPayload(plainSecret, testPayload);

  // DNS resolution check — blocks SSRF via DNS rebinding / private IP resolution
  try {
    await assertUrlNotPrivate(webhook.url);
  } catch {
    return NextResponse.json(
      { success: false, error: "URL resolves to a blocked private/internal address" },
      { status: 400, headers: rl.headers },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const startTime = Date.now();
  try {
    const response = await fetch(webhook.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": "webhook.test",
      },
      body: testPayload,
      signal: controller.signal,
      redirect: "manual",
    });

    const responseTime = Date.now() - startTime;

    return NextResponse.json(
      {
        success: response.ok,
        statusCode: response.status,
        responseTime,
      },
      { headers: rl.headers },
    );
  } catch (err) {
    const responseTime = Date.now() - startTime;
    const message =
      err instanceof Error ? err.message : "Unknown error";

    return NextResponse.json(
      {
        success: false,
        statusCode: null,
        responseTime,
        error: message,
      },
      { headers: rl.headers },
    );
  } finally {
    clearTimeout(timeout);
  }
}
