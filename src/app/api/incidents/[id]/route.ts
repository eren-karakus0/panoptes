import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { requireWorkspace } from "@/lib/workspace-auth";
import { validateIncidentUpdate } from "@/lib/incident-validation";
import { CHANNELS } from "@/lib/events/event-types";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  const incident = await prisma.incident.findFirst({
    where: { id, workspaceId: auth.workspace.id },
    include: {
      events: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!incident) {
    return NextResponse.json(
      { error: "Incident not found" },
      { status: 404, headers: rl.headers },
    );
  }

  return NextResponse.json(incident, { headers: rl.headers });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request);
  if (auth.error) return auth.error;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400, headers: rl.headers },
    );
  }

  const validated = validateIncidentUpdate(body);
  if ("error" in validated) {
    return NextResponse.json(
      { error: validated.error },
      { status: 400, headers: rl.headers },
    );
  }

  const incident = await prisma.incident.findFirst({
    where: { id, workspaceId: auth.workspace.id },
  });

  if (!incident) {
    return NextResponse.json(
      { error: "Incident not found" },
      { status: 404, headers: rl.headers },
    );
  }

  if (incident.status === "resolved") {
    return NextResponse.json(
      { error: "Incident is already resolved" },
      { status: 409, headers: rl.headers },
    );
  }

  if (incident.status === "acknowledged" && validated.status === "acknowledged") {
    return NextResponse.json(
      { error: "Incident is already acknowledged" },
      { status: 409, headers: rl.headers },
    );
  }

  const updateData: Record<string, unknown> = {
    status: validated.status,
  };
  if (validated.status === "acknowledged") {
    updateData.acknowledgedAt = new Date();
  }
  if (validated.status === "resolved") {
    updateData.resolvedAt = new Date();
  }

  const webhookType = validated.status === "acknowledged"
    ? "incident.acknowledged" as const
    : "incident.resolved" as const;

  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.incident.update({
      where: { id },
      data: updateData,
    });

    await tx.incidentEvent.create({
      data: {
        incidentId: id,
        eventType: validated.status,
        message: `Incident ${validated.status}`,
      },
    });

    await tx.outboxEvent.create({
      data: {
        channel: CHANNELS.INCIDENT,
        type: webhookType,
        visibility: "workspace",
        workspaceId: auth.workspace.id,
        payload: JSON.stringify({
          incidentId: id,
          entityType: result.entityType,
          entityId: result.entityId,
          status: validated.status,
        }),
      },
    });

    return result;
  });

  return NextResponse.json(updated, { headers: rl.headers });
}
