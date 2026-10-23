import type { Skill, SkillSource, SkillType, SkillVersion } from '@devdigest/shared';
import type { SkillRow, SkillVersionRow } from '../../db/rows.js';
import { detectInjectionPatterns } from './injection-scan.js';

/**
 * Pure helpers for the skills module — DB row ⇄ DTO mapping and the
 * body-version-bump rule. No I/O.
 */

/** Map a persisted skill row to the public `Skill` DTO. */
export function toSkillDto(row: SkillRow): Skill {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.type as SkillType,
    source: row.source as SkillSource,
    body: row.body,
    enabled: row.enabled,
    version: row.version,
    evidence_files: row.evidenceFiles ?? null,
    project_context: row.projectContext,
    injection_detected: detectInjectionPatterns(row.body).length > 0,
  };
}

/** Map a persisted `skill_versions` row to the public `SkillVersion` DTO. */
export function toSkillVersionDto(row: SkillVersionRow): SkillVersion {
  return {
    skill_id: row.skillId,
    version: row.version,
    body: row.body,
    created_at: row.createdAt.toISOString(),
  };
}

/**
 * True when a patch changes the skill's `body` relative to the existing row —
 * ONLY a body change bumps the version and snapshots `skill_versions`.
 * Deliberately narrower than agents' `isConfigChange` (which bumps on any
 * config field): per the shipped UI copy ("Saving a changed body creates a
 * new immutable version"), editing name/description/type/enabled on a skill
 * does not version it.
 */
export function isBodyChange(existing: Pick<SkillRow, 'body'>, patch: { body?: string }): boolean {
  return patch.body !== undefined && patch.body !== existing.body;
}

/**
 * Derive a skill name fallback from the first Markdown heading (`# Title`) in
 * a body, if any. Used by import flows when the user leaves the name blank.
 */
export function deriveNameFromMarkdown(body: string): string | undefined {
  const match = body.match(/^#\s+(.+)$/m);
  return match?.[1]?.trim() || undefined;
}
