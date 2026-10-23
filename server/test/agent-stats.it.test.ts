import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { AgentStats, AgentPerf } from '@devdigest/shared';

/**
 * Integration coverage for the L08 Agent Performance Dashboard
 * (`GET /agents/:id/stats`, `GET /agents/performance`) against a real
 * Postgres. No LLM/GitHub mock needed — this feature is a pure read-only
 * aggregation over already-persisted `agent_runs`/`reviews`/`findings` rows,
 * seeded directly here (bypassing the review-run pipeline, which is already
 * covered by `reviews.it.test.ts`).
 */

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

const config = () => loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);

// gpt-4.1 static pricing: in=$2.0/1M, out=$8.0/1M. 100,000 in / 50,000 out
// -> (100000*2 + 50000*8) / 1e6 = $0.60 exactly per done run — chosen so
// reconciliation assertions need no fuzzy rounding tolerance.
const TOKENS_IN = 100_000;
const TOKENS_OUT = 50_000;
const COST_PER_RUN = 0.6;

d('Agent Performance Dashboard (Testcontainers pg)', () => {
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

  let repoSeq = 0;
  async function seedRepoAndPr() {
    const name = `agent-stats-${repoSeq++}`;
    const [repo] = await pg.handle.db
      .insert(t.repos)
      .values({ workspaceId, owner: 'acme', name, fullName: `acme/${name}` })
      .returning();
    const [pr] = await pg.handle.db
      .insert(t.pullRequests)
      .values({
        workspaceId,
        repoId: repo!.id,
        number: 1,
        title: 'Add feature',
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
    return pr!;
  }

  async function createAgent(app: Awaited<ReturnType<typeof appWith>>, name: string) {
    const res = await app.inject({
      method: 'POST',
      url: '/agents',
      payload: { name, provider: 'openai', model: 'gpt-4.1', system_prompt: 'Review the diff.' },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  /** Seeds one 'done' agent_run + its review, with `decisions` findings split
   *  accepted/dismissed/pending, 1/3 each by default. Returns the run id. */
  async function seedDoneRun(opts: {
    agentId: string;
    prId: string;
    ranAt: Date;
    durationMs: number;
    findings: { accepted?: boolean; dismissed?: boolean }[];
  }) {
    const [run] = await pg.handle.db
      .insert(t.agentRuns)
      .values({
        workspaceId,
        agentId: opts.agentId,
        prId: opts.prId,
        ranAt: opts.ranAt,
        provider: 'openai',
        model: 'gpt-4.1',
        durationMs: opts.durationMs,
        tokensIn: TOKENS_IN,
        tokensOut: TOKENS_OUT,
        status: 'done',
        findingsCount: opts.findings.length,
        grounding: 'ok',
      })
      .returning();

    const [review] = await pg.handle.db
      .insert(t.reviews)
      .values({
        workspaceId,
        prId: opts.prId,
        agentId: opts.agentId,
        runId: run!.id,
        kind: 'review',
        verdict: 'request_changes',
        summary: 'summary',
        score: 70,
        model: 'gpt-4.1',
      })
      .returning();

    if (opts.findings.length > 0) {
      await pg.handle.db.insert(t.findings).values(
        opts.findings.map((f, i) => ({
          reviewId: review!.id,
          file: 'src/x.ts',
          startLine: i + 1,
          endLine: i + 1,
          severity: 'WARNING',
          category: 'bug',
          title: `Finding ${i}`,
          rationale: 'because',
          confidence: 0.8,
          kind: 'finding' as const,
          acceptedAt: f.accepted ? new Date() : null,
          dismissedAt: f.dismissed ? new Date() : null,
        })),
      );
    }
    return run!.id;
  }

  async function seedFailedRun(opts: { agentId: string; prId: string; ranAt: Date }) {
    await pg.handle.db.insert(t.agentRuns).values({
      workspaceId,
      agentId: opts.agentId,
      prId: opts.prId,
      ranAt: opts.ranAt,
      provider: 'openai',
      model: 'gpt-4.1',
      status: 'failed',
      tokensIn: 0,
      tokensOut: 0,
      durationMs: null,
      findingsCount: 0,
      error: 'timeout',
    });
  }

  it('GET /agents/:id/stats returns computed accept-rate/cost/latency for an agent with runs in range (AC-01)', async () => {
    const app = await appWith();
    const pr = await seedRepoAndPr();
    const agentId = await createAgent(app, 'Security Reviewer');

    await seedDoneRun({
      agentId,
      prId: pr.id,
      ranAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      durationMs: 1000,
      findings: [{ accepted: true }, { dismissed: true }, {}],
    });
    await seedDoneRun({
      agentId,
      prId: pr.id,
      ranAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      durationMs: 2000,
      findings: [{ accepted: true }],
    });
    await seedFailedRun({ agentId, prId: pr.id, ranAt: new Date(Date.now() - 30 * 60 * 1000) });

    const res = await app.inject({ method: 'GET', url: `/agents/${agentId}/stats?range=30d` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(() => AgentStats.parse(body)).not.toThrow();

    expect(body.runs).toBe(3); // the failed run still counts toward the denominator
    expect(body.findings_total).toBe(4);
    expect(body.accepted).toBe(2);
    expect(body.dismissed).toBe(1);
    expect(body.pending).toBe(1);
    expect(body.accept_rate).toBeCloseTo(2 / 3, 3);
    expect(body.total_cost_usd).toBeCloseTo(COST_PER_RUN * 2, 5); // 2 done runs only
    expect(body.avg_latency_ms).toBe(1500); // avg of the two done runs' durations only

    await app.close();
  });

  it('GET /agents/:id/stats for a zero-run agent returns a valid shape, never a 404 or fabricated 0/NaN (AC-02)', async () => {
    const app = await appWith();
    const agentId = await createAgent(app, 'Idle Agent');

    const res = await app.inject({ method: 'GET', url: `/agents/${agentId}/stats?range=30d` });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(() => AgentStats.parse(body)).not.toThrow();
    expect(body.runs).toBe(0);
    expect(body.accept_rate).toBeNull();
    expect(body.total_cost_usd).toBeNull();
    expect(body.avg_cost_usd).toBeNull();
    expect(body.avg_latency_ms).toBeNull();
    expect(body.avg_findings_per_run).toBeNull();

    await app.close();
  });

  it('an unknown agent id returns 404, not a fabricated zero-run response', async () => {
    const app = await appWith();
    const res = await app.inject({
      method: 'GET',
      url: `/agents/00000000-0000-0000-0000-000000000000/stats`,
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it('GET /agents/performance reconciles cost_by_agent/cost_by_model with summary.total_cost_usd (AC-04)', async () => {
    const app = await appWith();
    const pr = await seedRepoAndPr();
    const agentA = await createAgent(app, 'Agent Perf A');
    const agentB = await createAgent(app, 'Agent Perf B');
    const agentIdle = await createAgent(app, 'Agent Perf Idle'); // no runs — must not appear

    // A custom range scoped tightly to THIS test's own runs — `range=30d`
    // would also pick up every other test's seeded runs in the same shared
    // workspace (LocalNoAuthProvider always resolves the one default
    // workspace; there's no per-test workspace isolation via the HTTP API).
    const windowStart = new Date();
    await seedDoneRun({
      agentId: agentA,
      prId: pr.id,
      ranAt: new Date(windowStart.getTime() + 1000),
      durationMs: 1000,
      findings: [{ accepted: true }],
    });
    await seedDoneRun({
      agentId: agentA,
      prId: pr.id,
      ranAt: new Date(windowStart.getTime() + 2000),
      durationMs: 1000,
      findings: [{ dismissed: true }],
    });
    await seedDoneRun({
      agentId: agentB,
      prId: pr.id,
      ranAt: new Date(windowStart.getTime() + 3000),
      durationMs: 1000,
      findings: [{ accepted: true }],
    });
    const windowEnd = new Date(windowStart.getTime() + 10_000);

    const res = await app.inject({
      method: 'GET',
      url: `/agents/performance?from=${encodeURIComponent(windowStart.toISOString())}&to=${encodeURIComponent(windowEnd.toISOString())}`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(() => AgentPerf.parse(body)).not.toThrow();

    const agentIds = body.agents.map((a: { agent_id: string }) => a.agent_id);
    expect(agentIds).toEqual(expect.arrayContaining([agentA, agentB]));
    expect(agentIds).not.toContain(agentIdle); // zero-run agent excluded (AC-04)

    expect(body.summary.runs).toBe(3);
    expect(body.summary.total_cost_usd).toBeCloseTo(COST_PER_RUN * 3, 2);
    expect(body.summary.most_active_agent).toBe('Agent Perf A'); // 2 runs vs 1

    const sumSegments = (segs: { value: number }[]) => segs.reduce((s, x) => s + x.value, 0);
    expect(sumSegments(body.cost_by_agent)).toBeCloseTo(body.summary.total_cost_usd, 2);
    expect(sumSegments(body.cost_by_model)).toBeCloseTo(body.summary.total_cost_usd, 2);

    await app.close();
  });

  it('GET /agents/performance for a range with no runs returns an empty (not fabricated) dashboard (AC-05)', async () => {
    const app = await appWith();
    const res = await app.inject({
      method: 'GET',
      url: '/agents/performance?from=2000-01-01T00:00:00.000Z&to=2000-01-02T00:00:00.000Z',
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(() => AgentPerf.parse(body)).not.toThrow();
    expect(body).toEqual({
      summary: { runs: 0, total_cost_usd: null, avg_accept_rate: null, most_active_agent: null },
      agents: [],
      cost_by_agent: [],
      cost_by_model: [],
    });

    await app.close();
  });
});
