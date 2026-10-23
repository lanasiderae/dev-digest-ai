import type { Container } from '../../platform/container.js';
import type {
  Agent,
  AgentSkillLink,
  AgentVersion,
  CiFailOn,
  ModelInfo,
  ProjectContextSelectionList,
  Provider,
  ReviewStrategy,
} from '@devdigest/shared';
import { resolveProjectContextPaths, type ResolveProjectContextPathsResult } from '../project-context/helpers.js';
import { AgentsRepository } from './repository.js';
import { toAgentDto, toAgentVersionDto } from './helpers.js';
import { NotFoundError, ValidationError } from '../../platform/errors.js';

/**
 * A2 — agents service. Business logic for the Agents tab + Agent Editor.
 * Provider/model selection uses the LLM adapter's dynamic model list.
 *
 * An Agent = provider + model + system_prompt + linked skills + output_schema +
 * enabled. Config changes are versioned via `agent_versions` (repository).
 */

// Re-exported for backwards compatibility; implementation lives in ./helpers.
export { toAgentDto } from './helpers.js';

export interface CreateAgentInput {
  name: string;
  description?: string;
  provider: Provider;
  model: string;
  system_prompt: string;
  output_schema?: unknown;
  strategy?: ReviewStrategy;
  ci_fail_on?: CiFailOn;
  repo_intel?: boolean;
  project_context?: ProjectContextSelectionList;
  enabled?: boolean;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  provider?: Provider;
  model?: string;
  system_prompt?: string;
  output_schema?: unknown;
  strategy?: ReviewStrategy;
  ci_fail_on?: CiFailOn;
  repo_intel?: boolean;
  project_context?: ProjectContextSelectionList;
  enabled?: boolean;
}

export class AgentsService {
  private repo: AgentsRepository;

  constructor(private container: Container) {
    this.repo = new AgentsRepository(container.db);
  }

  async list(workspaceId: string): Promise<Agent[]> {
    const rows = await this.repo.list(workspaceId);
    const counts = await this.repo.agentSkillCounts(rows.map((r) => r.id));
    return rows.map((r) => ({ ...toAgentDto(r), skill_count: counts[r.id] ?? 0 }));
  }

  async get(workspaceId: string, id: string): Promise<Agent | undefined> {
    const row = await this.repo.getById(workspaceId, id);
    if (!row) return undefined;
    const counts = await this.repo.agentSkillCounts([row.id]);
    return { ...toAgentDto(row), skill_count: counts[row.id] ?? 0 };
  }

  /** Delete an agent (and its versions/skill-links, via cascade). */
  async delete(workspaceId: string, id: string): Promise<boolean> {
    return this.repo.deleteById(workspaceId, id);
  }

  async create(workspaceId: string, input: CreateAgentInput, userId?: string): Promise<Agent> {
    await this.assertProjectContextReposOwned(workspaceId, input.project_context);
    const row = await this.repo.insert({
      workspaceId,
      name: input.name,
      description: input.description,
      provider: input.provider,
      model: input.model,
      systemPrompt: input.system_prompt,
      outputSchema: input.output_schema,
      ...(input.strategy !== undefined ? { strategy: input.strategy } : {}),
      ...(input.ci_fail_on !== undefined ? { ciFailOn: input.ci_fail_on } : {}),
      ...(input.repo_intel !== undefined ? { repoIntel: input.repo_intel } : {}),
      ...(input.project_context !== undefined ? { projectContext: input.project_context } : {}),
      enabled: input.enabled,
      createdBy: userId ?? null,
    });
    return toAgentDto(row);
  }

