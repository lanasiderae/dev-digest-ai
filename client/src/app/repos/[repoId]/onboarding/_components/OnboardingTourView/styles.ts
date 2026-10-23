import type { CSSProperties } from "react";

/** Co-located styles for OnboardingTourView. Mirrors ConventionsView/PullsPage's
 *  `pageHeader` convention — `<main>` itself has no padding, so every page
 *  owns its own. */
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
  pageSubtitle: { fontSize: 13, color: "var(--text-muted)", margin: "6px 0 0", maxWidth: 640 } satisfies CSSProperties,
  body: { padding: "0 32px 32px" } satisfies CSSProperties,
} as const;
