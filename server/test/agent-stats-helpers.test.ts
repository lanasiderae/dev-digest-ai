import { describe, expect, it } from 'vitest';
import { AgentStats, AgentPerf } from '@devdigest/shared';
import { resolveRange, toAgentStats, toAgentPerf } from '../src/modules/agent-stats/helpers.js';
import type { AgentStatsRawGroup } from '../src/modules/reviews/repository/stats.repo.js';
import type { AgentRunRow, FindingRow } from '../src/db/rows.js';

function run(overrides: Partial<AgentRunRow> = {}): AgentRunRow {
  return {
    id: 'run-1',
    workspaceId: 'ws-1',
    agentId: 'agent-1',
    prId: 'pr-1',
    ranAt: new Date('2026-01-01T00:00:00.000Z'),
    provider: 'openai',
    model: 'gpt-4.1',
    durationMs: 1000,
    tokensIn: 100000,
    tokensOut: 50000,
    status: 'done',
    error: null,
    source: 'local',
    findingsCount: 2,
    grounding: null,
    score: 80,
    blockers: 0,
    ...overrides,
  };
}

function finding(overrides: Partial<FindingRow> = {}): FindingRow {
  return {
    id: 'finding-1',
    reviewId: 'review-1',
    file: 'src/x.ts',
    startLine: 1,
    endLine: 1,
    severity: 'WARNING',
    category: 'bug',
    title: 'Example',
    rationale: 'because',
    suggestion: null,
    confidence: 0.8,
    kind: 'finding',
    trifectaComponents: null,
    matchedSkill: null,
    acceptedAt: null,
    dismissedAt: null,
    ...overrides,
  };
}

/** gpt-4.1 static pricing: in=$2.0/1M, out=$8.0/1M (src/adapters/llm/pricing.ts).
 *  100,000 in / 50,000 out → (100000*2 + 50000*8) / 1e6 = $0.60 exactly, chosen
 *  so per-run cost needs no rounding and reconciliation assertions are exact. */
const estimate = (model: string, tokensIn: number, tokensOut: number): number | null => {
  if (model !== 'gpt-4.1') return null;
  return (tokensIn * 2.0 + tokensOut * 8.0) / 1_000_000;
};

describe('resolveRange', () => {
  const now = () => new Date('2026-06-15T12:00:00.000Z');

  it('"1d" resolves to the last 24h from now', () => {
    const { from, to } = resolveRange({ preset: '1d' }, now);
    expect(to).toEqual(now());
    expect(from).toEqual(new Date('2026-06-14T12:00:00.000Z'));
  });

  it('"30d" resolves to the last 30x24h from now', () => {
    const { from, to } = resolveRange({ preset: '30d' }, now);
    expect(to).toEqual(now());
    expect(from).toEqual(new Date('2026-05-16T12:00:00.000Z'));
  });

  it('a custom from/to is used verbatim', () => {
    const { from, to } = resolveRange({ from: '2026-01-01T00:00:00.000Z', to: '2026-01-31T00:00:00.000Z' }, now);
    expect(from).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(to).toEqual(new Date('2026-01-31T00:00:00.000Z'));
  });

  it('defaults to the last 30 days when neither preset nor from/to is given', () => {
    const { from, to } = resolveRange({}, now);
    expect(to).toEqual(now());
    expect(from).toEqual(new Date('2026-05-16T12:00:00.000Z'));
  });

  it('rejects a custom range missing one side', () => {
    expect(() => resolveRange({ from: '2026-01-01T00:00:00.000Z' }, now)).toThrow(/requires both/);
  });

  it('rejects an invalid date', () => {
    expect(() => resolveRange({ from: 'not-a-date', to: '2026-01-31T00:00:00.000Z' }, now)).toThrow(/Invalid/);
  });

  it('rejects from > to', () => {
    expect(() =>
      resolveRange({ from: '2026-02-01T00:00:00.000Z', to: '2026-01-01T00:00:00.000Z' }, now),
    ).toThrow(/must not be after/);
  });
});

