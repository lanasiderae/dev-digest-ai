/** Constants for the conventions module. */

/** Top-N ranked files pulled in via `repoIntel.getConventionSamples`. */
export const RANKED_SAMPLE_SIZE = 12;

/** Config filenames checked for at the clone root — included in the sample
 *  alongside the ranked files since they're some of the densest evidence for
 *  house-rules (lint/format/compiler settings), but `getConventionSamples`
 *  excludes them as "junk" for the ranked-file pass. */
export const CONFIG_FILENAMES = [
  '.eslintrc',
  '.eslintrc.json',
  '.eslintrc.js',
  '.eslintrc.cjs',
  'eslint.config.js',
  'eslint.config.mjs',
  'eslint.config.cjs',
  'eslint.config.ts',
  'tsconfig.json',
  '.prettierrc',
  '.prettierrc.json',
  '.prettierrc.js',
  'prettier.config.js',
  'prettier.config.mjs',
];

/** Per-file character cap when assembling the LLM prompt — keeps the sample
 *  (up to ~12 ranked files + a handful of configs) inside a sane token
 *  budget without a tokenizer pass. */
export const MAX_FILE_CHARS = 4000;

export const EXTRACTION_SCHEMA_NAME = 'ConventionExtraction';

/**
 * Hard cap on the whole LLM call, regardless of how many retries the
 * provider SDK attempts internally. Without this, a slow/unresponsive model
 * can hang the request for many minutes: the OpenAI SDK's own `maxRetries`
 * (2, set at client construction — see `Container.buildLlm`) multiplies with
 * `completeStructured`'s own schema-repair retry loop, so an unbounded call
 * can compound into several 90s timeouts stacked on top of each other.
 * 60s observed live against a real multi-provider-routed OpenRouter model
 * (`mistralai/mistral-nemo`): successful runs took 3–30s, one bad upstream
 * route took 7+ minutes before being killed manually — 60s cuts off that
 * kind of outlier without false-failing a normal, slightly-slow response.
 */
export const EXTRACTION_TIMEOUT_MS = 60_000;

/**
 * Fallback sampling for repos repo-intel doesn't index (anything outside
 * `.ts/.tsx/.js/.jsx/.mjs/.cjs` — see `repo-intel/constants.ts`'s
 * `SUPPORTED_EXT`). For those repos `getConventionSamples` and the JS/TS
 * `CONFIG_FILENAMES` check both come back empty, so without this, extraction
 * silently returns zero candidates for e.g. a Terraform or Go repo. Kept
 * local (not imported from `repo-intel/constants.ts`) since conventions only
 * reads repo-intel through its facade, per `repo-intel/README.md`.
 */
export const FALLBACK_EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  'out',
  'vendor',
  '.git',
  '.terraform',
  '.venv',
  '__pycache__',
  'target',
]);

/** Extensions sampled by the fallback walk — common source/config formats
 *  across non-JS ecosystems (infra-as-code, Go, Python, …). */
export const FALLBACK_SAMPLE_EXT = new Set([
  '.tf',
  '.tfvars',
  '.hcl',
  '.go',
  '.py',
  '.rb',
  '.java',
  '.kt',
  '.rs',
  '.yml',
  '.yaml',
  '.sh',
]);

/** Extensionless filenames worth sampling as fallback evidence. */
export const FALLBACK_SAMPLE_FILENAMES = new Set(['Makefile', 'Dockerfile']);

/** Safety cap on how many fallback-walk candidates we collect before sorting
 *  and taking the top `RANKED_SAMPLE_SIZE` — keeps a huge repo's walk bounded
 *  without needing repo-intel's full file-count/size machinery. */
export const FALLBACK_WALK_CAP = 200;
