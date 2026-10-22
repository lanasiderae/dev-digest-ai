import { describe, expect, it } from 'vitest';
import { buildSmartDiff, classifyFile, openFindingLinesByPath } from '../src/modules/pulls/helpers.js';

describe('classifyFile', () => {
  // AC21's three required precedence cases.
  it.each([
    ['__tests__/__snapshots__/x.snap', 'boilerplate'],
    ['.claude/skills/security/SKILL.md', 'wiring'],
    ['e2e/README.md', 'tests'],
  ] as const)('%s -> %s', (path, role) => {
    expect(classifyFile(path)).toBe(role);
  });

  // Representative paths per role, first-match-wins.
  it.each([
    ['pnpm-lock.yaml', 'boilerplate'],
    ['package-lock.json', 'boilerplate'],
    ['dist/index.js', 'boilerplate'],
    ['src/foo.generated.ts', 'boilerplate'],
    ['server/src/modules/pulls/helpers.test.ts', 'tests'],
    ['server/src/modules/pulls/helpers.it.test.ts', 'tests'],
    ['client/src/lib/hooks/index.ts', 'wiring'],
    ['server/src/app.config.ts', 'wiring'],
    ['.env.example', 'wiring'],
    ['docs/README.md', 'docs'],
    ['README.md', 'docs'],
    ['CHANGELOG.md', 'docs'],
    ['server/src/modules/pulls/routes.ts', 'core'],
    ['client/src/lib/hooks/intent.ts', 'core'],
  ] as const)('%s -> %s', (path, role) => {
    expect(classifyFile(path)).toBe(role);
  });

  it('src/index.test.ts classifies as tests, not wiring (eval order)', () => {
    expect(classifyFile('src/index.test.ts')).toBe('tests');
  });

  it('docs/index.ts classifies as wiring, not docs (basename wins over directory)', () => {
    expect(classifyFile('docs/index.ts')).toBe('wiring');
  });
});

describe('openFindingLinesByPath', () => {
  it('drops dismissed findings and sorts/dedupes surviving lines', () => {
    const lines = openFindingLinesByPath([
      { file: 'a.ts', startLine: 10, dismissedAt: null },
      { file: 'a.ts', startLine: 3, dismissedAt: null },
      { file: 'a.ts', startLine: 10, dismissedAt: null },
      { file: 'a.ts', startLine: 99, dismissedAt: new Date() },
      { file: 'b.ts', startLine: 1, dismissedAt: null },
    ]);
    expect(lines.get('a.ts')).toEqual([3, 10]);
    expect(lines.get('b.ts')).toEqual([1]);
  });
});

describe('buildSmartDiff', () => {
  it('groups files in role order, omits empty groups, and sorts files within a group', () => {
    const result = buildSmartDiff(
      [
        { path: 'server/src/foo.ts', additions: 10, deletions: 0 },
        { path: 'pnpm-lock.yaml', additions: 500, deletions: 0 },
        { path: 'server/src/bar.test.ts', additions: 5, deletions: 0 },
        { path: 'server/src/aaa.ts', additions: 2, deletions: 1 },
      ],
      new Map([['server/src/foo.ts', [12]]]),
    );
    expect(result.groups.map((g) => g.role)).toEqual(['core', 'tests', 'boilerplate']);
    const core = result.groups.find((g) => g.role === 'core')!;
    expect(core.files.map((f) => f.path)).toEqual(['server/src/aaa.ts', 'server/src/foo.ts']);
    expect(core.files.find((f) => f.path === 'server/src/foo.ts')?.finding_lines).toEqual([12]);
  });

  it('excludes boilerplate from the split-suggestion total and flags too_big above the threshold', () => {
    const bigFile = { path: 'server/src/big.ts', additions: 300, deletions: 200, };
    const result = buildSmartDiff(
      [bigFile, { path: 'pnpm-lock.yaml', additions: 10_000, deletions: 0 }],
      new Map(),
    );
    expect(result.split_suggestion.too_big).toBe(true);
    expect(result.split_suggestion.total_lines).toBe(500);
    expect(result.split_suggestion.proposed_splits.some((s) => s.name === 'boilerplate')).toBe(false);
  });

  it('is not too_big under the threshold and proposes no splits', () => {
    const result = buildSmartDiff([{ path: 'server/src/small.ts', additions: 10, deletions: 5 }], new Map());
    expect(result.split_suggestion.too_big).toBe(false);
    expect(result.split_suggestion.proposed_splits).toEqual([]);
  });
});