  async update(
    workspaceId: string,
    id: string,
    patch: UpdateAgentInput,
  ): Promise<Agent | undefined> {
    await this.assertProjectContextReposOwned(workspaceId, patch.project_context);
    const row = await this.repo.update(workspaceId, id, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.provider !== undefined ? { provider: patch.provider } : {}),
      ...(patch.model !== undefined ? { model: patch.model } : {}),
      ...(patch.system_prompt !== undefined ? { systemPrompt: patch.system_prompt } : {}),
      ...(patch.output_schema !== undefined ? { outputSchema: patch.output_schema } : {}),
      ...(patch.strategy !== undefined ? { strategy: patch.strategy } : {}),
      ...(patch.ci_fail_on !== undefined ? { ciFailOn: patch.ci_fail_on } : {}),
      ...(patch.repo_intel !== undefined ? { repoIntel: patch.repo_intel } : {}),
      ...(patch.project_context !== undefined ? { projectContext: patch.project_context } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    });
    return row ? toAgentDto(row) : undefined;
  }

  /**
   * Validate that every `repo_id` named in a `project_context` patch is
   * actually owned by this workspace (CTX-AC-04's "approved repository
   * scope" half, on the CRUD side — TASK-03's `ProjectContextRepository.
   * getOwnedRepo` is the read-path equivalent). No-ops on an empty/absent
   * selection list — selecting nothing never needs an ownership check.
   */
  private async assertProjectContextReposOwned(
    workspaceId: string,
    selections: ProjectContextSelectionList | undefined,
  ): Promise<void> {
    if (!selections || selections.length === 0) return;
    const repoIds = [...new Set(selections.map((s) => s.repo_id))];
    const owned = await this.container.reposRepo.listOwnedIds(workspaceId, repoIds);
    const unowned = repoIds.filter((id) => !owned.has(id));
    if (unowned.length > 0) {
      throw new ValidationError(
        `project_context references repositories outside this workspace: ${unowned.join(', ')}`,
      );
    }
  }

  /**
   * C3/CTX-AC-05: resolve this agent's own `project_context` selections plus
   * its enabled, ordered linked skills' selections into a single
   * deduplicated path list for `repoId` — the shared resolver
   * (`resolveProjectContextPaths`) does the ordered-union/dedup/cross-repo
   * work; this method's only job is supplying the real agent/skill selection
   * data. "Enabled" reuses the SAME filter `run-executor.ts`'s
   * `resolveAgentSkills` already applies for prompt assembly (skills/service.ts's
   * injection gate forces a flagged/unvetted skill's `enabled` to false, so
   * `enabled === true` already means "safe" — no second trust check here).
   * Unscoped by workspace, same as `skillLinks`/`linkSkill` above — callers
   * (TASK-06/08/10) have already resolved/validated the agent in their own
   * workspace-scoped flow before reaching this call.
   */
  async resolveProjectContext(
    agentId: string,
    repoId: string,
  ): Promise<ResolveProjectContextPathsResult> {
    const agent = await this.repo.getByIdUnscoped(agentId);
    if (!agent) throw new NotFoundError(`Agent ${agentId} not found`);
    const links = await this.repo.linkedSkills(agentId);
    const enabledSkills = links.filter((l) => l.skill.enabled);
    return resolveProjectContextPaths({
      repoId,
      agentSelections: agent.projectContext,
      skillSelections: enabledSkills.map((l) => l.skill.projectContext),
    });
  }

  /**
   * Config history for an agent, newest version first. Workspace-scoped: returns
   * undefined when the agent isn't in this workspace (the route maps that to 404)
   * so version snapshots can't be read across tenants.
   */
  async listVersions(workspaceId: string, agentId: string): Promise<AgentVersion[] | undefined> {
    const agent = await this.repo.getById(workspaceId, agentId);
    if (!agent) return undefined;
    const rows = await this.repo.listVersions(agentId);
    return rows.map(toAgentVersionDto);
  }

  /**
   * A single config snapshot for an agent. Returns undefined when the agent isn't
   * in this workspace OR that version was never recorded (route → 404).
   */
  async getVersion(
    workspaceId: string,
    agentId: string,
    version: number,
  ): Promise<AgentVersion | undefined> {
    const agent = await this.repo.getById(workspaceId, agentId);
    if (!agent) return undefined;
    const row = await this.repo.getVersion(agentId, version);
    return row ? toAgentVersionDto(row) : undefined;
  }

  /** Linked skills for an agent as AgentSkillLink[] (ordered). */
  async skillLinks(agentId: string): Promise<AgentSkillLink[]> {
    const links = await this.repo.linkedSkills(agentId);
    return links.map((l) => ({ agent_id: agentId, skill_id: l.skill.id, order: l.order }));
  }

  /**
   * Set / reorder the agent's linked skills. If `skillIds` is provided, replaces
   * the whole set in that order. Returns the resulting ordered links.
   */
  async setSkills(
    workspaceId: string,
    agentId: string,
    skillIds: string[],
  ): Promise<AgentSkillLink[] | undefined> {
    const agent = await this.repo.getById(workspaceId, agentId);
    if (!agent) return undefined;
    await this.assertSkillsInWorkspace(workspaceId, skillIds);
    await this.repo.setSkills(agentId, skillIds);
    return this.skillLinks(agentId);
  }

  /** Link a single skill (append or set order) — additive to existing links. */
  async linkSkill(
    workspaceId: string,
    agentId: string,
    skillId: string,
    order?: number,
  ): Promise<AgentSkillLink[] | undefined> {
    const agent = await this.repo.getById(workspaceId, agentId);
    if (!agent) return undefined;
    await this.assertSkillsInWorkspace(workspaceId, [skillId]);
    const existing = await this.repo.linkedSkills(agentId);
    const resolvedOrder = order ?? existing.length;
    await this.repo.linkSkill(agentId, skillId, resolvedOrder);
    return this.skillLinks(agentId);
  }

  /**
   * Guard against linking an agent to another workspace's skill id. Reads
   * through container.skillsRepo (owned by the skills module) rather than
   * duplicating skill ownership logic here.
   */
  private async assertSkillsInWorkspace(workspaceId: string, skillIds: string[]): Promise<void> {
    for (const skillId of skillIds) {
      const skill = await this.container.skillsRepo.getById(workspaceId, skillId);
      if (!skill) throw new NotFoundError(`Skill ${skillId} not found`);
    }
  }

  /**
   * Dynamic model list from the provider adapter's /models. Degrades gracefully
   * to [] if the provider key is not configured (the editor still renders).
   */
  async listModels(provider: Provider): Promise<ModelInfo[]> {
    try {
      const llm = await this.container.llm(provider);
      return await llm.listModels();
    } catch {
      return [];
    }
  }
}
