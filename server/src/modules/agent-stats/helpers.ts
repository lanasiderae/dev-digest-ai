/**
 * Pure helpers for the agent-stats module (side-effect free; no DB/network).
 * Unit-tested without Postgres — see `helpers.test.ts`.
 */
import { ValidationError } from '../../platform/errors.js';
import { computeRunCost } from '../reviews/helpers.js';
import type { AgentStatsRawGroup } from '../reviews/repository.js';
import type { AgentRunRow, FindingRow } from '../../db/rows.js';
import type { AgentStats, AgentPerf, AgentPerfRow, PerfCostSegment, StatPoint } from '@devdigest/shared';
import { ONE_DAY_MS, THIRTY_DAYS_MS } from './constants.js';

export type Estimate = (model: string, tokensIn: number, tokensOut: number) => number | null;

export interface RangeInput {
  preset?: '1d' | '30d';
  from?: string;
  to?: string;
}

/**
 * The ONE range-resolution rule both routes call (spec's "Data and
 * aggregation rules — Range resolution"): `1d` = last 24h from `now()`,
 * `30d` = last 30×24h, `custom` = the caller's inclusive `[from, to]` ISO
 * timestamps. Neither preset nor from/to given defaults to the last 30 days
 * (matches the dashboard/Stats tab's own default range control).
 */
export function resolveRange(input: RangeInput, now: () => Date = () => new Date()): { from: Date; to: Date } {
  if (input.preset === '1d') {
    const to = now();
    return { from: new Date(to.getTime() - ONE_DAY_MS), to };
  }
  if (input.preset === '30d') {
    const to = now();
    return { from: new Date(to.getTime() - THIRTY_DAYS_MS), to };
  }
  if (input.from != null || input.to != null) {
    if (!input.from || !input.to) {
      throw new ValidationError('Custom range requires both "from" and "to"');
    }
    const from = new Date(input.from);
    const to = new Date(input.to);
    if (Number.isNaN(from.getTime())) throw new ValidationError('Invalid "from" date');
    if (Number.isNaN(to.getTime())) throw new ValidationError('Invalid "to" date');
    if (from.getTime() > to.getTime()) throw new ValidationError('"from" must not be after "to"');
    return { from, to };
  }
  const to = now();
  return { from: new Date(to.getTime() - THIRTY_DAYS_MS), to };
}

function sum(values: number[]): number {
  return values.reduce((s, v) => s + v, 0);
}

/** Round to cents — costs are an estimate, not a reconciled invoice, but
 *  floating noise beyond 2dp is never meaningful here. */
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

interface Aggregate {
  runs: number;
  findingsTotal: number;
  accepted: number;
  dismissed: number;
  pending: number;
  acceptRate: number | null;
  dismissRate: number | null;
  avgFindingsPerRun: number | null;
  totalCostUsd: number | null;
  avgCostUsd: number | null;
  avgLatencyMs: number | null;
  findingsBySeverity: { CRITICAL: number; WARNING: number; SUGGESTION: number };
}

/**
 * The shared aggregation math behind BOTH `toAgentStats` (one agent) and
 * `toAgentPerf`'s per-agent rows — one implementation so "reuse the same
 * aggregation rules" (brief, Part 5) is structural, not just a convention.
 *
 * Run universe rule: every run counts toward `runs` (the denominator must be
 * honest about what was attempted, including failures), but only
 * `status === 'done'` runs feed cost/latency (matches `computeRunCost`'s own
 * `status !== 'done' → null` rule — averaging a null is meaningless, not 0).
 * Accept-rate denominator: `accepted + dismissed` findings only; `pending`
 * is reported but never counted in the rate.
 */
