import { prisma } from "@/lib/db";
import { REPUBLIC_CHAIN, DELEGATION_DEFAULTS } from "@/lib/constants";

interface ChainDelegation {
  delegation: {
    delegator_address: string;
    validator_address: string;
    shares: string;
  };
  balance: {
    denom: string;
    amount: string;
  };
}

export interface DelegationSyncResult {
  eventsSynced: number;
  snapshotsTaken: number;
  duration: number;
}

const MAX_PAGES = 50;

async function fetchValidatorDelegations(validatorAddr: string): Promise<ChainDelegation[]> {
  const all: ChainDelegation[] = [];
  let nextKey: string | null = null;
  let pages = 0;
  do {
    pages++;
    if (pages > MAX_PAGES) {
      console.error("[delegations] Max pagination pages reached, stopping");
      break;
    }
    const url: string = `${REPUBLIC_CHAIN.restUrl}/cosmos/staking/v1beta1/validators/${validatorAddr}/delegations?pagination.limit=${DELEGATION_DEFAULTS.DELEGATION_FETCH_LIMIT}${
      nextKey ? `&pagination.key=${encodeURIComponent(nextKey)}` : ""
    }`;
    try {
      const res: Response = await fetch(url, { signal: AbortSignal.timeout(DELEGATION_DEFAULTS.FETCH_TIMEOUT_MS) });
      if (!res.ok) {
        console.error(`[delegations] Failed to fetch delegations for ${validatorAddr}:`, res.status);
        break;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      all.push(...((data.delegation_responses as ChainDelegation[]) ?? []));
      nextKey = (data.pagination?.next_key as string) ?? null;
    } catch (error) {
      console.error(`[delegations] Failed to fetch delegations for ${validatorAddr}:`, error);
      break;
    }
  } while (nextKey);
  return all;
}

export async function syncDelegations(): Promise<DelegationSyncResult> {
  const start = Date.now();
  let eventsSynced = 0;
  let snapshotsTaken = 0;

  const validators = await prisma.validator.findMany({
    select: { id: true, moniker: true },
  });

  for (const val of validators) {
    const delegations = await fetchValidatorDelegations(val.id);

    // Get previous snapshot for comparison
    const prevSnapshot = await prisma.delegationSnapshot.findFirst({
      where: { validatorId: val.id },
      orderBy: { timestamp: "desc" },
    });

    const prevDelegators = new Map<string, string>();
    if (prevSnapshot?.topDelegators) {
      try {
        const parsed = JSON.parse(prevSnapshot.topDelegators) as Array<{ address: string; amount: string }>;
        for (const d of parsed) {
          prevDelegators.set(d.address, d.amount);
        }
      } catch {
        // ignore parse errors
      }
    }

    // Build current state
    const currentDelegators = new Map<string, string>();
    let totalDelegated = 0n;

    for (const d of delegations) {
      const addr = d.delegation.delegator_address;
      const amount = d.balance.amount;
      currentDelegators.set(addr, amount);
      totalDelegated += BigInt(amount);
    }

    // Detect delegation events by comparing with prev snapshot (if exists)
    if (prevSnapshot) {
      // New delegations
      for (const [addr, amount] of currentDelegators) {
        const prevAmount = prevDelegators.get(addr);
        if (!prevAmount) {
          await prisma.delegationEvent.create({
            data: {
              type: "delegate",
              delegator: addr,
              validatorTo: val.id,
              amount,
            },
          });
          eventsSynced++;
        } else if (BigInt(amount) > BigInt(prevAmount)) {
          await prisma.delegationEvent.create({
            data: {
              type: "delegate",
              delegator: addr,
              validatorTo: val.id,
              amount: (BigInt(amount) - BigInt(prevAmount)).toString(),
            },
          });
          eventsSynced++;
        }
      }

      // Undelegations
      for (const [addr, amount] of prevDelegators) {
        const currentAmount = currentDelegators.get(addr);
        if (!currentAmount) {
          await prisma.delegationEvent.create({
            data: {
              type: "undelegate",
              delegator: addr,
              validatorTo: val.id,
              amount,
            },
          });
          eventsSynced++;
        } else if (BigInt(currentAmount) < BigInt(amount)) {
          await prisma.delegationEvent.create({
            data: {
              type: "undelegate",
              delegator: addr,
              validatorTo: val.id,
              amount: (BigInt(amount) - BigInt(currentAmount)).toString(),
            },
          });
          eventsSynced++;
        }
      }
    }

    // Build top delegators
    const sorted = [...currentDelegators.entries()]
      .sort((a, b) => {
        const diff = BigInt(b[1]) - BigInt(a[1]);
        return diff > 0n ? 1 : diff < 0n ? -1 : 0;
      })
      .slice(0, DELEGATION_DEFAULTS.SNAPSHOT_TOP_DELEGATORS)
      .map(([address, amount]) => ({ address, amount }));

    // Calculate churn rate
    const prevTotal = prevSnapshot ? BigInt(prevSnapshot.totalDelegated) : 0n;
    const churnRate = prevTotal > 0n
      ? Math.abs(Number(((totalDelegated - prevTotal) * 10000n) / prevTotal)) / 100
      : 0;

    // Create snapshot
    await prisma.delegationSnapshot.create({
      data: {
        validatorId: val.id,
        totalDelegators: currentDelegators.size,
        totalDelegated: totalDelegated.toString(),
        topDelegators: JSON.stringify(sorted),
        churnRate,
      },
    });
    snapshotsTaken++;
  }

  return { eventsSynced, snapshotsTaken, duration: Date.now() - start };
}
