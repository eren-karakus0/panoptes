import { NextRequest, NextResponse } from "next/server";
import { validateCronAuth } from "@/lib/cron-auth";
import { withRateLimit } from "@/lib/api-helpers";
import { aggregateStats, syncGovernance, syncDelegations } from "@/lib/indexer";
import { computeEndpointScores, computeValidatorScores, detectAnomalies, evaluateSlos, correlateIncidents, evaluatePolicies, detectWhaleMovement } from "@/lib/intelligence";

type StepError = { step: string; error: string };

async function runStep<T>(name: string, fn: () => Promise<T>, errors: StepError[]): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[Cron Stats] ${name} failed:`, msg);
    errors.push({ step: name, error: msg });
    return null;
  }
}

export async function POST(request: NextRequest) {
  const authError = validateCronAuth(request);
  if (authError) return authError;

  const rl = withRateLimit(request);
  if ("response" in rl) return rl.response;

  const errors: StepError[] = [];

  // Each step runs independently — one failure doesn't block others
  const stats = await runStep("aggregateStats", aggregateStats, errors);

  const [endpointScores, validatorScores, anomalies] = await Promise.all([
    runStep("computeEndpointScores", computeEndpointScores, errors),
    runStep("computeValidatorScores", computeValidatorScores, errors),
    runStep("detectAnomalies", detectAnomalies, errors),
  ]);

  const [governanceResults, delegationResults] = await Promise.all([
    runStep("syncGovernance", syncGovernance, errors),
    runStep("syncDelegations", syncDelegations, errors),
  ]);

  const whaleResults = await runStep("detectWhaleMovement", detectWhaleMovement, errors);

  const sloResults = await runStep("evaluateSlos", evaluateSlos, errors);
  const policyResults = await runStep("evaluatePolicies", evaluatePolicies, errors);
  const incidentResults = await runStep("correlateIncidents", correlateIncidents, errors);

  const status = errors.length === 0 ? 200 : 207;

  return NextResponse.json({
    success: errors.length === 0,
    partial: errors.length > 0 && errors.length < 10,
    ...(stats ?? {}),
    scoring: {
      endpoints: endpointScores?.scored ?? 0,
      validators: validatorScores?.scored ?? 0,
    },
    anomalies: {
      detected: anomalies?.detected ?? 0,
      resolved: anomalies?.resolved ?? 0,
    },
    slos: {
      evaluated: sloResults?.evaluated ?? 0,
      breached: sloResults?.breached ?? 0,
      recovered: sloResults?.recovered ?? 0,
      exhausted: sloResults?.exhausted ?? 0,
    },
    governance: {
      proposalsSynced: governanceResults?.proposalsSynced ?? 0,
      votesSynced: governanceResults?.votesSynced ?? 0,
    },
    delegations: {
      eventsSynced: delegationResults?.eventsSynced ?? 0,
      snapshotsTaken: delegationResults?.snapshotsTaken ?? 0,
      whalesDetected: whaleResults?.detected ?? 0,
    },
    policies: {
      evaluated: policyResults?.evaluated ?? 0,
      triggered: policyResults?.triggered ?? 0,
      actionsExecuted: policyResults?.actionsExecuted ?? 0,
      rolledBack: policyResults?.rolledBack ?? 0,
    },
    incidents: {
      created: incidentResults?.created ?? 0,
      linked: incidentResults?.linked ?? 0,
      resolved: incidentResults?.resolved ?? 0,
    },
    errors: errors.length > 0 ? errors : undefined,
  }, { status });
}
