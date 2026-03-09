import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    endpoint: {
      findMany: vi.fn(),
    },
    endpointHealth: {
      createMany: vi.fn(),
    },
  },
}));

import { checkEndpoints } from "@/lib/indexer/endpoints";
import { prisma } from "@/lib/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = prisma as any;

describe("checkEndpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            result: { sync_info: { latest_block_height: "12345" } },
          }),
      }),
    );
  });

  it("checks active endpoints and records health", async () => {
    mockPrisma.endpoint.findMany.mockResolvedValue([
      {
        id: "ep1",
        url: "https://rpc.example.com",
        type: "rpc",
        provider: "Test",
        isOfficial: false,
        isActive: true,
        createdAt: new Date(),
      },
    ]);
    mockPrisma.endpointHealth.createMany.mockResolvedValue({ count: 1 });

    const result = await checkEndpoints();

    expect(result.checked).toBe(1);
    expect(result.healthy).toBe(1);
    expect(result.unhealthy).toBe(0);
    expect(mockPrisma.endpointHealth.createMany).toHaveBeenCalled();
  });

  it("handles no active endpoints", async () => {
    mockPrisma.endpoint.findMany.mockResolvedValue([]);

    const result = await checkEndpoints();

    expect(result.checked).toBe(0);
    expect(result.healthy).toBe(0);
  });

  it("marks endpoint unhealthy on fetch error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );

    mockPrisma.endpoint.findMany.mockResolvedValue([
      {
        id: "ep1",
        url: "https://rpc.example.com",
        type: "rpc",
        provider: null,
        isOfficial: false,
        isActive: true,
        createdAt: new Date(),
      },
    ]);
    mockPrisma.endpointHealth.createMany.mockResolvedValue({ count: 1 });

    const result = await checkEndpoints();

    expect(result.unhealthy).toBe(1);
  });

  it("handles REST endpoint type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            block: { header: { height: "99999" } },
          }),
      }),
    );

    mockPrisma.endpoint.findMany.mockResolvedValue([
      {
        id: "ep2",
        url: "https://rest.example.com",
        type: "rest",
        provider: null,
        isOfficial: true,
        isActive: true,
        createdAt: new Date(),
      },
    ]);
    mockPrisma.endpointHealth.createMany.mockResolvedValue({ count: 1 });

    const result = await checkEndpoints();

    expect(result.checked).toBe(1);
    expect(result.healthy).toBe(1);
  });

  it("handles EVM-RPC endpoint type", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ result: "0x1a4" }),
      }),
    );

    mockPrisma.endpoint.findMany.mockResolvedValue([
      {
        id: "ep3",
        url: "https://evm.example.com",
        type: "evm-rpc",
        provider: null,
        isOfficial: false,
        isActive: true,
        createdAt: new Date(),
      },
    ]);
    mockPrisma.endpointHealth.createMany.mockResolvedValue({ count: 1 });

    const result = await checkEndpoints();

    expect(result.checked).toBe(1);
  });
});
