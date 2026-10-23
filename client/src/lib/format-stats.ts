/**
 * Shared formatters for the Agent Performance Dashboard (L08) — the per-agent
 * Stats tab and the global dashboard render the exact same fields, so one
 * formatter per field keeps "never render a fabricated 0/—%" (AC-09)
 * enforced in one place instead of per-component. Mirrors `format-cost.ts`'s
 * null-is-"no data"-not-zero rule.
 */

/** 0..1 rate -> "61%". null/undefined (no accepted+dismissed decisions yet)
 *  -> "–", never "0%" (a real 0% and "no data yet" must never look the same). */
export function formatPercent(rate: number | null | undefined): string {
  if (rate == null) return "–";
  return `${Math.round(rate * 100)}%`;
}

/** ms -> "450ms"/"1.2s". null (no 'done' run to average) -> "–", never "0s". */
export function formatDuration(ms: number | null | undefined): string {
  if (ms == null) return "–";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
