import type { CSSProperties } from "react";

/** Co-located styles for ConventionsView. Horizontal/top padding (32px
 *  sides, 24px top) mirrors the PR list page's `pageHeader`/`tableCard`
 *  convention — `<main>` itself has no padding, so every page owns its own. */
export const s = {
  pageHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 16,
    padding: "24px 32px 0",
    marginBottom: 16,
  } satisfies CSSProperties,
  pageTitle: { fontSize: 20, fontWeight: 600, margin: 0 } satisfies CSSProperties,
  repoLink: { color: "var(--accent)", textDecoration: "none" } satisfies CSSProperties,
  pageSubtitle: { fontSize: 13, color: "var(--text-muted)", margin: "6px 0 0" } satisfies CSSProperties,
  errorBanner: {
    fontSize: 13,
    color: "var(--crit)",
    background: "var(--crit-bg)",
    border: "1px solid var(--crit)",
    borderRadius: 6,
    padding: "8px 12px",
    margin: "0 32px 12px",
  } satisfies CSSProperties,
  toolbar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    margin: "0 32px 12px",
  } satisfies CSSProperties,
  acceptedCount: { fontSize: 13, color: "var(--text-secondary)" } satisfies CSSProperties,
  toolbarActions: { display: "flex", gap: 8 } satisfies CSSProperties,
  list: { display: "flex", flexDirection: "column", padding: "0 32px 32px" } satisfies CSSProperties,
  loadingStack: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "0 32px 32px",
  } satisfies CSSProperties,
  emptyWrap: { padding: "0 32px 32px" } satisfies CSSProperties,
} as const;
