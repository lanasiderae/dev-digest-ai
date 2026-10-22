import { describe, it, expect } from "vitest";
import type { FindingRecord, PrFile, ReviewRecord, SmartDiff } from "@/lib/types";
import { filesWithFindingsCount, latestFindingsByPath, mergeSmartOrder } from "./helpers";

function prFile(path: string): PrFile {
  return { path, additions: 1, deletions: 0, patch: null };
}

describe("mergeSmartOrder", () => {
  it("returns every role in order, including empty ones", () => {
    const smartDiff: SmartDiff = {
      groups: [{ role: "core", files: [{ path: "a.ts", additions: 1, deletions: 0, finding_lines: [] }] }],
      split_suggestion: { too_big: false, total_lines: 1, proposed_splits: [] },
    };
    const groups = mergeSmartOrder([prFile("a.ts")], smartDiff);
    expect(groups.map((g) => g.role)).toEqual(["core", "tests", "wiring", "docs", "boilerplate"]);
    expect(groups.find((g) => g.role === "tests")!.files).toEqual([]);
  });

  it("appends a PR file the smart-diff doesn't know about to the core fallback group", () => {
    const smartDiff: SmartDiff = {
      groups: [],
      split_suggestion: { too_big: false, total_lines: 0, proposed_splits: [] },
    };
    const groups = mergeSmartOrder([prFile("mystery.ts")], smartDiff);
    expect(groups.find((g) => g.role === "core")!.files.map((f) => f.path)).toEqual(["mystery.ts"]);
  });

  it("drops a smart-diff path that isn't actually in the PR's files", () => {
    const smartDiff: SmartDiff = {
      groups: [{ role: "core", files: [{ path: "gone.ts", additions: 1, deletions: 0, finding_lines: [] }] }],
      split_suggestion: { too_big: false, total_lines: 1, proposed_splits: [] },
    };
    const groups = mergeSmartOrder([], smartDiff);
    expect(groups.find((g) => g.role === "core")!.files).toEqual([]);
  });

  it("flags a file with finding_lines so filesWithFindingsCount counts it", () => {
    const smartDiff: SmartDiff = {
      groups: [
        {
          role: "core",
          files: [
            { path: "a.ts", additions: 1, deletions: 0, finding_lines: [5] },
            { path: "b.ts", additions: 1, deletions: 0, finding_lines: [] },
          ],
        },
      ],
      split_suggestion: { too_big: false, total_lines: 2, proposed_splits: [] },
    };
    const group = mergeSmartOrder([prFile("a.ts"), prFile("b.ts")], smartDiff).find((g) => g.role === "core")!;
    expect(filesWithFindingsCount(group)).toBe(1);
  });
});

function finding(overrides: Partial<FindingRecord> = {}): FindingRecord {
  return {
    id: "f1",
    severity: "WARNING",
    category: "bug",
    title: "t",
    file: "a.ts",
    start_line: 1,
    end_line: 1,
    rationale: "r",
    suggestion: null,
    confidence: 0.5,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    matched_skill: null,
    review_id: "rev1",
    accepted_at: null,
    dismissed_at: null,
    ...overrides,
  };
}

function review(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: "rev1",
    pr_id: "pr1",
    agent_id: "agent1",
    run_id: null,
    agent_name: "Agent",
    kind: "review",
    verdict: "comment",
    summary: null,
    score: 90,
    model: "gpt",
    cost: null,
    grounding: null,
    created_at: "2026-01-01T00:00:00Z",
    findings: [finding()],
    ...overrides,
  };
}

describe("latestFindingsByPath", () => {
  it("keeps only each agent's latest review, newest first", () => {
    const older = review({ id: "rev-old", created_at: "2026-01-01T00:00:00Z", findings: [finding({ id: "old" })] });
    const newer = review({ id: "rev-new", created_at: "2026-01-02T00:00:00Z", findings: [finding({ id: "new" })] });
    const byPath = latestFindingsByPath([older, newer]);
    expect(byPath.get("a.ts")!.map((f) => f.id)).toEqual(["new"]);
  });

  it("ignores a non-review (summary) kind entirely", () => {
    const summary = review({ kind: "summary", findings: [finding({ id: "s" })] });
    expect(latestFindingsByPath([summary]).size).toBe(0);
  });

  it("keeps dismissed findings (muted rendering happens downstream, not here)", () => {
    const r = review({ findings: [finding({ id: "d", dismissed_at: "2026-01-03T00:00:00Z" })] });
    expect(latestFindingsByPath([r]).get("a.ts")!.map((f) => f.id)).toEqual(["d"]);
  });
});
