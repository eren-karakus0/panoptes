import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    anomaly: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
    endpoint: { findMany: vi.fn(), count: vi.fn() },
    validator: { findMany: vi.fn() },
    slo: { findMany: vi.fn() },
    policy: { findMany: vi.fn(), update: vi.fn() },
    policyExecution: { create: vi.fn() },
    actionRecord: { count: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    incident: { findFirst: vi.fn(), create: vi.fn() },
    incidentEvent: { create: vi.fn() },
    outboxEvent: { create: vi.fn() },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({
        policy: {
          findUnique: vi.fn().mockResolvedValue({
            id: "p-1", isActive: true, cooldownMinutes: 15, lastTriggeredAt: null,
          }),
          update: vi.fn().mockResolvedValue({}),
        },
        incident: { create: vi.fn().mockResolvedValue({ id: "inc-1" }) },
        incidentEvent: { create: vi.fn() },
        outboxEvent: { create: vi.fn() },
      }),
    ),
  },
}));

vi.mock("@/lib/events/publish", () => ({
  publishEvent: vi.fn(),
  publishEvents: vi.fn(),
}));

import { prisma } from "@/lib/db";

describe("evaluatePolicies", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default empty state
    vi.mocked(prisma.anomaly.findMany).mockResolvedValue([]);
    vi.mocked(prisma.endpoint.findMany).mockResolvedValue([]);
    vi.mocked(prisma.validator.findMany).mockResolvedValue([]);
    vi.mocked(prisma.slo.findMany).mockResolvedValue([]);
    vi.mocked(prisma.policy.findMany).mockResolvedValue([]);
    vi.mocked(prisma.actionRecord.findMany).mockResolvedValue([]);
    vi.mocked(prisma.actionRecord.count).mockResolvedValue(0);
    vi.mocked(prisma.actionRecord.updateMany).mockResolvedValue({ count: 0 } as never);
  });

  it("returns zero counts when no anomalies exist", async () => {
    const { evaluatePolicies } = await import("@/lib/intelligence/policy-engine");
    const result = await evaluatePolicies();

    expect(result.evaluated).toBe(0);
    expect(result.triggered).toBe(0);
    expect(result.actionsExecuted).toBe(0);
  });

  it("evaluates policies when anomalies present", async () => {
    vi.mocked(prisma.anomaly.findMany).mockResolvedValue([
      {
        id: "a-1", type: "jailing", severity: "high",
        entityType: "validator", entityId: "val-1",
        title: "Test", description: "Test", metadata: null,
        resolved: false, detectedAt: new Date(), resolvedAt: null,
      },
    ] as never);

    vi.mocked(prisma.policy.findMany).mockResolvedValue([
      {
        id: "p-1", workspaceId: "ws-1", name: "Test Policy",
        description: null, isActive: true, dryRun: true, priority: 100,
        conditions: JSON.stringify([{ field: "anomaly.type", operator: "eq", value: "jailing" }]),
        actions: JSON.stringify([{ type: "log" }]),
        cooldownMinutes: 15, lastTriggeredAt: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
    ] as never);

    vi.mocked(prisma.policyExecution.create).mockResolvedValue({ id: "pe-1" } as never);
    vi.mocked(prisma.policy.update).mockResolvedValue({} as never);

    const { evaluatePolicies } = await import("@/lib/intelligence/policy-engine");
    const result = await evaluatePolicies();

    expect(result.evaluated).toBe(1);
    expect(result.triggered).toBe(1);
    expect(prisma.policyExecution.create).toHaveBeenCalled();
  });

  it("respects cooldown period", async () => {
    vi.mocked(prisma.anomaly.findMany).mockResolvedValue([
      {
        id: "a-1", type: "jailing", severity: "high",
        entityType: "validator", entityId: "val-1",
        title: "Test", description: "Test", metadata: null,
        resolved: false, detectedAt: new Date(), resolvedAt: null,
      },
    ] as never);

    vi.mocked(prisma.policy.findMany).mockResolvedValue([
      {
        id: "p-1", workspaceId: "ws-1", name: "Test",
        description: null, isActive: true, dryRun: true, priority: 100,
        conditions: JSON.stringify([{ field: "anomaly.type", operator: "eq", value: "jailing" }]),
        actions: JSON.stringify([{ type: "log" }]),
        cooldownMinutes: 15,
        lastTriggeredAt: new Date(), // triggered just now
        createdAt: new Date(), updatedAt: new Date(),
      },
    ] as never);

    // Override $transaction to simulate fresh read showing active cooldown
    vi.mocked(prisma.$transaction).mockImplementation((async (fn: (tx: unknown) => unknown) => {
      return fn({
        policy: {
          findUnique: vi.fn().mockResolvedValue({
            id: "p-1", isActive: true, cooldownMinutes: 15,
            lastTriggeredAt: new Date(), // just triggered
          }),
          update: vi.fn(),
        },
      });
    }) as never);

    const { evaluatePolicies } = await import("@/lib/intelligence/policy-engine");
    const result = await evaluatePolicies();

    expect(result.triggered).toBe(0);
    expect(prisma.policyExecution.create).not.toHaveBeenCalled();
  });

  it("skips when conditions don't match", async () => {
    vi.mocked(prisma.anomaly.findMany).mockResolvedValue([
      {
        id: "a-1", type: "endpoint_down", severity: "high",
        entityType: "endpoint", entityId: "ep-1",
        title: "Test", description: "Test", metadata: null,
        resolved: false, detectedAt: new Date(), resolvedAt: null,
      },
    ] as never);

    vi.mocked(prisma.policy.findMany).mockResolvedValue([
      {
        id: "p-1", workspaceId: "ws-1", name: "Test",
        description: null, isActive: true, dryRun: true, priority: 100,
        conditions: JSON.stringify([{ field: "anomaly.type", operator: "eq", value: "jailing" }]),
        actions: JSON.stringify([{ type: "log" }]),
        cooldownMinutes: 15, lastTriggeredAt: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
    ] as never);

    const { evaluatePolicies } = await import("@/lib/intelligence/policy-engine");
    const result = await evaluatePolicies();

    expect(result.evaluated).toBe(1);
    expect(result.triggered).toBe(0);
  });
});

