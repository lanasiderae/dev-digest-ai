import type { CSSProperties } from "react";

/** Co-located styles for RunTraceDrawer (extracted from inline styles). */
export const s = {
  // ---- TraceSection ----
  section: {
    border: "1px solid var(--border)",
    borderRadius: 8,
    overflow: "hidden",
    marginBottom: 14,
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  sectionHead: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "12px 16px",
    cursor: "pointer",
  } satisfies CSSProperties,
  sectionIcon: { color: "var(--text-muted)" } satisfies CSSProperties,
  sectionTitle: { fontSize: 14, fontWeight: 600, flex: 1 } satisfies CSSProperties,
  chevron: (open: boolean): CSSProperties => ({
    color: "var(--text-muted)",
    transform: open ? "rotate(180deg)" : "none",
    transition: "transform .15s",
  }),
  sectionBody: { borderTop: "1px solid var(--border)", padding: 16 } satisfies CSSProperties,

  // ---- ToolCallRow ----
  toolRow: {
    borderRadius: 6,
    border: "1px solid var(--border)",
    marginBottom: 8,
    overflow: "hidden",
  } satisfies CSSProperties,
  toolHead: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 12px",
    cursor: "pointer",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  toolIcon: { color: "var(--warn)" } satisfies CSSProperties,
  toolName: { fontSize: 13 } satisfies CSSProperties,
  toolArgs: { color: "var(--text-muted)" } satisfies CSSProperties,
  toolMeta: { marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  toolMs: { fontSize: 12, color: "var(--text-secondary)", width: 50, textAlign: "right" } satisfies CSSProperties,
  toolDetail: {
    padding: "10px 14px",
    fontSize: 12,
    color: "var(--text-secondary)",
    background: "var(--code-bg)",
    borderTop: "1px solid var(--border)",
    lineHeight: 1.5,
  } satisfies CSSProperties,

  // ---- PromptBlock ----
  promptRow: {
    borderRadius: 6,
    border: "1px solid var(--border)",
    marginBottom: 8,
    overflow: "hidden",
  } satisfies CSSProperties,
  promptHead: { display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", cursor: "pointer" } satisfies CSSProperties,
  promptDot: (color: string): CSSProperties => ({ width: 7, height: 7, borderRadius: 2, background: color }),
  promptLabel: { fontSize: 13, fontWeight: 600 } satisfies CSSProperties,
  promptToggle: { marginLeft: "auto", fontSize: 12, color: "var(--text-muted)" } satisfies CSSProperties,
  promptPre: {
    margin: 0,
    padding: "12px 14px",
    fontSize: 12,
    lineHeight: 1.55,
    color: "var(--text-primary)",
    background: "var(--code-bg)",
    borderTop: "1px solid var(--border)",
    whiteSpace: "pre-wrap",
    maxHeight: 180,
    overflow: "auto",
  } satisfies CSSProperties,

  // ---- Stat ----
  stat: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: 7,
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
  } satisfies CSSProperties,
  statLabel: { fontSize: 12, color: "var(--text-muted)", fontWeight: 600 } satisfies CSSProperties,
  statVal: { fontSize: 16, fontWeight: 700, marginTop: 4 } satisfies CSSProperties,

  // ---- TraceBody ----
  configList: { display: "flex", flexDirection: "column", gap: 10, fontSize: 13 } satisfies CSSProperties,
  configModel: { color: "var(--accent-text)" } satisfies CSSProperties,
  configProvider: { color: "var(--text-secondary)" } satisfies CSSProperties,
  specsWrap: { display: "flex", gap: 6, flexWrap: "wrap" } satisfies CSSProperties,
  specsNone: { color: "var(--text-muted)" } satisfies CSSProperties,
  spec: { fontSize: 12, color: "var(--text-secondary)" } satisfies CSSProperties,
  statsRow: { display: "flex", gap: 10 } satisfies CSSProperties,
  rawPre: {
    margin: 0,
    padding: "12px 14px",
    fontSize: 12,
    lineHeight: 1.5,
    color: "var(--text-primary)",
    background: "var(--code-bg)",
    borderRadius: 6,
    whiteSpace: "pre-wrap",
    overflow: "auto",
    maxHeight: 220,
  } satisfies CSSProperties,

  // ---- Row ----
  row: { display: "flex", gap: 12 } satisfies CSSProperties,
  rowLabel: { color: "var(--text-muted)", width: 110 } satisfies CSSProperties,

  // ---- ProjectContextSection ----
  ctxDocList: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 } satisfies CSSProperties,
  ctxDocRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 10px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  // minWidth: 0 is required alongside flex: 1 for the ellipsis to actually
  // engage on a long path in a flex row — see client/INSIGHTS.md.
  ctxDocPath: {
    fontSize: 12.5,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  } satisfies CSSProperties,
  ctxDocRevision: { fontSize: 11, color: "var(--text-muted)", flexShrink: 0 } satisfies CSSProperties,
  ctxDocTokens: { fontSize: 12, color: "var(--text-secondary)", flexShrink: 0 } satisfies CSSProperties,
  ctxTotal: { fontSize: 12, color: "var(--text-muted)", marginBottom: 10 } satisfies CSSProperties,
  ctxOmissionsWrap: { marginBottom: 10 } satisfies CSSProperties,
  ctxOmissionsTitle: { fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 6 } satisfies CSSProperties,
  ctxOmissionRow: {
    display: "flex",
    alignItems: "baseline",
    gap: 10,
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid var(--border)",
    background: "var(--bg-surface)",
    marginBottom: 6,
    flexWrap: "wrap",
  } satisfies CSSProperties,
  ctxOmissionReason: { fontSize: 11.5, color: "var(--warn)", fontWeight: 600, flexShrink: 0 } satisfies CSSProperties,
  ctxOmissionDetail: { fontSize: 11.5, color: "var(--text-muted)" } satisfies CSSProperties,

  // ---- Drawer body ----
  footer: { display: "flex", gap: 10 } satisfies CSSProperties,
  tabBody: { paddingTop: 18 } satisfies CSSProperties,
  emptyNote: { fontSize: 13, color: "var(--text-muted)", padding: 16 } satisfies CSSProperties,
  noToolCalls: { fontSize: 13, color: "var(--text-muted)" } satisfies CSSProperties,
} as const;
