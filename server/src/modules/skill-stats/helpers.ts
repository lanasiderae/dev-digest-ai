/**
 * Pure helpers for the skill-stats module (side-effect free; no DB/network).
 * Mirrors agent-stats/helpers.ts's `toAgentStats` shape/conventions.
 */
import type { SkillStats } from '@devdigest/shared';
import type { AgentRunRow, FindingRow } from '../../db/rows.js';

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}

/**
 * `GET /skills/:id/stats`'s DTO builder.
 *
 * - `pull_frequency` = distinct PRs (among the skill's linked agents' runs in
 *   range) that have ≥1 finding citing this skill, over all distinct PRs
 *   those runs touched. Null when no PR was reviewed in range.
 * - `accept_rate` = accept / (accept + dismiss) over this skill's OWN
 *   matched findings only (not the agent's overall rate).
 * - `matched_skill` (model self-report, sanitized against the agent's actual
 *   linked skill names at run time) is the only "this skill was applied"
 *   signal this repo persists per finding — there is no separate record of
 *   every skill resolved into a run's prompt regardless of outcome, so this
 *   is a proxy, not literal prompt-inclusion tracking.
 */
export function toSkillStats(
  skillId: string,
  skillName: string,
  agentsLinked: { id: string; name: string }[],
  runs: AgentRunRow[],
  matchedFindings: { finding: FindingRow; runId: string }[],
): SkillStats {
  const agentsActive = new Set(runs.map((r) => r.agentId).filter((id): id is string => !!id)).size;
  const matchedRunIds = new Set(matchedFindings.map((f) => f.runId));

  const prIdByRunId = new Map(
    runs.filter((r): r is AgentRunRow & { prId: string } => r.prId != null).map((r) => [r.id, r.prId]),
  );
  const prsTotal = new Set([...prIdByRunId.values()]).size;
  const prsMatched = new Set(
    [...matchedRunIds].map((runId) => prIdByRunId.get(runId)).filter((id): id is string => !!id),
  ).size;

  const decisionFindings = matchedFindings.map((f) => f.finding).filter((f) => f.kind === 'finding');
  const accepted = decisionFindings.filter((f) => f.acceptedAt != null).length;
  const dismissed = decisionFindings.filter((f) => f.dismissedAt != null).length;
  const decisions = accepted + dismissed;

  const findingsByCategory = { bug: 0, security: 0, perf: 0, style: 0, test: 0 };
  for (const f of decisionFindings) {
    if (f.category in findingsByCategory) {
      findingsByCategory[f.category as keyof typeof findingsByCategory]++;
    }
  }

  return {
    skill_id: skillId,
    skill_name: skillName,
    agents_linked: agentsLinked.length,
    agents_active: agentsActive,
    pull_frequency: prsTotal > 0 ? round4(prsMatched / prsTotal) : null,
    prs_matched: prsMatched,
    prs_total: prsTotal,
    accept_rate: decisions > 0 ? round4(accepted / decisions) : null,
    accepted,
    dismissed,
    findings_total: decisionFindings.length,
    findings_by_category: findingsByCategory,
    agents_using: agentsLinked.map((a) => ({ agent_id: a.id, agent_name: a.name })),
  };
}

export interface BulkPullFrequencyInput {
  skillId: string;
  skillName: string;
  agentIds: string[];
}

/**
 * Cheap, list-view version of `toSkillStats`'s `pull_frequency` — the SAME
 * metric (distinct matched PRs / distinct total PRs, via `matched_skill`),
 * computed for MANY skills in one pass over shared raw rows instead of one
 * `getSkillStatsRaw` round trip per skill. Feeds `SkillCard`'s list-row
 * "pull freq" text (`SkillsService.list`).
 */
export function toBulkPullFrequency(
  skills: BulkPullFrequencyInput[],
  runs: { id: string; agentId: string | null; prId: string | null }[],
  matchedFindings: { matchedSkill: string; runId: string }[],
): Record<string, number | null> {
  const prIdByRunId = new Map(
    runs.filter((r): r is typeof r & { prId: string } => r.prId != null).map((r) => [r.id, r.prId]),
  );
  const matchedSkillNamesByRun = new Map<string, Set<string>>();
  for (const f of matchedFindings) {
    let names = matchedSkillNamesByRun.get(f.runId);
    if (!names) {
      names = new Set();
      matchedSkillNamesByRun.set(f.runId, names);
    }
    names.add(f.matchedSkill);
  }

  const result: Record<string, number | null> = {};
  for (const skill of skills) {
    const agentIdSet = new Set(skill.agentIds);
    const skillRuns = runs.filter((r) => r.agentId != null && agentIdSet.has(r.agentId));
    const prsTotal = new Set(skillRuns.map((r) => prIdByRunId.get(r.id)).filter((id): id is string => !!id));
    const prsMatched = new Set(
      skillRuns
        .filter((r) => matchedSkillNamesByRun.get(r.id)?.has(skill.skillName))
        .map((r) => prIdByRunId.get(r.id))
        .filter((id): id is string => !!id),
    );
    result[skill.skillId] = prsTotal.size > 0 ? round4(prsMatched.size / prsTotal.size) : null;
  }
  return result;
}
