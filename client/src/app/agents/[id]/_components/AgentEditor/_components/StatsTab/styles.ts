import type { CSSProperties } from "react";

export const s = {
  wrap: { maxWidth: 760, display: "flex", flexDirection: "column", gap: 20 } satisfies CSSProperties,
  header: { display: "flex", alignItems: "center", gap: 12 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700, flex: 1 } satisfies CSSProperties,
  skeletons: { display: "flex", flexDirection: "column", gap: 16 } satisfies CSSProperties,
  metricsRow: { display: "flex", gap: 12, flexWrap: "wrap" } satisfies CSSProperties,
  section: { display: "flex", flexDirection: "column", gap: 10 } satisfies CSSProperties,
  sectionLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-muted)",
    letterSpacing: "0.03em",
    textTransform: "uppercase",
  } satisfies CSSProperties,
  severityRow: { display: "flex", gap: 10, flexWrap: "wrap" } satisfies CSSProperties,
  note: { fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
