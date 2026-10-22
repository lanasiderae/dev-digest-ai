import type { CSSProperties } from "react";

export const s = {
  root: { display: "flex", flexDirection: "column" } satisfies CSSProperties,
  labelRow: { minHeight: 37 } satisfies CSSProperties,
  card: {
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--bg-elevated)",
    padding: 18,
    display: "flex",
    flexDirection: "column",
    gap: 14,
  } satisfies CSSProperties,
  summaryLine: {
    fontSize: 12.5,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
  // Degraded state: a separate warning banner, visually distinct from the
  // per-symbol no-callers note below (different element, border, background).
  degradedBanner: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    border: "1px solid var(--warn)",
    borderRadius: 8,
    background: "var(--warn-bg)",
    padding: 12,
  } satisfies CSSProperties,
  degradedText: { display: "flex", flexDirection: "column", gap: 2 } satisfies CSSProperties,
  degradedTitle: { fontSize: 13, fontWeight: 600, color: "var(--text-primary)" } satisfies CSSProperties,
  degradedBody: { fontSize: 12.5, color: "var(--text-secondary)" } satisfies CSSProperties,
  symbolList: { display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
  symbolBlock: {
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: 10,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  } satisfies CSSProperties,
  symbolHeader: {
    display: "flex",
    alignItems: "baseline",
    gap: 8,
    fontSize: 13,
  } satisfies CSSProperties,
  symbolName: { fontWeight: 600, color: "var(--text-primary)" } satisfies CSSProperties,
  symbolFile: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  callerList: { display: "flex", flexDirection: "column", gap: 4 } satisfies CSSProperties,
  callerRow: { display: "flex", alignItems: "center", gap: 8 } satisfies CSSProperties,
  chipsRow: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 } satisfies CSSProperties,
  // Per-symbol empty state: a muted inline line INSIDE that symbol's own
  // block — distinct from the degraded banner (no border, no icon, no bg).
  muted: {
    fontSize: 12,
    color: "var(--text-muted)",
  } satisfies CSSProperties,
} as const;
