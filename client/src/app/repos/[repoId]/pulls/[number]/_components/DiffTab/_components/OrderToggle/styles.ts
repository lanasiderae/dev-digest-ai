import type { CSSProperties } from "react";

export const s = {
  wrap: {
    display: "inline-flex",
    border: "1px solid var(--border-strong)",
    borderRadius: 6,
    overflow: "hidden",
  } satisfies CSSProperties,
} as const;

/** Active option gets the accent treatment; inactive stays plain. */
export function optionFor(active: boolean): CSSProperties {
  return {
    padding: "5px 10px",
    fontSize: 12.5,
    fontWeight: 500,
    border: "none",
    cursor: "pointer",
    background: active ? "var(--accent)" : "var(--bg-elevated)",
    color: active ? "#fff" : "var(--text-secondary)",
  };
}
