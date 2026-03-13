import {
  SLO_INDICATORS,
  SLO_ENTITY_TYPES,
  SLO_INDICATOR_ENTITY_MAP,
  SLO_DEFAULTS,
  type SloIndicator,
  type SloEntityType,
} from "@/lib/constants";

interface SloCreateResult {
  name: string;
  indicator: SloIndicator;
  entityType: SloEntityType;
  entityId: string;
  target: number;
  windowDays: number;
}

interface SloUpdateResult {
  name?: string;
  target?: number;
  windowDays?: number;
  isActive?: boolean;
}

interface ValidationError {
  error: string;
}

export function validateSloCreate(
  body: unknown,
): SloCreateResult | ValidationError {
  if (!body || typeof body !== "object") {
    return { error: "Request body is required" };
  }

  const { name, indicator, entityType, entityId, target, windowDays } =
    body as Record<string, unknown>;

  // name
  if (typeof name !== "string" || name.trim().length === 0) {
    return { error: "name is required and must be a non-empty string" };
  }
  if (name.trim().length > 100) {
    return { error: "name must be at most 100 characters" };
  }

  // indicator
  const validIndicators = SLO_INDICATORS as readonly string[];
  if (typeof indicator !== "string" || !validIndicators.includes(indicator)) {
    return {
      error: `indicator must be one of: ${SLO_INDICATORS.join(", ")}`,
    };
  }

  // entityType
  const validEntityTypes = SLO_ENTITY_TYPES as readonly string[];
  if (typeof entityType !== "string" || !validEntityTypes.includes(entityType)) {
    return {
      error: `entityType must be one of: ${SLO_ENTITY_TYPES.join(", ")}`,
    };
  }

  // indicator ↔ entityType compatibility
  const allowedEntities = SLO_INDICATOR_ENTITY_MAP[indicator as SloIndicator];
  if (!allowedEntities.includes(entityType as SloEntityType)) {
    return {
      error: `indicator "${indicator}" is not compatible with entityType "${entityType}". Allowed: ${allowedEntities.join(", ")}`,
    };
  }

  // entityId
  if (typeof entityId !== "string" || entityId.trim().length === 0) {
    return { error: "entityId is required and must be a non-empty string" };
  }

  // target
  if (typeof target !== "number" || isNaN(target)) {
    return { error: "target is required and must be a number" };
  }
  if (target < SLO_DEFAULTS.MIN_TARGET || target > SLO_DEFAULTS.MAX_TARGET) {
    return {
      error: `target must be between ${SLO_DEFAULTS.MIN_TARGET} and ${SLO_DEFAULTS.MAX_TARGET}`,
    };
  }

  // windowDays
  if (typeof windowDays !== "number" || !Number.isInteger(windowDays)) {
    return { error: "windowDays is required and must be an integer" };
  }
  if (
    windowDays < SLO_DEFAULTS.MIN_WINDOW_DAYS ||
    windowDays > SLO_DEFAULTS.MAX_WINDOW_DAYS
  ) {
    return {
      error: `windowDays must be between ${SLO_DEFAULTS.MIN_WINDOW_DAYS} and ${SLO_DEFAULTS.MAX_WINDOW_DAYS}`,
    };
  }

  return {
    name: name.trim(),
    indicator: indicator as SloIndicator,
    entityType: entityType as SloEntityType,
    entityId: entityId.trim(),
    target,
    windowDays,
  };
}

export function validateSloUpdate(
  body: unknown,
): SloUpdateResult | ValidationError {
  if (!body || typeof body !== "object") {
    return { error: "Request body is required" };
  }

  const { name, target, windowDays, isActive } = body as Record<
    string,
    unknown
  >;
  const result: SloUpdateResult = {};
  let hasField = false;

  if (name !== undefined) {
    if (typeof name !== "string" || name.trim().length === 0) {
      return { error: "name must be a non-empty string" };
    }
    if (name.trim().length > 100) {
      return { error: "name must be at most 100 characters" };
    }
    result.name = name.trim();
    hasField = true;
  }

  if (target !== undefined) {
    if (typeof target !== "number" || isNaN(target)) {
      return { error: "target must be a number" };
    }
    if (target < SLO_DEFAULTS.MIN_TARGET || target > SLO_DEFAULTS.MAX_TARGET) {
      return {
        error: `target must be between ${SLO_DEFAULTS.MIN_TARGET} and ${SLO_DEFAULTS.MAX_TARGET}`,
      };
    }
    result.target = target;
    hasField = true;
  }

  if (windowDays !== undefined) {
    if (typeof windowDays !== "number" || !Number.isInteger(windowDays)) {
      return { error: "windowDays must be an integer" };
    }
    if (
      windowDays < SLO_DEFAULTS.MIN_WINDOW_DAYS ||
      windowDays > SLO_DEFAULTS.MAX_WINDOW_DAYS
    ) {
      return {
        error: `windowDays must be between ${SLO_DEFAULTS.MIN_WINDOW_DAYS} and ${SLO_DEFAULTS.MAX_WINDOW_DAYS}`,
      };
    }
    result.windowDays = windowDays;
    hasField = true;
  }

  if (isActive !== undefined) {
    if (typeof isActive !== "boolean") {
      return { error: "isActive must be a boolean" };
    }
    result.isActive = isActive;
    hasField = true;
  }

  if (!hasField) {
    return { error: "At least one field must be provided for update" };
  }

  return result;
}
