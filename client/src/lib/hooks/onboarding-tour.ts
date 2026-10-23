/* hooks/onboarding-tour.ts — React Query hooks for the L05 Onboarding Tour
   feature (TASK-11). GET /repos/:id/onboarding is a pure cache read, never a
   generation; POST /repos/:id/onboarding generates/regenerates and may return
   `cached_tour_preserved: true` when the attempt fell back to skeleton/failed
   without overwriting a previously successful cached tour — see
   `OnboardingGenerateResponse`'s doc comment in `@devdigest/shared`.

   Distinct from the pre-existing, unrelated `/onboarding` add-repository
   screen's own hooks (`useAddRepo` etc. in `./core`) — see
   `client/INSIGHTS.md`'s note on the two same-named-in-English features. */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { OnboardingGenerateResponse, OnboardingReadResponse } from "@devdigest/shared";

export function onboardingTourKey(repoId: string | null | undefined) {
  return ["onboarding-tour", repoId] as const;
}

/** `GET /repos/:id/onboarding` — a plain cache read, zero model calls. */
export function useOnboardingTour(repoId: string | null | undefined) {
  return useQuery({
    queryKey: onboardingTourKey(repoId),
    queryFn: () => api.get<OnboardingReadResponse>(`/repos/${repoId}/onboarding`),
    enabled: !!repoId,
  });
}

/**
 * `POST /repos/:id/onboarding` — generates/regenerates (Generate/Refresh).
 * The mutation's own settled `data` (not just the invalidated GET) is what
 * callers need to detect a `cached_tour_preserved: true` refresh so the UI
 * can show the honest "refresh failed, showing the last successful tour"
 * state rather than silently rendering stale data as fresh — see the
 * consuming `OnboardingTourPanel`'s `selectDisplayTour`/`isRefreshFallback`
 * helpers.
 */
export function useGenerateOnboardingTour(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<OnboardingGenerateResponse>(`/repos/${repoId}/onboarding`),
    onSuccess: () => {
      // Refetches the cache-only GET so a reload reflects whatever this call
      // actually persisted (or didn't, when `cached_tour_preserved` is true —
      // in that case the refetch simply confirms the prior cached tour is
      // still what's stored).
      qc.invalidateQueries({ queryKey: onboardingTourKey(repoId) });
    },
  });
}
