import { describe, it, expect, vi, beforeEach } from "vitest";

const txMock = {
  sloEvaluation: { create: vi.fn().mockResolvedValue({}) },
  slo: { update: vi.fn().mockResolvedValue({}) },
  outboxEvent: { create: vi.fn().mockResolvedValue({ seq: 1 }) },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    slo: {
      findMany: vi.fn(),
    },
    sloEvaluation: {
      create: vi.fn(),
    },
    endpointHealth: {
      findMany: vi.fn(),
    },
    validatorScore: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn((fn: (tx: typeof txMock) => unknown) => fn(txMock)),
  },
}));

import { prisma } from "@/lib/db";
import { evaluateSlos, computeErrorBudget } from "@/lib/intelligence/slo";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

const baseSlo = {
  id: "slo-1",
  workspaceId: "ws-1",
  name: "RPC Uptime",
  indicator: "uptime",
  entityType: "endpoint",
  entityId: "ep-1",
  target: 0.999,
  windowDays: 7,
  isActive: true,
  isBreaching: false,
  currentValue: null,
  budgetConsumed: null,
  burnRate: null,
  lastEvaluatedAt: null,
};

describe("computeErrorBudget", () => {
  it("returns consumed=1.0 when SLI equals target (edge of budget)", () => {
    // When SLI = target, consumed = (1-SLI)/(1-target) = 1.0
    const result = computeErrorBudget(0.999, 0.999);
    expect(result.consumed).toBeCloseTo(1.0, 2);
    expect(result.remaining).toBeCloseTo(0, 2);
  });

  it("returns consumed<1.0 when SLI exceeds target", () => {
    // SLI=0.9995, target=0.999 → actualErrors=0.0005, budget=0.001 → consumed=0.5
    const result = computeErrorBudget(0.9995, 0.999);
    expect(result.consumed).toBeCloseTo(0.5, 1);
    expect(result.remaining).toBeCloseTo(0.5, 1);
  });

  it("returns consumed>0 when target is exceeded (errors)", () => {
    const result = computeErrorBudget(0.995, 0.999);
    // errorBudget = 0.001, actual = 0.005, consumed = 5.0
    expect(result.consumed).toBeCloseTo(5.0, 1);
    expect(result.remaining).toBe(0);
    expect(result.burnRate).toBeCloseTo(5.0, 1);
  });

  it("returns remaining=0 when budget exhausted", () => {
    const result = computeErrorBudget(0.99, 0.999);
    expect(result.consumed).toBeGreaterThanOrEqual(1.0);
    expect(result.remaining).toBe(0);
  });

  it("handles perfect SLI (1.0)", () => {
    const result = computeErrorBudget(1.0, 0.999);
    expect(result.consumed).toBeCloseTo(0, 5);
    expect(result.remaining).toBeCloseTo(1.0, 5);
  });

  it("handles zero error budget edge case (target=1.0 equivalent)", () => {
    // When target is very close to 1.0 and there ARE errors
    const result = computeErrorBudget(0.999, 0.9999);
    expect(result.consumed).toBeGreaterThan(0);
  });
});

