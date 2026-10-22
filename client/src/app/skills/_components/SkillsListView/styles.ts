import type { CSSProperties } from "react";
import { LIST_WIDTH } from "./constants";

/** Co-located styles for SkillsListView — a permanent master-detail layout
 *  (narrow list + large detail pane), mirroring /skills/[id]/page.tsx's own
 *  two-pane shape so the page looks identical with or without a selection. */
export const s = {
  page: { display: "flex", height: "calc(100vh - 52px)" } satisfies CSSProperties,
  list: {
    width: LIST_WIDTH,
    flexShrink: 0,
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-surface)",
  } satisfies CSSProperties,
  listHeader: { padding: "16px 16px 12px" } satisfies CSSProperties,
  listHeaderRow: { display: "flex", alignItems: "center", gap: 10, marginBottom: 14 } satisfies CSSProperties,
  h1: { fontSize: 18, fontWeight: 700, flex: 1 } satisfies CSSProperties,
  search: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderRadius: 7,
    border: "1px solid var(--border)",
    background: "var(--bg-elevated)",
  } satisfies CSSProperties,
  searchIcon: { color: "var(--text-muted)" } satisfies CSSProperties,
  searchInput: {
    flex: 1,
    fontSize: 13,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--text-primary)",
  } satisfies CSSProperties,
  listScroll: { flex: 1, overflow: "auto", padding: "0 12px 12px" } satisfies CSSProperties,
  selectPrompt: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center" } satisfies CSSProperties,
} as const;
