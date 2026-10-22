import type { Container } from '../../platform/container.js';
import type { Skill, SkillSource, SkillType, SkillVersion } from '@devdigest/shared';
import { SkillsRepository } from './repository.js';
import { toSkillDto, toSkillVersionDto } from './helpers.js';
import { extractSkillArchive, type ArchiveImportResult } from './import/archive.js';
import type { UrlImportResult } from './import/url.js';
import { detectInjectionPatterns } from './injection-scan.js';

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
}

export interface UpdateSkillInput {
  name?: string;
  description?: string;
  type?: SkillType;
  body?: string;
  enabled?: boolean;
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
    return rows.map((r) => ({ ...toSkillDto(r), agent_count: counts[r.id] ?? 0 }));
  }

  async get(workspaceId: string, id: string): Promise<Skill | undefined> {
    const row = await this.repo.getById(workspaceId, id);
    if (!row) return undefined;
    const counts = await this.container.agentsRepo.skillAgentCounts(workspaceId, [row.id]);
    return { ...toSkillDto(row), agent_count: counts[row.id] ?? 0 };
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
    const existing = await this.repo.getById(workspaceId, id);
    if (!existing) return undefined;

    const effectiveBody = patch.body ?? existing.body;
    const flagged = detectInjectionPatterns(effectiveBody).length > 0;
    const gatedPatch: UpdateSkillInput = flagged ? { ...patch, enabled: false } : patch;

    const row = await this.repo.update(workspaceId, id, gatedPatch);
    return row ? toSkillDto(row) : undefined;
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
