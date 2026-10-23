import type { CSSProperties } from "react";

export const s = {
  pill: (color: string, bg: string): CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    padding: "1px 7px",
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.03em",
    color,
    background: bg,
    whiteSpace: "nowrap",
  }),
} as const;
