import type { ReviewRecord } from "@devdigest/shared";
import { SEVERITY_ORDER } from "@/lib/severity";

/**
 * Each agent's OWN latest review, in the order the agents last reviewed
 * (newest first) — the client-side twin of the server's `latestReviewPerAgent`
 * (`server/src/modules/pulls/status.ts`), so this popover lists exactly the
 * reviews whose findings the list column's badge counts sum.
 *
 * Keep the two in step: if one takes the latest review per PR and the other
 * per agent, the popover and the badges beside it disagree on screen.
 *
 * Expects `usePrReviews` order (newest first) and ignores `kind: 'summary'`
 * entries, which carry no findings. A null `agent_id` (unattributed run)
 * collapses into one entry rather than counting as a distinct agent per
 * review.
 */
export function latestReviewPerAgent(reviews: ReviewRecord[] | undefined): ReviewRecord[] {
  const seen = new Set<string>();
  const out: ReviewRecord[] = [];
  for (const r of reviews ?? []) {
    if (r.kind !== "review") continue;
    const key = r.agent_id ?? "";
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** CRITICAL → WARNING → SUGGESTION, the badge-cluster order used app-wide. */
export function sortBySeverity(findings: ReviewRecord["findings"]): ReviewRecord["findings"] {
  return [...findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );
}