describe("SLI: uptime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.slo.update.mockResolvedValue({});
    txMock.sloEvaluation.create.mockResolvedValue({});
    txMock.outboxEvent.create.mockResolvedValue({ seq: 1 });
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );
  });

  it("calculates SLI ~1.0 for healthy endpoint", async () => {
    mockPrisma.slo.findMany.mockResolvedValue([{ ...baseSlo }]);
    mockPrisma.endpointHealth.findMany.mockResolvedValue([
      { isHealthy: true },
      { isHealthy: true },
      { isHealthy: true },
      { isHealthy: true },
      { isHealthy: true },
    ]);

    const result = await evaluateSlos();
    expect(result.evaluated).toBe(1);
    expect(txMock.sloEvaluation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sliValue: 1.0,
          isBreaching: false,
        }),
      }),
    );
  });

  it("calculates low SLI for unhealthy endpoint", async () => {
    mockPrisma.slo.findMany.mockResolvedValue([{ ...baseSlo }]);
    mockPrisma.endpointHealth.findMany.mockResolvedValue([
      { isHealthy: true },
      { isHealthy: false },
      { isHealthy: false },
      { isHealthy: false },
      { isHealthy: false },
    ]);

    const result = await evaluateSlos();
    expect(result.evaluated).toBe(1);
    expect(txMock.sloEvaluation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sliValue: 0.2,
          isBreaching: true,
        }),
      }),
    );
  });

  it("skips when no data in window", async () => {
    mockPrisma.slo.findMany.mockResolvedValue([{ ...baseSlo }]);
    mockPrisma.endpointHealth.findMany.mockResolvedValue([]);

    const result = await evaluateSlos();
    expect(result.evaluated).toBe(0);
    expect(result.skipped).toBe(1);
    expect(txMock.sloEvaluation.create).not.toHaveBeenCalled();
  });
});

describe("SLI: latency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.slo.update.mockResolvedValue({});
    txMock.sloEvaluation.create.mockResolvedValue({});
    txMock.outboxEvent.create.mockResolvedValue({ seq: 1 });
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );
  });

  it("calculates high SLI for low-latency healthy checks", async () => {
    mockPrisma.slo.findMany.mockResolvedValue([
      { ...baseSlo, indicator: "latency" },
    ]);
    mockPrisma.endpointHealth.findMany.mockResolvedValue([
      { isHealthy: true, latencyMs: 100 },
      { isHealthy: true, latencyMs: 200 },
      { isHealthy: true, latencyMs: 150 },
    ]);

    const result = await evaluateSlos();
    expect(result.evaluated).toBe(1);
    expect(txMock.sloEvaluation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sliValue: 1.0,
        }),
      }),
    );
  });

  it("calculates low SLI for high-latency checks", async () => {
    mockPrisma.slo.findMany.mockResolvedValue([
      { ...baseSlo, indicator: "latency" },
    ]);
    mockPrisma.endpointHealth.findMany.mockResolvedValue([
      { isHealthy: true, latencyMs: 6000 },
      { isHealthy: true, latencyMs: 7000 },
      { isHealthy: false, latencyMs: 0 },
    ]);

    const result = await evaluateSlos();
    expect(result.evaluated).toBe(1);
    expect(txMock.sloEvaluation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sliValue: 0,
        }),
      }),
    );
  });
});

describe("SLI: error_rate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.slo.update.mockResolvedValue({});
    txMock.sloEvaluation.create.mockResolvedValue({});
    txMock.outboxEvent.create.mockResolvedValue({ seq: 1 });
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );
  });

  it("follows uptime logic", async () => {
    mockPrisma.slo.findMany.mockResolvedValue([
      { ...baseSlo, indicator: "error_rate" },
    ]);
    mockPrisma.endpointHealth.findMany.mockResolvedValue([
      { isHealthy: true },
      { isHealthy: true },
      { isHealthy: false },
    ]);

    const result = await evaluateSlos();
    expect(result.evaluated).toBe(1);
    expect(txMock.sloEvaluation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sliValue: expect.closeTo(0.6667, 2),
        }),
      }),
    );
  });
});

describe("SLI: block_production", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.slo.update.mockResolvedValue({});
    txMock.sloEvaluation.create.mockResolvedValue({});
    txMock.outboxEvent.create.mockResolvedValue({ seq: 1 });
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );
  });

  it("calculates average missedBlockRate from ValidatorScore", async () => {
    mockPrisma.slo.findMany.mockResolvedValue([
      {
        ...baseSlo,
        indicator: "block_production",
        entityType: "validator",
        entityId: "val-1",
      },
    ]);
    mockPrisma.validatorScore.findMany.mockResolvedValue([
      { missedBlockRate: 0.95 },
      { missedBlockRate: 0.90 },
      { missedBlockRate: 1.0 },
    ]);

    const result = await evaluateSlos();
    expect(result.evaluated).toBe(1);
    expect(txMock.sloEvaluation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sliValue: expect.closeTo(0.95, 2),
        }),
      }),
    );
  });

  it("skips when no validator scores in window", async () => {
    mockPrisma.slo.findMany.mockResolvedValue([
      {
        ...baseSlo,
        indicator: "block_production",
        entityType: "validator",
        entityId: "val-1",
      },
    ]);
    mockPrisma.validatorScore.findMany.mockResolvedValue([]);

    const result = await evaluateSlos();
    expect(result.skipped).toBe(1);
    expect(result.evaluated).toBe(0);
  });
});

