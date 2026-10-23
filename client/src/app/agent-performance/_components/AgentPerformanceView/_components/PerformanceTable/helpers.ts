import type { AgentPerfRow } from "@devdigest/shared";
import { MIN_DECISIONS_FOR_RATE } from "./constants";

export type SortKey = "runs" | "acceptRate" | "cost";

/** AC-08 — fewer than `MIN_DECISIONS_FOR_RATE` accepted+dismissed decisions
 *  means `accept_rate` is still a real number (never excluded), but too
 *  thin a sample to rank at face value. */
export function isLowSample(row: AgentPerfRow): boolean {
  return row.accepted + row.dismissed < MIN_DECISIONS_FOR_RATE;
}

/**
 * Sort rows for display. `runs`/`cost` are plain numeric sorts (nulls last).
 * `acceptRate` (AC-08) sorts the RELIABLE rows by accept_rate DESC first,
 * then segregates every low-sample row to the bottom (itself sorted by
 * accept_rate DESC for a stable secondary order) — never interleaved with
 * the reliable rows, so a 100%-on-1-decision row can't outrank a
 * 70%-on-50-decisions row.
 */
export function sortPerformanceRows(rows: AgentPerfRow[], sort: SortKey): AgentPerfRow[] {
  const copy = [...rows];
  if (sort === "runs") return copy.sort((a, b) => b.runs - a.runs);
  if (sort === "cost") {
    return copy.sort((a, b) => (b.total_cost_usd ?? -1) - (a.total_cost_usd ?? -1));
  }
  const byRateDesc = (a: AgentPerfRow, b: AgentPerfRow) => (b.accept_rate ?? -1) - (a.accept_rate ?? -1);
  const reliable = copy.filter((r) => !isLowSample(r)).sort(byRateDesc);
  const lowSample = copy.filter(isLowSample).sort(byRateDesc);
  return [...reliable, ...lowSample];
}
