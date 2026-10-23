/* IntentCard — the derived-intent section of the Overview tab (AC9). Renders
   a one-sentence statement plus in/out-of-scope columns, or an explicit
   missing-context state (never fabricated — AC11). Every LLM-derived field
   is rendered as PLAIN TEXT ONLY — never markdown/HTML, never a link. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Icon, SectionLabel, Skeleton } from "@devdigest/ui";
import { usePrIntent, useRegenerateIntent } from "@/lib/hooks/intent";
import { s } from "./styles";

export function IntentCard({ prId, embedded = false }: { prId: string | null | undefined; embedded?: boolean }) {
  const t = useTranslations("intent");
  const cardStyle = embedded ? { ...s.card, border: 0, padding: 0, background: "transparent" } : s.card;
  const labelStyle = embedded ? { ...s.labelRow, minHeight: 26 } : s.labelRow;
  const { data, isLoading, isError } = usePrIntent(prId);
  const regenerate = useRegenerateIntent(prId);

  if (isLoading) {
    return (
      <section style={s.root}>
        <div style={labelStyle}>
          <SectionLabel icon="Target">{t("title")}</SectionLabel>
        </div>
        <Skeleton height={110} />
      </section>
    );
  }

  // Hard failure (network/API down) — the card is non-essential; the rest of
  // the Overview tab still renders.
  if (isError || !data) return null;

  const { intent: record, unavailable_reason } = data;

  if (!record) {
    if (unavailable_reason === "provider_not_configured") {
      return (
        <section style={s.root}>
          <div style={labelStyle}>
            <SectionLabel icon="Target">{t("title")}</SectionLabel>
          </div>
          <div style={s.inlineNote}>
            <Icon.Info size={14} />
            <span>{t("providerNotConfigured")}</span>
          </div>
        </section>
      );
    }
    if (unavailable_reason === "generation_failed" || unavailable_reason === "timeout") {
      return (
        <section style={s.root}>
          <div style={labelStyle}>
            <SectionLabel icon="Target">{t("title")}</SectionLabel>
          </div>
          <div style={s.inlineNote}>
            <Icon.AlertTriangle size={14} />
            <span>{t("generationFailed")}</span>
            <Button
              kind="secondary"
              size="sm"
              icon="RefreshCw"
              loading={regenerate.isPending}
              onClick={() => regenerate.mutate()}
            >
              {t("retry")}
            </Button>
          </div>
        </section>
      );
    }
    // 'not_generated': a review run hasn't derived one yet, and the user
    // hasn't pressed the button either.
    return (
      <section style={s.root}>
        <div style={labelStyle}>
          <SectionLabel icon="Target">{t("title")}</SectionLabel>
        </div>
        <div style={cardStyle}>
          <p style={s.statement}>{t("notGenerated.title")}</p>
          <div style={s.muted}>{t("notGenerated.body")}</div>
          <div>
            <Button
              kind="secondary"
              size="sm"
              icon="RefreshCw"
              loading={regenerate.isPending}
              onClick={() => regenerate.mutate()}
            >
              {regenerate.isPending ? t("notGenerated.running") : t("notGenerated.run")}
            </Button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section style={s.root}>
      <div style={labelStyle}>
        <SectionLabel icon="Target">{t("title")}</SectionLabel>
      </div>
      <div style={cardStyle}>
        <p style={s.statement}>{record.intent}</p>

        <div style={s.columns}>
          <div>
            <div style={s.columnLabel}>{t("inScope")}</div>
            {record.in_scope.length === 0 ? (
              <span style={s.muted}>{t("noneIdentified")}</span>
            ) : (
              <ul style={s.bulletList}>
                {record.in_scope.map((item, i) => (
                  <li key={i} style={s.bulletItem}>
                    <Icon.Check size={13} style={{ color: "var(--ok)", marginTop: 2, flexShrink: 0 }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div style={s.columnLabel}>{t("outOfScope")}</div>
            {record.out_of_scope.length === 0 ? (
              <span style={s.muted}>{t("noneIdentified")}</span>
            ) : (
              <ul style={s.bulletList}>
                {record.out_of_scope.map((item, i) => (
                  <li key={i} style={s.bulletItem}>
                    <Icon.X size={13} style={{ color: "var(--crit)", marginTop: 2, flexShrink: 0 }} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div style={s.footerRow}>
          <Button
            kind="secondary"
            size="sm"
            icon="RefreshCw"
            loading={regenerate.isPending}
            onClick={() => regenerate.mutate()}
          >
            {regenerate.isPending ? t("notGenerated.running") : t("regenerate")}
          </Button>
        </div>
      </div>
    </section>
  );
}
