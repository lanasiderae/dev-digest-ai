/**
 * L05/TASK-10 — `OnboardingTourService.generate` (POST /repos/:id/onboarding),
 * hermetic (no Docker, no real git/DB): `container.reposRepo`/`repoIntel`/
 * `git`/`gitTreeReader`/`llm` are plain stubs, `container.db` is a minimal
 * chainable stub standing in for `resolveFeatureModel`'s one settings read
 * (same pattern `brief-generate.test.ts` uses), and the module's own
 * `repo` (cache get/upsert) is overridden directly — the same
 * private-field-cast convention `brief-generate.test.ts` already uses.
 *
 * Covers: zero-call skeleton for every ineligible-index case (flag off / no
 * data / partial / failed), exactly ONE structured attempt for an eligible
 * complete index, evidence-path grounding rejection (preserves cache),
 * model/transport failure fallback (preserves cache, usage honestly
 * "unknown" not zero), the per-section "no setup evidence" downgrade, input
 * budget drop-from-tail, mandatory-overflow fail-before-call, and the
 * index-revision race.
 */
import { describe, it, expect } from 'vitest';
import type { Container } from '../src/platform/container.js';
import { OnboardingTourService } from '../src/modules/onboarding-tour/service.js';
import { ConflictError, ValidationError } from '../src/platform/errors.js';
import { ONBOARDING_INPUT_TOKEN_CAP } from '../src/modules/onboarding-tour/constants.js';

const CHAR_TOKENIZER = { count: (t: string) => t.length };

/** A minimal but CONTRACT-VALID cached `OnboardingTour` — `repo.get()` only
 *  ever returns what a previous `repo.upsert()` actually wrote (itself
 *  always contract-validated), so "cache exists" in practice always means
 *  "a valid OnboardingTour exists", unlike an arbitrary raw blob. `marker`
 *  is stashed in `reason` so a test can assert the OLD cache specifically
 *  (not a fresh one) is what's still there. */
function makeValidCachedTour(marker: string) {
  const section = { narrative: marker, evidence: [], status: 'generated' as const, reason: null };
  return {
    repo_id: 'repo-1',
    sections: {
      architecture_overview: section,
      critical_paths: section,
      local_setup: section,
      reading_order: section,
      first_tasks: section,
    },
    status: 'complete' as const,
    reason: null,
    index_revision: 'sha-old',
    attempt: {
      called_model: true,
      provider: 'openrouter' as const,
      model: 'deepseek/deepseek-v4-flash',
      tokens_in: 1,
      tokens_out: 1,
      cost_usd: 0,
      attempted_at: new Date(0).toISOString(),
    },
    omissions: [],
    generated_at: new Date(0).toISOString(),
  };
}

function makeRepoRow(overrides: Partial<{ owner: string; name: string; clonePath: string | null }> = {}) {
  return { id: 'repo-1', owner: 'acme', name: 'widgets', clonePath: '/clones/acme/widgets', ...overrides };
}

function makeIndexState(overrides: Partial<{ status: string; degraded: boolean; degradedReason: string; lastIndexedSha: string; reason: string }> = {}) {
  return {
    repoId: 'repo-1',
    status: 'full',
    filesIndexed: 10,
    filesSkipped: 0,
    durationMs: 100,
    lastIndexedSha: 'sha-abc',
    indexerVersion: 1,
    updatedAt: new Date(0),
    degraded: false,
    ...overrides,
  };
}

interface MakeServiceOpts {
  repoRow?: ReturnType<typeof makeRepoRow> | undefined;
  repoIntelEnabled?: boolean;
  indexState?: ReturnType<typeof makeIndexState>;
  freshIndexState?: ReturnType<typeof makeIndexState>;
  rankedFiles?: { path: string; rank: number; hotness: number; score: number }[];
  hotnessAvailable?: boolean;
  criticalPaths?: string[][];
  repoMapText?: string | null;
  setupTreeEntries?: { path: string; kind: 'blob' | 'symlink' | 'submodule' | 'tree' | 'other'; oid: string | null; sizeBytes: number | null }[];
  setupBlobs?: Record<string, string>;
  llmData?: unknown;
  llmError?: Error;
  cached?: unknown;
}

