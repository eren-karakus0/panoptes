export function parseIntParam(
  value: string | null | undefined,
  defaultValue: number,
  min: number,
  max: number,
): number {
  if (!value) return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return defaultValue;
  return Math.min(Math.max(parsed, min), max);
}

export function parseStringParam(
  value: string | null | undefined,
  allowedValues: string[],
): string | undefined {
  if (!value) return undefined;
  return allowedValues.includes(value) ? value : undefined;
}

export function parseBoolParam(
  value: string | null | undefined,
): boolean | undefined {
  if (!value) return undefined;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  return undefined;
}

export function parseDateParam(
  value: string | null | undefined,
): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  return isNaN(date.getTime()) ? undefined : date;
}
