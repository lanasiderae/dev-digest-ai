/* BlastRadiusCard — the Blast Radius section of the Overview tab. Shows each
   changed symbol's downstream callers (file:line, deep-linked to GitHub) plus
   the endpoints/crons they reach, grouped exactly as the server already
   grouped them (no re-grouping here). Renders a deterministic summary line
   built from blast.json's stat.* labels + numbers derived from the payload —
   it does NOT render the server's `blast.summary` string verbatim, so the
   line stays translatable instead of bypassing i18n.

   Each symbol row is its own disclosure (collapsed by default, same
   chevron/role=button pattern as DiffTab's RoleGroup) — a PR can touch
   dozens of symbols and most have zero or one caller, so an always-expanded
   list buries the ones worth reading. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Chip, Icon, MonoLink, SectionLabel, Skeleton } from "@devdigest/ui";
import type { BlastDegradedReason } from "@devdigest/shared";
import { useBlastRadius } from "@/lib/hooks/blast-radius";
import { githubBlobUrl } from "@/lib/github-urls";
import { callerLabel, groupSymbols, symbolKey, totalCounts } from "./helpers";
import { chevronFor, s } from "./styles";
import { PriorPrsFooter } from "./_components/PriorPrsFooter";

/** Maps the server's degraded reason enum onto blast.json's `degraded.reason.*`
    keys. Any reason not in this map (future enum members) falls back to the
    `unknown` key rather than throwing or rendering a blank. */
const REASON_KEY: Record<BlastDegradedReason, string> = {
  flag_off: "flagOff",
  index_failed: "indexFailed",
  index_partial: "indexPartial",
  repo_too_large: "repoTooLarge",
  no_data: "noData",
};

export function BlastRadiusCard({
  prId,
  repoFullName,
  headSha,
}: {
  prId: string | null | undefined;
  repoFullName: string | null | undefined;
  headSha: string | null | undefined;
}) {
  const t = useTranslations("blast");
  const { data, isLoading, isError } = useBlastRadius(prId);
  // Every symbol starts collapsed — a changed-heavy PR can have dozens of
  // symbols, most with zero or one caller; a wall of expanded blocks buries
  // the ones worth looking at. Keyed by symbolKey so toggling one symbol
  // never affects another with the same name in a different file.
  const [openSymbols, setOpenSymbols] = React.useState<Set<string>>(() => new Set());
  const toggleSymbol = (key: string) => {
    setOpenSymbols((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };
  // Only one row can be hovered by a mouse at a time — a single key avoids a
  // per-row useState, which the rows-in-a-loop shape can't do anyway.
  const [hoveredSymbol, setHoveredSymbol] = React.useState<string | null>(null);

  if (isLoading) {
    return (
      <section style={s.root}>
        <div style={s.labelRow}>
          <SectionLabel icon="Zap">{t("title")}</SectionLabel>
        </div>
        <Skeleton height={110} />
      </section>
    );
  }

  // Hard failure (network/API down) — non-essential card; the rest of the
  // Overview tab still renders, exactly like IntentCard's posture.
  if (isError || !data) return null;

  const { blast, degraded, reason } = data;
  const groups = groupSymbols(blast);
  const counts = totalCounts(blast);
  const reasonKey = reason ? REASON_KEY[reason] ?? "unknown" : "unknown";

  return (
    <section style={s.root}>
      <div style={s.labelRow}>
        <SectionLabel icon="Zap">{t("title")}</SectionLabel>
      </div>
      <div style={s.card}>
        <div style={s.summaryLine}>
          {t("summaryLine", {
            symbols: counts.symbols,
            symbolsLabel: t("stat.symbols"),
            callers: counts.callers,
            callersLabel: t("stat.callers"),
            endpoints: counts.endpoints,
            endpointsLabel: t("stat.endpoints"),
            crons: counts.crons,
            cronsLabel: t("stat.crons"),
          })}
        </div>

        {degraded && (
          <div style={s.degradedBanner}>
            <Icon.AlertTriangle size={15} style={{ color: "var(--warn)", flexShrink: 0, marginTop: 1 }} />
            <div style={s.degradedText}>
              <span style={s.degradedTitle}>{t("degraded.title")}</span>
              <span style={s.degradedBody}>{t(`degraded.reason.${reasonKey}`)}</span>
            </div>
          </div>
        )}

        <div style={s.symbolList}>
          {groups.map(({ symbol, downstream }) => {
            const key = symbolKey(symbol);
            const open = openSymbols.has(key);
            return (
              <div key={key} style={s.symbolBlock}>
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  onClick={() => toggleSymbol(key)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleSymbol(key);
                    }
                  }}
                  onMouseEnter={() => setHoveredSymbol(key)}
                  onMouseLeave={() => setHoveredSymbol((cur) => (cur === key ? null : cur))}
                  style={{ ...s.symbolHeader, background: hoveredSymbol === key ? "var(--bg-hover)" : undefined }}
                >
                  <Icon.Code size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  <span style={s.symbolName}>{symbol.name}</span>
                  <span style={s.symbolFile}>{symbol.file}</span>
                  <span style={s.callerCount}>{t("callerCount", { count: downstream?.callers.length ?? 0 })}</span>
                  <Icon.ChevronRight size={14} style={chevronFor(open)} />
                </div>

                {open &&
                  (!downstream ? (
                    <span style={s.muted}>{t("symbol.noCallers")}</span>
                  ) : (
                    <>
                      <div style={s.callerList}>
                        {downstream.callers.map((c) => (
                          <div key={`${c.file}:${c.line}`} style={s.callerRow}>
                            <MonoLink
                              href={
                                repoFullName && headSha
                                  ? githubBlobUrl(repoFullName, headSha, c.file, c.line)
                                  : undefined
                              }
                            >
                              {callerLabel(c.file, c.line)}
                            </MonoLink>
                          </div>
                        ))}
                      </div>

                      {(downstream.endpoints_affected.length > 0 || downstream.crons_affected.length > 0) && (
                        <div style={s.chipsRow}>
                          {downstream.endpoints_affected.map((e) => (
                            <Chip key={`endpoint:${e}`} icon="Activity">
                              {e}
                            </Chip>
                          ))}
                          {downstream.crons_affected.map((c) => (
                            <Chip key={`cron:${c}`} icon="Clock">
                              {c}
                            </Chip>
                          ))}
                        </div>
                      )}
                    </>
                  ))}
              </div>
            );
          })}
        </div>

        <PriorPrsFooter prId={prId} repoFullName={repoFullName} />
      </div>
    </section>
  );
}
