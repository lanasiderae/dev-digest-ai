/* PrBriefCard — the PR Brief section of the Overview tab (L05 Feature 2,
   TASK-09). Empty-cache Generate (BRIEF-AC-01), optional reviewer selection
   (BRIEF-AC-02), summary/risks/review-focus/VerdictBanner (BRIEF-AC-02/03/15),
   diff navigation (BRIEF-AC-05/13/16/17), stale/refresh (BRIEF-AC-06/12) and
   a generation skeleton (BRIEF-AC-18).

   Every model-derived string (summary, risk title/explanation, focus reason)
   is rendered as PLAIN TEXT ONLY — never markdown/HTML — mirroring
   IntentCard/BlastRadiusCard's discipline for untrusted model output. */
"use client";

import React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Badge, Button, Icon, SectionLabel, SelectInput, Skeleton } from "@devdigest/ui";
import type { BriefSource, BriefSources, PrFile, Risk, RiskSeverity } from "@devdigest/shared";
import { useAgents } from "@/lib/hooks/agents";
import { usePrReviews } from "@/lib/hooks/reviews";
import { useBrief, useGenerateBrief } from "@/lib/hooks/brief";
import { VerdictBanner } from "../../../VerdictBanner";
import { agentNameFor, buildDiffNavUrl, isFileInDiff, latestVerdictCounts, latestVerdictReview } from "./helpers";
import { s } from "./styles";

const RISK_COLOR: Record<RiskSeverity, string> = {
  high: "var(--crit)",
  medium: "var(--warn)",
  low: "var(--text-muted)",
};

const SOURCE_ICON: Record<BriefSource["status"], "Check" | "AlertTriangle" | "X"> = {
  available: "Check",
  degraded: "AlertTriangle",
  unavailable: "X",
};

const SOURCE_COLOR: Record<BriefSource["status"], string> = {
  available: "var(--ok)",
  degraded: "var(--warn)",
  unavailable: "var(--text-muted)",
};

function SourceRow({ labelKey, source }: { labelKey: string; source: BriefSource }) {
  const t = useTranslations("brief");
  const I = Icon[SOURCE_ICON[source.status]];
  return (
    <div style={s.sourceRow}>
      <I size={13} style={{ color: SOURCE_COLOR[source.status], flexShrink: 0 }} />
      <span style={s.sourceLabel}>{t(`card.sources.${labelKey}`)}</span>
      {source.reason && <span style={s.sourceReason}>{source.reason}</span>}
    </div>
  );
}

