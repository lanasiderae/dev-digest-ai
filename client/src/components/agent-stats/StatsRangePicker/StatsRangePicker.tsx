/* StatsRangePicker — 1 day / 30 days / custom range control, shared by the
   Agent Editor's Stats tab and the global Agent Performance dashboard.
   Labels are passed in (not read from a fixed i18n namespace here) since the
   two callers resolve strings from different message namespaces. */
"use client";

import React from "react";
import { Chip, TextInput } from "@devdigest/ui";
import type { UseStatsRangeResult } from "./useStatsRange";
import { s } from "./styles";

export interface StatsRangePickerLabels {
  oneDay: string;
  thirtyDays: string;
  custom: string;
  /** e.g. "{n} runs matched" — already pluralized by the caller. */
  matched: (runs: number) => string;
}

export function StatsRangePicker({
  range,
  labels,
  runsMatched,
}: {
  range: UseStatsRangeResult;
  labels: StatsRangePickerLabels;
  /** AC-10 — the count of runs the resolved range matched; `null` while loading/erroring. */
  runsMatched: number | null;
}) {
  return (
    <div style={s.wrap}>
      <div style={s.chips}>
        <Chip active={range.preset === "1d"} onClick={() => range.setPreset("1d")}>
          {labels.oneDay}
        </Chip>
        <Chip active={range.preset === "30d"} onClick={() => range.setPreset("30d")}>
          {labels.thirtyDays}
        </Chip>
        <Chip active={range.preset === "custom"} onClick={() => range.setPreset("custom")}>
          {labels.custom}
        </Chip>
      </div>
      {range.preset === "custom" && (
        <div style={s.customRow}>
          <div style={s.dateInput}>
            <TextInput type="date" value={range.customFrom} onChange={range.setCustomFrom} mono={false} />
          </div>
          <span style={s.dash}>–</span>
          <div style={s.dateInput}>
            <TextInput type="date" value={range.customTo} onChange={range.setCustomTo} mono={false} />
          </div>
        </div>
      )}
      <div className="mono tnum" style={s.resolved}>
        {range.resolvedFrom} – {range.resolvedTo} · {runsMatched != null ? labels.matched(runsMatched) : "…"}
      </div>
    </div>
  );
}
