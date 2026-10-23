/* hooks/intent.ts — the Intent Layer. GET /pulls/:id/intent returns the
   cached (or not-yet-generated) intent; POST derives/regenerates it. A missing
   provider key or LLM failure is a 200 with `unavailable_reason`, never an
   error — so this never needs to retry or toast on its own. */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { PrIntentResponse } from "@devdigest/shared";

/** Long-lived: an unchanged PR's intent doesn't need refetching on its own —
   a review run (which derives it as shared pre-work) invalidates this key. */
const INTENT_STALE_TIME_MS = 5 * 60 * 1000;

export function prIntentKey(prId: string | null | undefined) {
  return ["pr-intent", prId] as const;
}

/**
 * A PR's derived intent — a plain GET of the cached record, never a
 * generation. Opening the page must not spend an LLM call: intent is
 * produced only by a review run's pre-work, or by the card's manual
 * "Run Intent" / "Regenerate" action (`useRegenerateIntent`).
 */
export function usePrIntent(prId: string | null | undefined) {
  return useQuery({
    queryKey: prIntentKey(prId),
    queryFn: () => api.get<PrIntentResponse>(`/pulls/${prId}/intent`),
    enabled: !!prId,
    retry: false,
    staleTime: INTENT_STALE_TIME_MS,
  });
}

/** Derive/regenerate a PR's intent (the card's "Run Intent"/"Regenerate"/"Retry" action). */
export function useRegenerateIntent(prId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<PrIntentResponse>(`/pulls/${prId}/intent`, { force: true }),
    onSuccess: (data) => {
      qc.setQueryData(prIntentKey(prId), data);
    },
  });
}
