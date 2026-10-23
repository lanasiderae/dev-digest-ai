import { describe, it, expect } from 'vitest';
import { toSkillStats } from './helpers.js';
import type { AgentRunRow, FindingRow } from '../../db/rows.js';

let runSeq = 0;
function mkRun(overrides: Partial<AgentRunRow> = {}): AgentRunRow {
  runSeq += 1;
  return {
    id: `run-${runSeq}`,
    workspaceId: 'ws1',
    agentId: 'agent-1',
    prId: `pr-${runSeq}`,
    ranAt: new Date('2026-01-01T00:00:00.000Z'),
    provider: 'openai',
    model: 'gpt-4.1',
    durationMs: 1000,
    tokensIn: 100,
    tokensOut: 50,
    status: 'done',
    error: null,
    source: 'local',
    findingsCount: 1,
    grounding: null,
    score: 80,
    blockers: 0,
    ...overrides,
  };
}

let findingSeq = 0;
function mkFinding(overrides: Partial<FindingRow> = {}): FindingRow {
  findingSeq += 1;
  return {
    id: `finding-${findingSeq}`,
    reviewId: 'review-1',
    file: 'src/foo.ts',
    startLine: 1,
    endLine: 1,
    severity: 'WARNING',
    category: 'bug',
    title: 'Example finding',
    rationale: 'Because',
    suggestion: null,
    confidence: 0.9,
    kind: 'finding',
    trifectaComponents: null,
    matchedSkill: 'PR Quality Rubric',
    acceptedAt: null,
    dismissedAt: null,
    ...overrides,
  };
}

describe('toSkillStats', () => {
  it('returns a valid zero shape when the skill has no linked agents/runs', () => {
    const stats = toSkillStats('skill-1', 'PR Quality Rubric', [], [], []);
    expect(stats).toMatchObject({
      skill_id: 'skill-1',
      skill_name: 'PR Quality Rubric',
      agents_linked: 0,
      agents_active: 0,
      pull_frequency: null,
      prs_matched: 0,
      prs_total: 0,
      accept_rate: null,
      accepted: 0,
      dismissed: 0,
      findings_total: 0,
      findings_by_category: { bug: 0, security: 0, perf: 0, style: 0, test: 0 },
      agents_using: [],
    });
  });

  it('computes pull frequency as distinct matched PRs over distinct total PRs', () => {
    const run1 = mkRun({ id: 'run-1', agentId: 'a1', prId: 'pr-1' });
    const run2 = mkRun({ id: 'run-2', agentId: 'a1', prId: 'pr-2' });
    const finding = mkFinding({ matchedSkill: 'PR Quality Rubric' });

    const stats = toSkillStats(
      'skill-1',
      'PR Quality Rubric',
      [{ id: 'a1', name: 'Security Reviewer' }],
      [run1, run2],
      [{ finding, runId: 'run-1' }],
    );

    expect(stats.prs_total).toBe(2);
    expect(stats.prs_matched).toBe(1);
    expect(stats.pull_frequency).toBe(0.5);
    expect(stats.agents_linked).toBe(1);
    expect(stats.agents_active).toBe(1);
  });

  it('pull_frequency is null (not 0) when no run touched a PR', () => {
    const run = mkRun({ prId: null });
    const stats = toSkillStats('skill-1', 'Rubric', [{ id: 'a1', name: 'Agent' }], [run], []);
    expect(stats.prs_total).toBe(0);
    expect(stats.pull_frequency).toBeNull();
  });

  it('accept_rate counts only accepted/dismissed decisions, never pending', () => {
    const run = mkRun({ id: 'run-1' });
    const accepted = mkFinding({ acceptedAt: new Date() });
    const dismissed = mkFinding({ dismissedAt: new Date() });
    const pending = mkFinding({});

    const stats = toSkillStats(
      'skill-1',
      'Rubric',
      [{ id: 'a1', name: 'Agent' }],
      [run],
      [accepted, dismissed, pending].map((finding) => ({ finding, runId: 'run-1' })),
    );

    expect(stats.accepted).toBe(1);
    expect(stats.dismissed).toBe(1);
    expect(stats.accept_rate).toBe(0.5);
    expect(stats.findings_total).toBe(3);
  });

  it('accept_rate is null (not 0) when there are zero decisions', () => {
    const run = mkRun({ id: 'run-1' });
    const pending = mkFinding({});
    const stats = toSkillStats(
      'skill-1',
      'Rubric',
      [{ id: 'a1', name: 'Agent' }],
      [run],
      [{ finding: pending, runId: 'run-1' }],
    );
    expect(stats.accept_rate).toBeNull();
  });

  it('tallies findings_by_category only over decision-kind findings', () => {
    const run = mkRun({ id: 'run-1' });
    const bug = mkFinding({ category: 'bug' });
    const sec = mkFinding({ category: 'security' });
    const secondSec = mkFinding({ category: 'security' });
    const hook = mkFinding({ kind: 'hook', category: 'security' });

    const stats = toSkillStats(
      'skill-1',
      'Rubric',
      [{ id: 'a1', name: 'Agent' }],
      [run],
      [bug, sec, secondSec, hook].map((finding) => ({ finding, runId: 'run-1' })),
    );

    expect(stats.findings_by_category).toEqual({ bug: 1, security: 2, perf: 0, style: 0, test: 0 });
    expect(stats.findings_total).toBe(3); // the 'hook' kind finding is excluded
  });

  it('agents_active only counts linked agents that actually ran in range', () => {
    const run = mkRun({ id: 'run-1', agentId: 'a1' });
    const stats = toSkillStats(
      'skill-1',
      'Rubric',
      [
        { id: 'a1', name: 'Active Agent' },
        { id: 'a2', name: 'Idle Agent' },
      ],
      [run],
      [],
    );
    expect(stats.agents_linked).toBe(2);
    expect(stats.agents_active).toBe(1);
    expect(stats.agents_using).toEqual([
      { agent_id: 'a1', agent_name: 'Active Agent' },
      { agent_id: 'a2', agent_name: 'Idle Agent' },
    ]);
  });
});
