import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import type { Db } from '../../../db/client.js';
import * as t from '../../../db/schema.js';
import type { AgentRunRow, FindingRow } from '../../../db/rows.js';

/** One agent's raw rows in the requested range — the shared fetch behind
 *  both `GET /agents/:id/stats` and `GET /agents/performance` (agent-stats
 *  module's `toAgentStats`/`toAgentPerf` pure DTO builders consume this). */
export interface AgentStatsRawGroup {
  agentId: string;
  agentName: string;
  provider: string | null;
  model: string | null;
  runs: AgentRunRow[];
  findings: FindingRow[];
}

/**
 * Raw per-agent rows for the agent-stats module, grouped in JS over a
 * workspace/range-scoped fetch rather than aggregated in SQL — the cost
 * estimate step (`computeRunCost` + `PriceBook`) can't run in SQL anyway,
 * and expected row volumes in this course project don't warrant the extra
 * complexity of a SQL-side aggregate.
 *
 * Two queries (not one join) deliberately: `agent_runs` ⋈ `agents` for the
 * per-run facts (one row per run), then `findings` ⋈ `reviews` keyed by
 * `reviews.run_id` for the finding-level facts (one row per finding) —
 * joining all three in one query would fan out the run-level columns once
 * per finding on that run, which would double-count tokens/duration for any
 * run with >1 finding.
 */
export async function getAgentStatsRaw(
  db: Db,
  workspaceId: string,
  opts: { agentId?: string; from: Date; to: Date },
): Promise<AgentStatsRawGroup[]> {
  const whereClauses = [
    eq(t.agentRuns.workspaceId, workspaceId),
    gte(t.agentRuns.ranAt, opts.from),
    lte(t.agentRuns.ranAt, opts.to),
  ];
  if (opts.agentId) whereClauses.push(eq(t.agentRuns.agentId, opts.agentId));

  const runRows = await db
    .select({
      run: t.agentRuns,
      agentName: t.agents.name,
      agentProvider: t.agents.provider,
      agentModel: t.agents.model,
    })
    .from(t.agentRuns)
    .innerJoin(t.agents, eq(t.agents.id, t.agentRuns.agentId))
    .where(and(...whereClauses));

  if (runRows.length === 0) return [];

  const runIds = runRows.map((r) => r.run.id);
  const findingRows = await db
    .select({ finding: t.findings, runId: t.reviews.runId })
    .from(t.findings)
    .innerJoin(t.reviews, eq(t.reviews.id, t.findings.reviewId))
    .where(inArray(t.reviews.runId, runIds));

  const agentIdByRunId = new Map(runRows.map((r) => [r.run.id, r.run.agentId]));
  const groups = new Map<string, AgentStatsRawGroup>();
  for (const r of runRows) {
    const agentId = r.run.agentId;
    if (!agentId) continue; // agent_runs.agent_id is SET NULL on agent delete — unattributable
    let g = groups.get(agentId);
    if (!g) {
      g = { agentId, agentName: r.agentName, provider: r.agentProvider, model: r.agentModel, runs: [], findings: [] };
      groups.set(agentId, g);
    }
    g.runs.push(r.run);
  }
  for (const { finding, runId } of findingRows) {
    if (!runId) continue;
    const agentId = agentIdByRunId.get(runId);
    if (!agentId) continue;
    groups.get(agentId)?.findings.push(finding);
  }
  return [...groups.values()];
}

/** One finding paired with the run it came from — unlike `AgentStatsRawGroup`,
 *  the skill-stats module needs to know WHICH run each matched finding
 *  belongs to (to resolve that run's PR for the pull-frequency denominator). */
export interface SkillStatsRaw {
  runs: AgentRunRow[];
  matchedFindings: { finding: FindingRow; runId: string }[];
}

/**
 * Raw rows for the skill-stats module (`GET /skills/:id/stats`): every run
 * (in range) by any agent that links the skill, plus only the findings on
 * those runs whose `matched_skill` names this skill — the proxy this repo
 * already has for "the model applied this skill" (no per-run prompt-
 * inclusion tracking exists; see `findings.matched_skill`'s other use in
 * `FindingCard`'s "via <skill>" tag).
 */
export async function getSkillStatsRaw(
  db: Db,
  workspaceId: string,
  opts: { agentIds: string[]; skillName: string; from: Date; to: Date },
): Promise<SkillStatsRaw> {
  if (opts.agentIds.length === 0) return { runs: [], matchedFindings: [] };

  const runs = await db
    .select()
    .from(t.agentRuns)
    .where(
      and(
        eq(t.agentRuns.workspaceId, workspaceId),
        inArray(t.agentRuns.agentId, opts.agentIds),
        gte(t.agentRuns.ranAt, opts.from),
        lte(t.agentRuns.ranAt, opts.to),
      ),
    );
  if (runs.length === 0) return { runs: [], matchedFindings: [] };

  const runIds = runs.map((r) => r.id);
  const findingRows = await db
    .select({ finding: t.findings, runId: t.reviews.runId })
    .from(t.findings)
    .innerJoin(t.reviews, eq(t.reviews.id, t.findings.reviewId))
    .where(and(inArray(t.reviews.runId, runIds), eq(t.findings.matchedSkill, opts.skillName)));

  const matchedFindings = findingRows.filter(
    (f): f is { finding: FindingRow; runId: string } => f.runId != null,
  );
  return { runs, matchedFindings };
}

/** Raw rows for the Skills LIST view's bulk pull-frequency computation
 *  (`SkillsService.list` → `skill-stats/helpers.ts`'s `toBulkPullFrequency`):
 *  every run (in range) by any agent that links ANY of the given skills, plus
 *  only the (matched_skill, runId) pairs whose matched_skill names one of the
 *  given skills — ONE pass over the whole list, not one `getSkillStatsRaw`
 *  call per skill/card. */
export interface BulkPullFrequencyRaw {
  runs: { id: string; agentId: string | null; prId: string | null }[];
  matchedFindings: { matchedSkill: string; runId: string }[];
}

export async function getBulkPullFrequencyRaw(
  db: Db,
  workspaceId: string,
  opts: { agentIds: string[]; skillNames: string[]; from: Date; to: Date },
): Promise<BulkPullFrequencyRaw> {
  if (opts.agentIds.length === 0 || opts.skillNames.length === 0) return { runs: [], matchedFindings: [] };

  const runs = await db
    .select({ id: t.agentRuns.id, agentId: t.agentRuns.agentId, prId: t.agentRuns.prId })
    .from(t.agentRuns)
    .where(
      and(
        eq(t.agentRuns.workspaceId, workspaceId),
        inArray(t.agentRuns.agentId, opts.agentIds),
        gte(t.agentRuns.ranAt, opts.from),
        lte(t.agentRuns.ranAt, opts.to),
      ),
    );
  if (runs.length === 0) return { runs: [], matchedFindings: [] };

  const runIds = runs.map((r) => r.id);
  const findingRows = await db
    .select({ matchedSkill: t.findings.matchedSkill, runId: t.reviews.runId })
    .from(t.findings)
    .innerJoin(t.reviews, eq(t.reviews.id, t.findings.reviewId))
    .where(and(inArray(t.reviews.runId, runIds), inArray(t.findings.matchedSkill, opts.skillNames)));

  const matchedFindings = findingRows.filter(
    (f): f is { matchedSkill: string; runId: string } => f.matchedSkill != null && f.runId != null,
  );
  return { runs, matchedFindings };
}