function aggregate(rawRuns: AgentRunRow[], rawFindings: FindingRow[], estimate: Estimate): Aggregate {
  const runs = rawRuns.length;
  const doneRuns = rawRuns.filter((r) => r.status === 'done');
  const costs = doneRuns
    .map((r) => computeRunCost(estimate, r))
    .filter((c): c is number => c != null);
  const durations = doneRuns.map((r) => r.durationMs).filter((d): d is number => d != null);

  const decisionFindings = rawFindings.filter((f) => f.kind === 'finding');
  const accepted = decisionFindings.filter((f) => f.acceptedAt != null).length;
  const dismissed = decisionFindings.filter((f) => f.dismissedAt != null).length;
  const pending = decisionFindings.length - accepted - dismissed;
  const decisions = accepted + dismissed;

  const findingsBySeverity = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
  for (const f of decisionFindings) {
    if (f.severity === 'CRITICAL' || f.severity === 'WARNING' || f.severity === 'SUGGESTION') {
      findingsBySeverity[f.severity]++;
    }
  }

  return {
    runs,
    findingsTotal: decisionFindings.length,
    accepted,
    dismissed,
    pending,
    acceptRate: decisions > 0 ? round4(accepted / decisions) : null,
    dismissRate: decisions > 0 ? round4(dismissed / decisions) : null,
    avgFindingsPerRun: runs > 0 ? round4(decisionFindings.length / runs) : null,
    totalCostUsd: costs.length > 0 ? round2(sum(costs)) : null,
    avgCostUsd: costs.length > 0 ? round2(sum(costs) / costs.length) : null,
    avgLatencyMs: durations.length > 0 ? Math.round(sum(durations) / durations.length) : null,
    findingsBySeverity,
  };
}

/** Oldest→newest per-run findings count — `agent_runs.findings_count` is
 *  already persisted per run (by `completeAgentRun`), so no extra join is
 *  needed to build the sparkline. */
function buildTrend(rawRuns: AgentRunRow[]): StatPoint[] {
  return [...rawRuns]
    .sort((a, b) => a.ranAt.getTime() - b.ranAt.getTime())
    .map((r) => ({ label: r.ranAt.toISOString(), value: r.findingsCount ?? 0 }));
}

function buildNumericTrend(rawRuns: AgentRunRow[]): number[] {
  return [...rawRuns].sort((a, b) => a.ranAt.getTime() - b.ranAt.getTime()).map((r) => r.findingsCount ?? 0);
}

function lastRunAt(rawRuns: AgentRunRow[]): string | null {
  if (rawRuns.length === 0) return null;
  return rawRuns.reduce((latest, r) => (r.ranAt > latest ? r.ranAt : latest), rawRuns[0]!.ranAt).toISOString();
}

/**
 * `GET /agents/:id/stats`'s DTO builder. Zero-run case (AC-02) still returns
 * a fully valid `AgentStats` — `runs: 0` and every rate/avg field `null`,
 * never a fabricated `0`/`NaN`.
 */
export function toAgentStats(
  agentId: string,
  agentName: string,
  rawRuns: AgentRunRow[],
  rawFindings: FindingRow[],
  estimate: Estimate,
): AgentStats {
  const agg = aggregate(rawRuns, rawFindings, estimate);
  return {
    agent_id: agentId,
    agent_name: agentName,
    runs: agg.runs,
    findings_total: agg.findingsTotal,
    accepted: agg.accepted,
    dismissed: agg.dismissed,
    pending: agg.pending,
    accept_rate: agg.acceptRate,
    dismiss_rate: agg.dismissRate,
    avg_findings_per_run: agg.avgFindingsPerRun,
    total_cost_usd: agg.totalCostUsd,
    avg_cost_usd: agg.avgCostUsd,
    avg_latency_ms: agg.avgLatencyMs,
    findings_by_severity: agg.findingsBySeverity,
    trend: buildTrend(rawRuns),
  };
}

