import type { CSSProperties } from "react";

export const s = {
  wrap: { display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  chips: { display: "flex", gap: 8, flexWrap: "wrap" } satisfies CSSProperties,
  customRow: { display: "flex", alignItems: "center", gap: 8 } satisfies CSSProperties,
  dateInput: { width: 150 } satisfies CSSProperties,
  dash: { color: "var(--text-muted)" } satisfies CSSProperties,
  resolved: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
