import type { CSSProperties } from "react";

export const s = {
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 6 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700 } satisfies CSSProperties,
  orderHint: { fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 } satisfies CSSProperties,
  search: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderRadius: 7,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    width: 240,
    marginBottom: 16,
  } satisfies CSSProperties,
  searchInput: {
    flex: 1,
    fontSize: 13,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  row: (dragging: boolean): CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    borderRadius: 7,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    marginBottom: 6,
    opacity: dragging ? 0.5 : 1,
  }),
  moveCol: { display: "flex", flexDirection: "column", gap: 0 } satisfies CSSProperties,
  name: { fontSize: 13.5, fontWeight: 600, flex: 1 } satisfies CSSProperties,
  /** Mirrors SkillCard's own typeChip — same per-type color for the same
   *  label wherever a skill's type is shown. */
  typeChip: (color: string): CSSProperties => ({
    fontSize: 12,
    fontWeight: 600,
    color,
    background: color + "1a",
    padding: "1px 8px",
    borderRadius: 4,
  }),
} as const;
