import { describe, it, expect } from "vitest";
import {
  formatTokens,
  formatTokensShort,
  tokensToNumber,
  formatCommission,
  formatBlockHeight,
  formatUptime,
  formatLatency,
  formatPercent,
  truncateAddress,
  formatNumber,
} from "@/lib/formatters";

describe("formatTokens", () => {
  it("formats zero", () => {
    expect(formatTokens("0")).toBe("0 RAI");
  });

  it("formats empty string", () => {
    expect(formatTokens("")).toBe("0 RAI");
  });

  it("formats large arai values to RAI", () => {
    const tenRai = "10000000000000000000";
    expect(formatTokens(tenRai)).toBe("10 RAI");
  });

  it("formats with decimals", () => {
    const result = formatTokens("1500000000000000000");
    expect(result).toBe("1.50 RAI");
  });

  it("handles invalid input gracefully", () => {
    expect(formatTokens("not-a-number")).toBe("-- RAI");
    expect(formatTokens("12.5")).toBe("-- RAI");
  });

  it("handles whitespace in input", () => {
    expect(formatTokens(" 1000000000000000000 ")).toBe("1 RAI");
  });
});

describe("formatTokensShort", () => {
  it("formats millions", () => {
    const val = (BigInt(10_000_000) * BigInt(10 ** 18)).toString();
    expect(formatTokensShort(val)).toBe("10.0M RAI");
  });

  it("formats thousands", () => {
    const val = (BigInt(5000) * BigInt(10 ** 18)).toString();
    expect(formatTokensShort(val)).toBe("5.0K RAI");
  });

  it("formats zero", () => {
    expect(formatTokensShort("0")).toBe("0 RAI");
  });

  it("formats billions", () => {
    const val = (BigInt(2_000_000_000) * BigInt(10 ** 18)).toString();
    expect(formatTokensShort(val)).toBe("2.0B RAI");
  });

  it("handles fractional values < 1 RAI", () => {
    // 0.5 RAI = 5 * 10^17
    const halfRai = "500000000000000000";
    expect(formatTokensShort(halfRai)).toBe("0.50 RAI");
  });

  it("handles invalid input gracefully", () => {
    expect(formatTokensShort("abc")).toBe("-- RAI");
  });
});

describe("tokensToNumber", () => {
  it("converts arai to number", () => {
    const oneRai = "1000000000000000000";
    expect(tokensToNumber(oneRai)).toBe(1);
  });

  it("returns 0 for empty", () => {
    expect(tokensToNumber("")).toBe(0);
  });

  it("handles invalid input", () => {
    expect(tokensToNumber("invalid")).toBe(0);
  });

  it("handles fractional RAI", () => {
    // 0.5 RAI
    const halfRai = "500000000000000000";
    expect(tokensToNumber(halfRai)).toBeCloseTo(0.5, 5);
  });
});

describe("formatCommission", () => {
  it("formats 10%", () => {
    expect(formatCommission(0.1)).toBe("10.0%");
  });

  it("formats 5.5%", () => {
    expect(formatCommission(0.055)).toBe("5.5%");
  });

  it("formats 0%", () => {
    expect(formatCommission(0)).toBe("0.0%");
  });

  it("formats 100%", () => {
    expect(formatCommission(1)).toBe("100.0%");
  });
});

describe("formatBlockHeight", () => {
  it("formats with commas", () => {
    expect(formatBlockHeight("1234567")).toBe("1,234,567");
  });
});

describe("formatUptime", () => {
  it("formats percentage", () => {
    expect(formatUptime(99.5)).toBe("99.5%");
  });
});

describe("formatLatency", () => {
  it("formats milliseconds", () => {
    expect(formatLatency(150)).toBe("150ms");
  });

  it("formats seconds", () => {
    expect(formatLatency(1500)).toBe("1.5s");
  });
});

describe("formatPercent", () => {
  it("formats ratio to percent", () => {
    expect(formatPercent(0.65)).toBe("65.0%");
  });

  it("handles null", () => {
    expect(formatPercent(null)).toBe("--");
  });
});

describe("truncateAddress", () => {
  it("truncates long address", () => {
    const addr = "raivaloper12rfm0s7qu0v8mwmx54uepea3kx8d2m6v30x9ys";
    const result = truncateAddress(addr);
    expect(result).toContain("...");
    expect(result.length).toBeLessThan(addr.length);
  });

  it("returns short address as-is", () => {
    expect(truncateAddress("short")).toBe("short");
  });

  it("handles empty", () => {
    expect(truncateAddress("")).toBe("");
  });
});

describe("formatNumber", () => {
  it("formats with commas", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });
});
