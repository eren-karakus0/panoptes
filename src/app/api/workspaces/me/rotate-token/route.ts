import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit } from "@/lib/api-helpers";
import { requireWorkspace, hashToken, generateWorkspaceToken } from "@/lib/workspace-auth";

export async function POST(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const auth = await requireWorkspace(request);
  if (auth.error) return auth.error;

  const newToken = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.findUnique({ where: { id: auth.workspace.id } });
    if (!ws) throw new Error("Workspace not found");
    const token = generateWorkspaceToken();
    const hash = hashToken(token);
    await tx.workspace.update({
      where: { id: auth.workspace.id },
      data: { adminTokenHash: hash },
    });
    return token;
  });

  return NextResponse.json(
    { token: newToken, message: "Previous token invalidated" },
    { headers: rl.headers },
  );
}
