/**
 * PR-list rollup helpers (`modules/pulls/status.ts`) — the pure derivation that
 * decides each PR's review STATUS and tallies its FINDINGS for the list. The DB
 * `status` column holds GitHub's merge state; the review status
 * (needs_review / reviewed / stale) is derived here from head vs lastReviewedSha
 * + age, so it gets unit coverage independent of the route's queries.
 */
import { describe, it, expect } from 'vitest';
import {
  deriveReviewStatus,
  latestReviewPerAgent,
  rollupSeverities,
  STALE_DAYS,
} from '../src/modules/pulls/status.js';

const DAY = 86_400_000;
const now = Date.UTC(2026, 5, 11);

describe('deriveReviewStatus', () => {
  it('needs_review when never reviewed, or when head moved since the last review', () => {
    expect(
      deriveReviewStatus({ ghStatus: 'open', lastReviewedSha: null, headSha: 'abc', updatedAt: new Date(now), now }),
    ).toBe('needs_review');
    expect(
      deriveReviewStatus({ ghStatus: 'open', lastReviewedSha: 'old', headSha: 'abc', updatedAt: new Date(now), now }),
    ).toBe('needs_review');
  });

  it('reviewed when the current head was reviewed and the PR is recent', () => {
    expect(
      deriveReviewStatus({ ghStatus: 'open', lastReviewedSha: 'abc', headSha: 'abc', updatedAt: new Date(now - DAY), now }),
    ).toBe('reviewed');
  });

  it('stale when the current head was reviewed but the PR is older than STALE_DAYS', () => {
    expect(
      deriveReviewStatus({
        ghStatus: 'open',
        lastReviewedSha: 'abc',
        headSha: 'abc',
        updatedAt: new Date(now - (STALE_DAYS + 1) * DAY),
        now,
      }),
    ).toBe('stale');
  });

  it('keeps merged/closed regardless of review state', () => {
    expect(
      deriveReviewStatus({ ghStatus: 'merged', lastReviewedSha: null, headSha: 'abc', updatedAt: null, now }),
    ).toBe('merged');
    expect(
      deriveReviewStatus({ ghStatus: 'closed', lastReviewedSha: 'abc', headSha: 'abc', updatedAt: new Date(now), now }),
    ).toBe('closed');
  });
});

describe('rollupSeverities', () => {
  it('tallies findings into critical / warning / suggestion buckets (ignores unknown)', () => {
    expect(
      rollupSeverities([
        { severity: 'CRITICAL' },
        { severity: 'CRITICAL' },
        { severity: 'WARNING' },
        { severity: 'SUGGESTION' },
        { severity: 'WEIRD' },
      ]),
    ).toEqual({ critical: 2, warning: 1, suggestion: 1 });
  });

  it('is all-zero for no findings', () => {
    expect(rollupSeverities([])).toEqual({ critical: 0, warning: 0, suggestion: 0 });
  });
});

describe('latestReviewPerAgent', () => {
  // Input is always ordered newest-first, as the route's query returns it.
  const rows = (
    ...ids: [id: string, prId: string, agentId: string | null][]
  ): { id: string; prId: string; agentId: string | null }[] =>
    ids.map(([id, prId, agentId]) => ({ id, prId, agentId }));

  it("keeps one review per agent — every agent that reviewed the PR counts", () => {
    const byPr = latestReviewPerAgent(
      rows(['r3', 'pr1', 'security'], ['r2', 'pr1', 'perf'], ['r1', 'pr1', 'style']),
    );
    expect(byPr.get('pr1')!.map((r) => r.id)).toEqual(['r3', 'r2', 'r1']);
  });

  it("drops an agent's superseded re-runs, so its findings never double-count", () => {
    // 'security' reviewed twice; only its newest (r4) may contribute.
    const byPr = latestReviewPerAgent(
      rows(['r4', 'pr1', 'security'], ['r3', 'pr1', 'perf'], ['r2', 'pr1', 'security']),
    );
    expect(byPr.get('pr1')!.map((r) => r.id)).toEqual(['r4', 'r3']);
  });

  it('collapses all null-agent reviews into one entry (latest-review-only, as before)', () => {
    const byPr = latestReviewPerAgent(rows(['r2', 'pr1', null], ['r1', 'pr1', null]));
    expect(byPr.get('pr1')!.map((r) => r.id)).toEqual(['r2']);
  });

  it('treats a null agent as distinct from a named one, not as a duplicate', () => {
    const byPr = latestReviewPerAgent(rows(['r2', 'pr1', null], ['r1', 'pr1', 'security']));
    expect(byPr.get('pr1')!.map((r) => r.id)).toEqual(['r2', 'r1']);
  });

  it('keys per (PR, agent) — one agent reviewing two PRs contributes to both', () => {
    const byPr = latestReviewPerAgent(rows(['r2', 'pr2', 'security'], ['r1', 'pr1', 'security']));
    expect(byPr.get('pr1')!.map((r) => r.id)).toEqual(['r1']);
    expect(byPr.get('pr2')!.map((r) => r.id)).toEqual(['r2']);
  });

  it('has no entry for a PR with no reviews', () => {
    expect(latestReviewPerAgent([]).size).toBe(0);
    expect(latestReviewPerAgent(rows(['r1', 'pr1', 'security'])).has('pr2')).toBe(false);
  });
});
