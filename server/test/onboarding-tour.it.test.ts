import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { OnboardingTour } from '@devdigest/shared';
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
 * Integration coverage for `/repos/:id/onboarding` that genuinely needs real
 * Postgres and CANNOT be meaningfully mocked: the DB round trip (cache
 * actually persisted/reloaded via `onboarding`) and the real
 * `pg_try_advisory_lock`/`pg_advisory_unlock` cross-process concurrency seam
 * (`onboarding-tour-lock.test.ts` proves the LOGIC hermetically with a fake
 * `rawSql`; this file proves the SAME code path against a real connection
 * pool). Docker IS available in this environment (confirmed via
 * `dockerAvailable()` — same conclusion `brief.it.test.ts` reached in an
 * earlier L05 session); this file is actually run, not just written.
 */

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

/** A controlled "full, eligible" index — real repo-intel indexing is out of
 *  scope for this DB round-trip test (same reasoning `brief.it.test.ts` uses
 *  for its own `StubRepoIntel`): the point here is the `onboarding` table
 *  write/read and the real advisory lock, not repo-intel's own pipeline. */
class StubRepoIntel implements RepoIntel {
  constructor(private indexRevision = 'sha-stub') {}
  async getBlastRadius(): Promise<BlastResult> {
    return { changedSymbols: [], callers: [], impactedEndpoints: [], degraded: false };
  }
  async indexRepo(): Promise<IndexResult> {
    return { status: 'full', filesIndexed: 1, filesSkipped: 0, durationMs: 0 };
  }
  async refreshIndex(): Promise<IndexResult> {
    return { status: 'full', filesIndexed: 1, filesSkipped: 0, durationMs: 0 };
  }
  async getIndexState(repoId: string): Promise<IndexState> {
    return {
      repoId,
      status: 'full',
      filesIndexed: 10,
      filesSkipped: 0,
      durationMs: 100,
      lastIndexedSha: this.indexRevision,
      indexerVersion: 1,
      updatedAt: new Date(0),
      degraded: false,
    };
  }
  async getRepoMap(): Promise<RepoMapResult> {
    return { text: 'app -> api -> db', tokens: 5, cached: true };
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
    return [['src/index.ts', 'src/app.ts']];
  }
  async getRankedFilesWithHotness(): Promise<RankedFilesResult> {
    return { files: [{ path: 'src/index.ts', rank: 0.9, hotness: 0, score: 0.9 }], hotnessAvailable: false };
  }
}

const SECTION = { narrative: 'text', evidence: [] };
const VALID_GENERATION = {
  architecture_overview: SECTION,
  critical_paths: SECTION,
  local_setup: SECTION,
  reading_order: SECTION,
  first_tasks: SECTION,
};

d('Onboarding Tour (Testcontainers pg) — DB round trip + real advisory lock', () => {
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

  function appWith(opts: { generateDelayMs?: number; indexRevision?: string; repoIntelEnabled?: boolean } = {}) {
    const llm = new MockLLMProvider('openrouter', {
      structuredBySchema: { OnboardingTourGeneration: VALID_GENERATION },
    });
    if (opts.generateDelayMs) {
      const original = llm.completeStructured.bind(llm);
      llm.completeStructured = (async (req: Parameters<typeof original>[0]) => {
        await new Promise((r) => setTimeout(r, opts.generateDelayMs));
        return original(req);
      }) as typeof llm.completeStructured;
    }
    const appConfig =
      opts.repoIntelEnabled === false
        ? loadConfig({ ...process.env, NODE_ENV: 'test', REPO_INTEL_ENABLED: 'false' } as NodeJS.ProcessEnv)
        : config();
    return buildApp({
      config: appConfig,
      db: pg.handle.db,
      overrides: {
        repoIntel: new StubRepoIntel(opts.indexRevision),
        llm: { openrouter: llm },
        rawSql: pg.handle.sql,
      },
    });
  }

  async function seedRepo() {
    const name = `onboarding-tour-${Math.random().toString(36).slice(2)}`;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
      .returning();
    return repo!;
  }

  it('GET with no cache returns {tour: null}; POST persists into onboarding; GET then reloads it with ZERO model calls', async () => {
    const app = await appWith();
    const repo = await seedRepo();

    const getEmpty = await app.inject({ method: 'GET', url: `/repos/${repo.id}/onboarding` });
    expect(getEmpty.statusCode).toBe(200);
    expect(getEmpty.json().tour).toBeNull();

    const post = await app.inject({ method: 'POST', url: `/repos/${repo.id}/onboarding` });
    expect(post.statusCode).toBe(200);
    const postBody = post.json();
    expect(() => OnboardingTour.parse(postBody.tour)).not.toThrow();
    // Seeded repo has no clonePath → no setup evidence collected →
    // local_setup downgrades to "unavailable" → top status "partial"; the
    // point of this test is the DB round trip, not the status breakdown
    // (covered precisely by the hermetic `onboarding-tour-generate.test.ts`).
    expect(postBody.tour.status).toBe('partial');
    expect(postBody.cached_tour_preserved).toBe(false);

    const [row] = await pg.handle.db.select().from(t.onboarding).where(eq(t.onboarding.repoId, repo.id));
    expect(row).toBeDefined();

    const get = await app.inject({ method: 'GET', url: `/repos/${repo.id}/onboarding` });
    expect(get.statusCode).toBe(200);
    expect(get.json().tour.status).toBe('partial');

    await app.close();
  });

  it('a second concurrent POST for the same repo returns 409 while the first is in flight (real pg_try_advisory_lock)', async () => {
    const app = await appWith({ generateDelayMs: 200 });
    const repo = await seedRepo();

    const [first, second] = await Promise.all([
      app.inject({ method: 'POST', url: `/repos/${repo.id}/onboarding` }),
      new Promise<Awaited<ReturnType<typeof app.inject>>>((resolve) =>
        setTimeout(() => app.inject({ method: 'POST', url: `/repos/${repo.id}/onboarding` }).then(resolve), 20),
      ),
    ]);

    const statuses = [first.statusCode, second.statusCode].sort();
    expect(statuses).toEqual([200, 409]);

    await app.close();
  });

  it('a zero-call ineligible-index regeneration preserves the previously persisted cache in the real DB', async () => {
    const app = await appWith();
    const repo = await seedRepo();

    const first = await app.inject({ method: 'POST', url: `/repos/${repo.id}/onboarding` });
    expect(first.statusCode).toBe(200);
    const [rowAfterFirst] = await pg.handle.db.select().from(t.onboarding).where(eq(t.onboarding.repoId, repo.id));
    expect(rowAfterFirst).toBeDefined();
    const jsonAfterFirst = rowAfterFirst!.json;

    // Same repo, same real `onboarding` row — a SECOND app instance with
    // repo-intel disabled regenerates via the zero-call skeleton path, which
    // must leave the row written by the first app's POST untouched.
    const appDisabled = await appWith({ repoIntelEnabled: false });
    const second = await appDisabled.inject({ method: 'POST', url: `/repos/${repo.id}/onboarding` });
    expect(second.statusCode).toBe(200);
    expect(second.json().tour.status).toBe('skeleton');
    expect(second.json().cached_tour_preserved).toBe(true);

    const [rowAfterSecond] = await pg.handle.db.select().from(t.onboarding).where(eq(t.onboarding.repoId, repo.id));
    expect(rowAfterSecond!.json).toEqual(jsonAfterFirst); // byte-identical — never overwritten

    await app.close();
    await appDisabled.close();
  });
});
