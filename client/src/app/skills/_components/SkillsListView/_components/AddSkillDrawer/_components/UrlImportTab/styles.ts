import type { CSSProperties } from "react";

export const s = {
  wrap: { padding: "0 24px" } satisfies CSSProperties,
  row: { display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 20 } satisfies CSSProperties,
  urlField: { flex: 1 } satisfies CSSProperties,
  error: { fontSize: 13, color: "var(--crit)", marginBottom: 16 } satisfies CSSProperties,
  previewBody: {
    maxHeight: 200,
    overflow: "auto",
    padding: 12,
    borderRadius: 7,
    border: "1px solid var(--border-strong)",
    background: "var(--bg-elevated)",
    fontSize: 13,
  } satisfies CSSProperties,
  actions: { display: "flex", justifyContent: "flex-end", marginTop: 20 } satisfies CSSProperties,
} as const;
