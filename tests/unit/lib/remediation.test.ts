import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    actionRecord: {
      count: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    endpoint: { count: vi.fn() },
    incident: { findFirst: vi.fn() },
    anomaly: { findFirst: vi.fn(), update: vi.fn() },
    outboxEvent: { create: vi.fn() },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({
        incident: { create: vi.fn().mockResolvedValue({ id: "inc-1" }) },
        incidentEvent: { create: vi.fn() },
        outboxEvent: { create: vi.fn() },
      }),
    ),
  },
}));

vi.mock("@/lib/events/publish", () => ({
  publishEvent: vi.fn(),
}));

import { prisma } from "@/lib/db";

describe("getRemediationStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns status with counts", async () => {
    vi.mocked(prisma.actionRecord.count)
      .mockResolvedValueOnce(3) // actionsLastHour
      .mockResolvedValueOnce(1); // activeExclusions

    const { getRemediationStatus } = await import("@/lib/intelligence/remediation");
    const status = await getRemediationStatus("ws-1");

    expect(status.actionsLastHour).toBe(3);
    expect(status.maxAllowed).toBe(10);
    expect(status.canExecute).toBe(true);
    expect(status.activeExclusions).toBe(1);
  });

  it("returns canExecute false when limit reached", async () => {
    vi.mocked(prisma.actionRecord.count)
      .mockResolvedValueOnce(10) // at limit
      .mockResolvedValueOnce(0);

    const { getRemediationStatus } = await import("@/lib/intelligence/remediation");
    const status = await getRemediationStatus("ws-1");

    expect(status.canExecute).toBe(false);
  });
});

describe("getActiveExcludedEndpointIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns excluded endpoint IDs", async () => {
    vi.mocked(prisma.actionRecord.findMany).mockResolvedValue([
      { entityId: "ep-1" },
      { entityId: "ep-2" },
    ] as never);

    const { getActiveExcludedEndpointIds } = await import("@/lib/intelligence/remediation");
    const ids = await getActiveExcludedEndpointIds();

    expect(ids).toEqual(["ep-1", "ep-2"]);
  });

  it("returns empty array when no exclusions", async () => {
    vi.mocked(prisma.actionRecord.findMany).mockResolvedValue([]);

    const { getActiveExcludedEndpointIds } = await import("@/lib/intelligence/remediation");
    const ids = await getActiveExcludedEndpointIds();

    expect(ids).toEqual([]);
  });
});

describe("canExecute (from policy-actions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true when under limit", async () => {
    vi.mocked(prisma.actionRecord.count).mockResolvedValue(5);

    const { canExecute } = await import("@/lib/intelligence/policy-actions");
    const result = await canExecute("ws-1");

    expect(result).toBe(true);
  });

  it("returns false when at limit", async () => {
    vi.mocked(prisma.actionRecord.count).mockResolvedValue(10);

    const { canExecute } = await import("@/lib/intelligence/policy-actions");
    const result = await canExecute("ws-1");

    expect(result).toBe(false);
  });
});

describe("rollbackExpired", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rolls back expired action records", async () => {
    vi.mocked(prisma.actionRecord.updateMany).mockResolvedValue({ count: 2 } as never);

    const { rollbackExpired } = await import("@/lib/intelligence/policy-actions");
    const count = await rollbackExpired();

    expect(count).toBe(2);
    expect(prisma.actionRecord.updateMany).toHaveBeenCalled();
  });

  it("returns 0 when no expired records", async () => {
    vi.mocked(prisma.actionRecord.updateMany).mockResolvedValue({ count: 0 } as never);

    const { rollbackExpired } = await import("@/lib/intelligence/policy-actions");
    const count = await rollbackExpired();

    expect(count).toBe(0);
  });
});

describe("executeAction (from policy-actions)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns dry run message when dryRun is true", async () => {
    const { executeAction } = await import("@/lib/intelligence/policy-actions");
    const result = await executeAction(
      { type: "log" },
      { workspaceId: "ws-1", policyId: "p-1", entityType: "validator", entityId: "val-1", dryRun: true },
    );

    expect(result.success).toBe(true);
    expect(result.message).toContain("DRY RUN");
  });

  it("executes log action", async () => {
    const { executeAction } = await import("@/lib/intelligence/policy-actions");
    const result = await executeAction(
      { type: "log" },
      { workspaceId: "ws-1", policyId: "p-1", entityType: "validator", entityId: "val-1", dryRun: false },
    );

    expect(result.success).toBe(true);
    expect(result.type).toBe("log");
  });

  it("rejects routing_exclude for non-endpoints", async () => {
    const { executeAction } = await import("@/lib/intelligence/policy-actions");
    const result = await executeAction(
      { type: "routing_exclude" },
      { workspaceId: "ws-1", policyId: "p-1", entityType: "validator", entityId: "val-1", dryRun: false },
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("only applies to endpoints");
  });

  it("creates routing_exclude action record", async () => {
    vi.mocked(prisma.endpoint.count).mockResolvedValue(5);
    vi.mocked(prisma.actionRecord.count).mockResolvedValue(0);
    vi.mocked(prisma.actionRecord.create).mockResolvedValue({} as never);

    const { executeAction } = await import("@/lib/intelligence/policy-actions");
    const result = await executeAction(
      { type: "routing_exclude" },
      { workspaceId: "ws-1", policyId: "p-1", entityType: "endpoint", entityId: "ep-1", dryRun: false },
    );

    expect(result.success).toBe(true);
    expect(result.data?.expiresAt).toBeDefined();
    expect(prisma.actionRecord.create).toHaveBeenCalled();
  });

  it("prevents routing_exclude when too few endpoints", async () => {
    vi.mocked(prisma.endpoint.count).mockResolvedValue(2);
    vi.mocked(prisma.actionRecord.count).mockResolvedValue(0);

    const { executeAction } = await import("@/lib/intelligence/policy-actions");
    const result = await executeAction(
      { type: "routing_exclude" },
      { workspaceId: "ws-1", policyId: "p-1", entityType: "endpoint", entityId: "ep-1", dryRun: false },
    );

    expect(result.success).toBe(false);
    expect(result.message).toContain("Cannot exclude");
  });
});

