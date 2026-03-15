import { describe, it, expect } from "vitest";
import {
  evaluateCondition,
  evaluateAllConditions,
  ALLOWED_FIELDS,
  type EvaluationContext,
} from "@/lib/intelligence/policy-conditions";

describe("evaluateCondition", () => {
  const context: EvaluationContext = {
    anomaly: { type: "jailing", severity: "high", entityType: "validator", entityId: "val-1" },
    endpoint: { score: 75, uptime: 99.5, latency: 200, isHealthy: true },
    validator: { score: 80, jailed: false, missedBlocks: 50, commission: 0.1 },
    slo: { isBreaching: false, budgetConsumed: 0.3, currentValue: 0.98 },
  };

  it("eq operator works for strings", () => {
    expect(evaluateCondition({ field: "anomaly.type", operator: "eq", value: "jailing" }, context)).toBe(true);
    expect(evaluateCondition({ field: "anomaly.type", operator: "eq", value: "endpoint_down" }, context)).toBe(false);
  });

  it("neq operator works", () => {
    expect(evaluateCondition({ field: "anomaly.severity", operator: "neq", value: "low" }, context)).toBe(true);
    expect(evaluateCondition({ field: "anomaly.severity", operator: "neq", value: "high" }, context)).toBe(false);
  });

  it("gt operator works for numbers", () => {
    expect(evaluateCondition({ field: "endpoint.score", operator: "gt", value: 50 }, context)).toBe(true);
    expect(evaluateCondition({ field: "endpoint.score", operator: "gt", value: 80 }, context)).toBe(false);
  });

  it("gte operator works", () => {
    expect(evaluateCondition({ field: "endpoint.score", operator: "gte", value: 75 }, context)).toBe(true);
    expect(evaluateCondition({ field: "endpoint.score", operator: "gte", value: 76 }, context)).toBe(false);
  });

  it("lt operator works", () => {
    expect(evaluateCondition({ field: "validator.missedBlocks", operator: "lt", value: 100 }, context)).toBe(true);
    expect(evaluateCondition({ field: "validator.missedBlocks", operator: "lt", value: 10 }, context)).toBe(false);
  });

  it("lte operator works", () => {
    expect(evaluateCondition({ field: "validator.missedBlocks", operator: "lte", value: 50 }, context)).toBe(true);
    expect(evaluateCondition({ field: "validator.missedBlocks", operator: "lte", value: 49 }, context)).toBe(false);
  });

  it("in operator works with arrays", () => {
    expect(evaluateCondition({ field: "anomaly.type", operator: "in", value: ["jailing", "endpoint_down"] }, context)).toBe(true);
    expect(evaluateCondition({ field: "anomaly.type", operator: "in", value: ["endpoint_down", "block_stale"] }, context)).toBe(false);
  });

  it("eq operator works for booleans", () => {
    expect(evaluateCondition({ field: "endpoint.isHealthy", operator: "eq", value: true }, context)).toBe(true);
    expect(evaluateCondition({ field: "validator.jailed", operator: "eq", value: false }, context)).toBe(true);
    expect(evaluateCondition({ field: "slo.isBreaching", operator: "eq", value: true }, context)).toBe(false);
  });

  it("returns false for unknown fields", () => {
    expect(evaluateCondition({ field: "unknown.field", operator: "eq", value: "test" }, context)).toBe(false);
  });

  it("returns false for empty context section", () => {
    const emptyContext: EvaluationContext = {};
    expect(evaluateCondition({ field: "anomaly.type", operator: "eq", value: "jailing" }, emptyContext)).toBe(false);
  });

  it("returns false for gt on non-numbers", () => {
    expect(evaluateCondition({ field: "anomaly.type", operator: "gt", value: 5 }, context)).toBe(false);
  });

  it("returns false for __proto__ field (prototype pollution guard)", () => {
    const ctx: EvaluationContext = {
      anomaly: { type: "jailing", severity: "high", entityType: "validator", entityId: "val-1" },
    };
    expect(evaluateCondition({ field: "__proto__.polluted", operator: "eq", value: true }, ctx)).toBe(false);
  });

  it("returns false for constructor field (prototype pollution guard)", () => {
    const ctx: EvaluationContext = {
      anomaly: { type: "jailing", severity: "high", entityType: "validator", entityId: "val-1" },
    };
    expect(evaluateCondition({ field: "constructor.name", operator: "eq", value: "Object" }, ctx)).toBe(false);
  });

  it("returns false for prototype field (prototype pollution guard)", () => {
    const ctx: EvaluationContext = {
      anomaly: { type: "jailing", severity: "high", entityType: "validator", entityId: "val-1" },
    };
    expect(evaluateCondition({ field: "anomaly.prototype", operator: "eq", value: "test" }, ctx)).toBe(false);
  });

  it("returns false for __proto__ as key (prototype pollution guard)", () => {
    const ctx: EvaluationContext = {
      anomaly: { type: "jailing", severity: "high", entityType: "validator", entityId: "val-1" },
    };
    expect(evaluateCondition({ field: "anomaly.__proto__", operator: "eq", value: "test" }, ctx)).toBe(false);
  });
});

describe("evaluateAllConditions", () => {
  const context: EvaluationContext = {
    anomaly: { type: "jailing", severity: "high", entityType: "validator", entityId: "val-1" },
    endpoint: { score: 75, uptime: 99.5, latency: 200, isHealthy: true },
  };

  it("returns allMet: true when all conditions match", () => {
    const conditions = [
      { field: "anomaly.type", operator: "eq" as const, value: "jailing" },
      { field: "anomaly.severity", operator: "eq" as const, value: "high" },
    ];
    const result = evaluateAllConditions(conditions, context);
    expect(result.allMet).toBe(true);
    expect(result.metConditions).toHaveLength(2);
  });

  it("returns allMet: false when some conditions don't match", () => {
    const conditions = [
      { field: "anomaly.type", operator: "eq" as const, value: "jailing" },
      { field: "anomaly.severity", operator: "eq" as const, value: "low" },
    ];
    const result = evaluateAllConditions(conditions, context);
    expect(result.allMet).toBe(false);
    expect(result.metConditions).toHaveLength(1);
  });

  it("returns allMet: true for empty conditions", () => {
    const result = evaluateAllConditions([], context);
    expect(result.allMet).toBe(true);
    expect(result.metConditions).toHaveLength(0);
  });
});

describe("ALLOWED_FIELDS", () => {
  it("contains expected fields", () => {
    expect(ALLOWED_FIELDS.has("anomaly.type")).toBe(true);
    expect(ALLOWED_FIELDS.has("endpoint.score")).toBe(true);
    expect(ALLOWED_FIELDS.has("validator.jailed")).toBe(true);
    expect(ALLOWED_FIELDS.has("slo.isBreaching")).toBe(true);
  });

  it("rejects unknown fields", () => {
    expect(ALLOWED_FIELDS.has("unknown.field")).toBe(false);
    expect(ALLOWED_FIELDS.has("__proto__.polluted")).toBe(false);
  });

  it("blocks toString field access", () => {
    expect(ALLOWED_FIELDS.has("anomaly.toString")).toBe(false);
  });

  it("blocks valueOf field access", () => {
    expect(ALLOWED_FIELDS.has("anomaly.valueOf")).toBe(false);
  });

  it("rejects fields not in ALLOWED_FIELDS", () => {
    expect(ALLOWED_FIELDS.has("anomaly.toString")).toBe(false);
    expect(ALLOWED_FIELDS.has("anomaly.valueOf")).toBe(false);
    expect(ALLOWED_FIELDS.has("anomaly.hasOwnProperty")).toBe(false);
  });
});
