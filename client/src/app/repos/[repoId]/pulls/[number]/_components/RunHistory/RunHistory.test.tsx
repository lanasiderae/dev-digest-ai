/**
 * RunHistory — the badge must reflect the review OUTCOME, not the run lifecycle.
 * Regression guard for the "green ✓ done on a run that found 5 blockers" bug:
 * a settled run is colored/labelled by its denormalized blocker/finding counts,
 * and shows the review score ring.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { RunSummary, FindingRecord } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/prReview.json";

vi.mock("../RunFindingsPopover", () => ({
  RunFindingsPopover: () => <div data-testid="run-findings-popover" />,
}));

import { RunHistory } from "./RunHistory";

afterEach(cleanup);

function run(o: Partial<RunSummary>): RunSummary {
  return {
    run_id: "run-1",
    agent_id: "a1",
    agent_name: "Security Reviewer",
    provider: "openrouter",
    model: "deepseek/deepseek-v4-flash",
    status: "done",
    error: null,
    duration_ms: 1000,
    tokens_in: 100,
    tokens_out: 50,
    cost: null,
    findings_count: 0,
    grounding: "0/0 passed",
    ran_at: "2026-06-11T18:44:34.000Z",
    score: null,
    blockers: null,
    ...o,
  };
}

function renderRuns(runs: RunSummary[], findingsByRunId?: Record<string, FindingRecord[]>) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <RunHistory runs={runs} findingsByRunId={findingsByRunId} onOpenTrace={() => {}} />
    </NextIntlClientProvider>,
  );
}

function finding(o: Partial<FindingRecord>): FindingRecord {
  return {
    id: "f1",
    severity: "CRITICAL",
    category: "security",
    title: "Hardcoded secret",
    file: "src/config.ts",
    start_line: 11,
    end_line: 11,
    rationale: "A live key is committed.",
    suggestion: null,
    confidence: 0.95,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
    ...o,
  };
}

describe("RunHistory — outcome badge", () => {
  it("a done run WITH blockers reads 'rejected' (never green 'done') + shows the score ring", () => {
    renderRuns([run({ status: "done", findings_count: 5, blockers: 5, score: 0 })]);
    expect(screen.getByText("rejected")).toBeInTheDocument();
    expect(screen.queryByText("done")).not.toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument(); // CircularScore renders the number
    expect(screen.getByText(/5 blockers/)).toBeInTheDocument();
  });

  it("a clean done run reads 'approved'", () => {
    renderRuns([run({ status: "done", findings_count: 0, blockers: 0, score: 95 })]);
    expect(screen.getByText("approved")).toBeInTheDocument();
    expect(screen.getByText("95")).toBeInTheDocument();
  });

  it("a done run with non-blocking findings reads 'reviewed'", () => {
    renderRuns([run({ status: "done", findings_count: 3, blockers: 0, score: 72 })]);
    expect(screen.getByText("reviewed")).toBeInTheDocument();
    expect(screen.queryByText(/blockers/)).not.toBeInTheDocument();
  });

  it("a failed run reads 'error'", () => {
    renderRuns([run({ status: "failed", error: "boom", score: null, blockers: null })]);
    expect(screen.getByText("error")).toBeInTheDocument();
  });

  it("a running run reads 'running'", () => {
    renderRuns([run({ status: "running", score: null, blockers: null })]);
    expect(screen.getByText("running")).toBeInTheDocument();
  });
});

describe("RunHistory — cost", () => {
  it("shows tokens + cost under the timestamp for a settled run", () => {
    renderRuns([run({ status: "done", tokens_in: 9000, tokens_out: 119, cost: 0.0013 })]);
    expect(screen.getByText("9,119 tok · $0.0013")).toBeInTheDocument();
  });

  it("shows '–' for a settled run with no cost data, never '$0.00'", () => {
    renderRuns([run({ status: "done", tokens_in: 9000, tokens_out: 119, cost: null })]);
    expect(screen.getByText("9,119 tok · –")).toBeInTheDocument();
    expect(screen.queryByText(/\$0\.00/)).not.toBeInTheDocument();
  });

  it("shows no tokens/cost line for a run that hasn't settled", () => {
    renderRuns([run({ status: "failed", error: "boom", score: null, blockers: null, cost: null })]);
    expect(screen.queryByText(/tok ·/)).not.toBeInTheDocument();
  });
});

describe("RunHistory — per-run findings cluster", () => {
  it("shows a severity badge per non-zero count when findings are known for the run", () => {
    renderRuns(
      [run({ status: "done", findings_count: 2, blockers: 1, score: 61 })],
      { "run-1": [finding({ id: "f1", severity: "CRITICAL" }), finding({ id: "f2", severity: "WARNING" })] },
    );
    const trigger = screen.getByRole("button", { name: /\d/ });
    expect(trigger.textContent).toBe("11");
    // The old plain-text fallback must not also render.
    expect(screen.queryByText(/finding\(s\)/)).not.toBeInTheDocument();
  });

  it("falls back to the plain finding/blocker text when the run isn't in findingsByRunId", () => {
    renderRuns([run({ status: "done", findings_count: 5, blockers: 5, score: 0 })]);
    expect(screen.getByText(/5 blockers/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /\d/ })).not.toBeInTheDocument();
  });

  it("shows nothing for a clean run with an empty findings array", () => {
    renderRuns([run({ status: "done", findings_count: 0, blockers: 0, score: 95 })], { "run-1": [] });
    expect(screen.queryByRole("button", { name: /\d/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/finding\(s\)/)).not.toBeInTheDocument();
  });

  it("opens the per-run popover on click", () => {
    renderRuns([run({ status: "done", findings_count: 1, blockers: 1, score: 20 })], {
      "run-1": [finding({})],
    });
    expect(screen.queryByTestId("run-findings-popover")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /\d/ }));
    expect(screen.getByTestId("run-findings-popover")).toBeInTheDocument();
  });
});
