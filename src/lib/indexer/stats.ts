import { prisma } from "@/lib/db";
import { getRepublicClient } from "@/lib/republic";
import { IndexerError } from "@/lib/errors";
import { publishEvent } from "@/lib/events/publish";
import { CHANNELS } from "@/lib/events/event-types";

export async function aggregateStats(): Promise<{
  blockHeight: string;
  totalValidators: number;
  activeValidators: number;
  totalStaked: string;
  duration: number;
}> {
  const start = Date.now();

  try {
    const client = getRepublicClient();
    const status = await client.getStatus();

    const blockHeight = BigInt(
      status.syncInfo?.latestBlockHeight ?? "0",
    );

    const [totalValidators, activeValidators] = await Promise.all([
      prisma.validator.count(),
      prisma.validator.count({
        where: { status: "BOND_STATUS_BONDED" },
      }),
    ]);

    // Sum tokens for bonded ratio — use TEXT to avoid bigint overflow
    const tokenSum: Array<{ total: string }> = await prisma.$queryRaw`
      SELECT COALESCE(SUM(CAST(tokens AS NUMERIC)), 0)::TEXT as total
      FROM "Validator"
      WHERE status = 'BOND_STATUS_BONDED'
    `;
    const totalStaked = tokenSum[0]?.total ?? "0";

    // Bonded ratio: bonded tokens / all tokens
    const allTokenSum: Array<{ total: string }> = await prisma.$queryRaw`
      SELECT COALESCE(SUM(CAST(tokens AS NUMERIC)), 0)::TEXT as total
      FROM "Validator"
    `;
    const bondedStaked = BigInt(totalStaked);
    const allTokens = BigInt(allTokenSum[0]?.total ?? "0");
    const bondedRatio =
      allTokens > 0n
        ? Number((bondedStaked * 10000n) / allTokens) / 10000
        : null;

    // Avg block time from last 2 stats
    let avgBlockTime: number | null = null;
    const lastTwo = await prisma.networkStats.findMany({
      orderBy: { timestamp: "desc" },
      take: 2,
      select: { blockHeight: true, timestamp: true },
    });
    if (lastTwo.length === 2) {
      const heightDiff = Number(blockHeight - lastTwo[1].blockHeight);
      const timeDiffMs =
        lastTwo[0].timestamp.getTime() - lastTwo[1].timestamp.getTime();
      if (heightDiff > 0 && timeDiffMs > 0) {
        avgBlockTime = timeDiffMs / 1000 / heightDiff;
      }
    }

    await prisma.networkStats.create({
      data: {
        totalValidators,
        activeValidators,
        totalStaked,
        bondedRatio,
        blockHeight,
        avgBlockTime,
      },
    });

    await publishEvent({
      channel: CHANNELS.NETWORK,
      type: "stats.updated",
      payload: {
        blockHeight: blockHeight.toString(),
        totalValidators,
        activeValidators,
        totalStaked,
        bondedRatio,
        avgBlockTime,
      },
    });

    return {
      blockHeight: blockHeight.toString(),
      totalValidators,
      activeValidators,
      totalStaked,
      duration: Date.now() - start,
    };
  } catch (error) {
    throw new IndexerError(
      `Failed to aggregate stats: ${error instanceof Error ? error.message : String(error)}`,
      "stats",
    );
  }
}
