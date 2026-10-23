import type { CSSProperties } from "react";

export const s = {
  row: { display: "flex", gap: 12, flexWrap: "wrap" } satisfies CSSProperties,
  decisionsNote: {
    fontSize: 13,
    fontWeight: 500,
    color: "var(--text-muted)",
    marginLeft: 8,
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
} as const;
