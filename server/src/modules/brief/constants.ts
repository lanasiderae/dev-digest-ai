/**
 * PR Brief (L05, Feature 2) constants — BRIEF-AC-01–04/06/09–12.
 */

/** C7: whole-input token cap for the ONE brief generation call. Enforced
 *  BEFORE calling the model — mandatory sections (instructions/status/head/
 *  allowlist/compact facts/bounded PR+issue text) must fit on their own;
 *  only whole project-context documents are dropped (from the tail) to make
 *  room. */
export const BRIEF_INPUT_TOKEN_CAP = 8_000;

/** C7: output token cap for the structured completion. */
export const BRIEF_OUTPUT_TOKEN_CAP = 1_500;

/** Bounded PR description / linked-issue text — same shape as the Intent
 *  Layer's caps (`reviews/constants.ts`), independent constants since this
 *  is a different call with a different budget. */
export const BRIEF_MAX_DESCRIPTION_CHARS = 3000;
export const BRIEF_MAX_ISSUE_TITLE_CHARS = 300;
export const BRIEF_MAX_ISSUE_BODY_CHARS = 1500;

/** Smart Diff role groups beyond this many files per group are summarized
 *  ("+N more") rather than listed in full, so a huge PR can't blow the
 *  compact-facts section on its own. */
export const BRIEF_MAX_FILES_PER_ROLE_GROUP = 25;

/** The structured-output schema name sent to the provider. */
export const BRIEF_SCHEMA_NAME = 'PrBriefGeneration';

/** One structured attempt only (BRIEF-AC-09) — no schema-reprompt, no
 *  transport retry. */
export const BRIEF_MAX_RETRIES = 0;
