import type { CSSProperties } from "react";

export const s = {
  wrap: { display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  header: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 2px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    width: "100%",
    textAlign: "left",
  } satisfies CSSProperties,
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  count: {
    fontSize: 12,
    color: "var(--text-muted)",
    marginLeft: "auto",
  } satisfies CSSProperties,
  findingsBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    fontSize: 12,
    fontWeight: 600,
    color: "var(--warn)",
  } satisfies CSSProperties,
  findingsDot: {
    width: 6,
    height: 6,
    borderRadius: 99,
    background: "var(--warn)",
  } satisfies CSSProperties,
} as const;

/** Chevron rotates 90deg when the group is open. */
export function chevronFor(open: boolean): CSSProperties {
  return {
    color: "var(--text-muted)",
    transform: open ? "rotate(90deg)" : "none",
    transition: "transform .12s",
  };
}
