/**
 * `blast/service.ts`'s head-sha line correction — the fix for caller `line`s
 * being recorded against `repo_index_state.last_indexed_sha` while the UI/
 * MCP tool link every caller to the PR's `head_sha`. These tests assert the
 * WIRING (when the correction runs, when it's skipped, how it degrades),
 * not the line-mapping arithmetic itself — see `blast-line-mapping.test.ts`
 * for that.
 */
import { describe, it, expect } from 'vitest';
import { getBlastRadius } from '../src/modules/blast/service.js';
import { MockGitClient } from '../src/adapters/mocks.js';
import { parseUnifiedDiff } from '../src/adapters/git/diff-parser.js';
import type { BlastResult, IndexState } from '../src/modules/repo-intel/types.js';
import type { Container } from '../src/platform/container.js';
import type { PullRow } from '../src/db/rows.js';

function pull(overrides: Partial<PullRow> = {}): PullRow {
  return {
    id: 'pr-1',
    workspaceId: 'ws-1',
    repoId: 'repo-1',
    number: 42,
    title: 'Add a feature',
    author: 'dev',
    branch: 'feat/x',
    base: 'main',
    headSha: 'head-sha',
    lastReviewedSha: null,
    additions: 1,
    deletions: 0,
    filesCount: 1,
    status: 'needs_review',
    body: null,
    openedAt: null,
    updatedAt: null,
    ...overrides,
  } as PullRow;
}

function indexState(overrides: Partial<IndexState> = {}): IndexState {
  return {
    repoId: 'repo-1',
    status: 'full',
    filesIndexed: 1,
    filesSkipped: 0,
    durationMs: 1,
    lastIndexedSha: 'indexed-sha',
    indexerVersion: 1,
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeContainer(opts: {
  pull: PullRow;
  blast: BlastResult;
  state: IndexState;
  git: MockGitClient;
  repo?: { owner: string; name: string } | null;
}): Container {
  return {
    git: opts.git,
    reviewRepo: {
      getPull: async () => opts.pull,
      getPrFiles: async () => [{ path: 'a.ts' }],
      getRepo: async () => ('repo' in opts ? opts.repo : { owner: 'acme', name: 'widgets' }),
    },
    repoIntel: {
      getBlastRadius: async () => opts.blast,
      getIndexState: async () => opts.state,
    },
  } as unknown as Container;
}

const BLAST: BlastResult = {
  changedSymbols: [{ file: 'a.ts', name: 'rateLimit', kind: 'function' }],
  callers: [{ file: 'b.ts', symbol: 'caller', viaSymbol: 'rateLimit', line: 10, rank: 1 }],
  impactedEndpoints: [],
  degraded: false,
};

const INSERT_3_AT_5 =
  'diff --git a/b.ts b/b.ts\n--- a/b.ts\n+++ b/b.ts\n@@ -5,0 +6,3 @@\n+x\n+y\n+z\n';

describe('getBlastRadius head-sha line correction', () => {
  it('shifts a caller line forward using the direct base..head diff', async () => {
    const git = new MockGitClient({ diffDirect: INSERT_3_AT_5 });
    const container = makeContainer({ pull: pull(), blast: BLAST, state: indexState(), git });

    const res = await getBlastRadius(container, 'ws-1', 'pr-1');

    expect(res.blast.downstream[0]!.callers[0]!.line).toBe(13); // 10 -> +3
  });

  it('skips correction entirely when the index has no lastIndexedSha', async () => {
    const git = new MockGitClient({ diffDirect: INSERT_3_AT_5 });
    let diffCalled = false;
    git.diffDirect = async () => {
      diffCalled = true;
      throw new Error('should not be called');
    };
    const container = makeContainer({
      pull: pull(),
      blast: BLAST,
      state: indexState({ lastIndexedSha: '' }),
      git,
    });

    const res = await getBlastRadius(container, 'ws-1', 'pr-1');

    expect(res.blast.downstream[0]!.callers[0]!.line).toBe(10); // unchanged
    expect(diffCalled).toBe(false);
  });

  it('skips correction when the index is already at the PR head sha', async () => {
    const git = new MockGitClient({});
    let diffCalled = false;
    git.diffDirect = async () => {
      diffCalled = true;
      throw new Error('should not be called');
    };
    const container = makeContainer({
      pull: pull({ headSha: 'same-sha' }),
      blast: BLAST,
      state: indexState({ lastIndexedSha: 'same-sha' }),
      git,
    });

    await getBlastRadius(container, 'ws-1', 'pr-1');

    expect(diffCalled).toBe(false);
  });

  it('skips correction when there are no callers to correct', async () => {
    const git = new MockGitClient({});
    let diffCalled = false;
    git.diffDirect = async () => {
      diffCalled = true;
      throw new Error('should not be called');
    };
    const container = makeContainer({
      pull: pull(),
      blast: { ...BLAST, callers: [] },
      state: indexState(),
      git,
    });

    await getBlastRadius(container, 'ws-1', 'pr-1');

    expect(diffCalled).toBe(false);
  });

  it('fetches the PR head once and retries when the head sha is not yet reachable', async () => {
    const git = new MockGitClient({});
    let attempts = 0;
    let fetched = false;
    git.fetchPullHead = async () => {
      fetched = true;
    };
    git.diffDirect = async () => {
      attempts += 1;
      if (attempts === 1) throw new Error('unknown revision');
      return parseUnifiedDiff(INSERT_3_AT_5);
    };

    const container = makeContainer({ pull: pull(), blast: BLAST, state: indexState(), git });

    const res = await getBlastRadius(container, 'ws-1', 'pr-1');

    expect(fetched).toBe(true);
    expect(attempts).toBe(2);
    expect(res.blast.downstream[0]!.callers[0]!.line).toBe(13);
  });

  it('keeps the indexed line when the head sha is unreachable even after fetching', async () => {
    const git = new MockGitClient({});
    git.diffDirect = async () => {
      throw new Error('unknown revision');
    };
    const container = makeContainer({ pull: pull(), blast: BLAST, state: indexState(), git });

    const res = await getBlastRadius(container, 'ws-1', 'pr-1');

    expect(res.blast.downstream[0]!.callers[0]!.line).toBe(10); // unchanged, no throw
  });

  it('keeps the indexed line when the repo basics lookup comes back empty', async () => {
    const git = new MockGitClient({ diffDirect: INSERT_3_AT_5 });
    const container = makeContainer({ pull: pull(), blast: BLAST, state: indexState(), git, repo: null });

    const res = await getBlastRadius(container, 'ws-1', 'pr-1');

    expect(res.blast.downstream[0]!.callers[0]!.line).toBe(10); // unchanged
  });
});
