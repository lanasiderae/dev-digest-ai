/* hooks/blast-radius.ts — GET /pulls/:id/blast, the per-symbol downstream
   callers for a PR's changed symbols. Modeled on hooks/intent.ts's shape
   (exported key helper + stale-time constant + docstring), not
   repo-intel.ts's polling shape — blast is derived from already-computed
   repo-intel data, not a background job the UI needs to poll for
   completion. */
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { BlastRadiusResponse } from "@devdigest/shared";

/** An unchanged PR's blast radius doesn't need refetching on its own. */
const BLAST_STALE_TIME_MS = 5 * 60 * 1000;

export function prBlastKey(prId: string | null | undefined) {
  return ["pr-blast", prId] as const;
}

/** A PR's blast radius — grouped downstream callers for its changed symbols,
    plus whether the answer is degraded (and why). Never generates anything;
    it's a plain read of repo-intel's already-computed result. */
export function useBlastRadius(prId: string | null | undefined) {
  return useQuery({
    queryKey: prBlastKey(prId),
    queryFn: () => api.get<BlastRadiusResponse>(`/pulls/${prId}/blast`),
    enabled: !!prId,
    retry: false,
    staleTime: BLAST_STALE_TIME_MS,
  });
}
