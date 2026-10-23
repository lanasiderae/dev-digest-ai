/** Opt-in L05 browser fixtures. Never invoked by normal application seeding. */
import { execFileSync } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { createDb } from './client.js';
import * as t from './schema.js';
import { PrBrief } from '../vendor/shared/contracts/brief.js';
import { OnboardingTour, ONBOARDING_TOUR_SECTION_KEYS } from '../vendor/shared/contracts/onboarding.js';
import { RunTrace } from '../vendor/shared/contracts/trace.js';
import { buildProjectContextAttachment } from '../modules/reviews/pipeline/project-context.js';
import { TiktokenTokenizer } from '../adapters/tokenizer/index.js';

const root = process.env.E2E_FIXTURE_ROOT;
if (process.env.E2E_FIXTURES !== '1' || !root || !process.env.DATABASE_URL) {
  throw new Error('Requires E2E_FIXTURES=1, E2E_FIXTURE_ROOT (temporary directory), and an isolated DATABASE_URL.');
}
if (resolve(root).includes('/server/clones')) throw new Error('Fixtures must use a temporary clone directory.');
const handle = createDb(process.env.DATABASE_URL);
try {
  // Fail closed before touching data: only the freshly seeded demo repository
  // and no actual review executions may exist in this isolated database.
  const repos = await handle.db.select().from(t.repos);
  const runs = await handle.db.select({ id: t.agentRuns.id }).from(t.agentRuns);
  const repo = repos[0];
  if (repos.length !== 1 || repo?.fullName !== 'acme/payments-api' || repo.clonePath || runs.length) {
    throw new Error('Refusing fixtures: expected a fresh demo-only DB without clones or runs.');
  }
  const [pr] = await handle.db.select().from(t.pullRequests)
    .where(and(eq(t.pullRequests.repoId, repo.id), eq(t.pullRequests.number, 482)));
  const [agent] = await handle.db.select().from(t.agents).where(eq(t.agents.name, 'Security Reviewer'));
  if (!pr || !agent) throw new Error('Run normal demo seed first.');

  const clone = join(root, 'clones', repo.owner, repo.name);
  const path = 'specs/smoke.md';
  const content = '# Smoke architecture rule\nThe api/ module must not import db/ directly.\n';
  await mkdir(join(clone, 'specs'), { recursive: true });
  await writeFile(join(clone, path), content);
  const git = (...args: string[]) => execFileSync('git', ['-C', clone, ...args], { encoding: 'utf8' }).trim();
  git('init', '-q');
  git('add', '.');
  git('-c', 'user.name=E2E Fixture', '-c', 'user.email=e2e@example.invalid', 'commit', '-qm', 'Static smoke context');
  const revision = git('rev-parse', 'HEAD');
  await handle.db.update(t.repos).set({ clonePath: clone }).where(eq(t.repos.id, repo.id));
  await handle.db.update(t.prFiles).set({
    patch: '@@ -10,0 +11,3 @@\n+export const port = 3001;\n+export const secret = "fixture-only";\n+export const timeout = 1000;',
  }).where(and(eq(t.prFiles.prId, pr.id), eq(t.prFiles.path, 'src/config.ts')));

  const unavailable = (reason: string) => ({ status: 'unavailable' as const, reason });
  const brief = PrBrief.parse({
    summary: 'Cached smoke brief: inspect configuration before merging.',
    intent: null, blast: null, history: { history: [] },
    risks: { risks: [{ kind: 'configuration', title: 'Configuration exposure', explanation: 'Check the new configuration value.', severity: 'high', file_refs: ['src/config.ts'] }] },
    review_focus: [{ file: 'src/config.ts', line: 12, reason: 'Verify the configuration value at this exact line.' }],
    sources: { intent: unavailable('Intent not derived.'), blast: unavailable('Repository index unavailable.'), issue: unavailable('No linked issue.'), reviewer_context: unavailable('Reviewer context not selected.'), documents: unavailable('No documents selected.') },
    provenance: { reviewer_agent_id: null, skill_ids: [], documents: [], pr_linked_spec_path: null, head_sha: pr.headSha, context_fingerprint: 'static-smoke-fixture', generated_at: '2026-10-23T00:00:00Z' },
  });
  await handle.db.insert(t.prBrief).values({ prId: pr.id, json: brief });
  await handle.db.insert(t.pullRequests).values({
    workspaceId: repo.workspaceId, repoId: repo.id, number: 483,
    title: 'Empty brief smoke fixture', author: 'e2e-fixture',
    branch: 'smoke/empty', base: 'main', headSha: pr.headSha,
  });

  const [fallback] = await handle.db.insert(t.repos).values({ workspaceId: repo.workspaceId, owner: 'acme', name: 'smoke-unindexed', fullName: 'acme/smoke-unindexed', createdAt: new Date('2099-01-01') }).returning();
  if (!fallback) throw new Error('Could not create fallback fixture');
  for (const [row, skeleton] of [[repo, false], [fallback, true]] as const) {
    const tour = OnboardingTour.parse({
      repo_id: row.id, status: skeleton ? 'skeleton' : 'complete', reason: skeleton ? 'Repository index unavailable — static smoke fixture.' : null,
      index_revision: skeleton ? null : revision, attempt: null,
      sections: Object.fromEntries(ONBOARDING_TOUR_SECTION_KEYS.map((key) => [key, {
        narrative: skeleton ? null : `Cached smoke tour: ${key.replaceAll('_', ' ')}.`,
        evidence: skeleton ? [] : [{ repo_id: repo.id, path, note: 'Static test evidence' }],
        status: skeleton ? 'skeleton' : 'generated', reason: skeleton ? 'Repository index unavailable.' : null,
      }])),
      omissions: skeleton ? [{ path: null, reason: 'index_unavailable', detail: null }] : [], generated_at: '2026-10-23T00:00:00Z',
    });
    await handle.db.insert(t.onboarding).values({ repoId: row.id, json: tour });
  }

  // Historical UI snapshot, NOT evidence of an actual model execution.
  const attachment = buildProjectContextAttachment([{ repo_id: repo.id, path, type: 'specs', revision, content }], [], 4000, new TiktokenTokenizer());
  const trace = RunTrace.parse({
    config: { agent: agent.name, model: 'static-smoke-fixture', pr: 482, source: 'local' },
    stats: { duration_ms: 0, tokens_in: 0, tokens_out: 0, cost_usd: null, findings: 0, grounding: 'fixture' },
    prompt_assembly: { system: 'Static browser fixture; no model was called.', user: 'Fixture', specs: attachment.snapshot.attached_specs },
    tool_calls: [], raw_output: 'Static browser fixture', memory_pulled: [], specs_read: [path], project_context: attachment.snapshot, log: [],
  });
  const [run] = await handle.db.insert(t.agentRuns).values({ workspaceId: repo.workspaceId, agentId: agent.id, prId: pr.id, model: 'static-smoke-fixture', status: 'done', findingsCount: 0 }).returning();
  if (!run) throw new Error('Could not create trace fixture');
  await handle.db.insert(t.runTraces).values({ runId: run.id, trace });
  const manifest = { REPO_ID: repo.id, AGENT_ID: agent.id, FALLBACK_REPO_ID: fallback.id };
  await writeFile(join(root, 'variables.json'), JSON.stringify(manifest));
  console.log('L05 static browser fixtures ready (no model calls).');
} finally {
  await handle.close();
}
