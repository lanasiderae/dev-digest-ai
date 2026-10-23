import { describe, expect, it } from 'vitest';
import {
  extractIssueRef,
  extractTicketRefs,
  hunkContexts,
  sanitizeIntent,
} from '../src/modules/reviews/pipeline/intent-signals.js';

describe('extractIssueRef', () => {
  it('prefers a closing keyword over a bare ref', () => {
    expect(extractIssueRef('Fixes #12, see also #99')).toBe(12);
  });
  it('falls back to a bare #N ref', () => {
    expect(extractIssueRef('Related to #42')).toBe(42);
  });
  it('ignores a heading-style ##', () => {
    expect(extractIssueRef('## Summary\nNo issue here')).toBeNull();
  });
  it('ignores owner/repo#123 (cross-repo)', () => {
    expect(extractIssueRef('see foo/bar#123')).toBeNull();
  });
  it('returns null for empty/missing body', () => {
    expect(extractIssueRef(null)).toBeNull();
    expect(extractIssueRef('')).toBeNull();
  });
});

describe('extractTicketRefs', () => {
  it('extracts a Jira-style key as external, dedup\'d', () => {
    const { external, specPaths } = extractTicketRefs(['See ENG-42', 'ENG-42 again']);
    expect(external).toEqual(['ENG-42']);
    expect(specPaths).toEqual([]);
  });
  it('extracts a repo-relative spec path as a candidate to fetch', () => {
    const { specPaths } = extractTicketRefs(['See server/specs/review-flow.md for details']);
    expect(specPaths).toEqual(['server/specs/review-flow.md']);
  });
  it('never includes an external ticket URL in specPaths', () => {
    const { external, specPaths } = extractTicketRefs(['https://notion.so/some-doc-123']);
    expect(external[0]).toContain('notion.so');
    expect(specPaths).toEqual([]);
  });
});

describe('hunkContexts', () => {
  it('extracts only the trailing context after the second @@, not the changed lines', () => {
    const patch = ['@@ -10,3 +10,4 @@ function foo() {', '+added line', '-removed line'].join('\n');
    const ctx = hunkContexts(patch, 120);
    expect(ctx).toEqual(['function foo() {']);
  });
  it('returns an empty array when a hunk header has no trailing context', () => {
    expect(hunkContexts('@@ -1,2 +1,2 @@\n context line', 120)).toEqual([]);
  });
});

describe('sanitizeIntent', () => {
  const limits = { maxStatementChars: 50, maxBullets: 2, maxBulletChars: 20 };

  it('trims, dedupes, and caps bullets', () => {
    const out = sanitizeIntent(
      { intent: '  Adds a feature  ', in_scope: ['a', 'a', 'b', 'c'], out_of_scope: [] },
      limits,
    );
    expect(out.intent).toBe('Adds a feature');
    expect(out.in_scope).toEqual(['a', 'b']); // dedup'd + capped at maxBullets=2
  });

  it('throws on an empty statement (caller maps this to generation_failed)', () => {
    expect(() => sanitizeIntent({ intent: '   ', in_scope: [], out_of_scope: [] }, limits)).toThrow();
  });
});
