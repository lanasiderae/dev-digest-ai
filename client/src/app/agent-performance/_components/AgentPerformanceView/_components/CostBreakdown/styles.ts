import type { CSSProperties } from "react";

export const s = {
  row: { display: "flex", gap: 24, flexWrap: "wrap" } satisfies CSSProperties,
  panel: {
    flex: 1,
    minWidth: 280,
    background: "var(--bg-elevated)",
    border: "1px solid var(--border)",
    borderRadius: 9,
    padding: 18,
  } satisfies CSSProperties,
  panelLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-muted)",
    letterSpacing: "0.03em",
    textTransform: "uppercase",
    marginBottom: 14,
  } satisfies CSSProperties,
  noCost: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  note: { fontSize: 12, color: "var(--text-muted)", marginTop: 4 } satisfies CSSProperties,
} as const;
