import type { SmartDiff, SmartDiffFile, SmartDiffGroup, SmartDiffRole } from '@devdigest/shared';
import {
  SMART_DIFF_BASENAME_PATTERNS,
  SMART_DIFF_DIR_SEGMENTS,
  SMART_DIFF_EVAL_ORDER,
  SMART_DIFF_ROLE_ORDER,
  SPLIT_SUGGESTION_MAX_LINES,
} from './constants.js';
import type { FindingAnchorRow, PrFileStat } from './types.js';

/**
 * Pure Smart Diff logic (ring 1 — no I/O, no `this`). Reusable outside an
 * HTTP request (AC21) — `routes.ts` is the only caller today, but nothing
 * here depends on Fastify or Drizzle.
 */

/** Compile a basename glob (`*` only) to an anchored, case-insensitive regex. */
function globToRegExp(glob: string): RegExp {
  const body = glob
    .split('*')
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${body}$`, 'i');
}

type ClassifiedRole = (typeof SMART_DIFF_EVAL_ORDER)[number];

const BASENAME_REGEXPS: Record<ClassifiedRole, RegExp[]> = {
  boilerplate: SMART_DIFF_BASENAME_PATTERNS.boilerplate.map(globToRegExp),
  tests: SMART_DIFF_BASENAME_PATTERNS.tests.map(globToRegExp),
  wiring: SMART_DIFF_BASENAME_PATTERNS.wiring.map(globToRegExp),
  docs: SMART_DIFF_BASENAME_PATTERNS.docs.map(globToRegExp),
};

/**
 * Classify a repo-relative path into a Smart Diff role. Pure; splits on '/'
 * only (GitHub paths always use it — never node:path). Roles are tried in
 * `SMART_DIFF_EVAL_ORDER` (boilerplate → tests → wiring → docs) and the FIRST
 * match wins; no match = `core`. The precedence is deliberate (AC21), e.g.:
 *   __tests__/__snapshots__/x.snap   -> boilerplate (not tests)
 *   .claude/skills/security/SKILL.md -> wiring      (not docs)
 *   e2e/README.md                    -> tests       (not docs)
 * Directory rules match ANY segment before the basename.
 */
export function classifyFile(path: string): SmartDiffRole {
  const segments = path.split('/');
  const basename = segments[segments.length - 1] ?? '';
  const dirs = new Set(segments.slice(0, -1).map((d) => d.toLowerCase()));
  for (const role of SMART_DIFF_EVAL_ORDER) {
    if (BASENAME_REGEXPS[role].some((re) => re.test(basename))) return role;
    if (SMART_DIFF_DIR_SEGMENTS[role].some((d) => dirs.has(d.toLowerCase()))) return role;
  }
  return 'core';
}

/** Sorted, de-duplicated start lines of OPEN (not dismissed) findings, keyed by file path. */
export function openFindingLinesByPath(rows: FindingAnchorRow[]): Map<string, number[]> {
  const byPath = new Map<string, Set<number>>();
  for (const row of rows) {
    if (row.dismissedAt != null) continue;
    const set = byPath.get(row.file) ?? new Set<number>();
    set.add(row.startLine);
    byPath.set(row.file, set);
  }
  const result = new Map<string, number[]>();
  for (const [file, lines] of byPath) result.set(file, [...lines].sort((a, b) => a - b));
  return result;
}

/** Boilerplate is excluded from the size total; splits are proposed only when too big. */
export function buildSplitSuggestion(groups: SmartDiffGroup[]): SmartDiff['split_suggestion'] {
  const reviewable = groups.filter((g) => g.role !== 'boilerplate' && g.files.length > 0);
  const totalLines = reviewable.reduce(
    (sum, g) => sum + g.files.reduce((s, f) => s + f.additions + f.deletions, 0),
    0,
  );
  const tooBig = totalLines > SPLIT_SUGGESTION_MAX_LINES;
  return {
    too_big: tooBig,
    total_lines: totalLines,
    proposed_splits: tooBig ? reviewable.map((g) => ({ name: g.role, files: g.files.map((f) => f.path) })) : [],
  };
}

/**
 * Group files by role (AC14), each annotated with its open-finding lines
 * (AC23). No model call (AC24) — everything here is deterministic. Groups
 * are emitted in `SMART_DIFF_ROLE_ORDER`, empty groups omitted; files within
 * a group are sorted by path.
 */
export function buildSmartDiff(files: PrFileStat[], findingLines: Map<string, number[]>): SmartDiff {
  const byRole = new Map<SmartDiffRole, SmartDiffFile[]>();
  for (const f of files) {
    const role = classifyFile(f.path);
    const list = byRole.get(role) ?? [];
    list.push({
      path: f.path,
      pseudocode_summary: null,
      additions: f.additions,
      deletions: f.deletions,
      finding_lines: findingLines.get(f.path) ?? [],
    });
    byRole.set(role, list);
  }
  const groups: SmartDiffGroup[] = [];
  for (const role of SMART_DIFF_ROLE_ORDER) {
    const list = byRole.get(role);
    if (!list || list.length === 0) continue;
    list.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    groups.push({ role, files: list });
  }
  return { groups, split_suggestion: buildSplitSuggestion(groups) };
}
