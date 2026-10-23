import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AgentPerfRow } from "@devdigest/shared";
import messages from "../../../../../../../messages/en/agentPerformance.json";
import { MIN_DECISIONS_FOR_RATE } from "./constants";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

// Records every call so AC-07 ("sorting/row-view never calls a review-run
// or LLM endpoint") can be asserted against the actual network-call surface.
const apiGetSpy = vi.fn();
vi.mock("../../../../../../../lib/api", () => ({ api: { get: (...args: unknown[]) => apiGetSpy(...args) } }));

import { PerformanceTable } from "./PerformanceTable";

afterEach(() => {
  cleanup();
  push.mockClear();
  apiGetSpy.mockClear();
});

function row(overrides: Partial<AgentPerfRow> = {}): AgentPerfRow {
  return {
    agent_id: "a1",
    agent_name: "Agent",
    provider: "openai",
    model: "gpt-4.1",
    runs: 1,
    findings_total: 0,
    accepted: 0,
    dismissed: 0,
    accept_rate: null,
    dismiss_rate: null,
    avg_findings_per_run: null,
    total_cost_usd: null,
    avg_cost_usd: null,
    avg_latency_ms: null,
    last_run_at: null,
    findings_by_severity: { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 },
    trend: [],
    ...overrides,
  };
}

function renderTable(rows: AgentPerfRow[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agentPerformance: messages }}>
      <PerformanceTable rows={rows} />
    </NextIntlClientProvider>,
  );
}

describe("PerformanceTable", () => {
  it("renders one row per agent with its runs/cost/duration/accept-rate", () => {
    renderTable([
      row({ agent_id: "a1", agent_name: "Security Reviewer", runs: 4, avg_cost_usd: 0.3, avg_latency_ms: 1500 }),
    ]);
    expect(screen.getByText("Security Reviewer")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("$0.30")).toBeInTheDocument();
    expect(screen.getByText("1.5s")).toBeInTheDocument();
  });

  it("marks a row with fewer than the minimum decisions as low-sample (AC-08)", () => {
    renderTable([
      row({ agent_id: "flashy", agent_name: "Flashy", accepted: 1, dismissed: 0, accept_rate: 1 }),
      row({
        agent_id: "proven",
        agent_name: "Proven",
        accepted: MIN_DECISIONS_FOR_RATE,
        dismissed: 0,
        accept_rate: 1,
      }),
    ]);
    expect(screen.getAllByText("Low sample")).toHaveLength(1);
  });

  it('clicking "View" navigates to the agent\'s own Stats tab, not a review-run route', () => {
    renderTable([row({ agent_id: "ag-42", agent_name: "Agent 42" })]);
    fireEvent.click(screen.getByText("View"));
    expect(push).toHaveBeenCalledWith("/agents/ag-42?tab=stats");
  });

  it("sorting by accept-rate segregates low-sample rows to the bottom and never calls a network endpoint (AC-07/AC-08)", () => {
    renderTable([
      row({ agent_id: "flashy", agent_name: "Flashy", accepted: 1, dismissed: 0, accept_rate: 1 }),
      row({
        agent_id: "proven",
        agent_name: "Proven",
        accepted: 3,
        dismissed: MIN_DECISIONS_FOR_RATE - 3 + 2,
        accept_rate: 0.7,
      }),
    ]);
    fireEvent.click(screen.getByText(/Accept/));
    const names = screen.getAllByRole("row").slice(1).map((r) => r.textContent ?? "");
    expect(names[0]).toContain("Proven");
    expect(names[1]).toContain("Flashy");
    expect(apiGetSpy).not.toHaveBeenCalled();
  });
});
