/* StatsTab — per-skill used-by/pull-frequency/accept-rate/findings stats.
   Skill-side analogue of the Agent Editor's StatsTab (L08). Read-only: mount,
   range change, and re-render never issue a review-run or LLM-call request —
   only `useSkillStats`'s `GET /skills/:id/stats`. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Skeleton, ErrorState, EmptyState, MetricCard, Donut, Button, Icon, Badge } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useSkillStats } from "../../../../../../../lib/hooks/skill-stats";
import { formatPercent } from "../../../../../../../lib/format-stats";
import { StatsRangePicker, useStatsRange } from "../../../../../../../components/agent-stats/StatsRangePicker";
import { MIN_DECISIONS_FOR_RATE } from "./constants";
import { s } from "./styles";

const CATEGORY_COLOR: Record<string, string> = {
  security: "var(--crit)",
  bug: "var(--warn)",
  perf: "#a78bfa",
  style: "var(--accent)",
  test: "var(--ok)",
};

const CATEGORY_LABEL: Record<string, string> = {
  security: "security",
  bug: "bug",
  perf: "perf",
  style: "style",
  test: "test",
};

/** Caller renders this with `key={skill.id}`, same as every other tab, so
 *  switching skills resets the range picker + query. */
export function StatsTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const router = useRouter();
  const range = useStatsRange("30d");
  const { data, isLoading, isError, refetch } = useSkillStats(skill.id, range.params);

  const categoryEntries = data
    ? (Object.entries(data.findings_by_category) as [string, number][]).filter(([, n]) => n > 0)
    : [];
  // AC-08-style low-sample guard (mirrors PerformanceTable's isLowSample for
  // the Agent dashboard): the rate is still COMPUTED and shown, just flagged
  // as unreliable below a documented decision-count floor — never hidden.
  const isLowSample = !!data && data.accept_rate != null && data.accepted + data.dismissed < MIN_DECISIONS_FOR_RATE;

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("stats.title")}</h2>
      </div>

      <StatsRangePicker
        range={range}
        runsMatched={data?.prs_total ?? null}
        labels={{
          oneDay: t("stats.range.oneDay"),
          thirtyDays: t("stats.range.thirtyDays"),
          custom: t("stats.range.custom"),
          matched: (n) => t("stats.range.matchedPrs", { count: n }),
        }}
      />

      {isLoading ? (
        <div style={s.skeletons}>
          <Skeleton height={88} />
          <Skeleton height={140} />
        </div>
      ) : isError ? (
        <ErrorState body={t("stats.loadError")} onRetry={() => refetch()} />
      ) : !data || data.agents_linked === 0 ? (
        <EmptyState icon="Cpu" title={t("stats.empty.title")} body={t("stats.empty.body")} />
      ) : (
        <>
          <div style={s.metricsRow}>
            <MetricCard
              label={t("stats.metrics.usedBy")}
              value={t("stats.metrics.usedByValue", { count: data.agents_linked })}
            />
            <MetricCard label={t("stats.metrics.pullFrequency")} value={formatPercent(data.pull_frequency)} />
            <MetricCard label={t("stats.metrics.acceptRate")} value={formatPercent(data.accept_rate)} />
            <MetricCard label={t("stats.metrics.findings")} value={data.findings_total} />
          </div>
          {isLowSample && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Badge color="var(--warn)" bg="var(--warn-bg)">
                {t("stats.lowSample.badge")}
              </Badge>
              <span style={s.note}>{t("stats.lowSample.note", { min: MIN_DECISIONS_FOR_RATE })}</span>
            </div>
          )}
          <p style={s.note}>{t("stats.pullFrequencyNote")}</p>

          <div style={s.section}>
            <div style={s.sectionLabel}>{t("stats.agentsUsing")}</div>
            {data.agents_using.length === 0 ? (
              <p style={s.note}>{t("stats.noAgents")}</p>
            ) : (
              data.agents_using.map((a) => (
                <div key={a.agent_id} style={s.agentRow}>
                  <Icon.Cpu size={14} style={{ color: "var(--text-secondary)" }} />
                  <span style={s.agentName}>{a.agent_name}</span>
                  <Button kind="ghost" size="sm" onClick={() => router.push(`/agents/${a.agent_id}?tab=stats`)}>
                    {t("stats.open")}
                  </Button>
                </div>
              ))
            )}
          </div>

          {categoryEntries.length > 0 && (
            <div style={s.section}>
              <div style={s.sectionLabel}>{t("stats.findingsByCategory")}</div>
              <Donut
                valuePrefix=""
                segments={categoryEntries.map(([cat, n]) => ({
                  label: CATEGORY_LABEL[cat] ?? cat,
                  value: n,
                  color: CATEGORY_COLOR[cat] ?? "var(--text-muted)",
                }))}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
