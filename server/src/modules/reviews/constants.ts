/**
 * Review module constants.
 */

/**
 * Studio review strategy. 'single-pass' = send the WHOLE diff in ONE LLM call.
 * We deliberately do NOT use 'auto'/map-reduce by default: map-reduce makes one
 * call PER FILE, which is slow and fragile (any single file's transient 5xx
 * fails the entire run) and unnecessary — the whole diff already fits the
 * model's context.
 */
export const REVIEW_STRATEGY = 'single-pass' as const;

/**
 * Intent Layer caps — every signal fed to the low-cost classifier is capped
 * so the request stays small and cheap, and so the full diff can never leak
 * in (AC6: "never full diff bodies").
 */
export const INTENT_MAX_TITLE_CHARS = 300;
export const INTENT_MAX_DESCRIPTION_CHARS = 2000;
export const INTENT_MAX_ISSUE_TITLE_CHARS = 300;
export const INTENT_MAX_ISSUE_BODY_CHARS = 2000;
export const INTENT_MAX_SPEC_EXCERPT_CHARS = 3000;
export const INTENT_MAX_FILE_PATHS = 30;
export const INTENT_MAX_HUNK_CONTEXTS = 20;
export const INTENT_MAX_HUNK_CONTEXT_CHARS = 120;
export const INTENT_MAX_STATEMENT_CHARS = 400;
export const INTENT_MAX_BULLETS = 6;
export const INTENT_MAX_BULLET_CHARS = 200;
export const INTENT_MAX_RETRIES = 1;
export const INTENT_TIMEOUT_MS = 15_000;
