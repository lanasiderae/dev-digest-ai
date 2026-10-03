/**
 * USD cost display. null/undefined ⇒ "–" (never "$0.00" — a run with no cost
 * data must read as "no data", not as a free run). Sub-cent LLM costs are
 * common (e.g. $0.0013); a flat toFixed(2) would collapse them to "$0.00".
 */
export function formatCost(usd: number | null | undefined): string {
  if (usd == null) return "–";
  if (usd === 0) return "$0.00";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}
