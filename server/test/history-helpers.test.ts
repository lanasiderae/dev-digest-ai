import { describe, expect, it } from 'vitest';
import { PrHistoryItem } from '@devdigest/shared';
import { sortByOverlap, toPrHistoryItem } from '../src/modules/history/helpers.js';
import type { PriorPrOverlap } from '../src/modules/reviews/repository/pull.repo.js';
import type { PullRow } from '../src/db/rows.js';

function pull(overrides: Partial<PullRow> = {}): PullRow {
  return {
    id: 'pr-1',
    workspaceId: 'ws-1',
    repoId: 'repo-1',
    number: 7,
    title: 'Add rate limiting',
    author: 'dev',
    branch: 'feat/x',
    base: 'main',
    headSha: 'deadbeef',
    lastReviewedSha: null,
    additions: 10,
    deletions: 2,
    filesCount: 1,
    status: 'merged',
    body: null,
    openedAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  };
}

describe('toPrHistoryItem', () => {
  it('maps a prior-PR overlap into the wire shape, deduping/sorting the overlap paths', () => {
    const overlap: PriorPrOverlap = {
      pr: pull(),
      overlapPaths: ['b.ts', 'a.ts', 'a.ts'],
    };
    const item = toPrHistoryItem(overlap);
    expect(() => PrHistoryItem.parse(item)).not.toThrow();
    expect(item).toEqual({
      pr_number: 7,
      title: 'Add rate limiting',
      merged_at: '2026-01-02T00:00:00.000Z',
      author: 'dev',
      files_overlap: ['a.ts', 'a.ts', 'b.ts'],
      notes: '',
    });
  });

  it('falls back to opened_at when updated_at is missing, then to an empty string', () => {
    const withoutUpdatedAt = toPrHistoryItem({
      pr: pull({ updatedAt: null }),
      overlapPaths: ['a.ts'],
    });
    expect(withoutUpdatedAt.merged_at).toBe('2026-01-01T00:00:00.000Z');

    const withoutEither = toPrHistoryItem({
      pr: pull({ updatedAt: null, openedAt: null }),
      overlapPaths: ['a.ts'],
    });
    expect(withoutEither.merged_at).toBe('');
  });

  it('never fabricates commentary — notes is always empty', () => {
    const item = toPrHistoryItem({ pr: pull(), overlapPaths: ['a.ts'] });
    expect(item.notes).toBe('');
  });
});

describe('sortByOverlap', () => {
  it('orders by overlap-path count descending', () => {
    const fewer: PriorPrOverlap = { pr: pull({ id: 'pr-fewer' }), overlapPaths: ['a.ts'] };
    const more: PriorPrOverlap = { pr: pull({ id: 'pr-more' }), overlapPaths: ['a.ts', 'b.ts'] };
    expect(sortByOverlap([fewer, more]).map((o) => o.pr.id)).toEqual(['pr-more', 'pr-fewer']);
  });

  it('breaks a tied overlap count by most-recently-updated first', () => {
    const older: PriorPrOverlap = {
      pr: pull({ id: 'pr-older', updatedAt: new Date('2026-01-01T00:00:00.000Z') }),
      overlapPaths: ['a.ts'],
    };
    const newer: PriorPrOverlap = {
      pr: pull({ id: 'pr-newer', updatedAt: new Date('2026-02-01T00:00:00.000Z') }),
      overlapPaths: ['a.ts'],
    };
    expect(sortByOverlap([older, newer]).map((o) => o.pr.id)).toEqual(['pr-newer', 'pr-older']);
  });

  it('does not mutate the input array', () => {
    const a: PriorPrOverlap = { pr: pull({ id: 'a' }), overlapPaths: ['x.ts'] };
    const b: PriorPrOverlap = { pr: pull({ id: 'b' }), overlapPaths: ['x.ts', 'y.ts'] };
    const input = [a, b];
    sortByOverlap(input);
    expect(input).toEqual([a, b]);
  });
});
