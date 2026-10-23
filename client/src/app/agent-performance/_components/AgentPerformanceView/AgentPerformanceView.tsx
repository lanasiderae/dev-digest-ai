/* AgentPerformanceView — global Agent Performance Dashboard (L08, Part 5 —
   wires the existing `AgentPerf` contract). Read-only: mount, range change,
   sort, and row-view never issue a review-run or LLM-call request (AC-07) —
   only `useAgentPerformance`'s `GET /agents/performance`. Layout matches the
   reference screenshot top-to-bottom: tiles -> table -> cost breakdown
   (AC-06). */
"use client";

import { useTranslations } from "next-intl";
import { Skeleton, ErrorState, EmptyState } from "@devdigest/ui";
import { AppShell } from "../../../../components/app-shell";
import { useAgentPerformance } from "../../../../lib/hooks/agent-stats";
import { StatsRangePicker, useStatsRange } from "../../../../components/agent-stats/StatsRangePicker";
import { SummaryTiles } from "./_components/SummaryTiles";
import { PerformanceTable } from "./_components/PerformanceTable";
import { CostBreakdown } from "./_components/CostBreakdown";
import { s } from "./styles";

export function AgentPerformanceView() {
  const t = useTranslations("agentPerformance");
  const range = useStatsRange("30d");
  const { data, isLoading, isError, refetch } = useAgentPerformance(range.params);

  const decisions = (data?.agents ?? []).reduce((sum, a) => sum + a.accepted + a.dismissed, 0);

  return (
    <AppShell crumb={[{ label: t("title") }]}>
      <div style={s.page}>
        <div style={s.header}>
          <h1 style={s.h1}>{t("title")}</h1>
          <p style={s.subtitle}>{t("subtitle")}</p>
        </div>

        <StatsRangePicker
          range={range}
          runsMatched={data?.summary.runs ?? null}
          labels={{
            oneDay: t("range.oneDay"),
            thirtyDays: t("range.thirtyDays"),
            custom: t("range.custom"),
            matched: (n) => t("range.matched", { count: n }),
          }}
        />

        {isLoading ? (
          <div style={s.section}>
            <Skeleton height={100} />
            <Skeleton height={220} />
          </div>
        ) : isError ? (
          <ErrorState fullScreen body={t("loadError")} onRetry={() => refetch()} />
        ) : !data || data.summary.runs === 0 ? (
          <EmptyState icon="Activity" title={t("empty.title")} body={t("empty.body")} />
        ) : (
          <>
            <SummaryTiles summary={data.summary} decisions={decisions} />

            <div style={s.section}>
              <div style={s.sectionLabel}>{t("perAgent")}</div>
              <PerformanceTable rows={data.agents} />
            </div>

            <CostBreakdown costByAgent={data.cost_by_agent} costByModel={data.cost_by_model} />
          </>
        )}
      </div>
    </AppShell>
  );
}