describe('toAgentStats', () => {
  it('a zero-run agent gets a valid AgentStats with runs:0 and every rate/avg null (AC-02)', () => {
    const stats = toAgentStats('agent-1', 'Security Reviewer', [], [], estimate);
    expect(() => AgentStats.parse(stats)).not.toThrow();
    expect(stats).toEqual({
      agent_id: 'agent-1',
      agent_name: 'Security Reviewer',
      runs: 0,
      findings_total: 0,
      accepted: 0,
      dismissed: 0,
      pending: 0,
      accept_rate: null,
      dismiss_rate: null,
      avg_findings_per_run: null,
      total_cost_usd: null,
      avg_cost_usd: null,
      avg_latency_ms: null,
      findings_by_severity: { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 },
      trend: [],
    });
  });

  it('computes accept-rate/cost/latency/severity over done runs + decided findings (AC-01)', () => {
    const runs = [
      run({ id: 'run-1', ranAt: new Date('2026-01-02T00:00:00.000Z'), durationMs: 1000 }),
      run({ id: 'run-2', ranAt: new Date('2026-01-01T00:00:00.000Z'), durationMs: 2000 }),
      // A failed run still counts toward `runs` but is excluded from cost/latency.
      run({
        id: 'run-3',
        ranAt: new Date('2026-01-03T00:00:00.000Z'),
        status: 'failed',
        tokensIn: 0,
        tokensOut: 0,
        durationMs: null,
        findingsCount: 0,
      }),
    ];
    const findings = [
      finding({ severity: 'CRITICAL', acceptedAt: new Date('2026-01-02T01:00:00.000Z') }),
      finding({ severity: 'WARNING', dismissedAt: new Date('2026-01-02T01:00:00.000Z') }),
      finding({ severity: 'SUGGESTION' }), // pending (never acted on)
      finding({ severity: 'WARNING', kind: 'summary' }), // not a decision-bearing finding, excluded
    ];

    const stats = toAgentStats('agent-1', 'Security Reviewer', runs, findings, estimate);
    expect(() => AgentStats.parse(stats)).not.toThrow();
    expect(stats.runs).toBe(3);
    expect(stats.findings_total).toBe(3);
    expect(stats.accepted).toBe(1);
    expect(stats.dismissed).toBe(1);
    expect(stats.pending).toBe(1);
    expect(stats.accept_rate).toBe(0.5);
    expect(stats.dismiss_rate).toBe(0.5);
    expect(stats.avg_findings_per_run).toBeCloseTo(1, 5); // 3 findings / 3 runs
    expect(stats.total_cost_usd).toBeCloseTo(1.2, 5); // two done runs @ $0.60 each
    expect(stats.avg_cost_usd).toBeCloseTo(0.6, 5);
    expect(stats.avg_latency_ms).toBe(1500); // avg of the two done runs only
    expect(stats.findings_by_severity).toEqual({ CRITICAL: 1, WARNING: 1, SUGGESTION: 1 });
    // Oldest -> newest.
    expect(stats.trend.map((p) => p.label)).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-01-02T00:00:00.000Z',
      '2026-01-03T00:00:00.000Z',
    ]);
  });

  it('never fabricates a $0.00/0% when no done run has a knowable cost', () => {
    const stats = toAgentStats(
      'agent-1',
      'Agent',
      [run({ status: 'failed', tokensIn: 0, tokensOut: 0 })],
      [],
      estimate,
    );
    expect(stats.total_cost_usd).toBeNull();
    expect(stats.avg_cost_usd).toBeNull();
    expect(stats.avg_latency_ms).toBeNull();
    expect(stats.accept_rate).toBeNull();
  });
});

