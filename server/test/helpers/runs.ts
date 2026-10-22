import * as t from '../../src/db/schema.js';
import { eq, inArray } from 'drizzle-orm';
import type { PgFixture } from './pg.js';

/**
 * `runReview` is fire-and-forget: the POST returns runIds immediately and each
 * agent's review is persisted in the background (the client subscribes to SSE).
 * Tests that assert on persisted reviews/findings/traces must first wait for the
 * background runs to finish. This polls `agent_runs` until every row for the PR
 * reaches a terminal status (done / failed / cancelled).
 */
const TERMINAL = new Set(['done', 'failed', 'cancelled']);

// Per review-flow.md, `agent_runs.status` is committed before the run's
// `run_traces` document (ReviewRunExecutor persists them as two sequential
// awaits, not one transaction) — so a run can be observably terminal here
// for a brief window before its trace exists. A caller that immediately
// fetches GET /runs/:id/trace after this resolves would otherwise race it
// (intermittent "Cannot read properties of undefined" on CI, not locally,
// since the window is normally sub-millisecond). Wait for both.
async function tracesExist(
  db: PgFixture['handle']['db'],
  terminalRuns: Array<typeof t.agentRuns.$inferSelect>,
): Promise<boolean> {
  if (terminalRuns.length === 0) return true;
  const ids = terminalRuns.map((r) => r.id);
  const traces = await db.select({ runId: t.runTraces.runId }).from(t.runTraces).where(inArray(t.runTraces.runId, ids));
  return traces.length >= ids.length;
}

export async function waitForPrRuns(
  db: PgFixture['handle']['db'],
  prId: string,
  opts: { expected?: number; timeoutMs?: number } = {},
): Promise<Array<typeof t.agentRuns.$inferSelect>> {
  const { expected, timeoutMs = 10_000 } = opts;
  const start = Date.now();
  for (;;) {
    const runs = await db.select().from(t.agentRuns).where(eq(t.agentRuns.prId, prId));
    const terminal = runs.filter((r) => TERMINAL.has(r.status ?? ''));
    // With an explicit `expected`, wait until that many runs finish (ignores any
    // extra rows, e.g. a trifecta scan). Otherwise wait for all rows to settle.
    const done =
      expected != null
        ? terminal.length >= expected
        : runs.length > 0 && terminal.length === runs.length;
    if (done && (await tracesExist(db, terminal))) return runs;
    if (Date.now() - start > timeoutMs) return runs;
    await new Promise((r) => setTimeout(r, 25));
  }
}
