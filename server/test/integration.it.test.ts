import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { MockGitClient, MockGitHubClient } from '../src/adapters/mocks.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn(
    '[integration] Docker not available — skipping Testcontainers integration tests.',
  );
}

d('Testcontainers: pg + pgvector', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it('migrations applied: every table exists', async () => {
    const rows = await pg.handle.sql<{ count: number }[]>`
      SELECT count(*)::int AS count FROM information_schema.tables
      WHERE table_schema = 'public'`;
    // 35 domain tables + drizzle migration bookkeeping
    expect(rows[0]!.count).toBeGreaterThanOrEqual(35);
  });

  it('pgvector extension is enabled', async () => {
    const rows = await pg.handle.sql<{ extname: string }[]>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'`;
    expect(rows).toHaveLength(1);
  });

  it('vector insert + similarity query round-trips', async () => {
    const { db } = pg.handle;
    const { workspaceId } = await seed(db);
    const [repo] = await db
      .insert(t.repos)
      .values({ workspaceId, owner: 'v', name: 'vec', fullName: 'v/vec' })
      .returning();
    const vec = Array.from({ length: 1536 }, (_, i) => (i === 0 ? 1 : 0));
    await db.insert(t.codeChunks).values({
      workspaceId,
      repoId: repo!.id,
      path: 'a.ts',
      content: 'hello',
      embedding: vec,
      source: 'code',
    });
    // cosine distance query against the same vector → distance ~0
    const literal = `[${vec.join(',')}]`;
    const rows = await pg.handle.sql<{ dist: number }[]>`
      SELECT embedding <=> ${literal}::vector AS dist
      FROM code_chunks WHERE repo_id = ${repo!.id}`;
    expect(rows[0]!.dist).toBeLessThan(0.0001);
  });

  it('seed is idempotent (re-run does not duplicate workspace)', async () => {
    await seed(pg.handle.db);
    await seed(pg.handle.db);
    const ws = await pg.handle.db.select().from(t.workspaces);
    expect(ws.filter((w) => w.name === 'default')).toHaveLength(1);
  });
});

