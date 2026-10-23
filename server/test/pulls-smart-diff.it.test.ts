import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { waitForPrRuns } from './helpers/runs.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import { MockLLMProvider, MockEmbedder, MockGitClient } from '../src/adapters/mocks.js';
import * as t from '../src/db/schema.js';
import type { Intent, Review } from '@devdigest/shared';

/** The review-triggering route also runs the Intent Layer's eager pre-work,
 *  which resolves `openrouter` by default — mock it too, or this test would
 *  hit a real provider whenever a real OPENROUTER_API_KEY happens to be
 *  configured on the machine running it. */
const INTENT_FIXTURE: Intent = { intent: 'test PR', in_scope: [], out_of_scope: [] };

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

const DIFF = `diff --git a/server/src/foo.ts b/server/src/foo.ts
--- a/server/src/foo.ts
+++ b/server/src/foo.ts
@@ -10,3 +10,4 @@
   port: 3000,
+  added: true,
   other: x,`;

const REVIEW_FIXTURE: Review = {
  verdict: 'comment',
  summary: 'Looks fine.',
  score: 97,
  findings: [
    {
      id: 'f1',
      severity: 'SUGGESTION',
      category: 'style',
      title: 'Minor nit',
      file: 'server/src/foo.ts',
      start_line: 11,
      end_line: 11,
      rationale: 'Stylistic only.',
      confidence: 0.6,
      kind: 'finding',
    },
  ],
};

d('Smart Diff (Testcontainers pg)', () => {
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
    return buildApp({
      config: config(),
      db: pg.handle.db,
      overrides: {
        embedder: new MockEmbedder(),
        git: new MockGitClient({ diff: DIFF }),
        llm: {
          openai: new MockLLMProvider('openai', { structured: REVIEW_FIXTURE }),
          openrouter: new MockLLMProvider('openai', { structuredBySchema: { PrIntent: INTENT_FIXTURE } }),
        },
      },
    });
  }

  async function seedRepoAndPr() {
    const name = `smart-diff-${Math.random().toString(36).slice(2)}`;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
      .returning();
    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 7,
        title: 'Add a feature',
        author: 'dev',
        branch: 'feat/x',
        base: 'main',
        headSha: 'deadbeef',
        additions: 3,
        deletions: 0,
        filesCount: 3,
        status: 'needs_review',
      })
      .returning();
    await pg.handle.db.insert(t.prFiles).values([
      {
        prId: pr!.id,
        path: 'server/src/foo.ts',
        additions: 1,
        deletions: 0,
        patch: '@@ -10,3 +10,4 @@\n   port: 3000,\n+  added: true,\n   other: x,',
      },
      { prId: pr!.id, path: 'server/test/foo.test.ts', additions: 1, deletions: 0, patch: null },
      { prId: pr!.id, path: 'pnpm-lock.yaml', additions: 1, deletions: 0, patch: null },
    ]);
    return { repo: repo!, pr: pr! };
  }

  it('groups files by role before any review exists, with no findings and no model call', async () => {
    const app = await appWith();
    const { pr } = await seedRepoAndPr();

    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/smart-diff` });
    expect(res.statusCode).toBe(200);
    const body = res.json();

    expect(body.groups.map((g: { role: string }) => g.role)).toEqual(['core', 'tests', 'boilerplate']);
    const core = body.groups.find((g: { role: string }) => g.role === 'core');
    expect(core.files).toHaveLength(1);
    expect(core.files[0].path).toBe('server/src/foo.ts');
    expect(core.files[0].finding_lines).toEqual([]);

    await app.close();
  });

  it('anchors open-finding lines onto the right file after a review runs', async () => {
    const app = await appWith();
    const { pr } = await seedRepoAndPr();
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'SmartDiffAgent', provider: 'openai', model: 'gpt-4.1', system_prompt: 's' },
      })
    ).json();

    await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } });
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });

    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/smart-diff` });
    const body = res.json();
    const core = body.groups.find((g: { role: string }) => g.role === 'core');
    expect(core.files[0].finding_lines).toEqual([11]);

    await app.close();
  });

  it('a dismissed finding no longer anchors a line', async () => {
    const app = await appWith();
    const { pr } = await seedRepoAndPr();
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'DismissAgent', provider: 'openai', model: 'gpt-4.1', system_prompt: 's' },
      })
    ).json();
    await app.inject({ method: 'POST', url: `/pulls/${pr.id}/review`, payload: { agentId: agent.id } });
    await waitForPrRuns(pg.handle.db, pr.id, { expected: 1 });

    const reviews = (await app.inject({ method: 'GET', url: `/pulls/${pr.id}/reviews` })).json();
    const findingId = reviews[0].findings[0].id;
    await app.inject({ method: 'POST', url: `/findings/${findingId}/dismiss` });

    const res = await app.inject({ method: 'GET', url: `/pulls/${pr.id}/smart-diff` });
    const core = res.json().groups.find((g: { role: string }) => g.role === 'core');
    expect(core.files[0].finding_lines).toEqual([]);

    await app.close();
  });
});