function makeService(opts: MakeServiceOpts = {}) {
  const repoRow = 'repoRow' in opts ? opts.repoRow : makeRepoRow();
  const indexState = opts.indexState ?? makeIndexState();
  const freshIndexState = opts.freshIndexState ?? indexState;

  const upserted: { repoId: string; json: unknown }[] = [];
  const cacheStub = {
    get: async () => opts.cached,
    upsert: async (repoId: string, json: unknown) => {
      upserted.push({ repoId, json });
    },
  };

  const completeStructuredCalls: unknown[] = [];
  let indexStateCallCount = 0;
  const llm = {
    id: 'openrouter' as const,
    listModels: async () => [],
    complete: async () => {
      throw new Error('must not call complete()');
    },
    completeStructured: async (req: { schema: { safeParse: (v: unknown) => { success: boolean; data?: unknown; error?: unknown } } }) => {
      completeStructuredCalls.push(req);
      if (opts.llmError) throw opts.llmError;
      const defaultSection = { narrative: 'text', evidence: [] as unknown[] };
      const defaultData = {
        architecture_overview: defaultSection,
        critical_paths: defaultSection,
        local_setup: defaultSection,
        reading_order: defaultSection,
        first_tasks: defaultSection,
      };
      const parsed = req.schema.safeParse(opts.llmData ?? defaultData);
      if (!parsed.success) throw new Error(`fixture failed schema: ${JSON.stringify(parsed.error)}`);
      return { data: parsed.data, model: 'deepseek/deepseek-v4-flash', tokensIn: 100, tokensOut: 50, costUsd: 0.01, raw: '', attempts: 1 };
    },
    embed: async () => {
      throw new Error('must not call embed()');
    },
  };

  const db = {
    select: () => ({
      from: () => ({
        where: async () => [], // no settings rows → registry default feature model ('onboarding')
      }),
    }),
  };

  const repoIntel = {
    getIndexState: async () => {
      indexStateCallCount += 1;
      return indexStateCallCount === 1 ? indexState : freshIndexState;
    },
    getRepoMap: async () => ({
      text: opts.repoMapText ?? 'repo map text',
      tokens: 10,
      cached: true,
      degraded: opts.repoMapText === null,
    }),
    getRankedFilesWithHotness: async () => ({
      files: opts.rankedFiles ?? [{ path: 'src/index.ts', rank: 0.9, hotness: 0, score: 0.9 }],
      hotnessAvailable: opts.hotnessAvailable ?? false,
    }),
    getCriticalPaths: async () => opts.criticalPaths ?? [['src/index.ts', 'src/app.ts']],
  };

  const git = { currentHead: async () => 'head-sha' };
  const gitTreeReader = {
    listTree: async () => opts.setupTreeEntries ?? [{ path: 'README.md', kind: 'blob' as const, oid: 'oid-readme', sizeBytes: 20 }],
    readBlob: async (_repo: unknown, oid: string) => ({
      content: opts.setupBlobs?.[oid] ?? 'setup instructions here',
      sizeBytes: 20,
    }),
  };

  const container = {
    config: { repoIntelEnabled: opts.repoIntelEnabled ?? true },
    db,
    reposRepo: { getById: async () => repoRow },
    repoIntel,
    git,
    gitTreeReader,
    tokenizer: CHAR_TOKENIZER,
    llm: async () => llm,
    rawSql: undefined,
  } as unknown as Container;

  const service = new OnboardingTourService(container);
  (service as unknown as { repo: typeof cacheStub }).repo = cacheStub;

  return { service, upserted, completeStructuredCalls };
}

