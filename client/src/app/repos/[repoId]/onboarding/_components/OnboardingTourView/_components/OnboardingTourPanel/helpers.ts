/* Pure helpers for OnboardingTourPanel — no React/hooks, so they're testable
   in isolation from next-intl/TanStack Query. */
import type { OnboardingAttempt, OnboardingGenerateResponse, OnboardingTour } from "@devdigest/shared";
import { formatCost } from "@/lib/format-cost";

/**
 * Picks the tour to actually render. Prefers the just-completed generation's
 * own response, UNLESS it reports `cached_tour_preserved: true` — in that
 * case the refresh attempt did NOT change the persisted tour (it fell back to
 * skeleton/failed), so render the still-persisted, last-successful tour (from
 * the cache-only GET) instead of the ephemeral failed/skeleton attempt. The
 * caller pairs this with `isRefreshFallback` to show an honest banner rather
 * than silently rendering the preserved content as if it were freshly
 * generated.
 */
export function selectDisplayTour(
  generateResult: OnboardingGenerateResponse | undefined,
  cachedTour: OnboardingTour | null | undefined,
): OnboardingTour | null {
  if (generateResult?.cached_tour_preserved) {
    return cachedTour ?? generateResult.tour;
  }
  if (generateResult) return generateResult.tour;
  return cachedTour ?? null;
}

/**
 * True when the most recent generate response reports that a refresh
 * attempt fell back to skeleton/failed and left the previously cached tour
 * untouched — the "cache-preserved fallback" case the UI must disclose.
 */
export function isRefreshFallback(generateResult: OnboardingGenerateResponse | undefined): boolean {
  return generateResult?.cached_tour_preserved === true;
}

/**
 * USD cost label for an attempt. Distinguishes three truthfully different
 * states: no call at all ("–", mirrors `formatCost(null)`'s "no data" en
 * dash), a call whose cost wasn't reported ("unknown" — never "$0.00"/free),
 * and a call with a known cost (delegates to the shared tiered formatter).
 */
export function formatAttemptCost(attempt: OnboardingAttempt | null): string {
  if (!attempt || !attempt.called_model) return "–";
  if (attempt.cost_usd == null) return "unknown";
  return formatCost(attempt.cost_usd);
}

/** Number of model calls this attempt actually made — at most 1 by C6 policy
 *  (no retry); 0 for a zero-call skeleton or when no attempt has ever been
 *  made at all. */
export function attemptCallCount(attempt: OnboardingAttempt | null): number {
  return attempt?.called_model ? 1 : 0;
}
