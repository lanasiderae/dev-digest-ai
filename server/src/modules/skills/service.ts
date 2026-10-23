import type { Container } from '../../platform/container.js';
import type {
  ProjectContextSelectionList,
  Skill,
  SkillSource,
  SkillType,
  SkillVersion,
} from '@devdigest/shared';
import { ValidationError } from '../../platform/errors.js';
import { SkillsRepository } from './repository.js';
import { toSkillDto, toSkillVersionDto } from './helpers.js';
import { extractSkillArchive, type ArchiveImportResult } from './import/archive.js';
import type { UrlImportResult } from './import/url.js';
import { detectInjectionPatterns } from './injection-scan.js';
import { resolveRange } from '../agent-stats/helpers.js';
import { toBulkPullFrequency } from '../skill-stats/helpers.js';
import type { SkillRow } from '../../db/rows.js';

/**
 * Skills service. Business logic for skill CRUD + import ingestion.
 *
 * A Skill = name + description + type + body + enabled. Body changes are
 * versioned via `skill_versions` (repository). Import endpoints return a
 * PREVIEW only — nothing is persisted until the normal `create` call runs.
 */

export interface CreateSkillInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  source?: SkillSource;
  enabled?: boolean;
  evidence_files?: string[];
  project_context?: ProjectContextSelectionList;
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
  project_context?: ProjectContextSelectionList;
}

export class SkillsService {
  private repo: SkillsRepository;

  constructor(private container: Container) {
    this.repo = new SkillsRepository(container.db);
  }

  async list(workspaceId: string): Promise<Skill[]> {
    const rows = await this.repo.list(workspaceId);
    const counts = await this.container.agentsRepo.skillAgentCounts(
      workspaceId,
      rows.map((r) => r.id),
    );
    const pullFreq = await this.bulkPullFrequency(workspaceId, rows);
    return rows.map((r) => ({
      ...toSkillDto(r),
      agent_count: counts[r.id] ?? 0,
      pull_frequency: pullFreq[r.id] ?? null,
    }));
  }

  async get(workspaceId: string, id: string): Promise<Skill | undefined> {
    const row = await this.repo.getById(workspaceId, id);
    if (!row) return undefined;
    const counts = await this.container.agentsRepo.skillAgentCounts(workspaceId, [row.id]);
    const pullFreq = await this.bulkPullFrequency(workspaceId, [row]);
    return {
      ...toSkillDto(row),
      agent_count: counts[row.id] ?? 0,
      pull_frequency: pullFreq[row.id] ?? null,
    };
  }

  /**
   * List-view "pull freq" badge: the same metric as the detail Stats tab's
   * live `GET /skills/:id/stats`, computed cheaply for ALL given skills in
   * one query pass (`getBulkPullFrequencyRaw` + `toBulkPullFrequency`)
   * instead of one stats call per skill/card — see those for the metric's
   * definition. Fixed last-30-days window (no range picker in the list).
   */
  private async bulkPullFrequency(
    workspaceId: string,
    rows: Pick<SkillRow, 'id' | 'name'>[],
  ): Promise<Record<string, number | null>> {
    if (rows.length === 0) return {};
    const agentIdsBySkill = await this.container.agentsRepo.agentIdsForSkills(
      workspaceId,
      rows.map((r) => r.id),
    );
    const allAgentIds = [...new Set(Object.values(agentIdsBySkill).flat())];
    const { from, to } = resolveRange({});
    const raw = await this.container.reviewRepo.getBulkPullFrequencyRaw(workspaceId, {
      agentIds: allAgentIds,
      skillNames: rows.map((r) => r.name),
      from,
      to,
    });
    return toBulkPullFrequency(
      rows.map((r) => ({ skillId: r.id, skillName: r.name, agentIds: agentIdsBySkill[r.id] ?? [] })),
      raw.runs,
      raw.matchedFindings,
    );
  }

  async delete(workspaceId: string, id: string): Promise<boolean> {
    return this.repo.deleteById(workspaceId, id);
  }

