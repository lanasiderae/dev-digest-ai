import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { PrHistory } from '@devdigest/shared';

/**
 * Integration coverage for `GET /pulls/:id/history`. No LLM mock, no
 * RepoIntel stub — this route is pure DB (pull_requests + pr_files), unlike
 * `blast`.
 */

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

d('Prior PR history (Testcontainers pg)', () => {
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

  function appWith() {
    return buildApp({ config: config(), db: pg.handle.db });
  }

  async function seedRepo(opts: { otherWorkspace?: boolean } = {}) {
    const wsId = opts.otherWorkspace
      ? (
          await pg.handle.db
            .insert(t.workspaces)
            .values({ name: `other-${Math.random().toString(36).slice(2)}` })
            .returning()
        )[0]!.id
      : workspaceId;
    const name = `history-${Math.random().toString(36).slice(2)}`;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId: wsId, owner: 'acme', name, fullName: `acme/${name}` })
      .returning();
    return { repo: repo!, wsId };
  }

  async function seedPr(
    repoId: string,
    wsId: string,
    opts: { number: number; status: string; files: string[]; title?: string; author?: string },
  ) {
    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId: wsId,
        repoId,
        number: opts.number,
        title: opts.title ?? `PR #${opts.number}`,
        author: opts.author ?? 'dev',
        branch: `feat/${opts.number}`,
        base: 'main',
        headSha: `sha-${opts.number}`,
        additions: 1,
        deletions: 0,
        filesCount: opts.files.length,
        status: opts.status,
      })
      .returning();
    if (opts.files.length > 0) {
      await pg.handle.db
        .insert(t.prFiles)
        .values(opts.files.map((path) => ({ prId: pr!.id, path, additions: 1, deletions: 0, patch: null })));
    }
    return pr!;
  }

  it('returns a merged prior PR that shares a file, with the shared path(s) in files_overlap', async () => {
    const { repo, wsId } = await seedRepo();
    await seedPr(repo.id, wsId, {
      number: 1,
      status: 'merged',
      files: ['server/src/foo.ts', 'server/src/unrelated.ts'],
      title: 'Earlier change',
      author: 'alice',
    });
    const current = await seedPr(repo.id, wsId, { number: 2, status: 'needs_review', files: ['server/src/foo.ts'] });

    const app = await appWith();
    const res = await app.inject({ method: 'GET', url: `/pulls/${current.id}/history` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(() => PrHistory.parse(body)).not.toThrow();
    expect(body.history).toHaveLength(1);
    expect(body.history[0]).toMatchObject({
      pr_number: 1,
      title: 'Earlier change',
      author: 'alice',
      files_overlap: ['server/src/foo.ts'],
    });

    await app.close();
  });

  it('excludes a PR that shares a file but is not merged (status=open)', async () => {
    const { repo, wsId } = await seedRepo();
    await seedPr(repo.id, wsId, { number: 1, status: 'open', files: ['server/src/foo.ts'] });
    const current = await seedPr(repo.id, wsId, { number: 2, status: 'needs_review', files: ['server/src/foo.ts'] });

    const app = await appWith();
    const res = await app.inject({ method: 'GET', url: `/pulls/${current.id}/history` });
    expect(res.json().history).toEqual([]);

    await app.close();
  });

  it('excludes a merged PR in the same repo with no overlapping files', async () => {
    const { repo, wsId } = await seedRepo();
    await seedPr(repo.id, wsId, { number: 1, status: 'merged', files: ['server/src/other.ts'] });
    const current = await seedPr(repo.id, wsId, { number: 2, status: 'needs_review', files: ['server/src/foo.ts'] });

    const app = await appWith();
    const res = await app.inject({ method: 'GET', url: `/pulls/${current.id}/history` });
    expect(res.json().history).toEqual([]);

    await app.close();
  });

  it('an unknown uuid returns 404', async () => {
    const app = await appWith();
    const res = await app.inject({
      method: 'GET',
      url: `/pulls/00000000-0000-0000-0000-000000000000/history`,
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('a non-uuid id returns 422', async () => {
    const app = await appWith();
    const res = await app.inject({ method: 'GET', url: `/pulls/not-a-uuid/history` });
    expect(res.statusCode).toBe(422);
    await app.close();
  });

  it('a PR in another workspace returns 404, not 200', async () => {
    const { repo, wsId } = await seedRepo({ otherWorkspace: true });
    const pr = await seedPr(repo.id, wsId, { number: 1, status: 'needs_review', files: ['server/src/foo.ts'] });

    const app = await appWith();
    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/history` });
    expect(res.statusCode).toBe(404);

    await app.close();
  });
});
