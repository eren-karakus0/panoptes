import { prisma } from "@/lib/db";
import type { PublishEventInput } from "./event-types";

export async function publishEvent(
  input: PublishEventInput,
): Promise<number | null> {
  try {
    const event = await prisma.outboxEvent.create({
      data: {
        channel: input.channel,
        type: input.type,
        visibility: input.visibility ?? "public",
        workspaceId: input.workspaceId ?? null,
        payload: JSON.stringify(input.payload),
      },
      select: { seq: true },
    });
    return event.seq;
  } catch (error) {
    console.error("[publishEvent] Failed:", error);
    return null;
  }
}

export async function publishEvents(
  inputs: PublishEventInput[],
): Promise<void> {
  await Promise.allSettled(inputs.map(publishEvent));
}
