import type { PolicyCondition } from "@/types";

export interface EvaluationContext {
  anomaly?: {
    type: string;
    severity: string;
    entityType: string;
    entityId: string | null;
  };
  endpoint?: {
    score: number;
    uptime: number;
    latency: number;
    isHealthy: boolean;
  };
  validator?: {
    score: number;
    jailed: boolean;
    missedBlocks: number;
    commission: number;
  };
  slo?: {
    isBreaching: boolean;
    budgetConsumed: number;
    currentValue: number;
  };
}

const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

export const ALLOWED_FIELDS = new Set([
  "anomaly.type", "anomaly.severity", "anomaly.entityType",
  "endpoint.score", "endpoint.uptime", "endpoint.latency", "endpoint.isHealthy",
  "validator.score", "validator.jailed", "validator.missedBlocks", "validator.commission",
  "slo.isBreaching", "slo.budgetConsumed", "slo.currentValue",
]);

function getFieldValue(context: EvaluationContext, field: string): unknown {
  const parts = field.split(".");
  if (parts.length !== 2) return undefined;

  const [group, key] = parts;
  if (BLOCKED_KEYS.has(group) || BLOCKED_KEYS.has(key)) return undefined;
  const section = context[group as keyof EvaluationContext];
  if (!section || typeof section !== "object") return undefined;

  return (section as Record<string, unknown>)[key];
}

function evaluateOperator(
  actual: unknown,
  operator: PolicyCondition["operator"],
  expected: PolicyCondition["value"],
): boolean {
  if (actual === undefined || actual === null) return false;

  switch (operator) {
    case "eq":
      return actual === expected;
    case "neq":
      return actual !== expected;
    case "gt":
      return typeof actual === "number" && typeof expected === "number" && actual > expected;
    case "gte":
      return typeof actual === "number" && typeof expected === "number" && actual >= expected;
    case "lt":
      return typeof actual === "number" && typeof expected === "number" && actual < expected;
    case "lte":
      return typeof actual === "number" && typeof expected === "number" && actual <= expected;
    case "in":
      return Array.isArray(expected) && expected.includes(String(actual));
    default:
      return false;
  }
}

export function evaluateCondition(
  condition: PolicyCondition,
  context: EvaluationContext,
): boolean {
  const value = getFieldValue(context, condition.field);
  return evaluateOperator(value, condition.operator, condition.value);
}

export function evaluateAllConditions(
  conditions: PolicyCondition[],
  context: EvaluationContext,
): { allMet: boolean; metConditions: PolicyCondition[] } {
  const metConditions: PolicyCondition[] = [];

  for (const condition of conditions) {
    if (evaluateCondition(condition, context)) {
      metConditions.push(condition);
    }
  }

  return {
    allMet: metConditions.length === conditions.length,
    metConditions,
  };
}