export function PrBriefCard({
  prId,
  files,
}: {
  prId: string | null | undefined;
  /** This PR's actual changed files — grounds navigation targets (BRIEF-AC-17):
   *  a risk/focus file reference absent from this list is a legitimate
   *  downstream/caller path, not a broken link. */
  files: PrFile[];
}) {
  const t = useTranslations("brief");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { data: agents } = useAgents();
  const { data: reviews } = usePrReviews(prId);

  // The LIVE reviewer-selector control — drives the NEXT `POST`. Deliberately
  // separate component state from the brief's own cached `provenance`, which
  // is read-only, display-only data about the LAST generation (plan finding
  // D1: these must never be the same field/control, even when they display
  // the same name right after a fresh cache load).
  const [selectedAgentId, setSelectedAgentId] = React.useState<string | null>(null);
  // Tracks which `prId` the selector was last seeded for — `undefined`
  // initially, so the first cached brief for THIS pr seeds it exactly once.
  const [seededForPrId, setSeededForPrId] = React.useState<string | null | undefined>(undefined);

  const { data, isLoading, isError, refetch } = useBrief(prId, selectedAgentId);
  const generate = useGenerateBrief(prId);

  // Seed the live selector from the cached generation's reviewer ONCE, the
  // first time a cached brief is seen for this PR — a reasonable default for
  // "refresh with the same reviewer", not an ongoing sync (the user's own
  // choice must never be silently overwritten afterward). Adjusting state
  // directly during render (rather than in an effect) avoids an extra
  // commit+effect round trip for this one-time derivation — see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes.
  if (data?.brief && seededForPrId !== prId) {
    setSeededForPrId(prId);
    setSelectedAgentId(data.brief.provenance.reviewer_agent_id);
  }

  const [openRisks, setOpenRisks] = React.useState<Set<number>>(() => new Set());
  const toggleRisk = (i: number) => {
    setOpenRisks((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  const navigateTo = (file: string, line?: number) => {
    router.push(buildDiffNavUrl(pathname, searchParams.toString(), file, line));
  };

  if (isLoading) {
    return (
      <section style={s.root}>
        <div style={s.labelRow}>
          <SectionLabel icon="FileText">{t("card.title")}</SectionLabel>
        </div>
        <Skeleton height={140} />
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section style={s.root}>
        <div style={s.labelRow}>
          <SectionLabel icon="FileText">{t("card.title")}</SectionLabel>
        </div>
        <div style={s.inlineNote}>
          <Icon.AlertTriangle size={14} />
          <span>{t("card.error")}</span>
          <Button kind="secondary" size="sm" icon="RefreshCw" onClick={() => refetch()}>
            {t("card.retry")}
          </Button>
        </div>
      </section>
    );
  }

  const brief = data.brief;
  const agentOptions = [
    { value: "", label: t("card.reviewer.none") },
    ...(agents ?? []).map((a) => ({ value: a.id, label: a.name })),
  ];

  const reviewerSelector = (
    <div style={s.reviewerField}>
      <span style={s.fieldLabel}>{t("card.reviewer.label")}</span>
      <div style={s.select}>
        <SelectInput
          value={selectedAgentId ?? ""}
          onChange={(v) => setSelectedAgentId(v === "" ? null : v)}
          options={agentOptions}
          mono={false}
        />
      </div>
    </div>
  );

  // ---- Empty cache: Generate (BRIEF-AC-01) ----
  if (!brief) {
    return (
      <section style={s.root}>
        <div style={s.labelRow}>
          <SectionLabel icon="FileText">{t("card.title")}</SectionLabel>
        </div>
        <div style={s.card}>
          {generate.isPending ? (
            <Skeleton height={140} />
          ) : (
            <div style={s.emptyRow}>
              {reviewerSelector}
              <Button
                kind="primary"
                size="sm"
                icon="Sparkles"
                loading={generate.isPending}
                onClick={() => generate.mutate(selectedAgentId)}
              >
                {t("card.generate")}
              </Button>
            </div>
          )}
          {generate.isError && (
            <div style={s.inlineNote}>
              <Icon.AlertTriangle size={14} style={{ color: "var(--warn)" }} />
              <span>{t("card.error")}</span>
            </div>
          )}
        </div>
      </section>
    );
  }

  const cachedReviewerName = agentNameFor(brief.provenance.reviewer_agent_id, agents ?? []);
  const cachedReviewerLabel =
    cachedReviewerName != null
      ? t("card.reviewer.generatedWith", { name: cachedReviewerName })
      : brief.sources.reviewer_context.reason ?? t("card.reviewer.generatedWithNone");

  const latestReview = latestVerdictReview(reviews ?? []);

  return (
    <section style={s.root}>
      <div style={s.labelRow}>
        <SectionLabel icon="FileText">{t("card.title")}</SectionLabel>
      </div>

      <div style={s.card}>
        {generate.isPending ? (
          <Skeleton height={220} />
        ) : (
          <>
            {data.stale && (
              <div style={s.staleBanner}>
                <Icon.AlertTriangle size={15} style={{ color: "var(--warn)", flexShrink: 0 }} />
                <span style={s.staleText}>{t("card.stale")}</span>
                <Button
                  kind="secondary"
                  size="sm"
                  icon="RefreshCw"
                  loading={generate.isPending}
                  onClick={() => generate.mutate(selectedAgentId)}
                >
                  {t("card.refresh")}
                </Button>
              </div>
            )}

            <div style={s.reviewerRow}>
              {reviewerSelector}
              {/* Read-only cached-generation provenance — a visibly distinct
                  element from the live selector above, even when it names
                  the same reviewer (plan finding D1). */}
              <span data-testid="brief-cached-reviewer" style={s.cachedReviewer}>
                {cachedReviewerLabel}
              </span>
            </div>

            <p style={s.summary}>{brief.summary}</p>

            <div>
              <div style={s.sectionLabel}>{t("card.sources.title")}</div>
              <div style={s.sourcesGrid}>
                {(Object.keys(brief.sources) as (keyof BriefSources)[]).map((key) => (
                  <SourceRow key={key} labelKey={key} source={brief.sources[key]} />
                ))}
              </div>
            </div>

            <div>
              <div style={s.sectionLabel}>{t("card.risks.title")}</div>
              {brief.risks.risks.length === 0 ? (
                <span style={s.muted}>{t("card.risks.empty")}</span>
              ) : (
                <div style={s.riskList}>
                  {brief.risks.risks.map((risk: Risk, i: number) => {
                    const open = openRisks.has(i);
                    return (
                      <div key={`${risk.kind}-${i}`} style={s.riskBlock}>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-expanded={open}
                          onClick={() => toggleRisk(i)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              toggleRisk(i);
                            }
                          }}
                          style={s.riskHeader}
                        >
                          <Icon.ChevronRight
                            size={14}
                            style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .12s" }}
                          />
                          <Badge color={RISK_COLOR[risk.severity]} bg="transparent">
                            {risk.severity}
                          </Badge>
                          <span style={s.riskTitle}>{risk.title}</span>
                        </div>
                        {open && (
                          <div style={s.riskBody}>
                            <p style={s.riskExplanation}>{risk.explanation}</p>
                            <div style={s.refList}>
                              {risk.file_refs.map((path) =>
                                isFileInDiff(path, files) ? (
                                  <Button key={path} kind="ghost" size="sm" icon="FileText" onClick={() => navigateTo(path)}>
                                    {path}
                                  </Button>
                                ) : (
                                  <span key={path} className="mono" style={s.notInDiff}>
                                    {path} — {t("card.navigation.notInDiff")}
                                  </span>
                                ),
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div style={s.sectionLabel}>{t("card.focus.title")}</div>
              {brief.review_focus.length === 0 ? (
                <span style={s.muted}>{t("card.focus.empty")}</span>
              ) : (
                <ol style={{ ...s.focusList, margin: 0, padding: 0, listStyle: "none" }}>
                  {brief.review_focus.map((item, i) => {
                    const inDiff = isFileInDiff(item.file, files);
                    return (
                      <li key={`${item.file}:${item.line}:${i}`} style={s.focusRow}>
                        <span style={s.focusOrdinal}>{i + 1}.</span>
                        <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
                          {inDiff ? (
                            <Button
                              kind="ghost"
                              size="sm"
                              icon="FileText"
                              onClick={() => navigateTo(item.file, item.line)}
                            >
                              {`${item.file}:${item.line}`}
                            </Button>
                          ) : (
                            <span className="mono" style={s.notInDiff}>
                              {`${item.file}:${item.line}`} — {t("card.navigation.notInDiff")}
                            </span>
                          )}
                          <span style={s.focusReason}>{item.reason}</span>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </div>

            <div>
              <div style={s.sectionLabel}>{t("card.verdict.title")}</div>
              {latestReview && latestReview.verdict ? (
                <VerdictBanner
                  verdict={latestReview.verdict}
                  summary={latestReview.summary}
                  score={latestReview.score}
                  severityCounts={latestVerdictCounts(latestReview)}
                  agentName={latestReview.agent_name}
                />
              ) : (
                <span style={s.muted}>{t("card.verdict.unreviewed")}</span>
              )}
            </div>

            <div style={s.footerRow}>
              <Button
                kind="secondary"
                size="sm"
                icon="RefreshCw"
                loading={generate.isPending}
                onClick={() => generate.mutate(selectedAgentId)}
              >
                {t("card.refresh")}
              </Button>
            </div>
          </>
        )}

        {generate.isError && (
          <div style={s.inlineNote}>
            <Icon.AlertTriangle size={14} style={{ color: "var(--warn)" }} />
            <span>{t("card.error")}</span>
          </div>
        )}
      </div>
    </section>
  );
}
