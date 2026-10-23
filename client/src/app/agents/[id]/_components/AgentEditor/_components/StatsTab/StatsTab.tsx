/* StatsTab — per-agent run/cost/duration/accept-rate stats (L08, Part 5 —
   wires the existing `AgentStats` contract). Read-only: mount, range change,
   and re-render never issue a review-run or LLM-call request (AC-03) — only
   `useAgentStats`'s `GET /agents/:id/stats`. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Skeleton, ErrorState, EmptyState, SeverityBadge, MetricCard, LineChart } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useAgentStats } from "../../../../../../../lib/hooks/agent-stats";
import { formatCost } from "../../../../../../../lib/format-cost";
import { formatPercent, formatDuration } from "../../../../../../../lib/format-stats";
import { StatsRangePicker, useStatsRange } from "../../../../../../../components/agent-stats/StatsRangePicker";
import { s } from "./styles";

/** Caller renders this with `key={agent.id}`, same as every other tab, so
 *  switching agents resets the range picker + query. */
export function StatsTab({ agent }: { agent: Agent }) {
  const t = useTranslations("agents");
  const range = useStatsRange("30d");
  const { data, isLoading, isError, refetch } = useAgentStats(agent.id, range.params);

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("stats.title")}</h2>
      </div>

      <StatsRangePicker
        range={range}
        runsMatched={data?.runs ?? null}
        labels={{
          oneDay: t("stats.range.oneDay"),
          thirtyDays: t("stats.range.thirtyDays"),
          custom: t("stats.range.custom"),
          matched: (n) => t("stats.range.matched", { count: n }),
        }}
      />

      {isLoading ? (
        <div style={s.skeletons}>
          <Skeleton height={88} />
          <Skeleton height={180} />
        </div>
      ) : isError ? (
        <ErrorState body={t("stats.loadError")} onRetry={() => refetch()} />
      ) : !data || data.runs === 0 ? (
        <EmptyState icon="Activity" title={t("stats.empty.title")} body={t("stats.empty.body")} />
      ) : (
        <>
          <div style={s.metricsRow}>
            <MetricCard label={t("stats.metrics.runs")} value={data.runs} />
            <MetricCard label={t("stats.metrics.acceptRate")} value={formatPercent(data.accept_rate)} />
            <MetricCard label={t("stats.metrics.avgCost")} value={formatCost(data.avg_cost_usd)} />
            <MetricCard label={t("stats.metrics.avgLatency")} value={formatDuration(data.avg_latency_ms)} />
          </div>

          <div style={s.section}>
            <div style={s.sectionLabel}>{t("stats.severity")}</div>
            <div style={s.severityRow}>
              <SeverityBadge severity="CRITICAL" count={data.findings_by_severity.CRITICAL} />
              <SeverityBadge severity="WARNING" count={data.findings_by_severity.WARNING} />
              <SeverityBadge severity="SUGGESTION" count={data.findings_by_severity.SUGGESTION} />
            </div>
          </div>

          {data.trend.length > 1 && (
            <div style={s.section}>
              <div style={s.sectionLabel}>{t("stats.trend")}</div>
              <LineChart
                series={[{ name: "findings", color: "var(--accent)", data: data.trend.map((p) => p.value) }]}
                yMin={0}
                yMax={Math.max(1, ...data.trend.map((p) => p.value))}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
