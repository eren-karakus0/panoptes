import { NextRequest, NextResponse } from "next/server";
import { withRateLimit } from "@/lib/api-helpers";
import {
  authenticateWorkspace,
  extractApiKey,
} from "@/lib/workspace-auth";
import { createStreamToken } from "@/lib/stream-token";
import { STREAM_DEFAULTS } from "@/lib/constants";

export async function POST(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  // Try Bearer token first, then fall back to x-api-key header.
  // This is a compatibility bridge for SDK/external clients until
  // the dedicated ApiKey model lands in v1.3.1.
  let workspace = await authenticateWorkspace(request);

  if (!workspace) {
    const apiKey = extractApiKey(request);
    if (apiKey) {
      // Re-use the same auth pipeline with the API key value
      const syntheticReq = new NextRequest(request.url, {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      workspace = await authenticateWorkspace(syntheticReq);
    }
  }

  if (!workspace) {
    return NextResponse.json(
      { error: "Unauthorized — valid workspace token or API key required" },
      { status: 401, headers: rl.headers },
    );
  }

  const token = createStreamToken(
    workspace.id,
    STREAM_DEFAULTS.TOKEN_TTL_SECONDS,
  );

  return NextResponse.json(
    { token, expiresIn: STREAM_DEFAULTS.TOKEN_TTL_SECONDS },
    { headers: rl.headers },
  );
}
