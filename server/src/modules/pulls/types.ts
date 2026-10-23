/**
 * Domain shapes for Smart Diff (ring 2 — no I/O). Narrower than the raw
 * Drizzle rows they're read from, so `helpers.ts`'s pure functions don't
 * depend on `db/schema.ts`.
 */

/** A PR file's diff stats, without the (large) patch text. */
export interface PrFileStat {
  path: string;
  additions: number;
  deletions: number;
}

/** Where a finding anchors in a file, plus whether the user dismissed it. */
export interface FindingAnchorRow {
  file: string;
  startLine: number;
  dismissedAt: Date | null;
}
