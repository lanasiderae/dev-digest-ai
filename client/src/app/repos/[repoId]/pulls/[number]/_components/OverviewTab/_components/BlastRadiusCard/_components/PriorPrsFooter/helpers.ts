/** "Jan 2, 2026" — null (never a blank string) when `iso` is empty or
    unparseable, so the caller can fall back to an explicit "—" rather than
    rendering nothing. */
export function formatMergedAt(iso: string): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString();
}
