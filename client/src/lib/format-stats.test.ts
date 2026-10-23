import { describe, it, expect } from "vitest";
import { formatPercent, formatDuration } from "./format-stats";

describe("formatPercent", () => {
  it("renders null/undefined as '–', never '0%' (no data vs a real zero)", () => {
    expect(formatPercent(null)).toBe("–");
    expect(formatPercent(undefined)).toBe("–");
  });

  it("renders an exact zero rate as '0%' (a real value, distinct from 'no data')", () => {
    expect(formatPercent(0)).toBe("0%");
  });

  it("rounds to the nearest whole percent", () => {
    expect(formatPercent(0.611)).toBe("61%");
    expect(formatPercent(1)).toBe("100%");
  });
});

describe("formatDuration", () => {
  it("renders null/undefined as '–', never '0s'", () => {
    expect(formatDuration(null)).toBe("–");
    expect(formatDuration(undefined)).toBe("–");
  });

  it("renders sub-second durations in ms", () => {
    expect(formatDuration(450)).toBe("450ms");
  });

  it("renders durations >= 1s with one decimal", () => {
    expect(formatDuration(1234)).toBe("1.2s");
  });
});
