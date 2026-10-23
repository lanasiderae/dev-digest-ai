import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { AgentPerf } from "@devdigest/shared";
import messages from "../../../../../messages/en/agentPerformance.json";

const PERF: AgentPerf = {
  summary: { runs: 4, total_cost_usd: 1.2, avg_accept_rate: 0.6667, most_active_agent: "Security Reviewer" },
  agents: [
    {
      agent_id: "ag1",
      agent_name: "Security Reviewer",
      provider: "openai",
      model: "gpt-4.1",
      runs: 4,
      findings_total: 3,
      accepted: 2,
      dismissed: 1,
      accept_rate: 0.6667,
      dismiss_rate: 0.3333,
      avg_findings_per_run: 0.75,
      total_cost_usd: 1.2,
      avg_cost_usd: 0.3,
      avg_latency_ms: 1500,
      last_run_at: "2026-01-02T00:00:00.000Z",
      findings_by_severity: { CRITICAL: 1, WARNING: 1, SUGGESTION: 1 },
      trend: [1, 2],
    },
  ],
  cost_by_agent: [{ label: "Security Reviewer", value: 1.2 }],
  cost_by_model: [{ label: "gpt-4.1", value: 1.2 }],
};

let mockState: { data: AgentPerf | undefined; isLoading: boolean; isError: boolean };
const refetch = vi.fn();
const routerPush = vi.fn();
// Records every call so AC-07 ("mount/sort/row-expand never calls a
// review-run or LLM endpoint") can be asserted against the real call surface.
const apiGetSpy = vi.fn();

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: routerPush }) }));
vi.mock("../../../../components/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("../../../../lib/api", () => ({ api: { get: (...args: unknown[]) => apiGetSpy(...args) } }));
vi.mock("../../../../lib/hooks/agent-stats", () => ({ useAgentPerformance: () => ({ ...mockState, refetch }) }));

import { AgentPerformanceView } from "./AgentPerformanceView";

function renderView() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agentPerformance: messages }}>
      <AgentPerformanceView />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  refetch.mockClear();
  routerPush.mockClear();
  apiGetSpy.mockClear();
});

describe("AgentPerformanceView", () => {
  it("loading: shows skeletons, no fabricated metric (AC-09)", () => {
    mockState = { data: undefined, isLoading: true, isError: false };
    renderView();
    expect(screen.queryByText("Total runs")).not.toBeInTheDocument();
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
  });

  it("error: shows the error state with retry, no fabricated metric (AC-09)", () => {
    mockState = { data: undefined, isLoading: false, isError: true };
    renderView();
    expect(screen.getByText("Could not load agent performance.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("empty (runs:0): shows the empty-dashboard state, distinct from loading/error (AC-05)", () => {
    mockState = {
      data: { summary: { runs: 0, total_cost_usd: null, avg_accept_rate: null, most_active_agent: null }, agents: [], cost_by_agent: [], cost_by_model: [] },
      isLoading: false,
      isError: false,
    };
    renderView();
    expect(screen.getByText("No agent runs yet")).toBeInTheDocument();
  });

  it("loaded: renders tiles, then the per-agent table, then the cost breakdown, top-to-bottom (AC-06)", () => {
    mockState = { data: PERF, isLoading: false, isError: false };
    const { container } = renderView();
    expect(screen.getByText("Total runs")).toBeInTheDocument();
    expect(screen.getAllByText("Security Reviewer").length).toBeGreaterThan(0);
    expect(screen.getByText("Cost by agent")).toBeInTheDocument();
    expect(screen.getByText("Cost by model")).toBeInTheDocument();

    const text = container.textContent ?? "";
    expect(text.indexOf("Total runs")).toBeLessThan(text.indexOf("Per-agent"));
    expect(text.indexOf("Per-agent")).toBeLessThan(text.indexOf("Cost by agent"));
  });

  it("never calls any review-run or LLM endpoint on mount or row-view navigation (AC-03/AC-07)", () => {
    mockState = { data: PERF, isLoading: false, isError: false };
    renderView();
    fireEvent.click(screen.getByText("View"));
    expect(routerPush).toHaveBeenCalledWith("/agents/ag1?tab=stats");
    expect(apiGetSpy).not.toHaveBeenCalled();
  });
});