describe('toAgentPerf', () => {
  it('an empty rawByAgent yields a valid empty-dashboard AgentPerf (AC-05)', () => {
    const perf = toAgentPerf([], estimate);
    expect(() => AgentPerf.parse(perf)).not.toThrow();
    expect(perf).toEqual({
      summary: { runs: 0, total_cost_usd: null, avg_accept_rate: null, most_active_agent: null },
      agents: [],
      cost_by_agent: [],
      cost_by_model: [],
    });
  });

  it('reconciles cost_by_agent/cost_by_model with summary.total_cost_usd and picks the most-active agent (AC-04)', () => {
    const raw: AgentStatsRawGroup[] = [
      {
        agentId: 'agent-1',
        agentName: 'Security Reviewer',
        provider: 'openai',
        model: 'gpt-4.1',
        runs: [
          run({ id: 'r1', agentId: 'agent-1', ranAt: new Date('2026-01-01T00:00:00.000Z') }),
          run({ id: 'r2', agentId: 'agent-1', ranAt: new Date('2026-01-02T00:00:00.000Z') }),
        ],
        findings: [
          finding({ reviewId: 'rev-1', acceptedAt: new Date() }),
          finding({ reviewId: 'rev-1', dismissedAt: new Date() }),
        ],
      },
      {
        agentId: 'agent-2',
        agentName: 'Style Reviewer',
        provider: 'openai',
        model: 'gpt-4.1',
        runs: [run({ id: 'r3', agentId: 'agent-2', ranAt: new Date('2026-01-03T00:00:00.000Z') })],
        findings: [finding({ reviewId: 'rev-2', acceptedAt: new Date() })],
      },
    ];

    const perf = toAgentPerf(raw, estimate);
    expect(() => AgentPerf.parse(perf)).not.toThrow();
    expect(perf.summary.runs).toBe(3);
    // agent-1 has 2 runs (most active); tie-break by last_run_at not needed here.
    expect(perf.summary.most_active_agent).toBe('Security Reviewer');

    const sumSegments = (segs: { value: number }[]) => segs.reduce((s, x) => s + x.value, 0);
    expect(sumSegments(perf.cost_by_agent)).toBeCloseTo(perf.summary.total_cost_usd!, 2);
    expect(sumSegments(perf.cost_by_model)).toBeCloseTo(perf.summary.total_cost_usd!, 2);
    // One model (gpt-4.1) used throughout.
    expect(perf.cost_by_model).toEqual([{ label: 'gpt-4.1', value: perf.summary.total_cost_usd }]);
  });

  it('breaks a tied run count by most-recent last_run_at', () => {
    const raw: AgentStatsRawGroup[] = [
      {
        agentId: 'agent-older',
        agentName: 'Older',
        provider: null,
        model: null,
        runs: [run({ id: 'r1', agentId: 'agent-older', ranAt: new Date('2026-01-01T00:00:00.000Z') })],
        findings: [],
      },
      {
        agentId: 'agent-newer',
        agentName: 'Newer',
        provider: null,
        model: null,
        runs: [run({ id: 'r2', agentId: 'agent-newer', ranAt: new Date('2026-02-01T00:00:00.000Z') })],
        findings: [],
      },
    ];
    expect(toAgentPerf(raw, estimate).summary.most_active_agent).toBe('Newer');
  });

  it('reconciles exactly even when per-agent subtotals straddle a rounding boundary', () => {
    // Regression for a real double-rounding bug: summing already-rounded
    // per-agent totals (then rounding again) drifted from cost_by_model's
    // single rounding by a whole cent on ordinary, non-contrived costs.
    // $0.0075/run * 2 runs = $0.015 raw per agent, which round2() alone
    // pushes to $0.02 — summing two of those "$0.04"s is the bug; summing
    // the $0.03 raw total once is correct.
    const subCentEstimate = (): number => 0.0075;
    const raw: AgentStatsRawGroup[] = [
      {
        agentId: 'agent-1',
        agentName: 'Agent A',
        provider: 'openai',
        model: 'gpt-4.1',
        runs: [
          run({ id: 'r1', agentId: 'agent-1', ranAt: new Date('2026-01-01T00:00:00.000Z') }),
          run({ id: 'r2', agentId: 'agent-1', ranAt: new Date('2026-01-01T01:00:00.000Z') }),
        ],
        findings: [],
      },
      {
        agentId: 'agent-2',
        agentName: 'Agent B',
        provider: 'openai',
        model: 'gpt-4.1',
        runs: [
          run({ id: 'r3', agentId: 'agent-2', ranAt: new Date('2026-01-01T02:00:00.000Z') }),
          run({ id: 'r4', agentId: 'agent-2', ranAt: new Date('2026-01-01T03:00:00.000Z') }),
        ],
        findings: [],
      },
    ];

    const perf = toAgentPerf(raw, subCentEstimate);
    expect(perf.summary.total_cost_usd).toBe(0.03);
    const sumSegments = (segs: { value: number }[]) => segs.reduce((s, x) => s + x.value, 0);
    expect(sumSegments(perf.cost_by_agent)).toBe(0.03);
    expect(sumSegments(perf.cost_by_model)).toBe(0.03);
  });
});
