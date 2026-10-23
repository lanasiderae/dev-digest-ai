/* Pure helpers for PrBriefCard — no React/hooks, so they're testable in
   isolation from next/navigation and TanStack Query. */
import type { PrFile, ReviewRecord, Severity } from "@devdigest/shared";
import { severityCounts } from "@/lib/severity";

/**
 * True when `path` is a file this PR actually changed. Blast's downstream/
 * caller paths are real, grounded paths but are NOT guaranteed to be in this
 * set — a permitted downstream file absent from the PR diff is an expected,
 * correctly-grounded case (BRIEF-AC-17), not a fabricated path.
 */
export function isFileInDiff(path: string, files: PrFile[]): boolean {
  return files.some((f) => f.path === path);
}

/**
 * Builds `?tab=diff&file=<encoded>&line=<positive>` over the CURRENT query
 * string, preserving every other existing param (BRIEF-AC-05/13).
 * `URLSearchParams` percent-encodes `file` for a correct decode round trip
 * on the receiving page. `line` is omitted (and any existing `line` param
 * removed) when navigating from a risk's file reference, which has no line.
 */
export function buildDiffNavUrl(pathname: string, currentSearch: string, file: string, line?: number): string {
  const sp = new URLSearchParams(currentSearch);
  sp.set("tab", "diff");
  sp.set("file", file);
  if (line != null) sp.set("line", String(line));
  else sp.delete("line");
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/**
 * The single most-recent `kind:'review'` review that has a verdict, for
 * `VerdictBanner` (BRIEF-AC-15). Distinct from the per-agent "latest review"
 * rule used elsewhere (`DiffTab`/`FindingsPopover` helpers) — those compute
 * one latest review PER AGENT; this picks the one overall latest verdict
 * across every agent, which is the only thing a single banner can show.
 */
export function latestVerdictReview(reviews: ReviewRecord[]): ReviewRecord | null {
  const withVerdict = reviews.filter((r) => r.kind === "review" && r.verdict != null);
  if (withVerdict.length === 0) return null;
  return [...withVerdict].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]!;
}

/** Open (non-dismissed) finding counts by severity for `review`'s findings. */
export function latestVerdictCounts(review: ReviewRecord): Record<Severity, number> {
  return severityCounts(review.findings);
}

/** Display name for an agent id, falling back to the raw id when the agent
 *  list hasn't loaded yet or no longer contains it (e.g. deleted agent). */
export function agentNameFor(agentId: string | null, agents: { id: string; name: string }[]): string | null {
  if (agentId == null) return null;
  return agents.find((a) => a.id === agentId)?.name ?? agentId;
}
