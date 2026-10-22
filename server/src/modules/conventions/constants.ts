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
