import { NextRequest, NextResponse } from "next/server";
import { validateCronAuth } from "@/lib/cron-auth";
import { withRateLimit } from "@/lib/api-helpers";
import { aggregateStats } from "@/lib/indexer";
import { computeEndpointScores, computeValidatorScores, detectAnomalies, evaluateSlos } from "@/lib/intelligence";

export async function POST(request: NextRequest) {
  const authError = validateCronAuth(request);
  if (authError) return authError;

  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  try {
    // Aggregate stats first (provides fresh data), then run intelligence in parallel
    const stats = await aggregateStats();
    const [endpointScores, validatorScores, anomalies] = await Promise.all([
      computeEndpointScores(),
      computeValidatorScores(),
      detectAnomalies(),
    ]);

    const sloResults = await evaluateSlos();

    return NextResponse.json({
      success: true,
      ...stats,
      scoring: {
        endpoints: endpointScores.scored,
        validators: validatorScores.scored,
      },
      anomalies: {
        detected: anomalies.detected,
        resolved: anomalies.resolved,
      },
      slos: {
        evaluated: sloResults.evaluated,
        breached: sloResults.breached,
        recovered: sloResults.recovered,
        exhausted: sloResults.exhausted,
      },
    });
  } catch (error) {
    console.error("[Cron Stats]", error);
    const message =
      process.env.NODE_ENV === "production"
        ? "Internal server error"
        : error instanceof Error
          ? error.message
          : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
