import type { CSSProperties } from "react";

export const s = {
  wrap: { padding: "0 24px" } satisfies CSSProperties,
  notice: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    color: "var(--text-secondary)",
    fontSize: 13,
    lineHeight: 1.5,
    marginBottom: 16,
  } satisfies CSSProperties,
} as const;