describe("rollbackExpired - updateMany optimization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses updateMany instead of N+1 updates", async () => {
    vi.mocked(prisma.actionRecord.updateMany).mockResolvedValue({ count: 3 } as never);

    const { rollbackExpired } = await import("@/lib/intelligence/policy-actions");
    const count = await rollbackExpired();

    expect(count).toBe(3);
    expect(prisma.actionRecord.updateMany).toHaveBeenCalledWith({
      where: {
        expiresAt: { lte: expect.any(Date) },
        rolledBackAt: null,
      },
      data: { rolledBackAt: expect.any(Date) },
    });
    // Should NOT use findMany + individual updates anymore
    expect(prisma.actionRecord.findMany).not.toHaveBeenCalled();
    expect(prisma.actionRecord.update).not.toHaveBeenCalled();
  });

  it("returns 0 when no expired records", async () => {
    vi.mocked(prisma.actionRecord.updateMany).mockResolvedValue({ count: 0 } as never);

    const { rollbackExpired } = await import("@/lib/intelligence/policy-actions");
    const count = await rollbackExpired();

    expect(count).toBe(0);
  });
});

describe("executeAction - incident_create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates incident when none exists", async () => {
    vi.mocked(prisma.incident.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.$transaction).mockImplementation((async (fn: (tx: unknown) => unknown) => {
      return fn({
        incident: { create: vi.fn().mockResolvedValue({ id: "inc-new", title: "Auto" }) },
        incidentEvent: { create: vi.fn() },
        outboxEvent: { create: vi.fn() },
      });
    }) as never);

    const { executeAction } = await import("@/lib/intelligence/policy-actions");
    const result = await executeAction(
      { type: "incident_create" },
      { workspaceId: "ws-1", policyId: "p-1", entityType: "validator", entityId: "val-1", dryRun: false },
    );

    expect(result.success).toBe(true);
    expect(result.type).toBe("incident_create");
    expect(result.data?.incidentId).toBeDefined();
  });

  it("skips creation when incident already exists", async () => {
    vi.mocked(prisma.incident.findFirst).mockResolvedValue({
      id: "inc-existing", status: "open",
    } as never);

    const { executeAction } = await import("@/lib/intelligence/policy-actions");
    const result = await executeAction(
      { type: "incident_create" },
      { workspaceId: "ws-1", policyId: "p-1", entityType: "validator", entityId: "val-1", dryRun: false },
    );

    expect(result.success).toBe(true);
    expect(result.data?.incidentId).toBe("inc-existing");
  });
});

describe("executeAction - annotate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("annotates unresolved anomaly", async () => {
    vi.mocked(prisma.anomaly.findFirst).mockResolvedValue({
      id: "a-1", metadata: null,
    } as never);
    vi.mocked(prisma.anomaly.update).mockResolvedValue({} as never);

    const { executeAction } = await import("@/lib/intelligence/policy-actions");
    const result = await executeAction(
      { type: "annotate", config: { note: "Test annotation" } },
      { workspaceId: "ws-1", policyId: "p-1", entityType: "validator", entityId: "val-1", dryRun: false },
    );

    expect(result.success).toBe(true);
    expect(result.data?.anomalyId).toBe("a-1");
  });

  it("returns failure when no unresolved anomaly", async () => {
    vi.mocked(prisma.anomaly.findFirst).mockResolvedValue(null);

    const { executeAction } = await import("@/lib/intelligence/policy-actions");
    const result = await executeAction(
      { type: "annotate" },
      { workspaceId: "ws-1", policyId: "p-1", entityType: "validator", entityId: "val-1", dryRun: false },
    );

    expect(result.success).toBe(false);
  });
});

describe("executeAction - webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("publishes webhook event", async () => {
    const { executeAction } = await import("@/lib/intelligence/policy-actions");
    const result = await executeAction(
      { type: "webhook" },
      { workspaceId: "ws-1", policyId: "p-1", entityType: "validator", entityId: "val-1", dryRun: false },
    );

    expect(result.success).toBe(true);
    expect(result.type).toBe("webhook");
  });
});