  /**
   * Create a skill. The trust gate lives HERE, server-side, so a client bug
   * or bypass can't sneak an enabled import through: every source other than
   * 'manual' is forced to enabled=false regardless of what the request body
   * says. Only 'manual' (create-from-scratch, or omitted) honors a
   * client-supplied `enabled`, defaulting to true — UNLESS the body itself
   * matches a known prompt-injection pattern, which always forces
   * enabled=false regardless of source (see `injection-scan.ts`): a skill
   * body is concatenated into a TRUSTED agent system prompt, so a malicious
   * one must never be enabled by construction, manual source or not.
   */
  async create(workspaceId: string, input: CreateSkillInput): Promise<Skill> {
    await this.assertProjectContextReposOwned(workspaceId, input.project_context);
    const source = input.source ?? 'manual';
    const flagged = detectInjectionPatterns(input.body).length > 0;
    const enabled = !flagged && source === 'manual' ? (input.enabled ?? true) : false;
    const row = await this.repo.insert({
      workspaceId,
      name: input.name,
      description: input.description,
      type: input.type,
      source,
      body: input.body,
      enabled,
      evidenceFiles: input.evidence_files ?? null,
      ...(input.project_context !== undefined ? { projectContext: input.project_context } : {}),
    });
    return toSkillDto(row);
  }

  /**
   * Same injection gate as `create` applies on every update: a body that's
   * flagged (the patched one, or the existing one when body isn't part of
   * this patch) can never end up enabled.
   *
   * `source` is never touched here, even when a non-manual skill is
   * explicitly enabled (vetted) — it's permanent provenance ("was this
   * written by hand, imported, or auto-extracted?"), not a vetting flag.
   * The "needs vetting" / untrusted-source UI keys off `source !== 'manual'
   * && !enabled`, so it still clears while enabled and reappears if the
   * skill is disabled again — which correctly reflects that it's still a
   * non-manual skill, not a bug.
   */
  async update(
    workspaceId: string,
    id: string,
    patch: UpdateSkillInput,
  ): Promise<Skill | undefined> {
    await this.assertProjectContextReposOwned(workspaceId, patch.project_context);
    const existing = await this.repo.getById(workspaceId, id);
    if (!existing) return undefined;

    const effectiveBody = patch.body ?? existing.body;
    const flagged = detectInjectionPatterns(effectiveBody).length > 0;

    const row = await this.repo.update(workspaceId, id, {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.body !== undefined ? { body: patch.body } : {}),
      ...(patch.project_context !== undefined ? { projectContext: patch.project_context } : {}),
      ...(flagged
        ? { enabled: false }
        : patch.enabled !== undefined
          ? { enabled: patch.enabled }
          : {}),
    });
    return row ? toSkillDto(row) : undefined;
  }

  /**
   * Same CTX-AC-04 "approved repository scope" check as `AgentsService`'s
   * (see its doc comment) — duplicated as a method rather than factored into
   * a shared base class, matching this codebase's existing per-module
   * service style (no shared service base class exists today).
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

  async listVersions(workspaceId: string, skillId: string): Promise<SkillVersion[] | undefined> {
    const skill = await this.repo.getById(workspaceId, skillId);
    if (!skill) return undefined;
    const rows = await this.repo.listVersions(skillId);
    return rows.map(toSkillVersionDto);
  }

  async getVersion(
    workspaceId: string,
    skillId: string,
    version: number,
  ): Promise<SkillVersion | undefined> {
    const skill = await this.repo.getById(workspaceId, skillId);
    if (!skill) return undefined;
    const row = await this.repo.getVersion(skillId, version);
    return row ? toSkillVersionDto(row) : undefined;
  }

  /** Preview-only: fetches a URL server-side and returns extracted content.
   *  Writes nothing to the DB. */
  async importFromUrl(url: string): Promise<UrlImportResult> {
    return this.container.skillsUrlFetch(url);
  }

  /** Preview-only: parses a .zip buffer and returns candidate(s). Writes
   *  nothing to the DB. */
  async importFromArchive(buffer: Buffer): Promise<ArchiveImportResult> {
    return extractSkillArchive(buffer);
  }
}
