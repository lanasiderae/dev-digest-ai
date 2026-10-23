import { describe, it, expect } from "vitest";
import type { PrFile, ReviewRecord } from "@devdigest/shared";
import { agentNameFor, buildDiffNavUrl, isFileInDiff, latestVerdictCounts, latestVerdictReview } from "./helpers";

const FILES: PrFile[] = [
  { path: "src/a.ts", additions: 3, deletions: 1, patch: "@@ -1,1 +1,3 @@" },
  { path: "src/b.ts", additions: 0, deletions: 2, patch: "@@ -1,2 +0,0 @@" },
];

function review(overrides: Partial<ReviewRecord> = {}): ReviewRecord {
  return {
    id: "rev1",
    pr_id: "pr1",
    agent_id: "agent1",
    run_id: "run1",
    agent_name: "Agent One",
    kind: "review",
    verdict: "comment",
    summary: "Looks fine.",
    score: 80,
    model: "gpt",
    cost: 0.01,
    grounding: null,
    created_at: "2024-01-01T00:00:00.000Z",
    findings: [],
    ...overrides,
  };
}

describe("isFileInDiff", () => {
  it("is true for a changed file and false for a downstream-only path (BRIEF-AC-17 grounding)", () => {
    expect(isFileInDiff("src/a.ts", FILES)).toBe(true);
    expect(isFileInDiff("src/not-in-pr.ts", FILES)).toBe(false);
  });
});

describe("buildDiffNavUrl", () => {
  it("opens ?tab=diff&file=<encoded>&line=<n>, preserving other existing params", () => {
    const url = buildDiffNavUrl("/repos/r1/pulls/5", "trace=run1", "src/weird path.ts", 42);
    const [path, qs] = url.split("?");
    expect(path).toBe("/repos/r1/pulls/5");
    const sp = new URLSearchParams(qs);
    expect(sp.get("tab")).toBe("diff");
    expect(sp.get("file")).toBe("src/weird path.ts"); // round-trips through URLSearchParams decode
    expect(sp.get("line")).toBe("42");
    expect(sp.get("trace")).toBe("run1"); // preserved
  });

  it("omits line for a risk file reference (file-level navigation only)", () => {
    const url = buildDiffNavUrl("/repos/r1/pulls/5", "", "src/a.ts");
    const sp = new URLSearchParams(url.split("?")[1]);
    expect(sp.get("file")).toBe("src/a.ts");
    expect(sp.has("line")).toBe(false);
  });

  it("removes a stale existing ?line= when navigating to a line-less target", () => {
    const url = buildDiffNavUrl("/repos/r1/pulls/5", "line=7&file=old.ts", "src/a.ts");
    const sp = new URLSearchParams(url.split("?")[1]);
    expect(sp.has("line")).toBe(false);
    expect(sp.get("file")).toBe("src/a.ts");
  });
});

describe("latestVerdictReview / latestVerdictCounts", () => {
  it("picks the most recent review with a verdict across every agent, ignoring summary-kind rows", () => {
    const older = review({ id: "r1", created_at: "2024-01-01T00:00:00.000Z", verdict: "approve" });
    const newer = review({ id: "r2", created_at: "2024-02-01T00:00:00.000Z", verdict: "request_changes" });
    const summaryRow = review({ id: "r3", kind: "summary", created_at: "2024-03-01T00:00:00.000Z" });
    expect(latestVerdictReview([older, newer, summaryRow])?.id).toBe("r2");
  });

  it("returns null when nothing has a verdict yet (unreviewed state)", () => {
    expect(latestVerdictReview([review({ verdict: null })])).toBeNull();
  });

  it("tallies non-dismissed findings by severity", () => {
    const r = review({
      findings: [
        {
          id: "f1",
          review_id: "rev1",
          kind: "finding",
          severity: "CRITICAL",
          category: "bug",
          title: "x",
          file: "a.ts",
          start_line: 1,
          end_line: 1,
          rationale: "because",
          confidence: 1,
          accepted_at: null,
          dismissed_at: null,
        },
      ],
    });
    expect(latestVerdictCounts(r).CRITICAL).toBe(1);
  });
});

describe("agentNameFor", () => {
  it("resolves a known agent id to its name and falls back to the raw id otherwise", () => {
    const agents = [{ id: "a1", name: "Reviewer Bot" }];
    expect(agentNameFor("a1", agents)).toBe("Reviewer Bot");
    expect(agentNameFor("unknown-id", agents)).toBe("unknown-id");
    expect(agentNameFor(null, agents)).toBeNull();
  });
});
