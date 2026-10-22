import { describe, it, expect } from "vitest";
import type { FindingRecord } from "../../lib/types";
import { keyForFinding, partitionFindings, topSeverity } from "./findings";

function finding(overrides: Partial<FindingRecord> = {}): FindingRecord {
  return {
    id: "f1",
    severity: "WARNING",
    category: "bug",
    title: "Something",
    file: "a.ts",
    start_line: 10,
    end_line: 10,
    rationale: "because",
    suggestion: null,
    confidence: 0.8,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    matched_skill: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
    ...overrides,
  };
}

describe("keyForFinding", () => {
  it("always anchors to the RIGHT (new) side", () => {
    expect(keyForFinding(finding({ start_line: 42 }))).toBe("RIGHT:42");
  });
});

describe("partitionFindings", () => {
  it("splits findings into matched (rendered line) vs outside the visible patch", () => {
    const f1 = finding({ id: "f1", start_line: 10 });
    const f2 = finding({ id: "f2", start_line: 999 });
    const { matched, outside } = partitionFindings([f1, f2], new Set(["RIGHT:10"]));
    expect(matched.get("RIGHT:10")).toEqual([f1]);
    expect(outside).toEqual([f2]);
  });
});

describe("topSeverity", () => {
  it("picks CRITICAL over WARNING/SUGGESTION on the same line", () => {
    const findings = [finding({ severity: "SUGGESTION" }), finding({ severity: "CRITICAL" }), finding({ severity: "WARNING" })];
    expect(topSeverity(findings)).toBe("CRITICAL");
  });
});