d('Testcontainers: DB-backed routes via app.inject', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  it('POST /repos persists + enqueues a clone (mock git) and GET /repos lists it', async () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const git = new MockGitClient();
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git, github: new MockGitHubClient() },
    });

    const create = await app.inject({
      method: 'POST',
      url: '/repos',
      payload: { url: 'https://github.com/acme/widgets' },
    });
    expect(create.statusCode).toBe(201);
    expect(create.json().full_name).toBe('acme/widgets');

    await app.container.jobs.onIdle();
    expect(git.cloned.some((c) => c.repo.name === 'widgets')).toBe(true);

    const list = await app.inject({ method: 'GET', url: '/repos' });
    expect(list.json().some((r: { full_name: string }) => r.full_name === 'acme/widgets')).toBe(
      true,
    );
    await app.close();
  });

  it('GET /repos/:id/pulls imports PRs (mock GitHub) idempotently', async () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
    const repos = await app.inject({ method: 'GET', url: '/repos' });
    const repoId = repos.json()[0]!.id;

    const first = await app.inject({ method: 'GET', url: `/repos/${repoId}/pulls` });
    expect(first.statusCode).toBe(200);
    expect(first.json().length).toBeGreaterThan(0);
    // import again → still idempotent (unique repo_id+number)
    const second = await app.inject({ method: 'GET', url: `/repos/${repoId}/pulls` });
    expect(second.json().length).toBe(first.json().length);
    await app.close();
  });

  it("GET /repos/:id/pulls surfaces the latest review's findings_by_severity, not older reviews", async () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient({ pulls: [] }) },
    });
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    const workspaceId = ws!.id;

    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: 'findings-rollup', fullName: 'acme/findings-rollup' })
      .returning();
    const [prWithReviews] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 101,
        title: 'Add rate limiting',
        author: 'marisa.koch',
        branch: 'feat/rl',
        base: 'main',
        headSha: 'deadbeef',
        additions: 10,
        deletions: 2,
        filesCount: 1,
        status: 'open',
      })
      .returning();
    const [prUnreviewed] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 102,
        title: 'Unreviewed PR',
        author: 'deepak.r',
        branch: 'feat/other',
        base: 'main',
        headSha: 'cafef00d',
        additions: 3,
        deletions: 0,
        filesCount: 1,
        status: 'open',
      })
      .returning();

    const [olderReview] = await pg.handle.db
      .insert(t.reviews)
      .values({
        workspaceId,
        prId: prWithReviews!.id,
        kind: 'review',
        score: 20,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      })
      .returning();
    await pg.handle.db.insert(t.findings).values({
      reviewId: olderReview!.id,
      file: 'src/old.ts',
      startLine: 1,
      endLine: 1,
      severity: 'CRITICAL',
      category: 'security',
      title: 'Old critical finding (superseded)',
      rationale: 'From an earlier review run.',
      confidence: 0.9,
    });

    const [newerReview] = await pg.handle.db
      .insert(t.reviews)
      .values({
        workspaceId,
        prId: prWithReviews!.id,
        kind: 'review',
        score: 70,
        createdAt: new Date('2026-02-01T00:00:00Z'),
      })
      .returning();
    await pg.handle.db.insert(t.findings).values([
      {
        reviewId: newerReview!.id,
        file: 'src/new.ts',
        startLine: 1,
        endLine: 1,
        severity: 'WARNING',
        category: 'perf',
        title: 'New warning finding #1',
        rationale: 'From the latest review run.',
        confidence: 0.8,
      },
      {
        reviewId: newerReview!.id,
        file: 'src/new.ts',
        startLine: 5,
        endLine: 5,
        severity: 'WARNING',
        category: 'perf',
        title: 'New warning finding #2',
        rationale: 'From the latest review run.',
        confidence: 0.75,
      },
      {
        reviewId: newerReview!.id,
        file: 'src/new.ts',
        startLine: 9,
        endLine: 9,
        severity: 'SUGGESTION',
        category: 'style',
        title: 'New suggestion finding',
        rationale: 'From the latest review run.',
        confidence: 0.6,
      },
    ]);

    const res = await app.inject({ method: 'GET', url: `/repos/${repo!.id}/pulls` });
    expect(res.statusCode).toBe(200);
    const pulls = res.json() as { id: string; findings_by_severity: Record<string, number> }[];

    const reviewed = pulls.find((p) => p.id === prWithReviews!.id)!;
    // Only the NEWER review's findings count — the older review's CRITICAL
    // finding must not be summed in, proving "latest review only" (not a sum
    // across every historical run).
    expect(reviewed.findings_by_severity).toEqual({ CRITICAL: 0, WARNING: 2, SUGGESTION: 1 });

    const unreviewed = pulls.find((p) => p.id === prUnreviewed!.id)!;
    expect(unreviewed.findings_by_severity).toEqual({ CRITICAL: 0, WARNING: 0, SUGGESTION: 0 });
    expect(unreviewed.findings_by_agent).toEqual([]);

    await app.close();
  });

  it('GET /repos/:id/pulls Findings spans every agent that reviewed the PR, each at its own latest review', async () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient({ pulls: [] }) },
    });
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    const workspaceId = ws!.id;

    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: 'multi-agent-findings', fullName: 'acme/multi-agent-findings' })
      .returning();
    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 201,
        title: 'Reviewed by two agents',
        author: 'marisa.koch',
        branch: 'feat/multi',
        base: 'main',
        headSha: 'f00dface',
        additions: 20,
        deletions: 4,
        filesCount: 2,
        status: 'open',
      })
      .returning();

    const [security, perf] = await pg.handle.db
      .insert(t.agents)
      .values([
        {
          workspaceId,
          name: 'Security Reviewer',
          provider: 'openai' as const,
          model: 'gpt-4.1',
          systemPrompt: 'security',
        },
        {
          workspaceId,
          name: 'Perf Reviewer',
          provider: 'openai' as const,
          model: 'gpt-4.1',
          systemPrompt: 'perf',
        },
      ])
      .returning();

    const finding = (reviewId: string, severity: string, title: string) => ({
      reviewId,
      file: 'src/app.ts',
      startLine: 1,
      endLine: 1,
      severity,
      category: 'security',
      title,
      rationale: 'x',
      confidence: 0.9,
    });

    // Security agent reviewed twice — only its NEWER review may contribute.
    const [securityOld] = await pg.handle.db
      .insert(t.reviews)
      .values({
        workspaceId,
        prId: pr!.id,
        agentId: security!.id,
        kind: 'review',
        score: 30,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      })
      .returning();
    await pg.handle.db
      .insert(t.findings)
      .values(finding(securityOld!.id, 'CRITICAL', 'Superseded security finding'));

    const [securityNew] = await pg.handle.db
      .insert(t.reviews)
      .values({
        workspaceId,
        prId: pr!.id,
        agentId: security!.id,
        kind: 'review',
        score: 55,
        createdAt: new Date('2026-02-01T00:00:00Z'),
      })
      .returning();
    await pg.handle.db
      .insert(t.findings)
      .values([finding(securityNew!.id, 'CRITICAL', 'Hardcoded key')]);

    // Perf agent reviewed in between — its review is NOT the PR's latest, so
    // the old "latest review only" rule dropped these findings entirely.
    const [perfReview] = await pg.handle.db
      .insert(t.reviews)
      .values({
        workspaceId,
        prId: pr!.id,
        agentId: perf!.id,
        kind: 'review',
        score: 80,
        createdAt: new Date('2026-01-15T00:00:00Z'),
      })
      .returning();
    await pg.handle.db
      .insert(t.findings)
      .values([
        finding(perfReview!.id, 'WARNING', 'N+1 query'),
        finding(perfReview!.id, 'SUGGESTION', 'Extract helper'),
      ]);

    const res = await app.inject({ method: 'GET', url: `/repos/${repo!.id}/pulls` });
    expect(res.statusCode).toBe(200);
    const pulls = res.json() as {
      id: string;
      score: number | null;
      findings_by_severity: Record<string, number>;
      findings_by_agent: {
        agent_id: string | null;
        agent_name: string | null;
        review_id: string;
        counts: Record<string, number>;
      }[];
    }[];
    const row = pulls.find((p) => p.id === pr!.id)!;

    // BOTH agents count: 1 CRITICAL from Security's newest + Perf's 1 WARNING
    // and 1 SUGGESTION. Security's superseded CRITICAL is excluded, so the
    // total is 3 — not 2 (latest review only) and not 4 (every review ever).
    expect(row.findings_by_severity).toEqual({ CRITICAL: 1, WARNING: 1, SUGGESTION: 1 });

    // Per-agent breakdown, newest-reviewing agent first.
    expect(row.findings_by_agent).toEqual([
      {
        agent_id: security!.id,
        agent_name: 'Security Reviewer',
        review_id: securityNew!.id,
        counts: { CRITICAL: 1, WARNING: 0, SUGGESTION: 0 },
      },
      {
        agent_id: perf!.id,
        agent_name: 'Perf Reviewer',
        review_id: perfReview!.id,
        counts: { CRITICAL: 0, WARNING: 1, SUGGESTION: 1 },
      },
    ]);

    // SCORE stays the single latest review's (Security's newer one) — it is
    // deliberately NOT combined across agents.
    expect(row.score).toBe(55);

    await app.close();
  });

  it("GET /repos/:id/pulls Cost = SUM of every successful run's cost, not just the latest", async () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient({ pulls: [] }) },
    });
    const [ws] = await pg.handle.db.select().from(t.workspaces);
    const workspaceId = ws!.id;

    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name: 'cost-rollup', fullName: 'acme/cost-rollup' })
      .returning();
    const [prTwoSuccessfulRuns] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 201,
        title: 'Two successful re-reviews',
        author: 'marisa.koch',
        branch: 'feat/two-runs',
        base: 'main',
        headSha: 'deadbeef',
        additions: 10,
        deletions: 2,
        filesCount: 1,
        status: 'open',
      })
      .returning();
    const [prNoRuns] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 202,
        title: 'Never reviewed',
        author: 'deepak.r',
        branch: 'feat/never',
        base: 'main',
        headSha: 'cafef00d',
        additions: 3,
        deletions: 0,
        filesCount: 1,
        status: 'open',
      })
      .returning();

    // Two SUCCESSFUL runs (status='done') on the same PR, each costing
    // (1e6 tok in * $0.14 + 1e6 tok out * $0.28) / 1e6 = $0.42, from the
    // static pricing fallback in src/adapters/llm/pricing.ts.
    const [runA] = await pg.handle.db
      .insert(t.agentRuns)
      .values({
        workspaceId,
        prId: prTwoSuccessfulRuns!.id,
        model: 'deepseek/deepseek-v4-flash',
        status: 'done',
        tokensIn: 1_000_000,
        tokensOut: 1_000_000,
      })
      .returning();
    const [runB] = await pg.handle.db
      .insert(t.agentRuns)
      .values({
        workspaceId,
        prId: prTwoSuccessfulRuns!.id,
        model: 'deepseek/deepseek-v4-flash',
        status: 'done',
        tokensIn: 1_000_000,
        tokensOut: 1_000_000,
      })
      .returning();
    // A third, FAILED run — must not contribute to the sum.
    const [runFailed] = await pg.handle.db
      .insert(t.agentRuns)
      .values({
        workspaceId,
        prId: prTwoSuccessfulRuns!.id,
        model: 'deepseek/deepseek-v4-flash',
        status: 'failed',
        tokensIn: 1_000_000,
        tokensOut: 1_000_000,
      })
      .returning();

    await pg.handle.db.insert(t.reviews).values([
      {
        workspaceId,
        prId: prTwoSuccessfulRuns!.id,
        runId: runA!.id,
        kind: 'review',
        score: 60,
        createdAt: new Date('2026-01-01T00:00:00Z'),
      },
      {
        workspaceId,
        prId: prTwoSuccessfulRuns!.id,
        runId: runB!.id,
        kind: 'review',
        score: 80,
        createdAt: new Date('2026-02-01T00:00:00Z'),
      },
      {
        workspaceId,
        prId: prTwoSuccessfulRuns!.id,
        runId: runFailed!.id,
        kind: 'review',
        score: null,
        createdAt: new Date('2026-03-01T00:00:00Z'),
      },
    ]);

    const res = await app.inject({ method: 'GET', url: `/repos/${repo!.id}/pulls` });
    expect(res.statusCode).toBe(200);
    const pulls = res.json() as { id: string; cost: number | null }[];

    const reviewed = pulls.find((p) => p.id === prTwoSuccessfulRuns!.id)!;
    // Sum of both successful runs ($0.42 + $0.42), not either single run's
    // cost alone, and not inflated by the failed run (which costs null).
    expect(reviewed.cost).toBeCloseTo(0.84, 9);

    const unreviewed = pulls.find((p) => p.id === prNoRuns!.id)!;
    expect(unreviewed.cost).toBeNull();

    await app.close();
  });

  it('POST /repos/:id/poll syncs PR list and does NOT trigger a review', async () => {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    const app = await buildApp({
      config,
      db: pg.handle.db,
      overrides: { git: new MockGitClient(), github: new MockGitHubClient() },
    });
    const repoId = (await app.inject({ method: 'GET', url: '/repos' })).json()[0]!.id;
    const poll = await app.inject({ method: 'POST', url: `/repos/${repoId}/poll` });
    expect(poll.json().reviewTriggered).toBe(false);
    expect(poll.json().synced).toBeGreaterThan(0);
    await app.close();
  });
});
