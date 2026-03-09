import "dotenv/config";
import { prisma } from "./db.js";
import { RepublicClient, REPUBLIC_TESTNET } from "republic-sdk";

interface SyncResult {
  synced: number;
  snapshotsCreated: number;
  newValidators: number;
  duration: number;
}

const BATCH_SIZE = 50;

async function syncValidators(
  forceDailySnapshot = false,
): Promise<SyncResult> {
  const start = Date.now();

  const client = new RepublicClient({
    ...REPUBLIC_TESTNET,
    rpc: process.env.REPUBLIC_RPC_URL || REPUBLIC_TESTNET.rpc,
    rest: process.env.REPUBLIC_REST_URL || REPUBLIC_TESTNET.rest,
  });

  const validators = await client.getValidators();
  const existing = await prisma.validator.findMany();
  const existingMap = new Map(existing.map((v) => [v.id, v]));

  let snapshotsCreated = 0;
  let newValidators = 0;

  // Process in batches to reduce transaction overhead
  for (let i = 0; i < validators.length; i += BATCH_SIZE) {
    const batch = validators.slice(i, i + BATCH_SIZE);

    await prisma.$transaction(async (tx) => {
      for (const val of batch) {
        const commission = parseFloat(val.commission) || 0;
        const prev = existingMap.get(val.operatorAddress);

        const hasChanged =
          !prev ||
          prev.tokens !== val.tokens ||
          prev.status !== val.status ||
          prev.commission !== commission ||
          prev.jailed !== val.jailed;

        const shouldSnapshot = hasChanged || forceDailySnapshot;

        let jailCount = prev?.jailCount ?? 0;
        let lastJailedAt = prev?.lastJailedAt ?? null;
        if (prev && !prev.jailed && val.jailed) {
          jailCount += 1;
          lastJailedAt = new Date();
        }

        if (!prev) newValidators++;

        await tx.validator.upsert({
          where: { id: val.operatorAddress },
          create: {
            id: val.operatorAddress,
            moniker: val.moniker,
            status: val.status,
            tokens: val.tokens,
            commission,
            jailed: val.jailed,
            votingPower: val.tokens,
            jailCount,
            lastJailedAt,
          },
          update: {
            moniker: val.moniker,
            status: val.status,
            tokens: val.tokens,
            commission,
            jailed: val.jailed,
            votingPower: val.tokens,
            jailCount,
            lastJailedAt,
          },
        });

        if (shouldSnapshot) {
          await tx.validatorSnapshot.create({
            data: {
              validatorId: val.operatorAddress,
              tokens: val.tokens,
              status: val.status,
              commission,
              jailed: val.jailed,
              votingPower: val.tokens,
            },
          });
          snapshotsCreated++;
        }
      }
    });
  }

  return {
    synced: validators.length,
    snapshotsCreated,
    newValidators,
    duration: Date.now() - start,
  };
}

async function main() {
  console.log("[sync-validators] Starting...");

  const now = new Date();
  const hour = now.getUTCHours();
  const minute = now.getUTCMinutes();
  // Only trigger daily snapshot in the first 5-min window (00:00-00:04 UTC)
  const forceDailySnapshot = hour === 0 && minute < 5;

  if (forceDailySnapshot) {
    console.log("[sync-validators] Daily snapshot mode (00:00 UTC)");
  }

  try {
    const result = await syncValidators(forceDailySnapshot);
    console.log(
      `[sync-validators] Done: ${result.synced} synced, ${result.snapshotsCreated} snapshots, ${result.newValidators} new, ${result.duration}ms`,
    );
    process.exit(0);
  } catch (error) {
    console.error("[sync-validators] Failed:", error);
    process.exit(1);
  }
}

main();
