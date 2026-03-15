import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const validatorId = url.searchParams.get("validatorId");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 100);
  const offset = Number(url.searchParams.get("offset")) || 0;

  const where: Record<string, unknown> = {};
  if (type) where.type = type;
  if (validatorId) {
    where.OR = [{ validatorTo: validatorId }, { validatorFrom: validatorId }];
  }

  const [events, total] = await Promise.all([
    prisma.delegationEvent.findMany({
      where,
      orderBy: { timestamp: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.delegationEvent.count({ where }),
  ]);

  return jsonResponse({ events, total, limit, offset }, rl.headers);
}