/**
 * `GET /agents/performance`'s DTO builder. Empty case (AC-05, no agent has
 * any run in range) returns `{ summary: { runs: 0, total_cost_usd: null,
 * avg_accept_rate: null, most_active_agent: null }, agents: [],
 * cost_by_agent: [], cost_by_model: [] }` — `rawByAgent` is `[]` by
 * construction whenever nothing matched (the repository only ever groups
 * agents that already have ≥1 run in range), so this falls out naturally
 * rather than needing a special case here.
 */
export function toAgentPerf(rawByAgent: AgentStatsRawGroup[], estimate: Estimate): AgentPerf {
  const rows: AgentPerfRow[] = rawByAgent.map((g) => {
    const agg = aggregate(g.runs, g.findings, estimate);
    return {
      agent_id: g.agentId,
      agent_name: g.agentName,
      provider: g.provider,
      model: g.model,
      runs: agg.runs,
      findings_total: agg.findingsTotal,
      accepted: agg.accepted,
      dismissed: agg.dismissed,
      accept_rate: agg.acceptRate,
      dismiss_rate: agg.dismissRate,
      avg_findings_per_run: agg.avgFindingsPerRun,
      total_cost_usd: agg.totalCostUsd,
      avg_cost_usd: agg.avgCostUsd,
      avg_latency_ms: agg.avgLatencyMs,
      last_run_at: lastRunAt(g.runs),
      findings_by_severity: agg.findingsBySeverity,
      trend: buildNumericTrend(g.runs),
    };
  });

  const runs = sum(rows.map((r) => r.runs));

  // Weighted (not averaged-of-averages) so a handful of low-sample agents
  // can't skew the headline number as much as the agents with real volume —
  // same "accepted+dismissed only" denominator rule as every per-row rate.
  const totalAccepted = sum(rows.map((r) => r.accepted));
  const totalDismissed = sum(rows.map((r) => r.dismissed));
  const totalDecisions = totalAccepted + totalDismissed;
  const avg_accept_rate = totalDecisions > 0 ? round4(totalAccepted / totalDecisions) : null;

  const most_active_agent = pickMostActive(rows);

  // `total_cost_usd` is the single source of truth: round the flat raw sum
  // ONCE. `cost_by_agent`/`cost_by_model` must each independently round a
  // per-group subtotal to display it (that's what a "breakdown" is) — but
  // rounding every subtotal on its own, same-direction, can land the
  // segment sum a whole cent or more away from that total (two agents each
  // summing to a raw $0.015 round to $0.02 apiece = $0.04, while the same
  // $0.03 raw grand total rounds once to $0.03). That's not floating-point
  // noise, it's "sum of independently-rounded parts != round of the sum" —
  // unavoidable with plain per-segment rounding, so both breakdowns use
  // largest-remainder apportionment (`allocateCents`) instead: round every
  // segment down to the cent, then hand the few leftover pennies to the
  // segments with the largest fractional remainder, until the segments sum
  // EXACTLY to `total_cost_usd` (AC-04), not just approximately.
  const rawCostByAgent = buildRawCostByAgent(rawByAgent, estimate);
  const totalRaw = sum([...rawCostByAgent.values()].map((a) => a.raw));
  const total_cost_usd = rawCostByAgent.size > 0 ? round2(totalRaw) : null;

  const cost_by_agent: PerfCostSegment[] =
    total_cost_usd != null
      ? allocateCents(
          [...rawCostByAgent.values()].map((a) => ({ label: a.name, raw: a.raw })),
          total_cost_usd,
        ).sort((a, b) => b.value - a.value)
      : [];

  const cost_by_model = buildCostByModel(rawByAgent, estimate, total_cost_usd);

  return {
    summary: { runs, total_cost_usd, avg_accept_rate, most_active_agent },
    agents: rows,
    cost_by_agent,
    cost_by_model,
  };
}

