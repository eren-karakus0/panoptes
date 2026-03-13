import { describe, it, expect, vi, beforeEach } from "vitest";

const txMock = {
  incident: {
    create: vi.fn(),
    update: vi.fn(),
  },
  incidentEvent: { create: vi.fn() },
  outboxEvent: { create: vi.fn().mockResolvedValue({ seq: 1 }) },
};

vi.mock("@/lib/db", () => ({
  prisma: {
    slo: { findMany: vi.fn(), count: vi.fn() },
    anomaly: { findMany: vi.fn(), count: vi.fn() },
    incident: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    incidentEvent: { create: vi.fn() },
    outboxEvent: { create: vi.fn() },
    $transaction: vi.fn((fn: (tx: typeof txMock) => unknown) => fn(txMock)),
  },
}));

import { prisma } from "@/lib/db";
import { correlateIncidents } from "@/lib/intelligence/incident";

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
  isBreaching: true,
  currentValue: 0.95,
  budgetConsumed: 5.0,
  burnRate: 5.0,
  lastEvaluatedAt: new Date(),
};

const baseAnomaly = {
  id: "anomaly-1",
  type: "endpoint_down",
  severity: "high",
  entityType: "endpoint",
  entityId: "ep-1",
  title: "Endpoint down",
  description: "RPC endpoint is not responding",
  metadata: null,
  resolved: false,
  detectedAt: new Date(),
  resolvedAt: null,
};

