/* hooks/pr-history.ts — GET /pulls/:id/history, prior merged PRs in the
   same repo that touched any of this PR's changed files. Modeled on
   hooks/blast-radius.ts's shape (exported key helper + stale-time constant
   + docstring) — same "derived from already-stored data, not a background
   job" posture. */
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { PrHistory } from "@devdigest/shared";

/** An unchanged PR's prior-PR history doesn't need refetching on its own. */
const HISTORY_STALE_TIME_MS = 5 * 60 * 1000;

export function prHistoryKey(prId: string | null | undefined) {
  return ["pr-history", prId] as const;
}

/** Prior merged PRs in the same repo that touched any of this PR's changed
    files — a plain read, never generates anything. */
export function usePrHistory(prId: string | null | undefined) {
  return useQuery({
    queryKey: prHistoryKey(prId),
    queryFn: () => api.get<PrHistory>(`/pulls/${prId}/history`),
    enabled: !!prId,
    retry: false,
    staleTime: HISTORY_STALE_TIME_MS,
  });
}
