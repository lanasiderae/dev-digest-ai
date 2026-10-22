import type { CSSProperties } from "react";

/** Co-located styles for ConventionCard (mirrors SkillCard's card shape). */
export const s = {
  card: (accepted: boolean, rejected: boolean): CSSProperties => ({
    padding: 16,
    borderRadius: 8,
    border: "1px solid " + (accepted ? "var(--ok)" : rejected ? "var(--crit)" : "var(--border)"),
    background: "var(--bg-elevated)",
    opacity: rejected ? 0.7 : 1,
    marginBottom: 10,
  }),
  headerRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  } satisfies CSSProperties,
  rule: { fontSize: 14, fontWeight: 600, lineHeight: 1.4, flex: 1 } satisfies CSSProperties,
  actions: { display: "flex", gap: 8, flexShrink: 0, alignItems: "flex-start" } satisfies CSSProperties,
  editBox: { flex: 1, display: "flex", flexDirection: "column", gap: 8 } satisfies CSSProperties,
  editActions: { display: "flex", gap: 8, justifyContent: "flex-end" } satisfies CSSProperties,
  evidencePath: {
    fontSize: 12,
    color: "var(--text-muted)",
    margin: "8px 0 4px",
  } satisfies CSSProperties,
  snippet: {
    fontSize: 12.5,
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "8px 10px",
    overflowX: "auto",
    whiteSpace: "pre",
  } satisfies CSSProperties,
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  } satisfies CSSProperties,
  confidenceLabel: { fontSize: 11, color: "var(--text-muted)" } satisfies CSSProperties,
  confidenceBar: { width: 160, marginTop: 4 } satisfies CSSProperties,
} as const;