describe("correlateIncidents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    txMock.incident.create.mockResolvedValue({
      id: "inc-new",
      workspaceId: "ws-1",
      entityType: "endpoint",
      entityId: "ep-1",
      status: "open",
      severity: "medium",
      title: "SLO breach: RPC Uptime",
      description: "SLO breach",
      detectedAt: new Date(),
    });
    txMock.incidentEvent.create.mockResolvedValue({});
    txMock.outboxEvent.create.mockResolvedValue({ seq: 1 });
    txMock.incident.update.mockResolvedValue({});
    // Default: no anomalies, no recovered SLOs
    mockPrisma.anomaly.findMany.mockResolvedValue([]);
    mockPrisma.anomaly.count.mockResolvedValue(0);
    mockPrisma.slo.count.mockResolvedValue(0);
    mockPrisma.incident.findMany.mockResolvedValue([]);
    mockPrisma.incident.findFirst.mockResolvedValue(null);
  });

  // --- Incident Creation ---

  it("creates incident from SLO breach", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([{ ...baseSlo }]) // breaching SLOs
      .mockResolvedValueOnce([]) // recovered SLOs
    ;

    const result = await correlateIncidents();

    expect(result.created).toBe(1);
    expect(txMock.incident.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          workspaceId: "ws-1",
          entityType: "endpoint",
          entityId: "ep-1",
        }),
      }),
    );
  });

  it("creates incident from anomaly with workspace SLO", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([]) // no breaching SLOs
      .mockResolvedValueOnce([{ workspaceId: "ws-1", entityType: "endpoint" }]) // workspace SLOs for entity
      .mockResolvedValueOnce([]) // recovered SLOs
    ;
    mockPrisma.anomaly.findMany.mockResolvedValue([{ ...baseAnomaly }]);

    const result = await correlateIncidents();

    expect(result.created).toBe(1);
  });

  it("calculates correct severity (sliRatio < 0.95 → critical)", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([{ ...baseSlo, currentValue: 0.9, target: 0.999 }])
      .mockResolvedValueOnce([])
    ;

    await correlateIncidents();

    expect(txMock.incident.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          severity: "critical",
        }),
      }),
    );
  });

  it("writes incident.created outbox event", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([{ ...baseSlo }])
      .mockResolvedValueOnce([])
    ;

    await correlateIncidents();

    expect(txMock.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          channel: "incident",
          type: "incident.created",
          visibility: "workspace",
          workspaceId: "ws-1",
        }),
      }),
    );
  });

  it("creates IncidentEvent type=created", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([{ ...baseSlo }])
      .mockResolvedValueOnce([])
    ;

    await correlateIncidents();

    expect(txMock.incidentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "created",
        }),
      }),
    );
  });

  // --- Deduplication ---

  it("does not create new incident when open incident exists for same entity", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([{ ...baseSlo }])
      .mockResolvedValueOnce([])
    ;
    mockPrisma.incident.findFirst.mockResolvedValue({
      id: "inc-existing",
      workspaceId: "ws-1",
      entityType: "endpoint",
      entityId: "ep-1",
      status: "open",
    });

    const result = await correlateIncidents();

    expect(result.created).toBe(0);
    expect(result.linked).toBe(1);
    expect(txMock.incident.create).not.toHaveBeenCalled();
  });

  it("reuses existing acknowledged incident", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([{ ...baseSlo }])
      .mockResolvedValueOnce([])
    ;
    mockPrisma.incident.findFirst.mockResolvedValue({
      id: "inc-ack",
      workspaceId: "ws-1",
      entityType: "endpoint",
      entityId: "ep-1",
      status: "acknowledged",
    });

    const result = await correlateIncidents();

    expect(result.linked).toBe(1);
    expect(result.created).toBe(0);
  });

  it("adds slo_linked event to existing incident", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([{ ...baseSlo }])
      .mockResolvedValueOnce([])
    ;
    mockPrisma.incident.findFirst.mockResolvedValue({
      id: "inc-existing",
      workspaceId: "ws-1",
      entityType: "endpoint",
      entityId: "ep-1",
      status: "open",
    });

    await correlateIncidents();

    expect(mockPrisma.incidentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          incidentId: "inc-existing",
          eventType: "slo_linked",
        }),
      }),
    );
  });

  it("adds anomaly_linked event to existing incident", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([]) // no breaching SLOs
      .mockResolvedValueOnce([{ workspaceId: "ws-1", entityType: "endpoint" }])
      .mockResolvedValueOnce([]) // recovered
    ;
    mockPrisma.anomaly.findMany.mockResolvedValue([{ ...baseAnomaly }]);
    mockPrisma.incident.findFirst.mockResolvedValue({
      id: "inc-existing",
      workspaceId: "ws-1",
      entityType: "endpoint",
      entityId: "ep-1",
      status: "open",
    });

    await correlateIncidents();

    expect(mockPrisma.incidentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          incidentId: "inc-existing",
          eventType: "anomaly_linked",
        }),
      }),
    );
  });

  it("creates separate incidents for different entities", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([
        { ...baseSlo },
        { ...baseSlo, id: "slo-2", entityId: "ep-2" },
      ])
      .mockResolvedValueOnce([])
    ;
    mockPrisma.incident.findFirst.mockResolvedValue(null);

    const result = await correlateIncidents();

    expect(result.created).toBe(2);
  });

  it("creates separate incidents for different workspaces", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([
        { ...baseSlo },
        { ...baseSlo, id: "slo-2", workspaceId: "ws-2" },
      ])
      .mockResolvedValueOnce([])
    ;
    mockPrisma.incident.findFirst.mockResolvedValue(null);

    const result = await correlateIncidents();

    expect(result.created).toBe(2);
  });

  // --- Auto-Resolution ---

  it("resolves incident when all SLOs recover", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([]) // no breaching
      .mockResolvedValueOnce([{ ...baseSlo, isBreaching: false }]) // recovered
    ;
    mockPrisma.slo.count.mockResolvedValue(0); // no still-breaching
    mockPrisma.incident.findMany.mockResolvedValue([
      { id: "inc-1", workspaceId: "ws-1", entityType: "endpoint", entityId: "ep-1", status: "open" },
    ]);

    const result = await correlateIncidents();

    expect(result.resolved).toBe(1);
    expect(txMock.incident.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "inc-1" },
        data: expect.objectContaining({ status: "resolved" }),
      }),
    );
  });

  it("does not resolve when some SLOs still breaching", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([]) // no breaching SLOs fetched in step 1 (they might not be recently evaluated)
      .mockResolvedValueOnce([{ ...baseSlo, isBreaching: false }]) // recovered
    ;
    mockPrisma.slo.count.mockResolvedValue(1); // still one breaching

    const result = await correlateIncidents();

    expect(result.resolved).toBe(0);
  });

  it("writes incident.resolved outbox event on auto-resolve", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...baseSlo, isBreaching: false }])
    ;
    mockPrisma.slo.count.mockResolvedValue(0);
    mockPrisma.incident.findMany.mockResolvedValue([
      { id: "inc-1", workspaceId: "ws-1", entityType: "endpoint", entityId: "ep-1", status: "open" },
    ]);

    await correlateIncidents();

    expect(txMock.outboxEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "incident.resolved",
          channel: "incident",
        }),
      }),
    );
  });

  it("adds autoResolved metadata to resolved event", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ ...baseSlo, isBreaching: false }])
    ;
    mockPrisma.slo.count.mockResolvedValue(0);
    mockPrisma.incident.findMany.mockResolvedValue([
      { id: "inc-1", workspaceId: "ws-1", entityType: "endpoint", entityId: "ep-1", status: "open" },
    ]);

    await correlateIncidents();

    expect(txMock.incidentEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "resolved",
          metadata: JSON.stringify({ autoResolved: true }),
        }),
      }),
    );
  });

  it("does not auto-resolve when entity has unresolved anomalies", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([]) // no breaching SLOs
      .mockResolvedValueOnce([{ ...baseSlo, isBreaching: false }]) // recovered
    ;
    mockPrisma.slo.count.mockResolvedValue(0); // all SLOs healthy
    mockPrisma.anomaly.count.mockResolvedValue(1); // but unresolved anomaly exists
    mockPrisma.incident.findMany.mockResolvedValue([
      { id: "inc-1", workspaceId: "ws-1", entityType: "endpoint", entityId: "ep-1", status: "open" },
    ]);

    const result = await correlateIncidents();

    expect(result.resolved).toBe(0);
    expect(txMock.incident.update).not.toHaveBeenCalled();
  });

  it("auto-resolves when SLOs healthy AND no unresolved anomalies", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([]) // no breaching
      .mockResolvedValueOnce([{ ...baseSlo, isBreaching: false }]) // recovered
    ;
    mockPrisma.slo.count.mockResolvedValue(0);
    mockPrisma.anomaly.count.mockResolvedValue(0); // no unresolved anomalies
    mockPrisma.incident.findMany.mockResolvedValue([
      { id: "inc-1", workspaceId: "ws-1", entityType: "endpoint", entityId: "ep-1", status: "open" },
    ]);

    const result = await correlateIncidents();

    expect(result.resolved).toBe(1);
  });

  // --- Edge Cases ---

  it("returns created=0 when no breaching SLOs", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    ;

    const result = await correlateIncidents();

    expect(result.created).toBe(0);
    expect(result.linked).toBe(0);
    expect(result.resolved).toBe(0);
  });

  it("returns linked=0 when no anomalies", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    ;
    mockPrisma.anomaly.findMany.mockResolvedValue([]);

    const result = await correlateIncidents();

    expect(result.linked).toBe(0);
  });

  it("skips anomaly without workspace SLOs", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]) // no workspace SLOs for entity
      .mockResolvedValueOnce([])
    ;
    mockPrisma.anomaly.findMany.mockResolvedValue([{ ...baseAnomaly }]);

    const result = await correlateIncidents();

    expect(result.created).toBe(0);
  });

  it("skips network-level anomaly (entityId=null)", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
    ;
    mockPrisma.anomaly.findMany.mockResolvedValue([
      { ...baseAnomaly, entityId: null },
    ]);

    const result = await correlateIncidents();

    expect(result.created).toBe(0);
  });

  it("throws error when transaction fails", async () => {
    mockPrisma.slo.findMany
      .mockResolvedValueOnce([{ ...baseSlo }])
      .mockResolvedValueOnce([])
    ;
    mockPrisma.$transaction.mockRejectedValue(new Error("DB write failed"));

    await expect(correlateIncidents()).rejects.toThrow("DB write failed");
  });
});
