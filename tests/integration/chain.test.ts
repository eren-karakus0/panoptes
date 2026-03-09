import { describe, it, expect } from "vitest";
import { RepublicClient, REPUBLIC_TESTNET } from "republic-sdk";

const client = new RepublicClient({
  ...REPUBLIC_TESTNET,
  rpc: process.env.REPUBLIC_RPC_URL || REPUBLIC_TESTNET.rpc,
  rest: process.env.REPUBLIC_REST_URL || REPUBLIC_TESTNET.rest,
});

describe("Chain Integration", () => {
  it("fetches validators from chain", async () => {
    const validators = await client.getValidators();

    expect(Array.isArray(validators)).toBe(true);
    expect(validators.length).toBeGreaterThan(0);

    const first = validators[0];
    expect(first).toHaveProperty("operatorAddress");
    expect(first).toHaveProperty("moniker");
    expect(first).toHaveProperty("tokens");
    expect(first).toHaveProperty("commission");
    expect(first).toHaveProperty("jailed");
  }, 15000);

  it("fetches node status from chain", async () => {
    const status = await client.getStatus();

    expect(status).toHaveProperty("syncInfo");
    expect(status.syncInfo).toHaveProperty("latestBlockHeight");
    expect(Number(status.syncInfo.latestBlockHeight)).toBeGreaterThan(0);
  }, 15000);
});
