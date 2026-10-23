/* CostBreakdown — two donuts ("by agent", "by model") fed directly from the
   AgentPerf response's `cost_by_agent`/`cost_by_model` arrays, so
   reconciliation with `summary.total_cost_usd` is structural (same
   response, no separate client-side computation — AC-04). */
"use client";

import { useTranslations } from "next-intl";
import { Donut, type DonutSegment } from "@devdigest/ui";
import type { PerfCostSegment } from "@devdigest/shared";
import { SEGMENT_COLORS } from "./constants";
import { s } from "./styles";

function toDonutSegments(segments: PerfCostSegment[]): DonutSegment[] {
  return segments.map((seg, i) => ({ ...seg, color: SEGMENT_COLORS[i % SEGMENT_COLORS.length]! }));
}

export function CostBreakdown({
  costByAgent,
  costByModel,
}: {
  costByAgent: PerfCostSegment[];
  costByModel: PerfCostSegment[];
}) {
  const t = useTranslations("agentPerformance");
  return (
    <div>
      <div style={s.row}>
        <div style={s.panel}>
          <div style={s.panelLabel}>{t("costByAgent")}</div>
          {costByAgent.length === 0 ? (
            <div style={s.noCost}>{t("noCost")}</div>
          ) : (
            <Donut segments={toDonutSegments(costByAgent)} />
          )}
        </div>
        <div style={s.panel}>
          <div style={s.panelLabel}>{t("costByModel")}</div>
          {costByModel.length === 0 ? (
            <div style={s.noCost}>{t("noCost")}</div>
          ) : (
            <Donut segments={toDonutSegments(costByModel)} />
          )}
        </div>
      </div>
      {(costByAgent.length > 0 || costByModel.length > 0) && <p style={s.note}>{t("costEstimateNote")}</p>}
    </div>
  );
}
