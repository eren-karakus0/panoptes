import { describe, it, expect } from "vitest";
import {
  parseIntParam,
  parseStringParam,
  parseBoolParam,
  parseDateParam,
} from "@/lib/validation";

describe("parseIntParam", () => {
  it("returns default for null", () => {
    expect(parseIntParam(null, 10, 1, 100)).toBe(10);
  });

  it("parses valid integer", () => {
    expect(parseIntParam("25", 10, 1, 100)).toBe(25);
  });

  it("clamps to min", () => {
    expect(parseIntParam("-5", 10, 1, 100)).toBe(1);
  });

  it("clamps to max", () => {
    expect(parseIntParam("999", 10, 1, 100)).toBe(100);
  });

  it("returns default for NaN", () => {
    expect(parseIntParam("abc", 10, 1, 100)).toBe(10);
  });

  it("returns default for empty string", () => {
    expect(parseIntParam("", 10, 1, 100)).toBe(10);
  });
});

describe("parseStringParam", () => {
  it("returns undefined for null", () => {
    expect(parseStringParam(null, ["a", "b"])).toBeUndefined();
  });

  it("returns value if allowed", () => {
    expect(parseStringParam("a", ["a", "b"])).toBe("a");
  });

  it("returns undefined if not allowed", () => {
    expect(parseStringParam("c", ["a", "b"])).toBeUndefined();
  });
});

describe("parseBoolParam", () => {
  it("returns undefined for null", () => {
    expect(parseBoolParam(null)).toBeUndefined();
  });

  it("parses true", () => {
    expect(parseBoolParam("true")).toBe(true);
    expect(parseBoolParam("1")).toBe(true);
  });

  it("parses false", () => {
    expect(parseBoolParam("false")).toBe(false);
    expect(parseBoolParam("0")).toBe(false);
  });

  it("returns undefined for invalid", () => {
    expect(parseBoolParam("yes")).toBeUndefined();
  });
});

describe("parseDateParam", () => {
  it("returns undefined for null", () => {
    expect(parseDateParam(null)).toBeUndefined();
  });

  it("parses valid ISO date", () => {
    const result = parseDateParam("2026-01-15T00:00:00Z");
    expect(result).toBeInstanceOf(Date);
    expect(result?.getFullYear()).toBe(2026);
  });

  it("returns undefined for invalid date", () => {
    expect(parseDateParam("not-a-date")).toBeUndefined();
  });
});
