import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    outboxEvent: {
      create: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";
import { publishEvent, publishEvents } from "@/lib/events/publish";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

describe("publishEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates outbox event with correct data", async () => {
    mockPrisma.outboxEvent.create.mockResolvedValue({ seq: 42 });

    const result = await publishEvent({
      channel: "anomaly",
      type: "anomaly.created",
      payload: { anomalyType: "jailing", severity: "high" },
    });

    expect(result).toBe(42);
    expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith({
      data: {
        channel: "anomaly",
        type: "anomaly.created",
        visibility: "public",
        workspaceId: null,
        payload: JSON.stringify({
          anomalyType: "jailing",
          severity: "high",
        }),
      },
      select: { seq: true },
    });
  });

  it("defaults visibility to public", async () => {
    mockPrisma.outboxEvent.create.mockResolvedValue({ seq: 1 });

    await publishEvent({
      channel: "network",
      type: "stats.updated",
      payload: {},
    });

    expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ visibility: "public" }),
      }),
    );
  });

  it("supports workspace visibility", async () => {
    mockPrisma.outboxEvent.create.mockResolvedValue({ seq: 5 });

    await publishEvent({
      channel: "workspace",
      type: "anomaly.created",
      visibility: "workspace",
      workspaceId: "ws-123",
      payload: { test: true },
    });

    expect(mockPrisma.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          visibility: "workspace",
          workspaceId: "ws-123",
        }),
      }),
    );
  });

  it("returns null on DB error without throwing", async () => {
    mockPrisma.outboxEvent.create.mockRejectedValue(
      new Error("DB connection failed"),
    );

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await publishEvent({
      channel: "anomaly",
      type: "anomaly.created",
      payload: {},
    });

    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("publishEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes multiple events", async () => {
    mockPrisma.outboxEvent.create
      .mockResolvedValueOnce({ seq: 1 })
      .mockResolvedValueOnce({ seq: 2 });

    await publishEvents([
      { channel: "anomaly", type: "anomaly.created", payload: { id: 1 } },
      { channel: "anomaly", type: "validator.jailed", payload: { id: 2 } },
    ]);

    expect(mockPrisma.outboxEvent.create).toHaveBeenCalledTimes(2);
  });

  it("continues on partial failure (Promise.allSettled)", async () => {
    mockPrisma.outboxEvent.create
      .mockRejectedValueOnce(new Error("fail"))
      .mockResolvedValueOnce({ seq: 2 });

    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await publishEvents([
      { channel: "anomaly", type: "anomaly.created", payload: {} },
      { channel: "anomaly", type: "anomaly.resolved", payload: {} },
    ]);

    expect(mockPrisma.outboxEvent.create).toHaveBeenCalledTimes(2);
    consoleSpy.mockRestore();
  });
});
