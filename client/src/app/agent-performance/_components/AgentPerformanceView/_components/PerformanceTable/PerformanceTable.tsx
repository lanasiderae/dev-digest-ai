/* PerformanceTable — the dashboard's sortable per-agent row list. Sorting
   and row "View" navigation are pure client-side/routing concerns: neither
   ever calls a review-run or LLM endpoint (AC-07), only `router.push` to the
   agent's own Stats tab (`?tab=stats`). */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Sparkline } from "@devdigest/ui";
import type { AgentPerfRow } from "@devdigest/shared";
import { formatCost } from "../../../../../../lib/format-cost";
import { formatPercent, formatDuration } from "../../../../../../lib/format-stats";
import { isLowSample, sortPerformanceRows, type SortKey } from "./helpers";
import { s } from "./styles";

export function PerformanceTable({ rows }: { rows: AgentPerfRow[] }) {
  const t = useTranslations("agentPerformance");
  const router = useRouter();
  const [sort, setSort] = React.useState<SortKey>("runs");

  const sorted = sortPerformanceRows(rows, sort);

  return (
    <div style={s.wrap}>
      <table style={s.table}>
        <thead>
          <tr>
            <th style={s.thStatic}>{t("table.agent")}</th>
            <th style={s.th} onClick={() => setSort("runs")}>
              {t("table.runs")}
              {sort === "runs" ? " ▾" : ""}
            </th>
            <th style={s.th} onClick={() => setSort("cost")}>
              {t("table.cost")}
              {sort === "cost" ? " ▾" : ""}
            </th>
            <th style={s.thStatic}>{t("table.duration")}</th>
            <th style={s.th} onClick={() => setSort("acceptRate")}>
              {t("table.accept")}
              {sort === "acceptRate" ? " ▾" : ""}
            </th>
            <th style={s.thStatic}>{t("table.trend")}</th>
            <th style={s.thStatic}>{t("table.lastRun")}</th>
            <th style={s.thStatic} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.agent_id}>
              <td style={s.td}>{r.agent_name}</td>
              <td className="tnum" style={s.td}>
                {r.runs}
              </td>
              <td className="tnum" style={s.td}>
                {formatCost(r.avg_cost_usd)}
              </td>
              <td className="tnum" style={s.td}>
                {formatDuration(r.avg_latency_ms)}
              </td>
              <td style={s.td}>
                <div style={s.acceptCell}>
                  <span className="tnum">{formatPercent(r.accept_rate)}</span>
                  {isLowSample(r) && (
                    <Badge color="var(--warn)" bg="var(--warn-bg)">
                      {t("lowSample.badge")}
                    </Badge>
                  )}
                </div>
              </td>
              <td style={s.td}>
                <Sparkline data={r.trend} />
              </td>
              <td className="mono" style={s.td}>
                {r.last_run_at ? new Date(r.last_run_at).toLocaleDateString() : t("table.never")}
              </td>
              <td style={s.td}>
                <button style={s.viewBtn} onClick={() => router.push(`/agents/${r.agent_id}?tab=stats`)}>
                  {t("table.view")}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
