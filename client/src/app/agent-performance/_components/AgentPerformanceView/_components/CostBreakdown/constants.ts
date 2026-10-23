/** Donut segment palette — cycled by index. Design-token colors so the
 *  breakdown stays consistent across light/dark (same accent family the
 *  rest of the shell already uses). */
export const SEGMENT_COLORS = [
  "var(--accent)",
  "var(--sugg)",
  "var(--warn)",
  "var(--crit)",
  "var(--ok)",
  "var(--info)",
] as const;
