import React from "react";
import { createPortal } from "react-dom";

/** Hover-only tooltip (no click needed) — shows `label` in a small floating
 *  box to the right of `children`, vertically centered, the instant the
 *  pointer enters, unlike the native `title` attribute's inconsistent/
 *  delayed browser tooltip. Typically wraps a truncated
 *  (`text-overflow: ellipsis`) element to reveal its full text.
 *
 *  Renders through a portal at `document.body` with `position: fixed`,
 *  computed from the trigger's own `getBoundingClientRect()` — NOT
 *  `position: absolute` within the trigger — so it's never clipped by a
 *  narrow/scrollable ancestor (e.g. a sidebar list with `overflow: auto`). */
export function Tooltip({
  label,
  children,
  style,
}: {
  label: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [pos, setPos] = React.useState<{ top: number; left: number } | null>(null);

  const show = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (rect) setPos({ top: rect.top + rect.height / 2, left: rect.right + 8 });
  };
  const hide = () => setPos(null);

  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={hide}
      style={{ display: "inline-flex", minWidth: 0, ...style }}
    >
      {children}
      {pos &&
        createPortal(
          <span
            role="tooltip"
            style={{
              position: "fixed",
              top: pos.top,
              left: pos.left,
              transform: "translateY(-50%)",
              zIndex: 1000,
              padding: "5px 9px",
              borderRadius: 6,
              background: "var(--bg-elevated)",
              border: "1px solid var(--border-strong)",
              color: "var(--text-primary)",
              fontSize: 12,
              fontWeight: 500,
              whiteSpace: "nowrap",
              boxShadow: "0 4px 12px rgba(0,0,0,.35)",
              pointerEvents: "none",
            }}
          >
            {label}
          </span>,
          document.body,
        )}
    </span>
  );
}
