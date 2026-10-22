/**
 * Smart Diff group order in the response (most review-relevant first).
 */
export const SMART_DIFF_ROLE_ORDER = ['core', 'tests', 'wiring', 'docs', 'boilerplate'] as const;

/**
 * Smart Diff path classification tables, plain data. `classifyFile` walks them
 * in `SMART_DIFF_EVAL_ORDER` — boilerplate → tests → wiring → docs (core = no
 * match) — and the first role that matches wins (AC21). Basename patterns are
 * globs on the last path segment (`*` = any run of chars, case-insensitive);
 * directory names match ANY path segment before the basename.
 */
export const SMART_DIFF_BASENAME_PATTERNS = {
  boilerplate: [
    '*.lock',
    'pnpm-lock.yaml',
    'package-lock.json',
    'yarn.lock',
    '*.snap',
    '*.generated.*',
    '*.min.js',
  ],
  tests: ['*.test.ts', '*.test.tsx', '*.it.test.ts', '*.spec.ts'],
  wiring: ['index.ts', 'index.js', '*.config.*', 'tsconfig*.json', '.eslintrc*', '.env*', 'docker-compose*.yml'],
  docs: ['*.md', 'README*', 'CHANGELOG*', 'LICENSE'],
} as const;

export const SMART_DIFF_DIR_SEGMENTS = {
  boilerplate: ['dist', 'build', '__snapshots__'],
  tests: ['test', 'tests', '__tests__', 'e2e'],
  wiring: ['.github', '.claude'],
  docs: ['docs'],
} as const;

/** Evaluation order for the tables above (first match wins); `core` is the
 *  implicit fallback, not walked. */
export const SMART_DIFF_EVAL_ORDER = ['boilerplate', 'tests', 'wiring', 'docs'] as const;

/** Above this many changed lines (boilerplate excluded) the PR is flagged `too_big`. */
export const SPLIT_SUGGESTION_MAX_LINES = 400;
