import type { Container } from '../../platform/container.js';
import type { SkillStats } from '@devdigest/shared';
import { NotFoundError } from '../../platform/errors.js';
import { resolveRange, type RangeInput } from '../agent-stats/helpers.js';
import { toSkillStats } from './helpers.js';

/**
 * Skill Stats (per-skill analogue of L08's Agent Performance Dashboard).
 * Reuses the agent-stats module's range resolution and `container.reviewRepo`/
 * `container.agentsRepo` as the single read path for `agent_runs`/`findings`/
 * `agent_skills`, per onion-architecture's cross-module rule. Read-only: no
 * GitHub call, no model call.
 */
export class SkillStatsService {
  constructor(private container: Container) {}

  /** `GET /skills/:id/stats`. 404s if the skill doesn't exist in the
   *  workspace; a skill with no linked agents/runs still gets a valid
   *  `SkillStats` with zero/null fields. */
  async getSkillStats(workspaceId: string, skillId: string, rangeInput: RangeInput): Promise<SkillStats> {
    const skill = await this.container.skillsRepo.getById(workspaceId, skillId);
    if (!skill) throw new NotFoundError('Skill not found');

    const { from, to } = resolveRange(rangeInput);
    const agentsLinked = await this.container.agentsRepo.agentsForSkill(workspaceId, skillId);

    const raw = await this.container.reviewRepo.getSkillStatsRaw(workspaceId, {
      agentIds: agentsLinked.map((a) => a.id),
      skillName: skill.name,
      from,
      to,
    });

    return toSkillStats(skill.id, skill.name, agentsLinked, raw.runs, raw.matchedFindings);
  }
}
