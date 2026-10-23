import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { BlastRadiusResponse } from '@devdigest/shared';
import type {
  BlastResult,
  FileRankRow,
  IndexResult,
  IndexState,
  RefRow,
  RepoIntel,
  RepoMapResult,
  SignatureRow,
  SymbolRow,
} from '../src/modules/repo-intel/types.js';

/**
 * Integration coverage for `GET /pulls/:id/blast`. No LLM mock is needed —
 * this endpoint makes no model call; it only reads `pr_files` + calls the
 * injected `RepoIntel` stub exactly once.
 */

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

/** Minimal stub RepoIntel — only `getBlastRadius` does real work; it also
 *  records every call so tests can assert call count + arguments. */
class StubRepoIntel implements RepoIntel {
  calls: { repoId: string; changedFiles: string[] }[] = [];
  constructor(private result: BlastResult) {}

  async getBlastRadius(repoId: string, changedFiles: string[]): Promise<BlastResult> {
    this.calls.push({ repoId, changedFiles });
    return this.result;
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
}

d('Blast Radius (Testcontainers pg)', () => {
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

  function appWith(repoIntel: RepoIntel) {
    return buildApp({ config: config(), db: pg.handle.db, overrides: { repoIntel } });
  }

  async function seedRepoAndPr(opts: { otherWorkspace?: boolean } = {}) {
    const wsId = opts.otherWorkspace
      ? (
          await pg.handle.db
            .insert(t.workspaces)
            .values({ name: `other-${Math.random().toString(36).slice(2)}` })
            .returning()
        )[0]!.id
      : workspaceId;
    const name = `blast-${Math.random().toString(36).slice(2)}`;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId: wsId, owner: 'acme', name, fullName: `acme/${name}` })
      .returning();
    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId: wsId,
        repoId: repo!.id,
        number: 11,
        title: 'Add a feature',
        author: 'dev',
        branch: 'feat/x',
        base: 'main',
        headSha: 'deadbeef',
        additions: 3,
        deletions: 0,
        filesCount: 1,
        status: 'needs_review',
      })
      .returning();
    await pg.handle.db.insert(t.prFiles).values([
      { prId: pr!.id, path: 'server/src/foo.ts', additions: 1, deletions: 0, patch: null },
    ]);
    return { repo: repo!, pr: pr! };
  }

  it('returns 200 with a body that parses against BlastRadiusResponse, calling getBlastRadius exactly once with the persisted pr_files paths', async () => {
    const stub = new StubRepoIntel({
      changedSymbols: [{ file: 'server/src/foo.ts', name: 'rateLimit', kind: 'function' }],
      callers: [{ file: 'server/src/bar.ts', symbol: 'caller', viaSymbol: 'rateLimit', line: 10, rank: 1 }],
      impactedEndpoints: [],
      degraded: false,
    });
    const app = await appWith(stub);
    const { pr, repo } = await seedRepoAndPr();

    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/blast` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(() => BlastRadiusResponse.parse(body)).not.toThrow();
    expect(body.degraded).toBe(false);

    expect(stub.calls).toHaveLength(1);
    expect(stub.calls[0]).toEqual({ repoId: repo.id, changedFiles: ['server/src/foo.ts'] });

    await app.close();
  });

  it('surfaces degraded:true + the stub reason', async () => {
    const stub = new StubRepoIntel({
      changedSymbols: [],
      callers: [],
      impactedEndpoints: [],
      degraded: true,
      reason: 'index_partial',
    });
    const app = await appWith(stub);
    const { pr } = await seedRepoAndPr();

    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/blast` });
    const body = res.json();
    expect(body.degraded).toBe(true);
    expect(body.reason).toBe('index_partial');

    await app.close();
  });

  it('an unknown uuid returns 404', async () => {
    const app = await appWith(new StubRepoIntel({ changedSymbols: [], callers: [], impactedEndpoints: [] }));
    const res = await app.inject({
      method: 'GET',
      url: `/pulls/00000000-0000-0000-0000-000000000000/blast`,
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('a non-uuid id returns 422', async () => {
    const app = await appWith(new StubRepoIntel({ changedSymbols: [], callers: [], impactedEndpoints: [] }));
    const res = await app.inject({ method: 'GET', url: `/pulls/not-a-uuid/blast` });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('a PR in another workspace returns 404, not 200', async () => {
    const app = await appWith(new StubRepoIntel({ changedSymbols: [], callers: [], impactedEndpoints: [] }));
    const { pr } = await seedRepoAndPr({ otherWorkspace: true });

    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/blast` });
    expect(res.statusCode).toBe(404);

    await app.close();
  });
});
