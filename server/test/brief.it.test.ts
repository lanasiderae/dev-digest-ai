import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { PrBrief } from '@devdigest/shared';
import type {
  BlastResult,
  FileRankRow,
  IndexResult,
  IndexState,
  RankedFilesResult,
  RefRow,
  RepoIntel,
  RepoMapResult,
  SignatureRow,
  SymbolRow,
} from '../src/modules/repo-intel/types.js';
import { MockLLMProvider } from '../src/adapters/mocks.js';

/**
 * Integration coverage for `/pulls/:id/brief` that genuinely needs real
 * Postgres and CANNOT be meaningfully mocked: the DB round trip (cache
 * actually persisted/reloaded via `pr_brief`) and the real
 * `pg_try_advisory_lock`/`pg_advisory_unlock` cross-process concurrency
 * seam (`brief-lock.test.ts` proves the LOGIC hermetically with a fake
 * `rawSql`; this file proves the SAME code path against a real connection
 * pool, where a plain `db.execute()` per call could pick a different
 * pooled connection and silently break the lock — the exact bug
 * `sql.reserve()` exists to avoid).
 *
 * NOT run in this session (no Docker available to the agent that wrote it);
 * self-skips cleanly via `dockerAvailable()` like every other `.it.test.ts`.
 */

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

/** Minimal stub RepoIntel (same shape as `blast.it.test.ts`'s) — degraded on
 *  every method except `getBlastRadius`, which is never exercised with
 *  interesting data in this file (`agent_id: null`, no Blast-dependent
 *  assertions) since the point here is the cache/lock seam, not Blast
 *  content. */
class StubRepoIntel implements RepoIntel {
  async getBlastRadius(): Promise<BlastResult> {
    return { changedSymbols: [], callers: [], impactedEndpoints: [], degraded: false };
  }
  async indexRepo(): Promise<IndexResult> {
    return { status: 'degraded', filesIndexed: 0, filesSkipped: 0, durationMs: 0 };
  }
  async refreshIndex(): Promise<IndexResult> {
    return { status: 'degraded', filesIndexed: 0, filesSkipped: 0, durationMs: 0 };
  }
  async getIndexState(repoId: string): Promise<IndexState> {
    return {
      repoId,
      status: 'degraded',
      filesIndexed: 0,
      filesSkipped: 0,
      durationMs: 0,
      lastIndexedSha: '',
      indexerVersion: 1,
      updatedAt: new Date(0),
      degraded: true,
      degradedReason: 'no_data',
    };
  }
  async getRepoMap(): Promise<RepoMapResult> {
    return { text: '', tokens: 0, cached: false, degraded: true, reason: 'no_data' };
  }
  async getFileRank(): Promise<FileRankRow[]> {
    return [];
  }
  async getSymbolsInFiles(): Promise<SymbolRow[]> {
    return [];
  }
  async getCallerSignatures(): Promise<SignatureRow[]> {
    return [];
  }
  async getUnresolvedReferences(): Promise<RefRow[]> {
    return [];
  }
  async getConventionSamples(): Promise<string[]> {
    return [];
  }
  async getTopFilesByRank(): Promise<string[]> {
    return [];
  }
  async getCriticalPaths(): Promise<string[][]> {
    return [];
  }
  async getRankedFilesWithHotness(): Promise<RankedFilesResult> {
    return { files: [], hotnessAvailable: false, degraded: true, reason: 'no_data' };
  }
}

d('PR Brief (Testcontainers pg) — DB round trip + real advisory lock', () => {
  let pg: PgFixture;
  let workspaceId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function appWith(opts: { generateDelayMs?: number } = {}) {
    const llm = new MockLLMProvider('openai', {
      structuredBySchema: { PrBriefGeneration: { summary: 'A small config change.', risks: [], review_focus: [] } },
    });
    if (opts.generateDelayMs) {
      const original = llm.completeStructured.bind(llm);
      llm.completeStructured = (async (req: Parameters<typeof original>[0]) => {
        await new Promise((r) => setTimeout(r, opts.generateDelayMs));
        return original(req);
      }) as typeof llm.completeStructured;
    }
    return buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: { repoIntel: new StubRepoIntel(), llm: { openai: llm }, rawSql: pg.handle.sql },
    });
  }

  async function seedRepoAndPr() {
    const name = `brief-${Math.random().toString(36).slice(2)}`;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
      .returning();
    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 21,
        title: 'Add rate limiting',
        author: 'dev',
        branch: 'feat/x',
        base: 'main',
        headSha: 'sha-1',
        additions: 4,
        deletions: 0,
        filesCount: 1,
        status: 'needs_review',
      })
      .returning();
    await pg.handle.db.insert(t.prFiles).values([
      { prId: pr!.id, path: 'server/src/config.ts', additions: 4, deletions: 0, patch: null },
    ]);
    return { repo: repo!, pr: pr! };
  }

  it('POST persists into pr_brief; GET then reloads it with ZERO model calls', async () => {
    const app = await appWith();
    const { pr } = await seedRepoAndPr();

    const post = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/brief`, payload: { agent_id: null } });
    expect(post.statusCode).toBe(200);
    expect(() => PrBrief.parse(post.json())).not.toThrow();

    const [row] = await pg.handle.db.select().from(t.prBrief).where(eq(t.prBrief.prId, pr.id));
    expect(row).toBeDefined();

    const get = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/brief` });
    expect(get.statusCode).toBe(200);
    const body = get.json();
    expect(body.stale).toBe(false);
    expect(body.brief.summary).toBe('A small config change.');

    await app.close();
  });

  it('a second concurrent POST for the same PR returns 409 while the first is in flight (real pg_try_advisory_lock)', async () => {
    const app = await appWith({ generateDelayMs: 200 });
    const { pr } = await seedRepoAndPr();

    const [first, second] = await Promise.all([
      app.inject({ method: 'POST', url: `/pulls/${pr.id}/brief`, payload: { agent_id: null } }),
      new Promise<Awaited<ReturnType<typeof app.inject>>>((resolve) =>
        setTimeout(
          () => app.inject({ method: 'POST', url: `/pulls/${pr.id}/brief`, payload: { agent_id: null } }).then(resolve),
          20,
        ),
      ),
    ]);

    const statuses = [first.statusCode, second.statusCode].sort();
    expect(statuses).toEqual([200, 409]);

    await app.close();
  });

  it('rejects an explicit agent_id: null from substituting a reviewer (provenance stays null), distinct from an omitted key (422)', async () => {
    const app = await appWith();
    const { pr } = await seedRepoAndPr();

    const omitted = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/brief`, payload: {} });
    expect(omitted.statusCode).toBe(422);

    const explicit = await app.inject({ method: 'POST', url: `/pulls/${pr.id}/brief`, payload: { agent_id: null } });
    expect(explicit.statusCode).toBe(200);
    expect(explicit.json().provenance.reviewer_agent_id).toBeNull();

    await app.close();
  });
});
