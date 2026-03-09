import { describe, it, expect } from "vitest";
import {
  getValidatorStatusInfo,
  getHealthStatusInfo,
  getEndpointTypeLabel,
} from "@/lib/status";

describe("getValidatorStatusInfo", () => {
  it("returns bonded info", () => {
    const info = getValidatorStatusInfo("BOND_STATUS_BONDED");
    expect(info.label).toBe("Bonded");
    expect(info.color).toBe("teal");
  });

  it("returns unbonding info", () => {
    const info = getValidatorStatusInfo("BOND_STATUS_UNBONDING");
    expect(info.label).toBe("Unbonding");
    expect(info.color).toBe("amber");
  });

  it("returns unbonded info", () => {
    const info = getValidatorStatusInfo("BOND_STATUS_UNBONDED");
    expect(info.label).toBe("Unbonded");
    expect(info.color).toBe("slate");
  });

  it("handles unknown status", () => {
    const info = getValidatorStatusInfo("UNKNOWN");
    expect(info.label).toBe("UNKNOWN");
    expect(info.color).toBe("slate");
  });
});

describe("getHealthStatusInfo", () => {
  it("returns healthy info", () => {
    const info = getHealthStatusInfo(true);
    expect(info.label).toBe("Healthy");
    expect(info.color).toBe("teal");
  });

  it("returns unhealthy info", () => {
    const info = getHealthStatusInfo(false);
    expect(info.label).toBe("Unhealthy");
    expect(info.color).toBe("rose");
  });
});

describe("getEndpointTypeLabel", () => {
  it("formats rpc", () => {
    expect(getEndpointTypeLabel("rpc")).toBe("RPC");
  });

  it("formats rest", () => {
    expect(getEndpointTypeLabel("rest")).toBe("REST");
  });

  it("formats evm-rpc", () => {
    expect(getEndpointTypeLabel("evm-rpc")).toBe("EVM-RPC");
  });

  it("formats grpc", () => {
    expect(getEndpointTypeLabel("grpc")).toBe("gRPC");
  });

  it("uppercases unknown", () => {
    expect(getEndpointTypeLabel("custom")).toBe("CUSTOM");
  });
});
