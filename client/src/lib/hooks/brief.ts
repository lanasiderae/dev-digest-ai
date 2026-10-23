/* hooks/brief.ts — React Query hooks for the L05 PR Brief feature (TASK-09).
   GET /pulls/:id/brief is a pure cache read, never a generation; POST
   /pulls/:id/brief generates/regenerates. See `BriefReadResponse`'s and
   `BriefGenerateRequest`'s doc comments in `@devdigest/shared` (plan finding
   D1): the GET's `agent_id` query param is a DISPLAY-time staleness compare
   against the cached generation's own provenance, never the live
   reviewer-selector state for the next POST — callers must keep those two
   values in separate component state, never share one. */
"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { BriefGenerateRequest, BriefReadResponse, PrBrief } from "@devdigest/shared";

export function briefKey(prId: string | null | undefined) {
  return ["pr-brief", prId] as const;
}

/**
 * `GET /pulls/:id/brief` — a plain cache read, zero model calls either way.
 * `agentId` omitted (undefined/null) just hydrates the cached generation's
 * own provenance for display. Passing a value additionally compares it
 * against that cached provenance so the caller can detect staleness
 * (BRIEF-AC-12) — it is NOT "regenerate as this reviewer"; only `POST`
 * (`useGenerateBrief`) does that.
 */
export function useBrief(prId: string | null | undefined, agentId?: string | null) {
  return useQuery({
    queryKey: [...briefKey(prId), agentId ?? null],
    queryFn: () => {
      const qs = agentId ? `?agent_id=${encodeURIComponent(agentId)}` : "";
      return api.get<BriefReadResponse>(`/pulls/${prId}/brief${qs}`);
    },
    enabled: !!prId,
    // The query KEY includes `agentId` (for the staleness compare), but
    // picking a reviewer is a routine UI action, not a "reload the page"
    // moment — keep the last-rendered brief on screen while the new
    // agentId-scoped request is in flight instead of flashing back to the
    // loading skeleton on every selector change.
    placeholderData: keepPreviousData,
  });
}

/**
 * `POST /pulls/:id/brief` — generates/regenerates (Generate button, stale
 * Refresh affordance). `agentId` is ALWAYS sent explicitly as the request
 * body's `agent_id` — a real uuid or `null` — never omitted; omitting the
 * key is a 422 server-side (never infer the last reviewer, C2).
 */
export function useGenerateBrief(prId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string | null) =>
      api.post<PrBrief>(`/pulls/${prId}/brief`, { agent_id: agentId } satisfies BriefGenerateRequest),
    onSuccess: () => {
      // Invalidates every agentId-keyed GET variant for this PR so a reload
      // (and any open staleness comparison) reflects the newly persisted brief.
      qc.invalidateQueries({ queryKey: briefKey(prId) });
    },
  });
}
