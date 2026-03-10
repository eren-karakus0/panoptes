import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { parseIntParam, parseDateParam, parseStringParam } from "@/lib/validation";
import { API_DEFAULTS } from "@/lib/constants";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const { id } = await params;
  const searchParams = request.nextUrl.searchParams;

  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - API_DEFAULTS.DEFAULT_DAYS);
  const from = parseDateParam(searchParams.get("from")) ?? defaultFrom;
  const to = parseDateParam(searchParams.get("to")) ?? new Date();
  const limit = parseIntParam(
    searchParams.get("limit"),
    API_DEFAULTS.SNAPSHOTS_LIMIT,
    1,
    API_DEFAULTS.SNAPSHOTS_MAX,
  );
  const interval =
    parseStringParam(searchParams.get("interval"), [
      "raw",
      "hourly",
      "daily",
    ]) ?? "raw";

  const validator = await prisma.validator.findUnique({ where: { id } });

  if (!validator) {
    return jsonResponse({ error: "Validator not found" }, rl.headers, 404, {
      cache: false,
    });
  }

  let snapshots;
  let snapshotCount: number;

  if (interval === "raw") {
    [snapshots, snapshotCount] = await Promise.all([
      prisma.validatorSnapshot.findMany({
        where: {
          validatorId: id,
          timestamp: { gte: from, lte: to },
        },
        orderBy: { timestamp: "desc" },
        take: limit,
      }),
      prisma.validatorSnapshot.count({
        where: {
          validatorId: id,
          timestamp: { gte: from, lte: to },
        },
      }),
    ]);
  } else {
    const trunc = interval === "hourly" ? "hour" : "day";
    snapshots = await prisma.$queryRawUnsafe(
      `SELECT DISTINCT ON (DATE_TRUNC('${trunc}', "timestamp"))
        "id", "tokens", "status", "commission", "jailed", "votingPower", "timestamp"
      FROM "ValidatorSnapshot"
      WHERE "validatorId" = $1 AND "timestamp" >= $2 AND "timestamp" <= $3
      ORDER BY DATE_TRUNC('${trunc}', "timestamp") DESC, "timestamp" DESC
      LIMIT $4`,
      id,
      from,
      to,
      limit,
    ) as Array<{
      id: string;
      tokens: string;
      status: string;
      commission: number;
      jailed: boolean;
      votingPower: string;
      timestamp: Date;
    }>;
    snapshotCount = snapshots.length;
  }

  return jsonResponse(
    {
      validator: {
        ...validator,
        lastJailedAt: validator.lastJailedAt?.toISOString() ?? null,
        firstSeen: validator.firstSeen.toISOString(),
        lastUpdated: validator.lastUpdated.toISOString(),
      },
      snapshots: snapshots.map((s) => ({
        id: s.id,
        tokens: s.tokens,
        status: s.status,
        commission: s.commission,
        jailed: s.jailed,
        votingPower: s.votingPower,
        timestamp:
          s.timestamp instanceof Date
            ? s.timestamp.toISOString()
            : s.timestamp,
      })),
      snapshotCount,
      interval,
      period: { from: from.toISOString(), to: to.toISOString() },
    },
    rl.headers,
  );
}
