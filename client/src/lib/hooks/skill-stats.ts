/* hooks/skill-stats.ts — React Query hook for the per-skill Stats tab
   (`GET /skills/:id/stats`). Read-only: never triggers a review run or an
   LLM call, mirroring `hooks/agent-stats.ts`'s `useAgentStats`. */
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { SkillStats } from "@devdigest/shared";
import type { StatsRangeParams } from "./agent-stats";

function rangeQueryString(range: StatsRangeParams): string {
  const sp = new URLSearchParams();
  if (range.range) sp.set("range", range.range);
  if (range.from) sp.set("from", range.from);
  if (range.to) sp.set("to", range.to);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export function useSkillStats(skillId: string | null | undefined, range: StatsRangeParams) {
  return useQuery({
    queryKey: ["skill-stats", skillId, range.range, range.from, range.to],
    queryFn: () => api.get<SkillStats>(`/skills/${skillId}/stats${rangeQueryString(range)}`),
    enabled: !!skillId,
  });
}
