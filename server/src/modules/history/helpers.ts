import type { PrHistoryItem } from '@devdigest/shared';
import type { PriorPrOverlap } from '../reviews/repository/pull.repo.js';

/**
 * Pure Domain layer for the history module — no Drizzle/Fastify/container
 * types in any signature, same shape as `blast/helpers.ts`'s `toBlastRadius`.
 * This is what keeps `server/test/history-helpers.test.ts` a hermetic unit
 * test.
 */

/**
 * `pull_requests` has no dedicated merge-timestamp column — `status`
 * ('open'/'merged'/'closed') IS the GitHub merge state (see
 * `pulls/status.ts`'s `deriveReviewStatus`), and `updated_at` is the closest
 * available timestamp to "when it merged". `opened_at` is a fallback for the
 * rare row missing `updated_at`; an empty string is the last resort rather
 * than fabricating a date. This is an approximation, not an exact merge time.
 */
export function toPrHistoryItem(overlap: PriorPrOverlap): PrHistoryItem {
  const { pr, overlapPaths } = overlap;
  return {
    pr_number: pr.number,
    title: pr.title,
    merged_at: pr.updatedAt?.toISOString() ?? pr.openedAt?.toISOString() ?? '',
    author: pr.author,
    files_overlap: [...overlapPaths].sort(),
    // No LLM synthesis for this slice — deterministic data only.
    notes: '',
  };
}

/** Most-overlap-first, then most-recently-updated-first. Stable enough for
 *  a short, human-scanned list — no secondary tiebreak needed. */
export function sortByOverlap(overlaps: PriorPrOverlap[]): PriorPrOverlap[] {
  return [...overlaps].sort((a, b) => {
    const byCount = b.overlapPaths.length - a.overlapPaths.length;
    if (byCount !== 0) return byCount;
    const aTime = a.pr.updatedAt?.getTime() ?? 0;
    const bTime = b.pr.updatedAt?.getTime() ?? 0;
    return bTime - aTime;
  });
}
