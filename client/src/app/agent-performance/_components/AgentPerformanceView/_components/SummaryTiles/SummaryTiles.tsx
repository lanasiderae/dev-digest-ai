/* SummaryTiles — Total Runs / Total Cost / Avg Accept Rate / Most-Active
   Agent, each showing the range's run-count denominator (AC-10) so the
   number behind the headline is never opaque. Pure presentational — no
   data fetching of its own. */
"use client";

import { useTranslations } from "next-intl";
import { MetricCard } from "@devdigest/ui";
import type { AgentPerf } from "@devdigest/shared";
import { formatCost } from "../../../../../../lib/format-cost";
import { formatPercent } from "../../../../../../lib/format-stats";
import { s } from "./styles";

export function SummaryTiles({
  summary,
  decisions,
}: {
  summary: AgentPerf["summary"];
  /** accepted+dismissed across every agent in range — the denominator behind
   *  `avg_accept_rate`, surfaced on its own tile (AC-10: never opaque). */
  decisions: number;
}) {
  const t = useTranslations("agentPerformance");
  return (
    <div style={s.row}>
      <MetricCard label={t("summary.totalRuns")} value={summary.runs} />
      <MetricCard label={t("summary.totalCost")} value={formatCost(summary.total_cost_usd)} />
      <MetricCard
        label={t("summary.avgAcceptRate")}
        value={
          <>
            {formatPercent(summary.avg_accept_rate)}
            <span style={s.decisionsNote}>· {t("summary.decisionsMatched", { count: decisions })}</span>
          </>
        }
      />
      <MetricCard label={t("summary.mostActive")} value={summary.most_active_agent ?? t("summary.noAgent")} />
    </div>
  );
}
