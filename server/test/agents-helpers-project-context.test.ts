/**
 * Pure helper tests (L05, TASK-04) for the agent config-version-bump rule
 * extended to `project_context`: `isConfigChange`/`projectContextEqual` in
 * `agents/helpers.ts`. No I/O — these exercise the REAL functions the
 * repository calls, not a test-local reimplementation (see the fake-repo
 * disclaimer in `agents-project-context.test.ts`).
 */
import { describe, it, expect } from 'vitest';
import { isConfigChange, projectContextEqual } from '../src/modules/agents/helpers.js';
import type { AgentRow } from '../src/db/rows.js';

const EXISTING: Pick<
  AgentRow,
  'name' | 'description' | 'provider' | 'model' | 'systemPrompt' | 'strategy' | 'ciFailOn' | 'repoIntel' | 'projectContext'
> = {
  name: 'Reviewer',
  description: '',
  provider: 'openai',
  model: 'gpt-4.1',
  systemPrompt: 'Be helpful.',
  strategy: 'single-pass',
  ciFailOn: 'critical',
  repoIntel: true,
  projectContext: [{ repo_id: 'repo-1', paths: ['specs/a.md'] }],
};

describe('projectContextEqual', () => {
  it('treats two structurally identical selection lists (different object identity) as equal', () => {
    expect(
      projectContextEqual(
        [{ repo_id: 'repo-1', paths: ['specs/a.md'] }],
        [{ repo_id: 'repo-1', paths: ['specs/a.md'] }],
      ),
    ).toBe(true);
  });

  it('treats a changed path list as unequal', () => {
    expect(
      projectContextEqual(
        [{ repo_id: 'repo-1', paths: ['specs/a.md'] }],
        [{ repo_id: 'repo-1', paths: ['specs/a.md', 'docs/b.md'] }],
      ),
    ).toBe(false);
  });

  it('treats undefined as equivalent to an empty list', () => {
    expect(projectContextEqual(undefined, [])).toBe(true);
  });
});

describe('isConfigChange — project_context participates in the existing version bump', () => {
  it('bumps when project_context content actually differs', () => {
    expect(
      isConfigChange(EXISTING, {
        projectContext: [{ repo_id: 'repo-1', paths: ['specs/a.md', 'docs/b.md'] }],
      }),
    ).toBe(true);
  });

  it('does NOT bump when the resubmitted project_context is content-identical', () => {
    expect(
      isConfigChange(EXISTING, {
        projectContext: [{ repo_id: 'repo-1', paths: ['specs/a.md'] }],
      }),
    ).toBe(false);
  });

  it('does NOT bump when project_context is omitted from the patch entirely', () => {
    expect(isConfigChange(EXISTING, { name: 'Reviewer' })).toBe(false);
  });

  it('still bumps on an unrelated config field change, same as before this feature', () => {
    expect(isConfigChange(EXISTING, { name: 'Renamed' })).toBe(true);
  });
});
