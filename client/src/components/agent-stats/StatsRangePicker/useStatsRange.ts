/* useStatsRange — range-picker state (1 day / 30 days / custom) shared by
   the Agent Editor's Stats tab and the global Agent Performance dashboard,
   so "reuse the same aggregation rules" (spec) is visibly true in the UI
   too, not just the API both call with the resulting `params`. */
"use client";

import React from "react";
import type { StatsRangeParams } from "../../../lib/hooks/agent-stats";

export type RangePreset = "1d" | "30d" | "custom";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export interface UseStatsRangeResult {
  preset: RangePreset;
  setPreset: (p: RangePreset) => void;
  customFrom: string;
  customTo: string;
  setCustomFrom: (v: string) => void;
  setCustomTo: (v: string) => void;
  /** Ready to spread into `useAgentStats`/`useAgentPerformance`. */
  params: StatsRangeParams;
  /** The resolved window as plain `yyyy-mm-dd` strings, for display (AC-10 —
   *  the denominator behind "accept rate" must never be opaque). For a
   *  preset this mirrors the server's own `resolveRange` (last 1/30 days
   *  from today); for `custom` it is exactly what the caller typed. */
  resolvedFrom: string;
  resolvedTo: string;
}

export function useStatsRange(initialPreset: RangePreset = "30d"): UseStatsRangeResult {
  const [preset, setPresetState] = React.useState<RangePreset>(initialPreset);
  const [customFrom, setCustomFrom] = React.useState(() => isoDate(new Date(Date.now() - THIRTY_DAYS_MS)));
  const [customTo, setCustomTo] = React.useState(() => isoDate(new Date()));
  // The "now" a preset resolves against. Read once per mount and re-read in
  // the (event-handler) `setPreset` below, never during render itself —
  // `Date.now()` is impure and reading it directly in a render/useMemo body
  // trips React's `react-hooks/purity` rule.
  const [now, setNow] = React.useState(() => Date.now());

  const setPreset = React.useCallback((p: RangePreset) => {
    setPresetState(p);
    setNow(Date.now());
  }, []);

  const params = React.useMemo<StatsRangeParams>(() => {
    if (preset === "custom") {
      return {
        from: customFrom ? `${customFrom}T00:00:00.000Z` : undefined,
        to: customTo ? `${customTo}T23:59:59.999Z` : undefined,
      };
    }
    return { range: preset };
  }, [preset, customFrom, customTo]);

  const { resolvedFrom, resolvedTo } = React.useMemo(() => {
    if (preset === "custom") return { resolvedFrom: customFrom, resolvedTo: customTo };
    return {
      resolvedFrom: isoDate(new Date(now - (preset === "1d" ? ONE_DAY_MS : THIRTY_DAYS_MS))),
      resolvedTo: isoDate(new Date(now)),
    };
  }, [preset, customFrom, customTo, now]);

  return { preset, setPreset, customFrom, customTo, setCustomFrom, setCustomTo, params, resolvedFrom, resolvedTo };
}