describe("State transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.slo.update.mockResolvedValue({});
    txMock.sloEvaluation.create.mockResolvedValue({});
    txMock.outboxEvent.create.mockResolvedValue({ seq: 1 });
    mockPrisma.$transaction.mockImplementation(
      (fn: (tx: typeof txMock) => unknown) => fn(txMock),
    );
  });

  it("emits slo.breached when transitioning to breach", async () => {
    mockPrisma.slo.findMany.mockResolvedValue([
      { ...baseSlo, isBreaching: false },
    ]);
    // 50% uptime = breaching (target 99.9%)
    mockPrisma.endpointHealth.findMany.mockResolvedValue([
      { isHealthy: true },
      { isHealthy: false },
    ]);

    const result = await evaluateSlos();
    expect(result.breached).toBe(1);
    expect(txMock.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "slo.breached",
          channel: "slo",
          visibility: "workspace",
          workspaceId: "ws-1",
        }),
      }),
    );
  });

  it("emits slo.recovered when transitioning from breach to healthy", async () => {
    mockPrisma.slo.findMany.mockResolvedValue([
      { ...baseSlo, isBreaching: true },
    ]);
    mockPrisma.endpointHealth.findMany.mockResolvedValue([
      { isHealthy: true },
      { isHealthy: true },
      { isHealthy: true },
    ]);

    const result = await evaluateSlos();
    expect(result.recovered).toBe(1);
    expect(txMock.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "slo.recovered" }),
      }),
    );
  });

  it("emits slo.budget_exhausted when budget consumed >= 1.0", async () => {
    mockPrisma.slo.findMany.mockResolvedValue([
      { ...baseSlo, isBreaching: true, budgetConsumed: 0.5 },
    ]);
    // High error rate to exhaust budget
    mockPrisma.endpointHealth.findMany.mockResolvedValue([
      { isHealthy: false },
      { isHealthy: false },
      { isHealthy: false },
      { isHealthy: false },
      { isHealthy: true },
    ]);

    const result = await evaluateSlos();
    expect(result.exhausted).toBe(1);
    expect(txMock.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "slo.budget_exhausted" }),
      }),
    );
  });

  it("does not emit events when no state change", async () => {
    mockPrisma.slo.findMany.mockResolvedValue([
      { ...baseSlo, isBreaching: false },
    ]);
    mockPrisma.endpointHealth.findMany.mockResolvedValue([
      { isHealthy: true },
      { isHealthy: true },
    ]);

    await evaluateSlos();
    expect(txMock.outboxEvent.create).not.toHaveBeenCalled();
  });

  it("returns evaluated=0 when no active SLOs", async () => {
    mockPrisma.slo.findMany.mockResolvedValue([]);

    const result = await evaluateSlos();
    expect(result.evaluated).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it("rolls back all writes if transaction fails", async () => {
    mockPrisma.slo.findMany.mockResolvedValue([
      { ...baseSlo, isBreaching: false },
    ]);
    mockPrisma.endpointHealth.findMany.mockResolvedValue([
      { isHealthy: true },
      { isHealthy: false },
    ]);
    // Simulate transaction failure
    mockPrisma.$transaction.mockRejectedValue(new Error("DB write failed"));

    await expect(evaluateSlos()).rejects.toThrow("DB write failed");
  });
});
