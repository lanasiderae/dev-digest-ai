/**
 * L05 TASK-07 — `getRankedFilesWithHotness` facade method.
 *
 * Mocks `RepoIntelRepository` the same way `repo-intel-facade-degraded.test.ts`
 * does (patch `(svc as unknown as { repo }).repo` with a plain object), so
 * these stay hermetic unit tests with no Postgres/Docker involvement.
 *
 * Evidence this file proves (per plan.md TASK-07's Evidence line):
 *   (a) no parser/reindex/refresh invocation happens as a side effect
 *   (b) incomplete-index states (missing/degraded/failed/partial) are
 *       reported truthfully, distinguishing partial (still usable) from
 *       degraded/failed (not usable) per the established `tryGetIndexState`
 *       convention
 *   (c) DB reads are bounded (asserts the exact LIMIT passed, never
 *       unbounded)
 *   (d) deterministic tie-breaking (lexicographic path) and explicit
 *       `hotnessAvailable` disclosure, in both directions
 */
import { describe, it, expect, vi } from 'vitest';
import { RepoIntelService } from '../src/modules/repo-intel/service.js';
import type { IndexState } from '../src/modules/repo-intel/types.js';

interface MockRepoOverrides {
  tryGetIndexState?: () => Promise<IndexState | null>;
  getRankedFileFacts?: (
    repoId: string,
    limit: number,
  ) => Promise<Array<{ path: string; rank: number; hotness: number }>>;
  getIndexStateStats?: () => Promise<Record<string, unknown> | null>;
}

function buildService(flag: boolean, overrides: MockRepoOverrides = {}): RepoIntelService {
  const container = { config: { repoIntelEnabled: flag }, db: {} as never } as never;
  const svc = new RepoIntelService(container);
  (svc as unknown as { repo: Record<string, unknown> }).repo = {
    tryGetIndexState: overrides.tryGetIndexState ?? (async () => null),
    getRankedFileFacts: overrides.getRankedFileFacts ?? (async () => []),
    getIndexStateStats: overrides.getIndexStateStats ?? (async () => null),
  };
  return svc;
}

const fullState: IndexState = {
  repoId: 'r1',
  status: 'full',
  filesIndexed: 10,
  filesSkipped: 0,
  durationMs: 100,
  lastIndexedSha: 'abc123',
  indexerVersion: 1,
  updatedAt: new Date(),
};

describe('getRankedFilesWithHotness — eligibility/degradation (b)', () => {
  it('flag off → degraded flag_off, empty files, no DB reads', async () => {
    const getRankedFileFacts = vi.fn(async () => []);
    const tryGetIndexState = vi.fn(async () => fullState);
    const svc = buildService(false, { getRankedFileFacts, tryGetIndexState });

    const result = await svc.getRankedFilesWithHotness('r1', 5);

    expect(result).toEqual({ files: [], hotnessAvailable: false, degraded: true, reason: 'flag_off' });
    expect(tryGetIndexState).not.toHaveBeenCalled();
    expect(getRankedFileFacts).not.toHaveBeenCalled();
  });

  it('n <= 0 → empty result, no DB reads at all', async () => {
    const tryGetIndexState = vi.fn(async () => fullState);
    const getRankedFileFacts = vi.fn(async () => []);
    const svc = buildService(true, { tryGetIndexState, getRankedFileFacts });

    const result = await svc.getRankedFilesWithHotness('r1', 0);

    expect(result).toEqual({ files: [], hotnessAvailable: false });
    expect(tryGetIndexState).not.toHaveBeenCalled();
    expect(getRankedFileFacts).not.toHaveBeenCalled();
  });

  it('no persisted index state → degraded no_data', async () => {
    const svc = buildService(true, { tryGetIndexState: async () => null });
    const result = await svc.getRankedFilesWithHotness('r1', 5);
    expect(result).toEqual({ files: [], hotnessAvailable: false, degraded: true, reason: 'no_data' });
  });

  it('index status "failed" → degraded with the persisted degradedReason', async () => {
    const svc = buildService(true, {
      tryGetIndexState: async () => ({
        ...fullState,
        status: 'failed',
        degraded: true,
        degradedReason: 'index_failed',
      }),
    });
    const result = await svc.getRankedFilesWithHotness('r1', 5);
    expect(result).toEqual({
      files: [],
      hotnessAvailable: false,
      degraded: true,
      reason: 'index_failed',
    });
  });

  it('index status "degraded" with no explicit degradedReason → falls back to no_data', async () => {
    const svc = buildService(true, {
      tryGetIndexState: async () => ({ ...fullState, status: 'degraded', degraded: true }),
    });
    const result = await svc.getRankedFilesWithHotness('r1', 5);
    expect(result.degraded).toBe(true);
    expect(result.reason).toBe('no_data');
  });

  it('index status "partial" is still usable — NOT marked degraded (matches tryGetIndexState convention)', async () => {
    const svc = buildService(true, {
      tryGetIndexState: async () => ({ ...fullState, status: 'partial' }),
      getRankedFileFacts: async () => [{ path: 'a.ts', rank: 1, hotness: 0 }],
      getIndexStateStats: async () => ({ hotnessAvailable: false }),
    });
    const result = await svc.getRankedFilesWithHotness('r1', 5);
    expect(result.degraded).toBeUndefined();
    expect(result.files).toHaveLength(1);
  });

  it('eligible index but zero rows after filtering → degraded no_data (truthful empty disclosure)', async () => {
    const svc = buildService(true, {
      tryGetIndexState: async () => fullState,
      getRankedFileFacts: async () => [],
      getIndexStateStats: async () => ({ hotnessAvailable: true }),
    });
    const result = await svc.getRankedFilesWithHotness('r1', 5);
    expect(result).toEqual({ files: [], hotnessAvailable: true, degraded: true, reason: 'no_data' });
  });
});

