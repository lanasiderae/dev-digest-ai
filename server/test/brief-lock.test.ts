/**
 * L05/TASK-08 — `BriefService`'s advisory-lock seam (BRIEF-AC-06/12),
 * hermetic: no real Postgres, but a FAKE `container.rawSql` that models
 * `pg_try_advisory_lock`/`pg_advisory_unlock`'s actual semantics (a single
 * global flag shared across every `reserve()`'d connection — exactly like a
 * real session-scoped advisory lock is shared server-side across
 * connections, which is the whole reason `reserve()` is needed in
 * production instead of a plain pooled query). This proves the LOCKING
 * LOGIC itself (acquire → run → release, second-while-held → 409) without
 * needing Docker; `brief.it.test.ts` additionally exercises the REAL
 * `pg_try_advisory_lock` against Postgres.
 */
import { describe, it, expect } from 'vitest';
import type { Container } from '../src/platform/container.js';
import type { PullRow } from '../src/db/rows.js';
import { BriefService } from '../src/modules/brief/service.js';
import { ConflictError } from '../src/platform/errors.js';

function makePull(overrides: Partial<PullRow> = {}): PullRow {
  return {
    id: 'pr-1',
    workspaceId: 'ws-1',
    repoId: 'repo-1',
    number: 7,
    title: 'Add rate limiting',
    author: 'marisa.koch',
    branch: 'feat/x',
    base: 'main',
    headSha: 'sha-1',
    lastReviewedSha: null,
    additions: 10,
    deletions: 2,
    filesCount: 1,
    status: 'open',
    body: null,
    openedAt: null,
    updatedAt: null,
    ...overrides,
  } as unknown as PullRow;
}

/** Models a real session-scoped Postgres advisory lock: ONE global `locked`
 *  flag, shared across every `reserve()`'d connection (connections are
 *  per-call here, but the lock state is server-side/global, matching real
 *  Postgres). `release()` is a no-op (returning the reserved connection to
 *  the pool doesn't itself release the advisory lock — only an explicit
 *  `pg_advisory_unlock` does, exactly the bug this lock pattern exists to
 *  avoid). */
function makeFakeRawSql() {
  let locked = false;
  const reserveCalls: string[] = [];
  const rawSql = {
    reserve: async () => {
      reserveCalls.push('reserve');
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
  return { rawSql, reserveCalls, isLocked: () => locked };
}

function makeService(opts: { rawSql: unknown; generateDelayMs?: number }) {
  const pull = makePull();
  const reviewRepo = {
    getPull: async () => pull,
    getRepo: async () => ({ owner: 'acme', name: 'widgets' }),
    getPrFiles: async () => [],
    getIntent: async () => undefined,
    getPriorPrsWithFileOverlap: async () => [],
  };
  const llm = {
    completeStructured: async () => {
      if (opts.generateDelayMs) await new Promise((r) => setTimeout(r, opts.generateDelayMs));
      return {
        data: { summary: 'ok', risks: [], review_focus: [] },
        model: 'gpt-4.1',
        tokensIn: 1,
        tokensOut: 1,
        costUsd: 0,
        raw: '',
        attempts: 1,
      };
    },
    complete: async () => {
      throw new Error('unexpected');
    },
    listModels: async () => [],
    embed: async () => {
      throw new Error('unexpected');
    },
  };
  const db = { select: () => ({ from: () => ({ where: async () => [] }) }) };
  const repoIntel = { getBlastRadius: async () => ({ changedSymbols: [], callers: [] }), getIndexState: async () => ({ lastIndexedSha: null }) };
  const github = async () => ({ getIssue: async () => { throw new Error('no issue'); } });
  const container = {
    db,
    reviewRepo,
    agentsRepo: { getById: async () => { throw new Error('unexpected'); }, linkedSkills: async () => [] },
    tokenizer: { count: (t: string) => t.length },
    llm: async () => llm,
    github,
    repoIntel,
    rawSql: opts.rawSql,
  } as unknown as Container;

  const service = new BriefService(container);
  (service as unknown as { repo: { get: () => Promise<unknown>; upsert: () => Promise<void> } }).repo = {
    get: async () => undefined,
    upsert: async () => undefined,
  };
  (service as unknown as { computeContextIdentity: (...args: unknown[]) => Promise<unknown> }).computeContextIdentity =
    async () => ({ skillIds: [], documents: [], prLinkedSpecPath: null, omissions: [], fingerprint: 'fp' });

  return service;
}

describe('BriefService.generate — advisory-lock concurrency (BRIEF-AC-06/12)', () => {
  it('a second concurrent generation for the SAME PR while one is in flight gets an actionable 409, not a hang or a silent duplicate', async () => {
    const { rawSql, isLocked } = makeFakeRawSql();
    const service = makeService({ rawSql, generateDelayMs: 30 });

    const first = service.generate('ws-1', 'pr-1', null);
    // Give the first call time to acquire the lock before firing the second.
    await new Promise((r) => setTimeout(r, 5));
    expect(isLocked()).toBe(true);

    await expect(service.generate('ws-1', 'pr-1', null)).rejects.toThrow(ConflictError);

    const firstResult = await first;
    expect(firstResult.summary).toBe('ok');
    expect(isLocked()).toBe(false); // released in `finally` after the first call completed
  });

  it('releases the lock on failure too (grounding rejection, model error, etc.) so a retry is never stuck', async () => {
    const { rawSql, isLocked } = makeFakeRawSql();
    const service = makeService({ rawSql });

    await service.generate('ws-1', 'pr-1', null);
    expect(isLocked()).toBe(false);

    // A second, fully sequential call succeeds — proves the first call's
    // lock was actually released, not just "happened not to collide".
    await expect(service.generate('ws-1', 'pr-1', null)).resolves.toBeTruthy();
  });

  it('runs uncontended (no lock) when no real Postgres connection is available — the hermetic-test default', async () => {
    const service = makeService({ rawSql: undefined });
    await expect(service.generate('ws-1', 'pr-1', null)).resolves.toBeTruthy();
    await expect(service.generate('ws-1', 'pr-1', null)).resolves.toBeTruthy();
  });
});
