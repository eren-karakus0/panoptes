import { describe, it, expect } from "vitest";
import { timeAgo, formatDateTime, formatDate, formatChartDate } from "@/lib/time";

describe("timeAgo", () => {
  it("returns relative time", () => {
    const now = new Date().toISOString();
    const result = timeAgo(now);
    expect(result).toContain("ago");
  });

  it("handles invalid date", () => {
    expect(timeAgo("invalid")).toBe("--");
  });
});

describe("formatDateTime", () => {
  it("formats ISO date to readable string", () => {
    const result = formatDateTime("2026-03-09T14:30:00.000Z");
    expect(result).toContain("Mar");
    expect(result).toContain("2026");
  });

  it("handles invalid date", () => {
    expect(formatDateTime("invalid")).toBe("--");
  });
});

describe("formatDate", () => {
  it("formats date without time", () => {
    const result = formatDate("2026-03-09T14:30:00.000Z");
    expect(result).toContain("Mar");
    expect(result).toContain("2026");
    expect(result).not.toContain("14:30");
  });

  it("handles invalid date", () => {
    expect(formatDate("invalid")).toBe("--");
  });
});

describe("formatChartDate", () => {
  it("returns short format", () => {
    const result = formatChartDate("2026-03-09T14:30:00.000Z");
    expect(result).toContain("Mar");
    expect(result).not.toContain("2026");
  });

  it("handles invalid date", () => {
    expect(formatChartDate("invalid")).toBe("");
  });
});
