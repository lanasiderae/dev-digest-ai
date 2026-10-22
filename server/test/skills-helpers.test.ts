import { describe, it, expect } from 'vitest';
import {
  isBodyChange,
  toSkillDto,
  toSkillVersionDto,
  deriveNameFromMarkdown,
} from '../src/modules/skills/helpers.js';
import type { SkillRow, SkillVersionRow } from '../src/db/rows.js';

const baseRow: SkillRow = {
  id: 'skill-1',
  workspaceId: 'ws-1',
  name: 'pr-quality-rubric',
  description: 'Flags low-quality PRs.',
  type: 'rubric',
  source: 'manual',
  body: '# Rule\nBe thorough.',
  enabled: true,
  version: 1,
  evidenceFiles: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('isBodyChange', () => {
  it('is true when the patch changes body', () => {
    expect(isBodyChange(baseRow, { body: 'new body' })).toBe(true);
  });
  it('is false when the patch sets body to the same value', () => {
    expect(isBodyChange(baseRow, { body: baseRow.body })).toBe(false);
  });
  it('is false when body is not in the patch at all', () => {
    expect(isBodyChange(baseRow, {})).toBe(false);
  });
});

describe('toSkillDto', () => {
  it('maps a row to the public Skill DTO', () => {
    expect(toSkillDto(baseRow)).toEqual({
      id: 'skill-1',
      name: 'pr-quality-rubric',
      description: 'Flags low-quality PRs.',
      type: 'rubric',
      source: 'manual',
      body: '# Rule\nBe thorough.',
      enabled: true,
      version: 1,
      evidence_files: null,
    });
  });
});

describe('toSkillVersionDto', () => {
  it('maps a skill_versions row to the public SkillVersion DTO', () => {
    const row: SkillVersionRow = {
      skillId: 'skill-1',
      version: 2,
      body: 'v2 body',
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    };
    expect(toSkillVersionDto(row)).toEqual({
      skill_id: 'skill-1',
      version: 2,
      body: 'v2 body',
      created_at: '2026-01-02T00:00:00.000Z',
    });
  });
});

describe('deriveNameFromMarkdown', () => {
  it('takes the first # heading as the name', () => {
    expect(deriveNameFromMarkdown('# My Skill\n\nSome body.')).toBe('My Skill');
  });
  it('returns undefined when there is no heading', () => {
    expect(deriveNameFromMarkdown('Just text, no heading.')).toBeUndefined();
  });
  it('ignores a ## subheading when looking for the title', () => {
    expect(deriveNameFromMarkdown('## Not the title\nBody')).toBeUndefined();
  });
});
