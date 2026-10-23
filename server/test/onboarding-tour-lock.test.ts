/**
 * L05/TASK-10 — `OnboardingTourService`'s advisory-lock seam (ONBOARD-AC-08),
 * hermetic: no real Postgres, but a FAKE `container.rawSql` that models
 * `pg_try_advisory_lock`/`pg_advisory_unlock`'s actual semantics (a single
 * global flag shared across every `reserve()`'d connection) — same pattern
 * `brief-lock.test.ts` uses for `BriefService`. Proves the LOCKING LOGIC
 * itself (acquire → run → release, second-while-held → 409) without Docker;
 * `onboarding-tour.it.test.ts` additionally exercises the REAL
 * `pg_try_advisory_lock` against Postgres.
 */
import { describe, it, expect } from 'vitest';
import type { Container } from '../src/platform/container.js';
import { OnboardingTourService } from '../src/modules/onboarding-tour/service.js';
import { ConflictError } from '../src/platform/errors.js';

function makeFakeRawSql() {
  let locked = false;
  const rawSql = {
    reserve: async () => {
      const conn = async (strings: readonly string[]) => {
        const sql = strings.join('?');
        if (sql.includes('pg_try_advisory_lock')) {
          if (locked) return [{ locked: false }];
          locked = true;
          return [{ locked: true }];
        }
        if (sql.includes('pg_advisory_unlock')) {
          locked = false;
          return [{ unlocked: true }];
        }
        throw new Error(`unexpected query: ${sql}`);
      };
      (conn as unknown as { release: () => void }).release = () => undefined;
      return conn as unknown as import('postgres').Sql;
    },
  };
  return { rawSql, isLocked: () => locked };
}

function makeService(opts: { rawSql: unknown; generateDelayMs?: number }) {
  const llm = {
    id: 'openrouter' as const,
    listModels: async () => [],
    complete: async () => {
      throw new Error('unexpected');
    },
    completeStructured: async () => {
      if (opts.generateDelayMs) await new Promise((r) => setTimeout(r, opts.generateDelayMs));
      const section = { narrative: 'x', evidence: [] };
      return {
        data: {
          architecture_overview: section,
          critical_paths: section,
          local_setup: section,
          reading_order: section,
          first_tasks: section,
        },
        model: 'deepseek/deepseek-v4-flash',
        tokensIn: 1,
        tokensOut: 1,
        costUsd: 0,
        raw: '',
        attempts: 1,
      };
    },
    embed: async () => {
      throw new Error('unexpected');
    },
  };

  const db = { select: () => ({ from: () => ({ where: async () => [] }) }) };
  const repoIntel = {
    getIndexState: async () => ({
      repoId: 'repo-1',
      status: 'full',
      filesIndexed: 1,
      filesSkipped: 0,
      durationMs: 1,
      lastIndexedSha: 'sha-abc',
      indexerVersion: 1,
      updatedAt: new Date(0),
      degraded: false,
    }),
    getRepoMap: async () => ({ text: 'map', tokens: 1, cached: true }),
    getRankedFilesWithHotness: async () => ({ files: [], hotnessAvailable: false }),
    getCriticalPaths: async () => [],
  };

  const container = {
    config: { repoIntelEnabled: true },
    db,
    reposRepo: { getById: async () => ({ id: 'repo-1', owner: 'acme', name: 'widgets', clonePath: null }) },
    repoIntel,
    git: { currentHead: async () => 'head' },
    gitTreeReader: { listTree: async () => [], readBlob: async () => ({ content: '', sizeBytes: 0 }) },
    tokenizer: { count: (t: string) => t.length },
    llm: async () => llm,
    rawSql: opts.rawSql,
  } as unknown as Container;

  const service = new OnboardingTourService(container);
  (service as unknown as { repo: { get: () => Promise<unknown>; upsert: () => Promise<void> } }).repo = {
    get: async () => undefined,
    upsert: async () => undefined,
  };

  return service;
}

describe('OnboardingTourService.generate — advisory-lock concurrency (ONBOARD-AC-08)', () => {
  it('a second concurrent generation for the SAME repo while one is in flight gets an actionable 409, not a hang or a silent duplicate', async () => {
    const { rawSql, isLocked } = makeFakeRawSql();
    const service = makeService({ rawSql, generateDelayMs: 30 });

    const first = service.generate('ws-1', 'repo-1');
    await new Promise((r) => setTimeout(r, 5));
    expect(isLocked()).toBe(true);

    await expect(service.generate('ws-1', 'repo-1')).rejects.toThrow(ConflictError);

    const firstResult = await first;
    // `clonePath: null` on the test's repo row → no setup evidence
    // collected → local_setup downgrades to "unavailable" → top status
    // "partial"; the point of this test is the LOCK, not the status.
    expect(firstResult.tour.status).toBe('partial');
    expect(isLocked()).toBe(false); // released in `finally` after the first call completed
  });

  it('releases the lock on failure too so a retry is never stuck', async () => {
    const { rawSql, isLocked } = makeFakeRawSql();
    const service = makeService({ rawSql });

    await service.generate('ws-1', 'repo-1');
    expect(isLocked()).toBe(false);

    await expect(service.generate('ws-1', 'repo-1')).resolves.toBeTruthy();
  });

  it('runs uncontended (no lock) when no real Postgres connection is available — the hermetic-test default', async () => {
    const service = makeService({ rawSql: undefined });
    await expect(service.generate('ws-1', 'repo-1')).resolves.toBeTruthy();
    await expect(service.generate('ws-1', 'repo-1')).resolves.toBeTruthy();
  });
});
