import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent, AgentStats } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/agents.json";

const STATS: AgentStats = {
  agent_id: "ag1",
  agent_name: "Security Reviewer",
  runs: 4,
  findings_total: 3,
  accepted: 2,
  dismissed: 1,
  pending: 0,
  accept_rate: 0.6667,
  dismiss_rate: 0.3333,
  avg_findings_per_run: 0.75,
  total_cost_usd: 1.2,
  avg_cost_usd: 0.3,
  avg_latency_ms: 1500,
  findings_by_severity: { CRITICAL: 1, WARNING: 1, SUGGESTION: 1 },
  trend: [
    { label: "2026-01-01T00:00:00.000Z", value: 1 },
    { label: "2026-01-02T00:00:00.000Z", value: 2 },
  ],
};

let mockState: { data: AgentStats | undefined; isLoading: boolean; isError: boolean };
const refetch = vi.fn();
// Spy records every call so AC-03/AC-07 ("never calls a review-run/LLM
// endpoint") can be asserted against the actual network-call surface.
const apiGetSpy = vi.fn();

vi.mock("../../../../../../../lib/api", () => ({
  api: { get: (...args: unknown[]) => apiGetSpy(...args) },
}));

vi.mock("../../../../../../../lib/hooks/agent-stats", () => ({
  useAgentStats: () => ({ ...mockState, refetch }),
}));

import { StatsTab } from "./StatsTab";

const AGENT: Agent = {
  id: "ag1",
  name: "Security Reviewer",
  description: "",
  provider: "openai",
  model: "gpt-4.1",
  system_prompt: "x",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 1,
  project_context: [],
};

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: messages }}>
      <StatsTab agent={AGENT} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  refetch.mockClear();
  apiGetSpy.mockClear();
});

describe("StatsTab", () => {
  it("loading: shows skeletons, never a fabricated metric", () => {
    mockState = { data: undefined, isLoading: true, isError: false };
    renderTab();
    expect(screen.queryByText("Runs")).not.toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
  });

  it("error: shows the error state with retry, never a fabricated metric (AC-09)", () => {
    mockState = { data: undefined, isLoading: false, isError: true };
    renderTab();
    expect(screen.getByText("Could not load this agent's stats.")).toBeInTheDocument();
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
  });

  it("empty (runs:0): shows the empty state, not a 0-run metrics row", () => {
    mockState = {
      data: { ...STATS, runs: 0, accept_rate: null, total_cost_usd: null, avg_cost_usd: null, avg_latency_ms: null },
      isLoading: false,
      isError: false,
    };
    renderTab();
    expect(screen.getByText("No runs in this range")).toBeInTheDocument();
  });

  it("renders computed metrics, severity breakdown, and the resolved-range denominator (AC-01/AC-10)", () => {
    mockState = { data: STATS, isLoading: false, isError: false };
    renderTab();
    expect(screen.getByText("Runs")).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument(); // accept_rate rounded
    expect(screen.getByText("$0.30")).toBeInTheDocument(); // avg_cost_usd
    expect(screen.getByText("1.5s")).toBeInTheDocument(); // avg_latency_ms
    expect(screen.getByText(/4 runs matched/)).toBeInTheDocument();
  });

  it("labels cost as a DevDigest estimate, not reconciled billing", () => {
    mockState = { data: STATS, isLoading: false, isError: false };
    renderTab();
    expect(
      screen.getByText("Cost is a DevDigest estimate (via PriceBook), not reconciled provider billing."),
    ).toBeInTheDocument();
  });

  it("never calls any review-run or LLM endpoint on mount — only the stats hook (AC-03)", () => {
    mockState = { data: STATS, isLoading: false, isError: false };
    renderTab();
    // `api.get` is mocked at the module level; the hook itself is mocked too,
    // so no real fetch happens, but assert belt-and-suspenders that nothing
    // in this component tree reaches for a mutating/LLM-shaped endpoint.
    const calledPaths = apiGetSpy.mock.calls.map((c) => String(c[0]));
    expect(calledPaths.every((p) => !/\/review\b|\/runs\b|\/llm\b/.test(p))).toBe(true);
    expect(apiGetSpy).not.toHaveBeenCalled();
  });
});
