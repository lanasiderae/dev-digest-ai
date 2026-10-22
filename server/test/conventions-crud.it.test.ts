/**
 * Conventions CRUD (GET/PATCH routes) + re-scan semantics (Testcontainers pg).
 *
 * The LLM-calling `extract` path is covered by the mocked unit test
 * (`conventions-extract.test.ts`) — this suite exercises what actually needs
 * real Postgres: listing/patching persisted rows over HTTP, and
 * `ConventionsRepository.replacePending` never touching a row the user
 * already accepted OR rejected.
 */
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { ConventionsRepository } from '../src/modules/conventions/repository.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

d('Conventions CRUD + re-scan (Testcontainers pg)', () => {
  let pg: PgFixture;
  let workspaceId: string;
  let repoId: string;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    workspaceId = ws!.id;
    const [repo] = await pg.handle.db.select().from(t.repos).where(eq(t.repos.workspaceId, workspaceId));
    repoId = repo!.id;
  });
  afterAll(async () => {
    await pg?.stop();
  });
  // Each test inserts its own convention rows against the same shared
  // repo/workspace — clear between tests so one test's rows can't leak into
  // another's assertions (e.g. an exact `repo.list(...)` equality check).
  beforeEach(async () => {
    await pg.handle.db.delete(t.conventions).where(eq(t.conventions.repoId, repoId));
  });

  function makeApp() {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({ config, db: pg.handle.db });
  }

  it('GET lists candidates, PATCH accepts one', async () => {
    const app = await makeApp();
    const [row] = await pg.handle.db
      .insert(t.conventions)
      .values({
        workspaceId,
        repoId,
        rule: 'Prefer named exports',
        evidencePath: 'src/index.ts',
        evidenceSnippet: 'export function foo() {}',
        confidence: 0.8,
        accepted: false,
      })
      .returning();

    const list = await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` });
    expect(list.statusCode).toBe(200);
    expect(list.json()).toContainEqual(expect.objectContaining({ id: row!.id, accepted: false }));

    const patched = await app.inject({
      method: 'PATCH',
      url: `/conventions/${row!.id}`,
      payload: { accepted: true },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().accepted).toBe(true);
    expect(patched.json().rejected).toBe(false);
    await app.close();
  });

  it('PATCH accept/reject are mutually exclusive — rejecting an accepted row clears accepted, and vice versa', async () => {
    const app = await makeApp();
    const [row] = await pg.handle.db
      .insert(t.conventions)
      .values({
        workspaceId,
        repoId,
        rule: 'Mutually exclusive check',
        evidencePath: 'src/index.ts',
        evidenceSnippet: 'x',
        confidence: 0.6,
        accepted: true,
      })
      .returning();

    const rejected = await app.inject({
      method: 'PATCH',
      url: `/conventions/${row!.id}`,
      payload: { rejected: true },
    });
    expect(rejected.json()).toMatchObject({ accepted: false, rejected: true });

    const acceptedAgain = await app.inject({
      method: 'PATCH',
      url: `/conventions/${row!.id}`,
      payload: { accepted: true },
    });
    expect(acceptedAgain.json()).toMatchObject({ accepted: true, rejected: false });
    await app.close();
  });

  it('a rejected candidate does not reappear in GET after a reload', async () => {
    const app = await makeApp();
    const [row] = await pg.handle.db
      .insert(t.conventions)
      .values({
        workspaceId,
        repoId,
        rule: 'User explicitly rejected this',
        evidencePath: 'd.ts',
        evidenceSnippet: 'd',
        confidence: 0.4,
        accepted: false,
        rejected: true,
      })
      .returning();

    const list = await app.inject({ method: 'GET', url: `/repos/${repoId}/conventions` });
    expect(list.json()).not.toContainEqual(expect.objectContaining({ id: row!.id }));
    await app.close();
  });

  it('replacePending drops stale pending rows but never touches accepted OR rejected ones', async () => {
    const repo = new ConventionsRepository(pg.handle.db);
    const [acceptedRow] = await pg.handle.db
      .insert(t.conventions)
      .values({
        workspaceId,
        repoId,
        rule: 'Already accepted by the user',
        evidencePath: 'a.ts',
        evidenceSnippet: 'a',
        confidence: 0.95,
        accepted: true,
      })
      .returning();
    const [rejectedRow] = await pg.handle.db
      .insert(t.conventions)
      .values({
        workspaceId,
        repoId,
        rule: 'Already rejected by the user',
        evidencePath: 'r.ts',
        evidenceSnippet: 'r',
        confidence: 0.3,
        rejected: true,
      })
      .returning();
    await pg.handle.db.insert(t.conventions).values({
      workspaceId,
      repoId,
      rule: 'Stale candidate from a prior scan',
      evidencePath: 'b.ts',
      evidenceSnippet: 'b',
      confidence: 0.5,
      accepted: false,
    });

    const fresh = await repo.replacePending(workspaceId, repoId, [
      {
        workspaceId,
        repoId,
        rule: 'Fresh candidate from the new scan',
        evidencePath: 'c.ts',
        evidenceSnippet: 'c',
        confidence: 0.7,
      },
    ]);

    const rules = fresh.map((r) => r.rule);
    expect(rules).toEqual(['Fresh candidate from the new scan']);

    const all = await repo.list(workspaceId, repoId);
    expect(all.map((r) => r.rule).sort()).toEqual(
      ['Already accepted by the user', 'Already rejected by the user', 'Fresh candidate from the new scan'].sort(),
    );
    expect(all.find((r) => r.id === acceptedRow!.id)?.accepted).toBe(true);
    expect(all.find((r) => r.id === rejectedRow!.id)?.rejected).toBe(true);
  });
});