/** Highest `runs`; ties broken by most recent `last_run_at` (spec rule). */
function pickMostActive(rows: AgentPerfRow[]): string | null {
  let best: AgentPerfRow | null = null;
  for (const r of rows) {
    if (r.runs === 0) continue;
    if (!best) {
      best = r;
      continue;
    }
    if (r.runs > best.runs) {
      best = r;
      continue;
    }
    if (r.runs === best.runs) {
      const rLast = r.last_run_at ? Date.parse(r.last_run_at) : -Infinity;
      const bLast = best.last_run_at ? Date.parse(best.last_run_at) : -Infinity;
      if (rLast > bLast) best = r;
    }
  }
  return best?.agent_name ?? null;
}

/**
 * Cost grouped by the model each run actually used (`agent_runs.model`, not
 * the agent's current config, which may have changed since) — built from
 * the SAME per-run costs as `cost_by_agent`/`summary.total_cost_usd`, with
 * the same `allocateCents` apportionment so its segments sum EXACTLY to
 * `totalCostUsd` (AC-04), not just approximately.
 */
function buildCostByModel(
  rawByAgent: AgentStatsRawGroup[],
  estimate: Estimate,
  totalCostUsd: number | null,
): PerfCostSegment[] {
  if (totalCostUsd == null) return [];
  const byModel = new Map<string, number>();
  for (const g of rawByAgent) {
    for (const r of g.runs) {
      const cost = computeRunCost(estimate, r);
      if (cost == null) continue;
      const key = r.model ?? 'unknown';
      byModel.set(key, (byModel.get(key) ?? 0) + cost);
    }
  }
  const entries = [...byModel.entries()].map(([label, raw]) => ({ label, raw }));
  return allocateCents(entries, totalCostUsd).sort((a, b) => b.value - a.value);
}

/**
 * Largest-remainder apportionment: splits `totalUsd` (already `round2`'d)
 * across `entries` by their raw (unrounded) share, so the returned
 * segments sum to EXACTLY `totalUsd` rather than each segment rounding
 * independently and landing the sum a cent or more off. Standard method
 * for "parts that must sum to a rounded whole" (the same approach used to
 * apportion seats/percentages): round every entry down to the cent, then
 * hand the few leftover pennies (`totalCents - sum of floors`) to the
 * entries with the largest fractional remainder, one cent each.
 */
function allocateCents(entries: { label: string; raw: number }[], totalUsd: number): PerfCostSegment[] {
  const totalCents = Math.round(totalUsd * 100);
  const withRemainders = entries.map((e) => {
    const exactCents = e.raw * 100;
    const floorCents = Math.floor(exactCents);
    return { label: e.label, floorCents, remainder: exactCents - floorCents };
  });
  const flooredTotal = sum(withRemainders.map((e) => e.floorCents));
  let leftoverCents = totalCents - flooredTotal;

  const byRemainderDesc = [...withRemainders].sort((a, b) => b.remainder - a.remainder);
  return byRemainderDesc.map((e) => {
    const bonus = leftoverCents > 0 ? 1 : 0;
    if (leftoverCents > 0) leftoverCents--;
    return { label: e.label, value: round2((e.floorCents + bonus) / 100) };
  });
}

/**
 * Per-agent raw (unrounded) cost sums — the single source `cost_by_agent`
 * and `summary.total_cost_usd` both round from, mirroring `buildCostByModel`'s
 * own single-rounding-from-raw shape so neither grouping double-rounds.
 * Same implicit `computeRunCost` → `null` filter for non-`done`/uncosted
 * runs as `buildCostByModel` and `aggregate()`.
 */
function buildRawCostByAgent(
  rawByAgent: AgentStatsRawGroup[],
  estimate: Estimate,
): Map<string, { name: string; raw: number }> {
  const byAgent = new Map<string, { name: string; raw: number }>();
  for (const g of rawByAgent) {
    let raw = 0;
    let hasCost = false;
    for (const r of g.runs) {
      const cost = computeRunCost(estimate, r);
      if (cost == null) continue;
      raw += cost;
      hasCost = true;
    }
    if (hasCost) byAgent.set(g.agentId, { name: g.agentName, raw });
  }
  return byAgent;
}
