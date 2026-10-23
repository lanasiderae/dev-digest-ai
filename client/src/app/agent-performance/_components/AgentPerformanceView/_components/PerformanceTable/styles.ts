import type { CSSProperties } from "react";

export const s = {
  wrap: { overflowX: "auto" } satisfies CSSProperties,
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 } satisfies CSSProperties,
  th: {
    textAlign: "left",
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-muted)",
    borderBottom: "1px solid var(--border)",
    cursor: "pointer",
    userSelect: "none",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  thStatic: {
    textAlign: "left",
    padding: "8px 12px",
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-muted)",
    borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  td: {
    padding: "10px 12px",
    borderBottom: "1px solid var(--border)",
    color: "var(--text-primary)",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  acceptCell: { display: "flex", alignItems: "center", gap: 8 } satisfies CSSProperties,
  viewBtn: {
    background: "transparent",
    border: "1px solid var(--border-strong)",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 12.5,
    fontWeight: 600,
    color: "var(--accent)",
    cursor: "pointer",
  } satisfies CSSProperties,
} as const;
