import type { CSSProperties } from "react";

export const s = {
  notice: {
    border: "1px solid var(--warn)",
    borderRadius: 8,
    background: "var(--warn-bg)",
    padding: 14,
    margin: "12px 0",
  } satisfies CSSProperties,
  noticeTitle: { fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 } satisfies CSSProperties,
  noticeBody: { fontSize: 12.5, color: "var(--text-secondary)", marginBottom: 6 } satisfies CSSProperties,
  noticeList: { margin: 0, paddingLeft: 18, fontSize: 12.5, color: "var(--text-secondary)" } satisfies CSSProperties,
  controls: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    margin: "10px 0",
  } satisfies CSSProperties,
  controlsRight: { display: "flex", alignItems: "center", gap: 10 } satisfies CSSProperties,
  hint: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  groups: { display: "flex", flexDirection: "column", gap: 4 } satisfies CSSProperties,
} as const;
