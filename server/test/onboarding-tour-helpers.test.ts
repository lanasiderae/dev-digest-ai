/**
 * L05/TASK-10 — pure helpers for the Onboarding Tour module (no I/O, no
 * container): evidence-path grounding validation, the deterministic
 * skeleton/unavailable-section builders, and the advisory-lock key
 * derivation. Hermetic.
 */
import { describe, it, expect } from 'vitest';
import { ONBOARDING_TOUR_SECTION_KEYS } from '@devdigest/shared';
import {
  advisoryLockKeyForRepo,
  buildSkeletonSections,
  isSetupEvidencePath,
  markSectionUnavailable,
  toGeneratedSections,
  validateOnboardingGrounding,
  type OnboardingGeneration,
} from '../src/modules/onboarding-tour/helpers.js';

function makeGeneration(overrides: Partial<Record<string, { narrative: string; evidence: { path: string; note: string | null }[] }>> = {}): OnboardingGeneration {
  const base = { narrative: 'text', evidence: [] as { path: string; note: string | null }[] };
  return {
    architecture_overview: { ...base, ...overrides.architecture_overview },
    critical_paths: { ...base, ...overrides.critical_paths },
    local_setup: { ...base, ...overrides.local_setup },
    reading_order: { ...base, ...overrides.reading_order },
    first_tasks: { ...base, ...overrides.first_tasks },
  };
}

describe('validateOnboardingGrounding — rejecting narrative path claims that bypass evidence validation (ONBOARD-AC-01/06)', () => {
  it('passes when every cited evidence path is in the permitted set', () => {
    const result = makeGeneration({
      reading_order: { narrative: 'Read this first', evidence: [{ path: 'src/index.ts', note: null }] },
    });
    const violations = validateOnboardingGrounding(result, new Set(['src/index.ts']));
    expect(violations).toEqual([]);
  });

  it('rejects a section citing a path that was never actually collected', () => {
    const result = makeGeneration({
      reading_order: { narrative: 'Read this first', evidence: [{ path: 'src/invented-file.ts', note: null }] },
    });
    const violations = validateOnboardingGrounding(result, new Set(['src/index.ts']));
    expect(violations).toEqual([{ section: 'reading_order', path: 'src/invented-file.ts' }]);
  });

  it('collects violations across multiple sections, not just the first', () => {
    const result = makeGeneration({
      architecture_overview: { narrative: 'x', evidence: [{ path: 'nope-a.ts', note: null }] },
      first_tasks: { narrative: 'y', evidence: [{ path: 'nope-b.ts', note: null }] },
    });
    const violations = validateOnboardingGrounding(result, new Set(['real.ts']));
    expect(violations).toHaveLength(2);
    expect(violations.map((v) => v.path)).toEqual(['nope-a.ts', 'nope-b.ts']);
  });

  it('an empty evidence array for a section is always valid (never required to cite anything)', () => {
    const result = makeGeneration();
    const violations = validateOnboardingGrounding(result, new Set());
    expect(violations).toEqual([]);
  });
});

describe('toGeneratedSections', () => {
  it('tags every section "generated" with repo_id attached to each evidence ref', () => {
    const result = makeGeneration({
      critical_paths: { narrative: 'chain', evidence: [{ path: 'a.ts', note: 'start here' }] },
    });
    const sections = toGeneratedSections(result, 'repo-1');
    expect(sections.critical_paths).toEqual({
      narrative: 'chain',
      evidence: [{ repo_id: 'repo-1', path: 'a.ts', note: 'start here' }],
      status: 'generated',
      reason: null,
    });
    for (const key of ONBOARDING_TOUR_SECTION_KEYS) {
      expect(sections[key].status).toBe('generated');
    }
  });
});

describe('buildSkeletonSections / markSectionUnavailable', () => {
  it('produces exactly the five fixed sections, all "skeleton", with the same reason', () => {
    const sections = buildSkeletonSections('no index');
    expect(Object.keys(sections).sort()).toEqual([...ONBOARDING_TOUR_SECTION_KEYS].sort());
    for (const key of ONBOARDING_TOUR_SECTION_KEYS) {
      expect(sections[key]).toEqual({ narrative: null, evidence: [], status: 'skeleton', reason: 'no index' });
    }
  });

  it('downgrades exactly one section to "unavailable" without touching the others', () => {
    const generated = toGeneratedSections(makeGeneration(), 'repo-1');
    const downgraded = markSectionUnavailable(generated, 'local_setup', 'no setup docs found');
    expect(downgraded.local_setup).toEqual({ narrative: null, evidence: [], status: 'unavailable', reason: 'no setup docs found' });
    expect(downgraded.architecture_overview.status).toBe('generated');
  });
});

describe('advisoryLockKeyForRepo', () => {
  it('is deterministic for the same repo id', () => {
    expect(advisoryLockKeyForRepo('repo-1')).toBe(advisoryLockKeyForRepo('repo-1'));
  });

  it('differs between two different repo ids', () => {
    expect(advisoryLockKeyForRepo('repo-1')).not.toBe(advisoryLockKeyForRepo('repo-2'));
  });

  it('is a valid signed 64-bit bigint (never throws constructing it)', () => {
    const key = advisoryLockKeyForRepo('repo-1');
    expect(typeof key).toBe('bigint');
  });
});

describe('isSetupEvidencePath', () => {
  const allow = new Set(['readme.md', 'package.json', 'dockerfile']);
  const deny = new Set(['package-lock.json']);

  it('matches a known setup-manifest basename at any depth, case-insensitively', () => {
    expect(isSetupEvidencePath('README.md', allow, deny)).toBe(true);
    expect(isSetupEvidencePath('server/package.json', allow, deny)).toBe(true);
    expect(isSetupEvidencePath('Dockerfile', allow, deny)).toBe(true);
  });

  it('rejects a denylisted basename even if it would otherwise match', () => {
    expect(isSetupEvidencePath('package-lock.json', new Set(['package-lock.json']), deny)).toBe(false);
  });

  it('rejects an arbitrary source file not on the allowlist', () => {
    expect(isSetupEvidencePath('src/index.ts', allow, deny)).toBe(false);
  });
});
