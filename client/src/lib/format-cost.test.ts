import { describe, it, expect } from "vitest";
import { formatCost } from "./format-cost";

describe("formatCost", () => {
  it("renders null/undefined as '–', never '$0.00'", () => {
    expect(formatCost(null)).toBe("–");
    expect(formatCost(undefined)).toBe("–");
  });

  it("renders an exact zero cost as '$0.00' (a real value, distinct from 'no data')", () => {
    expect(formatCost(0)).toBe("$0.00");
  });

  it("uses 4 decimals under a cent so sub-cent costs don't collapse to $0.00", () => {
    expect(formatCost(0.0013)).toBe("$0.0013");
  });

  it("uses 2 decimals at or above a cent", () => {
    expect(formatCost(0.06)).toBe("$0.06");
    expect(formatCost(12.3)).toBe("$12.30");
  });
});
