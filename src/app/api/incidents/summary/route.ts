import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { requireWorkspace } from "@/lib/workspace-auth";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request);
  if (auth.error) return auth.error;

  const incidents = await prisma.incident.findMany({
    where: { workspaceId: auth.workspace.id },
    select: { status: true, severity: true },
  });

  const total = incidents.length;
  const open = incidents.filter((i) => i.status === "open").length;
  const acknowledged = incidents.filter((i) => i.status === "acknowledged").length;
  const resolved = incidents.filter((i) => i.status === "resolved").length;
  const critical = incidents.filter((i) => i.severity === "critical" && i.status !== "resolved").length;

  return NextResponse.json(
    { total, open, acknowledged, resolved, critical },
    { headers: rl.headers },
  );
}
