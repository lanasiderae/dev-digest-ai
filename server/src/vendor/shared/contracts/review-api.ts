import { z } from 'zod';
import { Finding, Verdict } from './findings.js';
import { BlastRadius, Intent, SmartDiff } from './brief.js';

/**
 * A2 — Review-Core API surface contracts. These extend the core
 * Review/Finding/Intent/SmartDiff contracts with the persisted/transport shapes
 * the reviewer endpoints return. A2 owns this file; the barrel re-exports it.
 *
 * Distinct from `Finding` (the raw LLM-output unit): `FindingRecord` adds the
 * persisted row identity + action timestamps so the UI can render accept/dismiss
 * state and the `review_id` it belongs to.
 */

export const FindingRecord = Finding.extend({
  review_id: z.string(),
  accepted_at: z.string().nullable(),
  dismissed_at: z.string().nullable(),
});
export type FindingRecord = z.infer<typeof FindingRecord>;

/** A persisted review with its kept findings + grounding summary. */
export const ReviewRecord = z.object({
  id: z.string(),
  pr_id: z.string(),
  agent_id: z.string().nullable(),
  run_id: z.string().nullable(),
  agent_name: z.string().nullish(),
  kind: z.enum(['summary', 'review']),
  verdict: Verdict.nullable(),
  summary: z.string().nullable(),
  score: z.number().int().nullable(),
  model: z.string().nullable(),
  cost: z.number().nullable(),
  grounding: z.string().nullish(),
  created_at: z.string(),
  findings: z.array(FindingRecord),
});
export type ReviewRecord = z.infer<typeof ReviewRecord>;

/**
 * Response of `POST /pulls/:id/review`. Each requested agent produces a run that
 * streams over SSE at `/runs/:runId/events`; clients subscribe per run. The
 * persisted reviews are also returned once the (synchronous) run completes.
 */
export const ReviewRunTarget = z.object({
  run_id: z.string(),
  agent_id: z.string(),
  agent_name: z.string(),
});
export type ReviewRunTarget = z.infer<typeof ReviewRunTarget>;

export const ReviewRunResponse = z.object({
  pr_id: z.string(),
  runs: z.array(ReviewRunTarget),
  reviews: z.array(ReviewRecord),
});
export type ReviewRunResponse = z.infer<typeof ReviewRunResponse>;

/** Intent persisted for a PR (the Intent plus the pr_id it scopes). */
export const PrIntentRecord = Intent.extend({ pr_id: z.string() });
export type PrIntentRecord = z.infer<typeof PrIntentRecord>;

/**
 * Why `GET /pulls/:id/intent` or a regenerate call returned no intent.
 * `not_generated` is the normal first-load case (nothing persisted yet, UI
 * should trigger generation); the rest are failure modes the classifier
 * fails open on (AC11: never fabricate — say explicitly why it's missing).
 */
export const IntentUnavailableReason = z.enum([
  'not_generated',
  'provider_not_configured',
  'timeout',
  'generation_failed',
]);
export type IntentUnavailableReason = z.infer<typeof IntentUnavailableReason>;

/** Response of `GET /pulls/:id/intent` and `POST /pulls/:id/intent/regenerate`. */
export const PrIntentResponse = z.object({
  intent: PrIntentRecord.nullable(),
  unavailable_reason: IntentUnavailableReason.nullable(),
});
export type PrIntentResponse = z.infer<typeof PrIntentResponse>;

/** Smart-diff response for a PR (the SmartDiff). */
export const SmartDiffResponse = SmartDiff;
export type SmartDiffResponse = z.infer<typeof SmartDiffResponse>;

/**
 * Why the blast radius for a PR is incomplete. Mirrors the repo-intel layer's
 * own degraded vocabulary so the UI can explain *which* kind of gap it hit
 * (flag off vs. never indexed vs. partial index) instead of showing an empty
 * card that is indistinguishable from "nothing downstream".
 */
export const BlastDegradedReason = z.enum([
  'flag_off',
  'index_failed',
  'index_partial',
  'repo_too_large',
  'no_data',
]);
export type BlastDegradedReason = z.infer<typeof BlastDegradedReason>;

/**
 * Response of `GET /pulls/:id/blast`. The `blast` payload is ALWAYS present —
 * a blast radius with no downstream callers is a real answer, not an absence,
 * so it is never null (unlike `PrIntentResponse.intent`, where "not generated
 * yet" genuinely has no payload). `degraded` answers the orthogonal question
 * "could the index fully answer this?", and is a required boolean (never
 * `undefined`) so no consumer has to distinguish absent-from-false.
 */
export const BlastRadiusResponse = z.object({
  blast: BlastRadius,
  degraded: z.boolean(),
  reason: BlastDegradedReason.nullable(),
});
export type BlastRadiusResponse = z.infer<typeof BlastRadiusResponse>;
