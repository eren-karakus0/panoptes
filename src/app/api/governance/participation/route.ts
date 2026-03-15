import { NextRequest } from "next/server";
import { withRateLimit, jsonResponse } from "@/lib/api-helpers";
import { computeGovernanceScores } from "@/lib/intelligence/governance-scoring";

export async function GET(request: NextRequest) {
  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const scores = await computeGovernanceScores();

  return jsonResponse({
    validators: scores.sort((a, b) => b.participationRate - a.participationRate),
    totalValidators: scores.length,
  }, rl.headers);
}
