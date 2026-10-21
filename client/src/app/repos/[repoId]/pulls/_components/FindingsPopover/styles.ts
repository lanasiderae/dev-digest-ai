import type { CSSProperties } from "react";

/** Co-located styles for FindingsPopover. */
export const s = {
  // Positioned (position/top|bottom/left/maxHeight) at render time from the
  // trigger's real screen coordinates — see POPOVER_WIDTH/positionPopover in
  // FindingsPopover.tsx. Rendered via a portal into document.body so an
  // ancestor's `overflow: hidden` (e.g. the list's tableCard) can't clip it.
  popover: {
    width: 360,
    overflowY: "auto",
    background: "var(--bg-elevated)",
    border: "1px solid var(--border-strong)",
    borderRadius: 9,
    boxShadow: "var(--shadow-modal)",
    padding: 10,
    zIndex: 1000,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    cursor: "default",
  } satisfies CSSProperties,
  header: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    padding: "2px 2px 6px",
    borderBottom: "1px solid var(--border)",
  } satisfies CSSProperties,
  empty: {
    fontSize: 13,
    color: "var(--text-secondary)",
    padding: "4px 2px",
  } satisfies CSSProperties,
  item: {
    display: "flex",
    gap: 10,
    padding: "8px 2px",
    borderBottom: "1px solid var(--border)",
  } satisfies CSSProperties,
  itemMain: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    minWidth: 0,
    flex: 1,
  } satisfies CSSProperties,
  itemTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  } satisfies CSSProperties,
  itemTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--text-primary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    minWidth: 0,
  } satisfies CSSProperties,
  itemMetaRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  } satisfies CSSProperties,
  itemRationale: {
    fontSize: 12.5,
    color: "var(--text-secondary)",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
  } satisfies CSSProperties,
} as const;
