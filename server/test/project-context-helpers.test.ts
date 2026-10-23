/**
 * Pure helper tests for the project-context module (no container, no I/O):
 * glob-root matching (default + nested + custom roots), type classification,
 * path-shape validation, and the C3 ordered-union/dedup resolver.
 */
import { describe, it, expect } from 'vitest';
import { DEFAULT_PROJECT_CONTEXT_ROOTS } from '@devdigest/shared';
import {
  classifyDocumentType,
  isEligibleMarkdownPath,
  matchesAnyRoot,
  normalizeRequestedPath,
  resolveProjectContextPaths,
} from '../src/modules/project-context/helpers.js';

describe('matchesAnyRoot — default roots (**/{specs,docs,insights}/**/*.md)', () => {
  const roots = DEFAULT_PROJECT_CONTEXT_ROOTS;

  it('matches a file directly under a top-level category directory (zero nested dirs)', () => {
    expect(matchesAnyRoot('specs/plan.md', roots)).toBe(true);
    expect(matchesAnyRoot('docs/readme.md', roots)).toBe(true);
    expect(matchesAnyRoot('insights/notes.md', roots)).toBe(true);
  });

  it('matches nested directories under a category directory', () => {
    expect(matchesAnyRoot('specs/l05/feature-1.md', roots)).toBe(true);
    expect(matchesAnyRoot('a/b/specs/c/d/plan.md', roots)).toBe(true);
  });

  it('rejects a non-matching top-level directory name', () => {
    expect(matchesAnyRoot('specsx/plan.md', roots)).toBe(false);
    expect(matchesAnyRoot('other/plan.md', roots)).toBe(false);
  });

  it('rejects a non-.md extension even under a matching directory', () => {
    expect(matchesAnyRoot('specs/plan.txt', roots)).toBe(false);
  });
});

describe('matchesAnyRoot — custom configured root', () => {
  it('matches a simple custom root glob', () => {
    expect(matchesAnyRoot('policies/security.md', ['policies/**/*.md'])).toBe(true);
    expect(matchesAnyRoot('policies/nested/security.md', ['policies/**/*.md'])).toBe(true);
    expect(matchesAnyRoot('other/security.md', ['policies/**/*.md'])).toBe(false);
  });

  it('matches a bare "any depth, any .md" custom root', () => {
    expect(matchesAnyRoot('anything/anywhere/file.md', ['**/*.md'])).toBe(true);
    expect(matchesAnyRoot('file.md', ['**/*.md'])).toBe(true);
    expect(matchesAnyRoot('file.txt', ['**/*.md'])).toBe(false);
  });
});

describe('classifyDocumentType', () => {
  it('classifies by the first matching known segment, topmost first', () => {
    expect(classifyDocumentType('specs/plan.md')).toBe('specs');
    expect(classifyDocumentType('a/docs/b.md')).toBe('docs');
    expect(classifyDocumentType('insights/notes.md')).toBe('insights');
  });

  it('classifies anything else as custom', () => {
    expect(classifyDocumentType('policies/security.md')).toBe('custom');
  });
});

describe('normalizeRequestedPath', () => {
  it('accepts a plain nested relative .md path', () => {
    expect(normalizeRequestedPath('specs/l05/feature-1.md')).toBe('specs/l05/feature-1.md');
  });

  it('rejects an absolute path', () => {
    expect(normalizeRequestedPath('/etc/passwd.md')).toBeNull();
  });

  it('rejects a traversal path', () => {
    expect(normalizeRequestedPath('../secret.md')).toBeNull();
    expect(normalizeRequestedPath('specs/../../secret.md')).toBeNull();
  });

  it('rejects a Windows-style absolute/backslash path', () => {
    expect(normalizeRequestedPath('C:\\secret.md')).toBeNull();
    expect(normalizeRequestedPath('specs\\plan.md')).toBeNull();
  });

  it('rejects a non-.md path and an empty-segment path', () => {
    expect(normalizeRequestedPath('specs/plan.txt')).toBeNull();
    expect(normalizeRequestedPath('specs//plan.md')).toBeNull();
  });
});

describe('isEligibleMarkdownPath', () => {
  const roots = DEFAULT_PROJECT_CONTEXT_ROOTS;

  it('requires both a safe shape AND root membership', () => {
    expect(isEligibleMarkdownPath('specs/plan.md', roots)).toBe(true);
    expect(isEligibleMarkdownPath('other/plan.md', roots)).toBe(false);
    expect(isEligibleMarkdownPath('../specs/plan.md', roots)).toBe(false);
  });
});

describe('resolveProjectContextPaths (C3 ordered union / dedup / cross-repo exclusion)', () => {
  it('unions agent paths first, then skills in order, first occurrence wins', () => {
    const result = resolveProjectContextPaths({
      repoId: 'r1',
      agentSelections: [{ repo_id: 'r1', paths: ['specs/a.md', 'specs/b.md'] }],
      skillSelections: [
        [{ repo_id: 'r1', paths: ['specs/b.md', 'specs/c.md'] }], // skill 1: b.md is a dup
        [{ repo_id: 'r1', paths: ['specs/d.md'] }], // skill 2
      ],
    });
    expect(result.paths).toEqual(['specs/a.md', 'specs/b.md', 'specs/c.md', 'specs/d.md']);
    expect(result.omissions).toEqual([{ repo_id: 'r1', path: 'specs/b.md', reason: 'duplicate', detail: null }]);
  });

  it('excludes selections for a different repository as cross_repo omissions', () => {
    const result = resolveProjectContextPaths({
      repoId: 'r1',
      agentSelections: [
        { repo_id: 'r1', paths: ['specs/a.md'] },
        { repo_id: 'r2', paths: ['specs/other-repo.md'] },
      ],
      skillSelections: [],
    });
    expect(result.paths).toEqual(['specs/a.md']);
    expect(result.omissions).toEqual([
      { repo_id: 'r2', path: 'specs/other-repo.md', reason: 'cross_repo', detail: null },
    ]);
  });

  it('returns an empty result for no selections', () => {
    const result = resolveProjectContextPaths({ repoId: 'r1', agentSelections: [], skillSelections: [] });
    expect(result).toEqual({ paths: [], omissions: [] });
  });
});
