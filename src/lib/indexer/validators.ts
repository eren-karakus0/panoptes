import { prisma } from "@/lib/db";
import { getRepublicClient } from "@/lib/republic";
import { IndexerError } from "@/lib/errors";

interface SyncOptions {
  forceDailySnapshot?: boolean;
}

interface SyncResult {
  synced: number;
  snapshotsCreated: number;
  newValidators: number;
  duration: number;
}

export async function syncValidators(
  options: SyncOptions = {},
): Promise<SyncResult> {
  const start = Date.now();
  const { forceDailySnapshot = false } = options;

  try {
    const client = getRepublicClient();
    const validators = await client.getValidators();

    const existing = await prisma.validator.findMany();
    const existingMap = new Map(existing.map((v) => [v.id, v]));

    let snapshotsCreated = 0;
    let newValidators = 0;

    for (const val of validators) {
      const commission = parseFloat(val.commission) || 0;
      const prev = existingMap.get(val.operatorAddress);

      const hasChanged =
        !prev ||
        prev.tokens !== val.tokens ||
        prev.status !== val.status ||
        prev.commission !== commission ||
        prev.jailed !== val.jailed;

      const shouldSnapshot = hasChanged || forceDailySnapshot;

      // Detect new jailing
      let jailCount = prev?.jailCount ?? 0;
      let lastJailedAt = prev?.lastJailedAt ?? null;
      if (prev && !prev.jailed && val.jailed) {
        jailCount += 1;
        lastJailedAt = new Date();
      }

      if (!prev) newValidators++;

      await prisma.$transaction(async (tx) => {
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
      });
    }

    return {
      synced: validators.length,
      snapshotsCreated,
      newValidators,
      duration: Date.now() - start,
    };
  } catch (error) {
    throw new IndexerError(
      `Failed to sync validators: ${error instanceof Error ? error.message : String(error)}`,
      "validators",
    );
  }
}
