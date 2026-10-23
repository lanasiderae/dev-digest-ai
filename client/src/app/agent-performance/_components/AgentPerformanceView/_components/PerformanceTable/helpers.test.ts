import { describe, it, expect } from "vitest";
import type { AgentPerfRow } from "@devdigest/shared";
import { isLowSample, sortPerformanceRows } from "./helpers";
import { MIN_DECISIONS_FOR_RATE } from "./constants";

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

describe("isLowSample", () => {
  it("is low-sample below the minimum accepted+dismissed decisions", () => {
    expect(isLowSample(row({ accepted: 1, dismissed: MIN_DECISIONS_FOR_RATE - 2 }))).toBe(true);
  });

  it("is not low-sample at or above the minimum", () => {
    const decided = Math.ceil(MIN_DECISIONS_FOR_RATE / 2);
    expect(isLowSample(row({ accepted: decided, dismissed: MIN_DECISIONS_FOR_RATE - decided }))).toBe(false);
  });
});

describe("sortPerformanceRows", () => {
  it("sorts by runs descending", () => {
    const rows = [row({ agent_id: "a", runs: 1 }), row({ agent_id: "b", runs: 5 })];
    expect(sortPerformanceRows(rows, "runs").map((r) => r.agent_id)).toEqual(["b", "a"]);
  });

  it("sorts by cost descending, nulls last", () => {
    const rows = [
      row({ agent_id: "no-cost", total_cost_usd: null }),
      row({ agent_id: "cheap", total_cost_usd: 1 }),
      row({ agent_id: "pricey", total_cost_usd: 10 }),
    ];
    expect(sortPerformanceRows(rows, "cost").map((r) => r.agent_id)).toEqual(["pricey", "cheap", "no-cost"]);
  });

  it("acceptRate: a reliable row never ranks below a low-sample row, even with a lower rate (AC-08)", () => {
    const highLowSample = row({ agent_id: "flashy", accepted: 1, dismissed: 0, accept_rate: 1.0 });
    const reliable = row({ agent_id: "proven", accepted: 35, dismissed: 15, accept_rate: 0.7 });
    expect(sortPerformanceRows([highLowSample, reliable], "acceptRate").map((r) => r.agent_id)).toEqual([
      "proven",
      "flashy",
    ]);
  });

  it("acceptRate: orders both groups by rate descending internally", () => {
    const reliableLow = row({ agent_id: "r-low", accepted: 20, dismissed: 20, accept_rate: 0.5 });
    const reliableHigh = row({ agent_id: "r-high", accepted: 45, dismissed: 5, accept_rate: 0.9 });
    const lowSampleLow = row({ agent_id: "ls-low", accepted: 0, dismissed: 1, accept_rate: 0 });
    const lowSampleHigh = row({ agent_id: "ls-high", accepted: 1, dismissed: 0, accept_rate: 1 });

    const order = sortPerformanceRows([reliableLow, lowSampleLow, reliableHigh, lowSampleHigh], "acceptRate").map(
      (r) => r.agent_id,
    );
    expect(order).toEqual(["r-high", "r-low", "ls-high", "ls-low"]);
  });

  it("does not mutate the input array", () => {
    const rows = [row({ agent_id: "a", runs: 1 }), row({ agent_id: "b", runs: 5 })];
    const input = [...rows];
    sortPerformanceRows(rows, "runs");
    expect(rows).toEqual(input);
  });
});
