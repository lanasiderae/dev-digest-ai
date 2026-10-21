import type { PrStatus } from '@devdigest/shared';

/**
 * PR-list rollup helpers (pure — no DB / `this`, so they unit-test cleanly).
 *
 * The Pull Requests list shows, per PR: the latest review's SCORE, a FINDINGS
 * severity breakdown across every agent that reviewed it, and a review STATUS.
 * The DB `status` column holds GitHub's merge state (open/merged/closed); the
 * review status (needs_review / reviewed / stale) is DERIVED here for OPEN PRs
 * from the commit a review last ran against (`lastReviewedSha`) vs the PR head,
 * plus age.
 */

/** Open PRs whose current head was reviewed but untouched this long read "stale". */
export const STALE_DAYS = 7;

export interface SeverityCounts {
  critical: number;
  warning: number;
  suggestion: number;
}

/** Tally finding severities (CRITICAL / WARNING / SUGGESTION) for one review. */
export function rollupSeverities(rows: { severity: string }[]): SeverityCounts {
  const c: SeverityCounts = { critical: 0, warning: 0, suggestion: 0 };
  for (const r of rows) {
    if (r.severity === 'CRITICAL') c.critical += 1;
    else if (r.severity === 'WARNING') c.warning += 1;
    else if (r.severity === 'SUGGESTION') c.suggestion += 1;
  }
  return c;
}

/**
 * Group reviews (ordered NEWEST-FIRST) into, per PR, each agent's OWN latest
 * review — one entry per agent that has ever reviewed that PR.
 *
 * This is what makes the list's FINDINGS column span agents. Taking only the
 * single latest review per PR understates a PR that several agents reviewed:
 * whichever agent happened to run last wins, and every other agent's open
 * findings silently vanish from the badge counts. Keyed per agent instead, a
 * re-run still supersedes that same agent's earlier review (newest wins), so
 * counts never double up across a review's own history.
 *
 * SCORE deliberately stays single-latest-review (see the route): a score is
 * one agent's verdict on the whole diff, so summing or averaging several
 * would invent a number no agent actually produced. Findings are additive
 * facts about the code; scores are not.
 *
 * `agentId` is nullable (an unattributed/one-off run). Every null-agent review
 * collapses into ONE bucket rather than counting as a distinct agent each
 * time — so a PR whose reviews are all unattributed keeps exactly the old
 * latest-review-only behaviour.
 */
export function latestReviewPerAgent<T extends { prId: string; agentId: string | null }>(
  reviewsNewestFirst: T[],
): Map<string, T[]> {
  const byPr = new Map<string, T[]>();
  const seen = new Set<string>();
  for (const rv of reviewsNewestFirst) {
    // \u0000 can't occur in a uuid, so it can't collide with a real id pair.
    const key = `${rv.prId}\u0000${rv.agentId ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const forPr = byPr.get(rv.prId) ?? [];
    forPr.push(rv);
    byPr.set(rv.prId, forPr);
  }
  return byPr;
}

/**
 * Review-freshness status for the PR list. Merged/closed PRs keep their GitHub
 * merge state; open PRs map to:
 *  - `needs_review` — never reviewed, OR head moved since the last review
 *  - `stale`        — current head was reviewed but the PR is older than STALE_DAYS
 *  - `reviewed`     — current head reviewed and recent
 */
export function deriveReviewStatus(args: {
  /** DB `status` column = GitHub merge state (open/merged/closed). */
  ghStatus: string;
  lastReviewedSha: string | null;
  headSha: string;
  updatedAt: Date | null;
  now: number;
  staleDays?: number;
}): PrStatus {
  const { ghStatus, lastReviewedSha, headSha, updatedAt, now } = args;
  if (ghStatus === 'merged' || ghStatus === 'closed') return ghStatus as PrStatus;
  if (!lastReviewedSha || lastReviewedSha !== headSha) return 'needs_review';
  const staleMs = (args.staleDays ?? STALE_DAYS) * 86_400_000;
  if (updatedAt && now - updatedAt.getTime() > staleMs) return 'stale';
  return 'reviewed';
}
