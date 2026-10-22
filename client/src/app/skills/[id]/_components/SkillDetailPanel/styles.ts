import type { CSSProperties } from "react";

export const s = {
  wrap: { flex: 1, padding: "20px 28px 40px", overflow: "auto" } satisfies CSSProperties,
  header: { display: "flex", alignItems: "center", gap: 12, marginBottom: 20 } satisfies CSSProperties,
  h2: { fontSize: 18, fontWeight: 700, flex: 1 } satisfies CSSProperties,
  enabledLabel: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-secondary)" } satisfies CSSProperties,
  notice: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 8,
    border: "1px solid var(--warn)",
    background: "var(--warn-bg)",
    color: "var(--text-primary)",
    fontSize: 13,
    lineHeight: 1.5,
    marginBottom: 20,
  } satisfies CSSProperties,
  bodyPreview: {
    padding: 16,
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
    marginBottom: 16,
  } satisfies CSSProperties,
  actions: { display: "flex", alignItems: "center", gap: 12, marginTop: 20 } satisfies CSSProperties,
  savedNote: { fontSize: 13, color: "var(--ok)" } satisfies CSSProperties,
} as const;
