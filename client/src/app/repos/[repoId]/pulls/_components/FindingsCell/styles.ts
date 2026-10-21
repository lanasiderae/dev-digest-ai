import type { CSSProperties } from "react";

/** Co-located styles for FindingsCell. */
export const s = {
  wrap: { position: "relative" } satisfies CSSProperties,
  trigger: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    cursor: "pointer",
  } satisfies CSSProperties,
} as const;
