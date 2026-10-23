import type { CSSProperties } from "react";

export const s = {
  page: { padding: "24px 28px 48px", display: "flex", flexDirection: "column", gap: 28, maxWidth: 1100 } satisfies CSSProperties,
  header: { display: "flex", flexDirection: "column", gap: 4 } satisfies CSSProperties,
  h1: { fontSize: 20, fontWeight: 700 } satisfies CSSProperties,
  subtitle: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
  section: { display: "flex", flexDirection: "column", gap: 12 } satisfies CSSProperties,
  sectionLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-muted)",
    letterSpacing: "0.03em",
    textTransform: "uppercase",
  } satisfies CSSProperties,
} as const;
