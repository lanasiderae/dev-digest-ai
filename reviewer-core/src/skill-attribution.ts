import type { Finding } from '@devdigest/shared';

/**
 * Skill-attribution hygiene — NOT a grounding gate. Every finding is kept
 * regardless; this only clears a `matched_skill` tag the model invented for
 * a skill that was never actually linked/enabled for this run, so a
 * hallucinated attribution can't survive into the stored finding.
 */
export function sanitizeMatchedSkills(findings: Finding[], knownSkillNames: string[]): Finding[] {
  const known = new Set(knownSkillNames);
  return findings.map((f) =>
    f.matched_skill && !known.has(f.matched_skill) ? { ...f, matched_skill: null } : f,
  );
}
