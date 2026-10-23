import type { CSSProperties } from "react";

export const s = {
  notice: {
    border: "1px solid var(--warn)",
    borderRadius: 8,
    background: "var(--warn-bg)",
    padding: 14,
    margin: "12px 0",
  } satisfies CSSProperties,
  noticeTitle: { fontSize: 13, fontWeight: 600, color: "var(--text-primary)" } satisfies CSSProperties,
  headerRight: { display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  stats: {
    fontSize: 12.5,
    color: "var(--text-muted)",
    margin: "10px 0",
  } satisfies CSSProperties,
  groups: { display: "flex", flexDirection: "column", gap: 4 } satisfies CSSProperties,
} as const;
