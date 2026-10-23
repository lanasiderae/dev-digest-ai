import type { CSSProperties } from "react";

export const s = {
  wrap: { maxWidth: 760 } satisfies CSSProperties,
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 6 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700, flex: 1 } satisfies CSSProperties,
  hint: { fontSize: 12.5, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.5 } satisfies CSSProperties,
  savedNote: { fontSize: 13, color: "var(--ok)", marginLeft: 12 } satisfies CSSProperties,
} as const;
