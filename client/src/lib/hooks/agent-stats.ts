/* hooks/agent-stats.ts — React Query hooks for the L08 Agent Performance
   Dashboard: the per-agent Stats tab (`GET /agents/:id/stats`) and the
   global dashboard (`GET /agents/performance`). Both read-only; neither ever
   triggers a review run or an LLM call (AC-03/AC-07). */
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { AgentStats, AgentPerf } from "@devdigest/shared";

/** Mirrors the server's `agent-stats` route query shape — `range=1d|30d` or
 *  an explicit `from`/`to` custom window (see `useStatsRange`). */
export interface StatsRangeParams {
  range?: "1d" | "30d";
  from?: string;
  to?: string;
}

function rangeQueryString(range: StatsRangeParams): string {
  const sp = new URLSearchParams();
  if (range.range) sp.set("range", range.range);
  if (range.from) sp.set("from", range.from);
  if (range.to) sp.set("to", range.to);
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

/** Per-agent run/cost/duration/accept-rate stats (Agent Editor's Stats tab). */
export function useAgentStats(agentId: string | null | undefined, range: StatsRangeParams) {
  return useQuery({
    queryKey: ["agent-stats", agentId, range.range, range.from, range.to],
    queryFn: () => api.get<AgentStats>(`/agents/${agentId}/stats${rangeQueryString(range)}`),
    enabled: !!agentId,
  });
}

/** Cross-agent performance dashboard (global "Agent Performance" page). */
export function useAgentPerformance(range: StatsRangeParams) {
  return useQuery({
    queryKey: ["agent-performance", range.range, range.from, range.to],
    queryFn: () => api.get<AgentPerf>(`/agents/performance${rangeQueryString(range)}`),
  });
}
