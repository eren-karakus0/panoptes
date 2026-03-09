import { RepublicClient, REPUBLIC_TESTNET } from "republic-sdk";

function createRepublicClient(): RepublicClient {
  return new RepublicClient({
    ...REPUBLIC_TESTNET,
    rpc: process.env.REPUBLIC_RPC_URL || REPUBLIC_TESTNET.rpc,
    rest: process.env.REPUBLIC_REST_URL || REPUBLIC_TESTNET.rest,
  });
}

const globalForRepublic = globalThis as unknown as {
  republicClient: RepublicClient | undefined;
};

export function getRepublicClient(): RepublicClient {
  if (process.env.NODE_ENV !== "production") {
    globalForRepublic.republicClient ??= createRepublicClient();
    return globalForRepublic.republicClient;
  }
  return createRepublicClient();
}