describe('OnboardingTourService.generate — zero-call skeleton for an ineligible/incomplete index (ONBOARD-AC-05)', () => {
  it('flag off: zero model calls, skeleton, every section "skeleton"', async () => {
    const { service, completeStructuredCalls, upserted } = makeService({ repoIntelEnabled: false });
    const { tour, cached_tour_preserved } = await service.generate('ws-1', 'repo-1');
    expect(tour.status).toBe('skeleton');
    expect(tour.attempt).toBeNull();
    expect(Object.values(tour.sections).every((s) => s.status === 'skeleton')).toBe(true);
    expect(completeStructuredCalls).toHaveLength(0);
    expect(upserted).toHaveLength(0);
    expect(cached_tour_preserved).toBe(false); // nothing to preserve
  });

  it('no index data at all: zero model calls, skeleton with an honest reason', async () => {
    const { service, completeStructuredCalls } = makeService({
      indexState: makeIndexState({ status: 'degraded', degraded: true, degradedReason: 'no_data', lastIndexedSha: '' }),
    });
    const { tour } = await service.generate('ws-1', 'repo-1');
    expect(tour.status).toBe('skeleton');
    expect(tour.reason).toMatch(/no usable repository index/i);
    expect(tour.index_revision).toBeNull();
    expect(completeStructuredCalls).toHaveLength(0);
  });

  it('partial index: zero model calls, skeleton tagged with the "index_partial" omission reason', async () => {
    const { service, completeStructuredCalls } = makeService({
      indexState: makeIndexState({ status: 'partial', degraded: false }),
    });
    const { tour } = await service.generate('ws-1', 'repo-1');
    expect(tour.status).toBe('skeleton');
    expect(tour.omissions[0]?.reason).toBe('index_partial');
    expect(completeStructuredCalls).toHaveLength(0);
  });

  it('failed/degraded index: zero model calls, skeleton', async () => {
    const { service, completeStructuredCalls } = makeService({
      indexState: makeIndexState({ status: 'failed', degraded: true, degradedReason: 'index_failed' }),
    });
    const { tour } = await service.generate('ws-1', 'repo-1');
    expect(tour.status).toBe('skeleton');
    expect(completeStructuredCalls).toHaveLength(0);
  });

  it('preserves an existing cached tour (reports cached_tour_preserved: true) rather than overwriting it with the skeleton', async () => {
    const OLD_CACHE = makeValidCachedTour('old-marker');
    const { service, upserted } = makeService({ repoIntelEnabled: false, cached: OLD_CACHE });
    const { cached_tour_preserved } = await service.generate('ws-1', 'repo-1');
    expect(cached_tour_preserved).toBe(true);
    expect(upserted).toHaveLength(0);
  });
});

describe('OnboardingTourService.generate — eligible complete index: exactly one attempt (ONBOARD-AC-01/04)', () => {
  it('calls completeStructured exactly once with disableTransportRetry/maxRetries=0, persists a "complete" tour', async () => {
    const { service, completeStructuredCalls, upserted } = makeService();
    const { tour, cached_tour_preserved } = await service.generate('ws-1', 'repo-1');

    expect(completeStructuredCalls).toHaveLength(1);
    const req = completeStructuredCalls[0] as { disableTransportRetry: boolean; maxRetries: number };
    expect(req.disableTransportRetry).toBe(true);
    expect(req.maxRetries).toBe(0);
    expect(tour.status).toBe('complete');
    expect(tour.attempt?.called_model).toBe(true);
    expect(tour.attempt?.tokens_in).toBe(100);
    expect(tour.attempt?.tokens_out).toBe(50);
    expect(tour.attempt?.cost_usd).toBe(0.01);
    expect(tour.index_revision).toBe('sha-abc');
    expect(upserted).toHaveLength(1);
    expect(cached_tour_preserved).toBe(false);
  });

  it('downgrades local_setup to "unavailable" and the top status to "partial" when no setup evidence was found at all', async () => {
    const { service } = makeService({ setupTreeEntries: [] });
    const { tour } = await service.generate('ws-1', 'repo-1');
    expect(tour.sections.local_setup.status).toBe('unavailable');
    expect(tour.status).toBe('partial');
  });
});

describe('OnboardingTourService.generate — grounding rejection preserves the old cache (ONBOARD-AC-01/06)', () => {
  it('rejects a narrative citing an evidence path that was never actually collected, preserving the old cache', async () => {
    const OLD_CACHE = makeValidCachedTour('old');
    const { service, upserted, completeStructuredCalls } = makeService({
      cached: OLD_CACHE,
      llmData: {
        architecture_overview: { narrative: 'x', evidence: [] },
        critical_paths: { narrative: 'x', evidence: [] },
        local_setup: { narrative: 'x', evidence: [] },
        reading_order: { narrative: 'bad', evidence: [{ path: 'src/invented.ts', note: null }] },
        first_tasks: { narrative: 'x', evidence: [] },
      },
    });

    const { tour, cached_tour_preserved } = await service.generate('ws-1', 'repo-1');
    expect(tour.status).toBe('failed');
    expect(tour.reason).toMatch(/grounding violation/i);
    expect(completeStructuredCalls).toHaveLength(1); // exactly one attempt, no repair call
    expect(upserted).toHaveLength(0);
    expect(cached_tour_preserved).toBe(true);
  });
});