describe('getRankedFilesWithHotness — bounded reads (c)', () => {
  it('passes a bounded LIMIT (max(n*10, 100)) to the repository, never unbounded', async () => {
    const getRankedFileFacts = vi.fn(async () => [{ path: 'a.ts', rank: 1, hotness: 0 }]);
    const svc = buildService(true, {
      tryGetIndexState: async () => fullState,
      getRankedFileFacts,
      getIndexStateStats: async () => ({ hotnessAvailable: false }),
    });

    await svc.getRankedFilesWithHotness('r1', 3);
    expect(getRankedFileFacts).toHaveBeenCalledWith('r1', 100); // max(3*10, 100)

    await svc.getRankedFilesWithHotness('r1', 50);
    expect(getRankedFileFacts).toHaveBeenCalledWith('r1', 500); // max(50*10, 100)
  });
});

describe('getRankedFilesWithHotness — no reindex/refresh side effect (a)', () => {
  it('never triggers indexRepo/refreshIndex as a side effect', async () => {
    const svc = buildService(true, {
      tryGetIndexState: async () => fullState,
      getRankedFileFacts: async () => [{ path: 'a.ts', rank: 1, hotness: 0 }],
      getIndexStateStats: async () => ({ hotnessAvailable: true }),
    });
    const indexSpy = vi.spyOn(svc, 'indexRepo');
    const refreshSpy = vi.spyOn(svc, 'refreshIndex');

    await svc.getRankedFilesWithHotness('r1', 5);

    expect(indexSpy).not.toHaveBeenCalled();
    expect(refreshSpy).not.toHaveBeenCalled();
  });
});

describe('getRankedFilesWithHotness — scoring, tie-break, hotness disclosure (d)', () => {
  it('sorts by rank * (1 + hotness) DESC', async () => {
    const svc = buildService(true, {
      tryGetIndexState: async () => fullState,
      getRankedFileFacts: async () => [
        { path: 'low.ts', rank: 1, hotness: 0 }, // score 1
        { path: 'high.ts', rank: 1, hotness: 4 }, // score 5
        { path: 'mid.ts', rank: 2, hotness: 0.5 }, // score 3
      ],
      getIndexStateStats: async () => ({ hotnessAvailable: true }),
    });

    const result = await svc.getRankedFilesWithHotness('r1', 3);
    expect(result.files.map((f) => f.path)).toEqual(['high.ts', 'mid.ts', 'low.ts']);
    expect(result.files[0]).toEqual({ path: 'high.ts', rank: 1, hotness: 4, score: 5 });
  });

  it('breaks exact score ties by lexicographic path order, deterministically', async () => {
    const svc = buildService(true, {
      tryGetIndexState: async () => fullState,
      getRankedFileFacts: async () => [
        { path: 'zebra.ts', rank: 2, hotness: 0 },
        { path: 'apple.ts', rank: 2, hotness: 0 },
        { path: 'mango.ts', rank: 2, hotness: 0 },
      ],
      getIndexStateStats: async () => ({ hotnessAvailable: false }),
    });

    const result = await svc.getRankedFilesWithHotness('r1', 3);
    expect(result.files.map((f) => f.path)).toEqual(['apple.ts', 'mango.ts', 'zebra.ts']);
  });

  it('discloses hotnessAvailable=false when the pipeline wrote the Option-B placeholder (the common case today)', async () => {
    const svc = buildService(true, {
      tryGetIndexState: async () => fullState,
      getRankedFileFacts: async () => [{ path: 'a.ts', rank: 1, hotness: 0 }],
      getIndexStateStats: async () => ({ hotnessAvailable: false }),
    });
    const result = await svc.getRankedFilesWithHotness('r1', 5);
    expect(result.hotnessAvailable).toBe(false);
  });

  it('discloses hotnessAvailable=false when the stats key is entirely absent (defaults to unavailable, never assumed true)', async () => {
    const svc = buildService(true, {
      tryGetIndexState: async () => fullState,
      getRankedFileFacts: async () => [{ path: 'a.ts', rank: 1, hotness: 0 }],
      getIndexStateStats: async () => ({}),
    });
    const result = await svc.getRankedFilesWithHotness('r1', 5);
    expect(result.hotnessAvailable).toBe(false);
  });

  it('discloses hotnessAvailable=true when the stats key is explicitly true', async () => {
    const svc = buildService(true, {
      tryGetIndexState: async () => fullState,
      getRankedFileFacts: async () => [{ path: 'a.ts', rank: 1, hotness: 0.2 }],
      getIndexStateStats: async () => ({ hotnessAvailable: true }),
    });
    const result = await svc.getRankedFilesWithHotness('r1', 5);
    expect(result.hotnessAvailable).toBe(true);
  });

  it('drops junk paths and caller-supplied exclude substrings, then truncates to n', async () => {
    const svc = buildService(true, {
      tryGetIndexState: async () => fullState,
      getRankedFileFacts: async () => [
        { path: 'src/a.test.ts', rank: 9, hotness: 0 },
        { path: 'src/vendor/b.ts', rank: 8, hotness: 0 },
        { path: 'src/core.ts', rank: 7, hotness: 0 },
        { path: 'src/other.ts', rank: 6, hotness: 0 },
      ],
      getIndexStateStats: async () => ({ hotnessAvailable: false }),
    });

    const result = await svc.getRankedFilesWithHotness('r1', 1, { exclude: ['vendor/'] });
    expect(result.files.map((f) => f.path)).toEqual(['src/core.ts']);
  });
});
