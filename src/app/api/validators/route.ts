import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { parseIntParam, parseStringParam, parseBoolParam } from "@/lib/validation";
import { API_DEFAULTS } from "@/lib/constants";
import type { Prisma } from "@/generated/prisma/client";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const params = request.nextUrl.searchParams;

  const status = parseStringParam(params.get("status"), [
    "BOND_STATUS_BONDED",
    "BOND_STATUS_UNBONDING",
    "BOND_STATUS_UNBONDED",
  ]);
  const jailed = parseBoolParam(params.get("jailed"));
  const sort = parseStringParam(params.get("sort"), [
    "tokens",
    "commission",
    "uptime",
    "moniker",
  ]) ?? "tokens";
  const order = parseStringParam(params.get("order"), ["asc", "desc"]) ?? "desc";
  const limit = parseIntParam(
    params.get("limit"),
    API_DEFAULTS.VALIDATORS_LIMIT,
    1,
    API_DEFAULTS.VALIDATORS_MAX,
  );
  const offset = parseIntParam(params.get("offset"), 0, 0, 100000);

  const where: Prisma.ValidatorWhereInput = {};
  if (status) where.status = status;
  if (jailed !== undefined) where.jailed = jailed;

  const [validators, total] = await Promise.all([
    prisma.validator.findMany({
      where,
      orderBy: { [sort]: order },
      skip: offset,
      take: limit,
    }),
    prisma.validator.count({ where }),
  ]);

  const items = validators.map((v) => ({
    ...v,
    lastJailedAt: v.lastJailedAt?.toISOString() ?? null,
    firstSeen: v.firstSeen.toISOString(),
    lastUpdated: v.lastUpdated.toISOString(),
  }));

  return jsonResponse({ validators: items, total, limit, offset }, rl.headers);
}
