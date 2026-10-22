import { describe, it, expect } from 'vitest';
import type { Finding } from '@devdigest/shared';
import { sanitizeMatchedSkills } from '../src/index.js';

function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'f1',
    severity: 'WARNING',
    category: 'bug',
    title: 't',
    file: 'a.ts',
    start_line: 1,
    end_line: 1,
    rationale: 'r',
    confidence: 0.5,
    kind: 'finding',
    ...overrides,
  };
}

describe('sanitizeMatchedSkills', () => {
  it('keeps a matched_skill that is an exact match of a known skill name', () => {
    const [kept] = sanitizeMatchedSkills(
      [finding({ matched_skill: 'secret-leakage-gate' })],
      ['secret-leakage-gate'],
    );
    expect(kept!.matched_skill).toBe('secret-leakage-gate');
  });

  it('nulls out a matched_skill that was never actually linked/enabled, but keeps the finding', () => {
    const [kept] = sanitizeMatchedSkills(
      [finding({ matched_skill: 'invented-skill-name' })],
      ['secret-leakage-gate'],
    );
    expect(kept!.matched_skill).toBeNull();
    expect(kept!.id).toBe('f1');
  });

  it('leaves an already-null matched_skill untouched', () => {
    const [kept] = sanitizeMatchedSkills([finding({ matched_skill: null })], ['secret-leakage-gate']);
    expect(kept!.matched_skill).toBeNull();
  });

  it('nulls every matched_skill when no skills were linked at all', () => {
    const [kept] = sanitizeMatchedSkills([finding({ matched_skill: 'anything' })], []);
    expect(kept!.matched_skill).toBeNull();
  });
});
