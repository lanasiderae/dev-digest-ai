"use client";

import { useEffect } from "react";

/** Sets document.title while this component is mounted, restoring the prior
 *  title on unmount/change. Every page here is a Client Component (see
 *  client/docs/ui-architecture.md), so the Metadata API (Server Component
 *  only) can't do this per-route — this is the Client Component equivalent. */
export function usePageTitle(title: string | null | undefined) {
  useEffect(() => {
    if (!title) return;
    const previous = document.title;
    document.title = `${title} — DevDigest`;
    return () => {
      document.title = previous;
    };
  }, [title]);
}
