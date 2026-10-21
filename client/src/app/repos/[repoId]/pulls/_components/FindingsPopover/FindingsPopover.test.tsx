import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReviewRecord } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/prReview.json";

const REVIEW: ReviewRecord = {
  id: "r1",
  pr_id: "pr1",
  agent_id: "a1",
  run_id: "run1",
  agent_name: "Security Reviewer",
  kind: "review",
  verdict: "request_changes",
  summary: "Two issues found.",
  score: 61,
  model: "gpt-4.1",
  cost: 0.01,
  grounding: null,
  created_at: "2026-06-13T20:52:00.000Z",
  findings: [
    {
      id: "f1",
      severity: "CRITICAL",
      category: "security",
      title: "Hardcoded Stripe secret key",
      file: "src/config.ts",
      start_line: 11,
      end_line: 11,
      rationale: "A live Stripe key is committed in source.",
      suggestion: null,
      confidence: 0.95,
      kind: "finding",
      trifecta_components: null,
      evidence: null,
      review_id: "r1",
      accepted_at: null,
      dismissed_at: null,
    },
    {
      id: "f2",
      severity: "WARNING",
      category: "perf",
      title: "N+1 query",
      file: "src/api/users.ts",
      start_line: 45,
      end_line: 52,
      rationale: "Loops and queries per user.",
      suggestion: null,
      confidence: 0.8,
      kind: "finding",
      trifecta_components: null,
      evidence: null,
      review_id: "r1",
      accepted_at: null,
      dismissed_at: null,
    },
  ],
};

let hookState: { data: ReviewRecord[] | undefined; isLoading: boolean; isError: boolean } = {
  data: [REVIEW],
  isLoading: false,
  isError: false,
};

vi.mock("@/lib/hooks/reviews", () => ({
  usePrReviews: () => hookState,
}));
vi.mock("@/lib/repo-context", () => ({
  useActiveRepo: () => ({ activeRepo: { full_name: "acme/widgets" } }),
}));

import { FindingsPopover, computePosition } from "./FindingsPopover";

afterEach(cleanup);

const anchorRef = { current: document.createElement("div") };

function renderPopover(onClose = vi.fn()) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <FindingsPopover prId="pr1" headSha="deadbeef" anchorRef={anchorRef} onClose={onClose} />
    </NextIntlClientProvider>,
  );
}

describe("FindingsPopover", () => {
  it("renders the latest review's findings, sorted by severity", () => {
    hookState = { data: [REVIEW], isLoading: false, isError: false };
    renderPopover();
    expect(screen.getByText("2 findings in this run")).toBeInTheDocument();
    expect(screen.getByText("Hardcoded Stripe secret key")).toBeInTheDocument();
    expect(screen.getByText("N+1 query")).toBeInTheDocument();
    expect(screen.getByText("src/config.ts:11")).toBeInTheDocument();
    expect(screen.getByText("src/api/users.ts:45-52")).toBeInTheDocument();
  });

  it("shows a loading state", () => {
    hookState = { data: undefined, isLoading: true, isError: false };
    renderPopover();
    expect(document.querySelector(".skeleton")).toBeInTheDocument();
  });

  it("shows an error state", () => {
    hookState = { data: undefined, isLoading: false, isError: true };
    renderPopover();
    expect(screen.getByText("Couldn’t load findings.")).toBeInTheDocument();
  });

  it("shows an empty state when the latest review has no findings", () => {
    hookState = { data: [{ ...REVIEW, findings: [] }], isLoading: false, isError: false };
    renderPopover();
    expect(screen.getByText("No findings.")).toBeInTheDocument();
  });

  it("calls onClose on Escape and on outside click", () => {
    hookState = { data: [REVIEW], isLoading: false, isError: false };
    const onClose = vi.fn();
    renderPopover(onClose);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("does not call onClose on a click inside the popover", () => {
    hookState = { data: [REVIEW], isLoading: false, isError: false };
    const onClose = vi.fn();
    renderPopover(onClose);
    fireEvent.mouseDown(screen.getByText("Hardcoded Stripe secret key"));
    expect(onClose).not.toHaveBeenCalled();
  });
});

// Regression coverage for the bug where the list's `tableCard` (overflow:
// hidden) clipped this popover whenever a row had no room below it — e.g.
// the last row in the table.
describe("computePosition", () => {
  function anchorAt(rect: Partial<DOMRect>): HTMLElement {
    const el = document.createElement("div");
    el.getBoundingClientRect = () =>
      ({ top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {}, ...rect }) as DOMRect;
    return el;
  }

  it("opens downward with plenty of room below", () => {
    window.innerHeight = 900;
    window.innerWidth = 1200;
    const pos = computePosition(anchorAt({ top: 100, bottom: 120, left: 50 }));
    expect(pos.top).toBe(126);
    expect(pos.bottom).toBeUndefined();
  });

  it("flips upward for the last row, with no room below", () => {
    window.innerHeight = 900;
    window.innerWidth = 1200;
    // A trigger near the very bottom of the viewport, as for the table's
    // last row — plenty of room above, almost none below.
    const pos = computePosition(anchorAt({ top: 860, bottom: 880, left: 50 }));
    expect(pos.top).toBeUndefined();
    expect(pos.bottom).toBe(900 - 860 + 6);
  });

  it("clamps horizontally so it never overflows the right edge of the viewport", () => {
    window.innerHeight = 900;
    window.innerWidth = 500;
    const pos = computePosition(anchorAt({ top: 100, bottom: 120, left: 450 }));
    expect(pos.left).toBeLessThanOrEqual(500 - 360 - 16);
  });
});