describe("evaluatePolicies - cooldown TOCTOU", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(prisma.anomaly.findMany).mockResolvedValue([]);
    vi.mocked(prisma.endpoint.findMany).mockResolvedValue([]);
    vi.mocked(prisma.validator.findMany).mockResolvedValue([]);
    vi.mocked(prisma.slo.findMany).mockResolvedValue([]);
    vi.mocked(prisma.policy.findMany).mockResolvedValue([]);
    vi.mocked(prisma.actionRecord.findMany).mockResolvedValue([]);
    vi.mocked(prisma.actionRecord.count).mockResolvedValue(0);
    vi.mocked(prisma.actionRecord.updateMany).mockResolvedValue({ count: 0 } as never);
  });

  it("uses $transaction for atomic cooldown check", async () => {
    vi.mocked(prisma.anomaly.findMany).mockResolvedValue([
      {
        id: "a-1", type: "jailing", severity: "high",
        entityType: "validator", entityId: "val-1",
        title: "Test", description: "Test", metadata: null,
        resolved: false, detectedAt: new Date(), resolvedAt: null,
      },
    ] as never);

    vi.mocked(prisma.policy.findMany).mockResolvedValue([
      {
        id: "p-1", workspaceId: "ws-1", name: "Test",
        description: null, isActive: true, dryRun: true, priority: 100,
        conditions: JSON.stringify([{ field: "anomaly.type", operator: "eq", value: "jailing" }]),
        actions: JSON.stringify([{ type: "log" }]),
        cooldownMinutes: 15, lastTriggeredAt: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
    ] as never);

    // Mock $transaction to simulate the atomic cooldown check
    vi.mocked(prisma.$transaction).mockImplementation((async (fn: (tx: unknown) => unknown) => {
      return fn({
        policy: {
          findUnique: vi.fn().mockResolvedValue({
            id: "p-1", isActive: true, cooldownMinutes: 15, lastTriggeredAt: null,
          }),
          update: vi.fn().mockResolvedValue({}),
        },
      });
    }) as never);

    vi.mocked(prisma.policyExecution.create).mockResolvedValue({ id: "pe-1" } as never);

    const { evaluatePolicies } = await import("@/lib/intelligence/policy-engine");
    const result = await evaluatePolicies();

    expect(result.triggered).toBe(1);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it("respects cooldown via transaction (fresh read)", async () => {
    vi.mocked(prisma.anomaly.findMany).mockResolvedValue([
      {
        id: "a-1", type: "jailing", severity: "high",
        entityType: "validator", entityId: "val-1",
        title: "Test", description: "Test", metadata: null,
        resolved: false, detectedAt: new Date(), resolvedAt: null,
      },
    ] as never);

    vi.mocked(prisma.policy.findMany).mockResolvedValue([
      {
        id: "p-1", workspaceId: "ws-1", name: "Test",
        description: null, isActive: true, dryRun: true, priority: 100,
        conditions: JSON.stringify([{ field: "anomaly.type", operator: "eq", value: "jailing" }]),
        actions: JSON.stringify([{ type: "log" }]),
        cooldownMinutes: 15, lastTriggeredAt: null,
        createdAt: new Date(), updatedAt: new Date(),
      },
    ] as never);

    // Mock transaction to return false (cooldown active in fresh read)
    vi.mocked(prisma.$transaction).mockImplementation((async (fn: (tx: unknown) => unknown) => {
      return fn({
        policy: {
          findUnique: vi.fn().mockResolvedValue({
            id: "p-1", isActive: true, cooldownMinutes: 15,
            lastTriggeredAt: new Date(), // just triggered
          }),
          update: vi.fn(),
        },
      });
    }) as never);

    const { evaluatePolicies } = await import("@/lib/intelligence/policy-engine");
    const result = await evaluatePolicies();

    expect(result.triggered).toBe(0);
  });
});