describe('OnboardingTourService.generate — model/transport failure fallback (ONBOARD-AC-06)', () => {
  it('falls back to a truthful "failed" skeleton, preserves the old cache, and never fabricates usage/cost', async () => {
    const OLD_CACHE = makeValidCachedTour('old');
    const err = Object.assign(new Error('upstream 500'), { details: { usage: 'unknown' } });
    const { service, upserted, completeStructuredCalls } = makeService({ cached: OLD_CACHE, llmError: err });

    const { tour, cached_tour_preserved } = await service.generate('ws-1', 'repo-1');
    expect(tour.status).toBe('failed');
    expect(tour.attempt?.called_model).toBe(true);
    expect(tour.attempt?.tokens_in).toBeNull();
    expect(tour.attempt?.tokens_out).toBeNull();
    expect(tour.attempt?.cost_usd).toBeNull(); // unknown, never coerced to 0
    expect(completeStructuredCalls).toHaveLength(1); // one attempt, no second call
    expect(upserted).toHaveLength(0);
    expect(cached_tour_preserved).toBe(true);
  });

  it('reports real accumulated usage on failure when the provider DID report some before failing', async () => {
    const err = Object.assign(new Error('schema validation failed'), {
      details: { usage: { tokensIn: 42, tokensOut: 7 } },
    });
    const { service } = makeService({ llmError: err });
    const { tour } = await service.generate('ws-1', 'repo-1');
    expect(tour.attempt?.tokens_in).toBe(42);
    expect(tour.attempt?.tokens_out).toBe(7);
    expect(tour.attempt?.cost_usd).toBeNull(); // cost is never known on a failed attempt
  });
});

describe('OnboardingTourService.generate — input budget (ONBOARD-AC-07)', () => {
  it('drops optional blocks from the tail under a tiny effective budget and still calls the model once', async () => {
    const hugeRanked = Array.from({ length: 200 }, (_, i) => ({
      path: `src/module-${i}/${'x'.repeat(60)}.ts`,
      rank: 0.5,
      hotness: 0,
      score: 0.5,
    }));
    const { service, completeStructuredCalls } = makeService({
      rankedFiles: hugeRanked,
      repoMapText: 'x'.repeat(200),
      criticalPaths: [['src/index.ts', 'src/app.ts']],
    });

    const { tour } = await service.generate('ws-1', 'repo-1');
    expect(completeStructuredCalls).toHaveLength(1);
    // Some budget-dropped omission is recorded truthfully.
    expect(tour.omissions.some((o) => o.reason === 'budget')).toBe(true);
  });

  it('fails BEFORE calling the model when the mandatory evidence allowlist alone exceeds the budget', async () => {
    const hugeRanked = Array.from({ length: 2000 }, (_, i) => ({
      path: `src/very/deeply/nested/package/module-${i}/file-${'x'.repeat(40)}.ts`,
      rank: 0.1,
      hotness: 0,
      score: 0.1,
    }));
    const { service, completeStructuredCalls, upserted } = makeService({ rankedFiles: hugeRanked });

    await expect(service.generate('ws-1', 'repo-1')).rejects.toThrow(ValidationError);
    expect(completeStructuredCalls).toHaveLength(0);
    expect(upserted).toHaveLength(0);
    const totalChars = hugeRanked.reduce((s, f) => s + f.path.length, 0);
    expect(totalChars).toBeGreaterThan(ONBOARDING_INPUT_TOKEN_CAP);
  });
});

describe('OnboardingTourService.generate — index-revision race (concurrency)', () => {
  it('rejects with a 409 and preserves the old cache when the index revision advanced during generation', async () => {
    const OLD_CACHE = { summary: 'old' };
    const { service, upserted } = makeService({
      cached: OLD_CACHE,
      freshIndexState: makeIndexState({ lastIndexedSha: 'sha-advanced' }),
    });

    await expect(service.generate('ws-1', 'repo-1')).rejects.toThrow(ConflictError);
    expect(upserted).toHaveLength(0);
  });
});
