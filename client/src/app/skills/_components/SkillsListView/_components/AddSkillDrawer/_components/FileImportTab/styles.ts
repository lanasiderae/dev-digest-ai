import type { CSSProperties } from "react";

export const s = {
  wrap: { padding: "0 24px" } satisfies CSSProperties,
  dropzone: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "28px 16px",
    borderRadius: 8,
    border: "1px dashed var(--border-strong)",
    background: "var(--bg-elevated)",
    color: "var(--text-secondary)",
    fontSize: 13,
    cursor: "pointer",
    marginBottom: 20,
  } satisfies CSSProperties,
  error: { fontSize: 13, color: "var(--crit)", marginBottom: 16 } satisfies CSSProperties,
  candidateList: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 20 } satisfies CSSProperties,
  candidateButton: (active: boolean): CSSProperties => ({
    textAlign: "left",
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid " + (active ? "var(--accent)" : "var(--border)"),
    background: active ? "var(--accent-bg)" : "var(--bg-elevated)",
    cursor: "pointer",
    fontSize: 13,
    fontFamily: "var(--font-mono, monospace)",
  }),
  actions: { display: "flex", justifyContent: "flex-end", marginTop: 20 } satisfies CSSProperties,
} as const;
