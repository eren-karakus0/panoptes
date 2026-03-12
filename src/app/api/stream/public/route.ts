import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/api-helpers";
import { STREAM_DEFAULTS } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const limit = checkRateLimit(ip);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const channelsParam = request.nextUrl.searchParams.get("channels");
  const channels = channelsParam
    ? channelsParam.split(",").map((c) => c.trim()).filter(Boolean)
    : null;

  // Single source of truth: base filter used by both tail cursor and poll
  const baseFilter: Record<string, unknown> = { visibility: "public" };
  if (channels) {
    baseFilter.channel = { in: channels };
  }

  const lastEventId = request.headers.get("last-event-id");
  let lastSeq: number;

  if (lastEventId) {
    lastSeq = parseInt(lastEventId, 10);
    if (isNaN(lastSeq)) lastSeq = 0;
  } else {
    // Tail mode: cursor scoped to exactly the events this client can see
    const latest = await prisma.outboxEvent.findFirst({
      where: baseFilter,
      orderBy: { seq: "desc" },
      select: { seq: true },
    });
    lastSeq = latest?.seq ?? 0;
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let currentSeq = lastSeq;
      let aborted = false;

      request.signal.addEventListener("abort", () => {
        aborted = true;
      });

      const run = async () => {
        // Send initial heartbeat so client knows connection is alive
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          return;
        }

        let heartbeatCounter = 0;

        while (!aborted) {
          try {
            const events = await prisma.outboxEvent.findMany({
              where: { seq: { gt: currentSeq }, ...baseFilter },
              orderBy: { seq: "asc" },
              take: STREAM_DEFAULTS.BATCH_SIZE,
            });

            for (const event of events) {
              const data = `id: ${event.seq}\nevent: ${event.type}\ndata: ${event.payload}\n\n`;
              controller.enqueue(encoder.encode(data));
              currentSeq = event.seq;
            }
          } catch (error) {
            console.error("[SSE/public] Poll error:", error);
          }

          // Heartbeat every ~5 poll cycles (15s)
          heartbeatCounter++;
          if (heartbeatCounter >= 5) {
            heartbeatCounter = 0;
            try {
              controller.enqueue(encoder.encode(": heartbeat\n\n"));
            } catch {
              break;
            }
          }

          await sleep(STREAM_DEFAULTS.POLL_INTERVAL_MS);
        }

        try {
          controller.close();
        } catch {
          // Already closed
        }
      };

      run();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
