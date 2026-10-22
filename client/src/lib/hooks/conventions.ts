/* hooks/conventions.ts — React Query hooks for the Conventions page.
     GET   /repos/:id/conventions         → candidate list
     POST  /repos/:id/conventions/extract → scan the clone (synchronous —
                                             the handler awaits the LLM call
                                             directly, no job to poll)
     PATCH /conventions/:id               → accept/reject or edit a rule */
"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { ConventionCandidate } from "@devdigest/shared";

export function useConventions(repoId: string | null | undefined) {
  return useQuery({
    queryKey: ["conventions", repoId],
    queryFn: () => api.get<ConventionCandidate[]>(`/repos/${repoId}/conventions`),
    enabled: !!repoId,
  });
}

/** Runs the scan and seeds the list cache with the fresh result directly —
 *  no need to invalidate + refetch since the response IS the new list. */
export function useExtractConventions(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<ConventionCandidate[]>(`/repos/${repoId}/conventions/extract`),
    onSuccess: (data) => {
      qc.setQueryData(["conventions", repoId], data);
    },
  });
}

export interface UpdateConventionInput {
  id: string;
  patch: Partial<Pick<ConventionCandidate, "rule" | "accepted" | "rejected">>;
}

export function useUpdateConvention(repoId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateConventionInput) =>
      api.patch<ConventionCandidate>(`/conventions/${id}`, patch),
    onSuccess: (updated) => {
      qc.setQueryData<ConventionCandidate[]>(["conventions", repoId], (prev) =>
        prev?.map((c) => (c.id === updated.id ? updated : c)),
      );
    },
  });
}
