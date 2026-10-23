import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../messages/en/agentPerformance.json";
import { SummaryTiles } from "./SummaryTiles";

afterEach(cleanup);

function renderTiles(summary: Parameters<typeof SummaryTiles>[0]["summary"], decisions = 0) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agentPerformance: messages }}>
      <SummaryTiles summary={summary} decisions={decisions} />
    </NextIntlClientProvider>,
  );
}

describe("SummaryTiles", () => {
  it("renders computed totals and the decisions denominator behind avg accept-rate (AC-10)", () => {
    renderTiles({ runs: 12, total_cost_usd: 3.4, avg_accept_rate: 0.6667, most_active_agent: "Security Reviewer" }, 87);
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("$3.40")).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();
    expect(screen.getByText(/87 decisions/)).toBeInTheDocument();
    expect(screen.getByText("Security Reviewer")).toBeInTheDocument();
  });

  it("renders '–' (never $0.00/0%) for an empty-dashboard summary, not a fabricated zero (AC-05/AC-09)", () => {
    renderTiles({ runs: 0, total_cost_usd: null, avg_accept_rate: null, most_active_agent: null }, 0);
    expect(screen.getByText("0")).toBeInTheDocument(); // runs:0 is a REAL zero, shown as-is
    expect(screen.queryByText("$0.00")).not.toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();
    expect(screen.getAllByText("–")).toHaveLength(2); // cost + accept-rate
  });
});
