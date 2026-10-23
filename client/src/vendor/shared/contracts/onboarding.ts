import { z } from 'zod';

/**
 * Onboarding Generator / repository tour (L05, Feature 3).
 *
 * Distinct from the pre-existing, unrelated `knowledge.ts` `Onboarding`/
 * `OnboardingSection` pair (the `/onboarding` add-repository screen's old
 * `{kind,title,body,diagram,links}` shape, which does not match the required
 * five sections and is explicitly NOT reused — see the approved spec's
 * Feature 3 provenance table). This file's exports are named `OnboardingTour*`
 * to avoid colliding with those existing barrel exports.
 *
 * Stored as the entire `onboarding.json` payload (one row per repo, 1:1 with
 * `repos`, existing table — see `server/src/db/schema/context.ts`).
 */

// ---- Sections ----

/** Exactly these five keys, in this fixed order. */
export const ONBOARDING_TOUR_SECTION_KEYS = [
  'architecture_overview',
  'critical_paths',
  'local_setup',
  'reading_order',
  'first_tasks',
] as const;

export const OnboardingTourSectionStatus = z.enum([
  /** Written by a successful structured model attempt. */
  'generated',
  /** Zero-call deterministic fallback (C6) — no eligible index, or a prior
      model/validation failure. */
  'skeleton',
  /** No evidence at all could be assembled for this section (e.g. no setup
      docs/manifests found) — distinct from `skeleton`, which still runs the
      standard deterministic template. */
  'unavailable',
]);
export type OnboardingTourSectionStatus = z.infer<typeof OnboardingTourSectionStatus>;

/** One evidence-backed repository path a section cites. Never a narrative
    claim without a matching, validated path — an unvalidated path must be
    rejected before caching, not stored here. */
export const OnboardingEvidenceRef = z.object({
  repo_id: z.string(),
  path: z.string(),
  /** Optional short note (e.g. why this file is read next, or what command
      it documents); null when the path speaks for itself. */
  note: z.string().nullable(),
});
export type OnboardingEvidenceRef = z.infer<typeof OnboardingEvidenceRef>;

/** One of the five top-level sections. For `reading_order`, `evidence`'s
    array order IS the recommended reading order. */
export const OnboardingTourSection = z.object({
  /** Narrative text; null when `status !== 'generated'` — distinguishes "not
      written" from "written but legitimately empty". */
  narrative: z.string().nullable(),
  evidence: z.array(OnboardingEvidenceRef),
  status: OnboardingTourSectionStatus,
  /** Human-readable reason when `status !== 'generated'` (e.g. "repository
      index unavailable", "no setup manifests found"); null when generated. */
  reason: z.string().nullable(),
});
export type OnboardingTourSection = z.infer<typeof OnboardingTourSection>;

export const OnboardingTourSections = z.object({
  architecture_overview: OnboardingTourSection,
  critical_paths: OnboardingTourSection,
  local_setup: OnboardingTourSection,
  reading_order: OnboardingTourSection,
  first_tasks: OnboardingTourSection,
});
export type OnboardingTourSections = z.infer<typeof OnboardingTourSections>;

// ---- Omissions ----

export const OnboardingOmissionReason = z.enum([
  /** No repo-intel index exists yet for this repository. */
  'index_unavailable',
  /** The index exists but is partial/degraded (see `repo_index_state.status`). */
  'index_partial',
  /** Exceeds the 24,000-token whole-input cap and was dropped before the call. */
  'budget',
  /** Referenced evidence path no longer exists at the pinned revision. */
  'missing',
]);
export type OnboardingOmissionReason = z.infer<typeof OnboardingOmissionReason>;

export const OnboardingOmission = z.object({
  path: z.string().nullable(),
  reason: OnboardingOmissionReason,
  detail: z.string().nullable(),
});
export type OnboardingOmission = z.infer<typeof OnboardingOmission>;

// ---- Attempt metadata ----

/** One generation attempt's call/token/cost metadata. C6: at most one
    structured attempt per generation, no retry. */
export const OnboardingAttempt = z.object({
  /** True once a model call was actually made; false for a zero-call C6
      skeleton (ineligible index) — the fields below are all null in that
      case, not zero, since no call happened to report on. */
  called_model: z.boolean(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  tokens_in: z.number().int().nullable(),
  tokens_out: z.number().int().nullable(),
  /** USD; null means unknown/unpriced — never coerced to 0 (mirrors this
      repo's existing `computeRunCost` null-not-zero convention). */
  cost_usd: z.number().nullable(),
  attempted_at: z.string(),
});
export type OnboardingAttempt = z.infer<typeof OnboardingAttempt>;

// ---- Top-level tour ----

export const OnboardingTourStatus = z.enum([
  /** One successful structured model attempt, all five sections generated. */
  'complete',
  /** Some sections generated, others skeleton/unavailable (e.g. partial index). */
  'partial',
  /** Zero-call deterministic fallback — no eligible index (C6). */
  'skeleton',
  /** Model/validation failure after the one allowed attempt; previous cached
      tour (if any) is preserved separately, this document IS the fallback
      shown for the failed attempt. */
  'failed',
]);
export type OnboardingTourStatus = z.infer<typeof OnboardingTourStatus>;

export const OnboardingTour = z.object({
  repo_id: z.string(),
  sections: OnboardingTourSections,
  status: OnboardingTourStatus,
  /** Human-readable reason for a non-`complete` status; null when complete. */
  reason: z.string().nullable(),
  /** The repository index revision (`repo_index_state.last_indexed_sha`) this
      tour was generated against — distinct from any PR head SHA; null when
      no index was available at all. */
  index_revision: z.string().nullable(),
  /** This generation's attempt metadata; null only when no attempt has ever
      been made for this tour (never generated at all). */
  attempt: OnboardingAttempt.nullable(),
  omissions: z.array(OnboardingOmission),
  generated_at: z.string(),
});
export type OnboardingTour = z.infer<typeof OnboardingTour>;
