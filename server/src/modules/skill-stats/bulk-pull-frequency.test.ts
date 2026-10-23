import { describe, it, expect } from 'vitest';
import { toBulkPullFrequency } from './helpers.js';

describe('toBulkPullFrequency', () => {
  it('returns null (not 0) for a skill whose linked agents reviewed no PR', () => {
    const result = toBulkPullFrequency(
      [{ skillId: 'sk1', skillName: 'Rubric', agentIds: ['a1'] }],
      [],
      [],
    );
    expect(result).toEqual({ sk1: null });
  });

  it('computes each skill independently from the SAME shared raw rows (one pass, not N queries)', () => {
    const runs = [
      { id: 'run-1', agentId: 'a1', prId: 'pr-1' },
      { id: 'run-2', agentId: 'a1', prId: 'pr-2' },
      { id: 'run-3', agentId: 'a2', prId: 'pr-3' },
    ];
    const matchedFindings = [
      { matchedSkill: 'Rubric', runId: 'run-1' },
      { matchedSkill: 'Security Gate', runId: 'run-3' },
    ];

    const result = toBulkPullFrequency(
      [
        { skillId: 'sk1', skillName: 'Rubric', agentIds: ['a1'] },
        { skillId: 'sk2', skillName: 'Security Gate', agentIds: ['a2'] },
        { skillId: 'sk3', skillName: 'Unused Skill', agentIds: ['a1', 'a2'] },
      ],
      runs,
      matchedFindings,
    );

    expect(result.sk1).toBe(0.5); // 1 of a1's 2 PRs matched "Rubric"
    expect(result.sk2).toBe(1); // a2's 1 PR matched "Security Gate"
    expect(result.sk3).toBe(0); // 3 PRs total across a1+a2, none cite "Unused Skill"
  });

  it('only counts a run toward a skill if the run belongs to one of THAT skill\'s linked agents', () => {
    // run-1 is by a2, but sk1 is only linked to a1 — a1 has no runs at all.
    const runs = [{ id: 'run-1', agentId: 'a2', prId: 'pr-1' }];
    const matchedFindings = [{ matchedSkill: 'Rubric', runId: 'run-1' }];

    const result = toBulkPullFrequency(
      [{ skillId: 'sk1', skillName: 'Rubric', agentIds: ['a1'] }],
      runs,
      matchedFindings,
    );
    expect(result.sk1).toBeNull();
  });

  it('ignores runs with no PR when computing the denominator', () => {
    const runs = [
      { id: 'run-1', agentId: 'a1', prId: null },
      { id: 'run-2', agentId: 'a1', prId: 'pr-2' },
    ];
    const result = toBulkPullFrequency(
      [{ skillId: 'sk1', skillName: 'Rubric', agentIds: ['a1'] }],
      runs,
      [{ matchedSkill: 'Rubric', runId: 'run-2' }],
    );
    expect(result.sk1).toBe(1); // only run-2 (the one with a PR) counts; it's matched
  });
});
