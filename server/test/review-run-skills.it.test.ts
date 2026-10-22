import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { waitForPrRuns } from './helpers/runs.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import { MockLLMProvider, MockGitClient } from '../src/adapters/mocks.js';
import * as t from '../src/db/schema.js';
import type { Intent, Review } from '@devdigest/shared';

/** The review-triggering routes also run the Intent Layer's eager pre-work,
 *  which resolves `openrouter` by default — mock it too, or this test would
 *  hit a real provider whenever a real OPENROUTER_API_KEY happens to be
 *  configured on the machine running it. */
const INTENT_FIXTURE: Intent = { intent: 'test PR', in_scope: [], out_of_scope: [] };

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[review-run-skills] Docker not available — skipping integration tests.');
}

const DIFF = `diff --git a/src/config.ts b/src/config.ts
--- a/src/config.ts
+++ b/src/config.ts
@@ -10,3 +10,4 @@
   port: 3000,
+  stripeKey: "sk_live_xxx",
   redisUrl: x,`;

const REVIEW_FIXTURE: Review = {
  verdict: 'request_changes',
  summary: 'Hardcoded secret.',
  score: 60,
  findings: [
    {
      id: 'f1',
      severity: 'CRITICAL',
      category: 'security',
      title: 'Hardcoded Stripe secret key',
      file: 'src/config.ts',
      start_line: 11,
      end_line: 11,
      rationale: 'sk_live in diff',
      confidence: 0.95,
      kind: 'finding',
      matched_skill: 'secret-leakage-gate',
    },
  ],
};

/**
 * End-to-end: an agent with one ENABLED and one DISABLED linked skill runs a
 * review. Asserts the resolved, wrapUntrusted()-wrapped ENABLED skill body
 * reaches the actual LLM prompt and the persisted run trace, and the
 * DISABLED one never does — i.e. the execution-wiring decision (skills
 * actually affect review output, gated by the skill's own `enabled` flag)
 * works end-to-end, not just at the management-API layer.
 */
d('Review run resolves enabled linked skills into the prompt (Testcontainers pg)', () => {
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

  function makeApp() {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({
      config,
      db: pg.handle.db,
      overrides: {
        git: new MockGitClient({ diff: DIFF }),
        llm: {
          openai: new MockLLMProvider('openai', { structured: REVIEW_FIXTURE }),
          openrouter: new MockLLMProvider('openai', { structuredBySchema: { PrIntent: INTENT_FIXTURE } }),
        },
      },
    });
  }

  it('an enabled linked skill reaches the prompt; a disabled one does not', async () => {
    const app = await makeApp();

    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: 'skills-wiring', fullName: 'acme/skills-wiring' })
      .returning();
    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 7,
        title: 'Add a key',
        author: 'dev',
        branch: 'feat/x',
        base: 'main',
        headSha: 'deadbeef',
        additions: 1,
        deletions: 0,
        filesCount: 1,
        status: 'needs_review',
      })
      .returning();
    await pg.handle.db.insert(t.prFiles).values({
      prId: pr!.id,
      path: 'src/config.ts',
      additions: 1,
      deletions: 0,
      patch: '@@ -10,3 +10,4 @@\n   port: 3000,\n+  stripeKey: "sk_live_xxx",\n   redisUrl: x,',
    });

    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Skill Wiring Agent', provider: 'openai', model: 'gpt-4.1', system_prompt: 'Review.' },
      })
    ).json();

    const enabledSkill = (
      await app.inject({
        method: 'POST',
        url: '/skills',
        payload: {
          name: 'secret-leakage-gate',
          description: 'Flags hardcoded secrets.',
          type: 'security',
          body: 'Flag any hardcoded API key or secret.',
          enabled: true,
        },
      })
    ).json();
    const disabledSkill = (
      await app.inject({
        method: 'POST',
        url: '/skills',
        payload: {
          name: 'not-yet-vetted-skill',
          description: 'An unvetted import.',
          type: 'custom',
          body: 'UNVETTED CONTENT THAT MUST NEVER REACH THE PROMPT.',
          source: 'imported_url',
        },
      })
    ).json();
    expect(disabledSkill.enabled).toBe(false);

    await app.inject({
      method: 'POST',
      url: `/agents/${agent.id}/skills`,
      payload: { skill_ids: [enabledSkill.id, disabledSkill.id] },
    });

    const started = await app.inject({
      method: 'POST',
      url: `/pulls/${pr!.id}/review`,
      payload: { agentId: agent.id },
    });
    expect(started.statusCode).toBe(200);
    const runId = started.json().runs[0].run_id;

    await waitForPrRuns(pg.handle.db, pr!.id, { expected: 1 });

    const trace = (await app.inject({ method: 'GET', url: `/runs/${runId}/trace` })).json();
    expect(trace.prompt_assembly.skills).not.toBeNull();
    expect(trace.prompt_assembly.skills).toContain('secret-leakage-gate');
    expect(trace.prompt_assembly.skills).toContain('Flag any hardcoded API key or secret.');
    expect(trace.prompt_assembly.skills).not.toContain('UNVETTED CONTENT THAT MUST NEVER REACH THE PROMPT.');

    // The persisted run log (surfaced in the trace drawer's "Run log"
    // section, not just the live SSE stream) records how many skills were
    // actually resolved into the prompt — only the one enabled skill counts.
    expect(trace.log.some((l: { msg: string }) => l.msg === 'Skills: 1 skill(s) attached to prompt')).toBe(
      true,
    );

    // The model-reported matched_skill, naming an actually-enabled linked
    // skill, survives sanitizeMatchedSkills() and persists on the finding.
    const reviews = (await app.inject({ method: 'GET', url: `/pulls/${pr!.id}/reviews` })).json();
    const finding = reviews[0].findings[0];
    expect(finding.matched_skill).toBe('secret-leakage-gate');

    await app.close();
  });
});
