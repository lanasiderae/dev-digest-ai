import type { Severity } from "./types";

/** Display order for severity badge clusters across the app. */
export const SEVERITY_ORDER: Severity[] = ["CRITICAL", "WARNING", "SUGGESTION"];

/** Tally non-dismissed findings by severity (dismissed findings don't count
   as open issues — same rule ReviewRunAccordion's old `blockers` count used). */
export function severityCounts(
  findings: { severity: Severity; dismissed_at?: string | null }[],
): Record<Severity, number> {
  const counts: Record<Severity, number> = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
  for (const f of findings) {
    if (f.dismissed_at) continue;
    counts[f.severity] += 1;
  }
  return counts;
}
