/* OnboardingTourPanel — the actual Onboarding Tour content (L05 Feature 3,
   TASK-11). Generate/refresh (ONBOARD-AC-08), exactly five sections with
   evidence/reading order (ONBOARD-AC-01), status/revision/attempt metadata
   (ONBOARD-AC-04), omissions (ONBOARD-AC-05/07) and the honest
   cache-preserved fallback banner (plan finding on TASK-11 scope).

   Every model-derived string (narrative, reason, omission detail) is
   rendered as PLAIN TEXT ONLY — never markdown/HTML — mirroring
   IntentCard/PrBriefCard's discipline for untrusted model output. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Icon, Skeleton, type IconName } from "@devdigest/ui";
import {
  ONBOARDING_TOUR_SECTION_KEYS,
  type OnboardingTourSection,
  type OnboardingTourSectionStatus,
  type OnboardingTourStatus,
} from "@/vendor/shared/contracts/onboarding";
import { useGenerateOnboardingTour, useOnboardingTour } from "@/lib/hooks/onboarding-tour";
import { githubBlobUrl } from "@/lib/github-urls";
import { ApiError } from "@/lib/api";
import { attemptCallCount, formatAttemptCost, isRefreshFallback, selectDisplayTour } from "./helpers";
import { s } from "./styles";

const STATUS_ICON: Record<OnboardingTourStatus, IconName> = {
  complete: "Check",
  partial: "AlertTriangle",
  skeleton: "AlertTriangle",
  failed: "XCircle",
};
const STATUS_COLOR: Record<OnboardingTourStatus, string> = {
  complete: "var(--ok)",
  partial: "var(--warn)",
  skeleton: "var(--text-muted)",
  failed: "var(--crit)",
};
const SECTION_STATUS_ICON: Record<OnboardingTourSectionStatus, IconName> = {
  generated: "Check",
  skeleton: "AlertTriangle",
  unavailable: "X",
};
const SECTION_STATUS_COLOR: Record<OnboardingTourSectionStatus, string> = {
  generated: "var(--ok)",
  skeleton: "var(--warn)",
  unavailable: "var(--text-muted)",
};

type Translate = ReturnType<typeof useTranslations>;

function EvidenceList({
  evidence,
  ordered,
  repoFullName,
  revision,
  t,
}: {
  evidence: { repo_id: string; path: string; note: string | null }[];
  ordered: boolean;
  repoFullName?: string | null;
  revision: string | null;
  t: Translate;
}) {
  if (evidence.length === 0) {
    return <span style={s.muted}>{t("sections.noEvidence")}</span>;
  }
  const ListTag = ordered ? "ol" : "ul";
  return (
    <ListTag style={ordered ? s.evidenceOrderedList : s.evidenceList}>
      {evidence.map((ev, i) => {
        // Evidence paths are visible references either way; a link to the
        // repo's GitHub blob (pinned to the SAME index revision this tour was
        // generated against, never the PR head) is a nice-to-have, not a
        // requirement — degrades to plain text when either piece is missing.
        const href = repoFullName && revision ? githubBlobUrl(repoFullName, revision, ev.path) : undefined;
        return (
          <li key={`${ev.path}-${i}`} style={s.evidenceRow}>
            {ordered && <span style={s.evidenceOrdinal}>{i + 1}.</span>}
            {href ? (
              <a href={href} target="_blank" rel="noopener noreferrer" className="mono" style={s.evidencePath}>
                {ev.path}
              </a>
            ) : (
              <span className="mono" style={s.evidencePath}>
                {ev.path}
              </span>
            )}
            {ev.note && <span style={s.evidenceNote}>— {ev.note}</span>}
          </li>
        );
      })}
    </ListTag>
  );
}

function SectionBlock({
  sectionKey,
  section,
  repoFullName,
  revision,
  t,
}: {
  sectionKey: (typeof ONBOARDING_TOUR_SECTION_KEYS)[number];
  section: OnboardingTourSection;
  repoFullName?: string | null;
  revision: string | null;
  t: Translate;
}) {
  const StatusIcon = Icon[SECTION_STATUS_ICON[section.status]];
  // Reading order is the one section whose evidence array order IS the
  // recommended reading order (ONBOARD-AC-01/ONBOARD-AC-03) — render it as an
  // ordered list; every other section's evidence is an unordered reference
  // list.
  const ordered = sectionKey === "reading_order";
  return (
    <div style={s.sectionBlock} data-testid={`onboarding-section-${sectionKey}`}>
      <div style={s.sectionHeader}>
        <StatusIcon size={14} style={{ color: SECTION_STATUS_COLOR[section.status] }} />
        <span style={s.sectionTitle}>{t(`sections.${sectionKey}`)}</span>
        <span style={{ fontSize: 11, color: SECTION_STATUS_COLOR[section.status] }}>
          {t(`sections.status.${section.status}`)}
        </span>
      </div>
      {section.narrative ? (
        <p style={s.sectionNarrative}>{section.narrative}</p>
      ) : (
        section.reason && <p style={s.sectionReason}>{section.reason}</p>
      )}
      <div style={s.evidenceLabel}>{t("sections.evidence")}</div>
      <EvidenceList evidence={section.evidence} ordered={ordered} repoFullName={repoFullName} revision={revision} t={t} />
    </div>
  );
}

export function OnboardingTourPanel({
  repoId,
  repoFullName,
}: {
  repoId: string | null | undefined;
  /** Used only to build a nice-to-have GitHub blob link for evidence paths;
   *  evidence still renders as plain repo-relative paths without it. */
  repoFullName?: string | null;
}) {
  const t = useTranslations("onboarding-tour");
  const { data, isLoading, isError, refetch } = useOnboardingTour(repoId);
  const generate = useGenerateOnboardingTour(repoId);

  if (isLoading) {
    return (
      <section style={s.root}>
        <Skeleton height={220} />
      </section>
    );
  }

  if (isError || !data) {
    return (
      <section style={s.root}>
        <ErrorState title={t("loadError.title")} onRetry={() => refetch()} />
      </section>
    );
  }

  const cachedTour = data.tour;
  const tour = selectDisplayTour(generate.data, cachedTour);
  const showFallbackBanner = isRefreshFallback(generate.data);

  // ---- Empty cache: Generate (ONBOARD-AC-08's "accessible repo entry" lands
  // here first for any never-generated repo) ----
  if (!tour) {
    return (
      <section style={s.root}>
        <div style={s.card}>
          {generate.isPending ? (
            <Skeleton height={140} />
          ) : (
            <EmptyState
              icon="Compass"
              title={t("empty.title")}
              body={t("empty.body")}
              cta={t("empty.cta")}
              onCta={() => generate.mutate()}
              ctaLoading={generate.isPending}
            />
          )}
          {generate.isError && (
            <div style={s.inlineNote}>
              <Icon.AlertTriangle size={14} style={{ color: "var(--warn)" }} />
              <span>{generate.error instanceof ApiError ? generate.error.message : t("error")}</span>
            </div>
          )}
        </div>
      </section>
    );
  }

  const StatusIcon = Icon[STATUS_ICON[tour.status]];

  return (
    <section style={s.root}>
      <div style={s.card}>
        {generate.isPending ? (
          <Skeleton height={360} />
        ) : (
          <>
            {showFallbackBanner && (
              <div style={s.fallbackBanner} data-testid="onboarding-fallback-banner">
                <Icon.AlertTriangle size={15} style={{ color: "var(--warn)", flexShrink: 0 }} />
                <span style={s.fallbackText}>{t("refreshFailed")}</span>
              </div>
            )}

            <div style={s.statusRow}>
              <div style={s.statusGroup}>
                <div style={s.statusChip} data-testid="onboarding-tour-status">
                  <StatusIcon size={14} style={{ color: STATUS_COLOR[tour.status] }} />
                  <span>{t(`status.${tour.status}`)}</span>
                </div>
                <span style={s.revisionText}>
                  {tour.index_revision
                    ? t("status.revision", { revision: tour.index_revision })
                    : t("status.revisionUnknown")}
                </span>
              </div>
              <Button
                kind="secondary"
                size="sm"
                icon="RefreshCw"
                loading={generate.isPending}
                onClick={() => generate.mutate()}
              >
                {t("refresh")}
              </Button>
            </div>

            {tour.reason && <p style={s.reasonText}>{tour.reason}</p>}

            <div>
              <div style={s.sectionLabel}>{t("attempt.title")}</div>
              {tour.attempt && tour.attempt.called_model ? (
                <div style={s.attemptGrid}>
                  <span style={s.attemptItem}>{t("attempt.calls", { count: attemptCallCount(tour.attempt) })}</span>
                  {tour.attempt.provider && (
                    <span style={s.attemptItem}>{t("attempt.provider", { provider: tour.attempt.provider })}</span>
                  )}
                  {tour.attempt.model && (
                    <span style={s.attemptItem}>{t("attempt.model", { model: tour.attempt.model })}</span>
                  )}
                  {tour.attempt.tokens_in != null && (
                    <span style={s.attemptItem}>{t("attempt.tokensIn", { count: tour.attempt.tokens_in })}</span>
                  )}
                  {tour.attempt.tokens_out != null && (
                    <span style={s.attemptItem}>{t("attempt.tokensOut", { count: tour.attempt.tokens_out })}</span>
                  )}
                  <span style={s.attemptItem}>{t("attempt.cost", { cost: formatAttemptCost(tour.attempt) })}</span>
                </div>
              ) : (
                <span style={s.muted}>{t("attempt.notCalled")}</span>
              )}
            </div>

            <div>
              <div style={s.sectionLabel}>{t("title")}</div>
              <div style={s.sectionsList}>
                {ONBOARDING_TOUR_SECTION_KEYS.map((key) => (
                  <SectionBlock
                    key={key}
                    sectionKey={key}
                    section={tour.sections[key]}
                    repoFullName={repoFullName}
                    revision={tour.index_revision}
                    t={t}
                  />
                ))}
              </div>
            </div>

            <div>
              <div style={s.sectionLabel}>{t("omissions.title")}</div>
              {tour.omissions.length === 0 ? (
                <span style={s.muted}>{t("omissions.empty")}</span>
              ) : (
                <div style={s.omissionsList}>
                  {tour.omissions.map((o, i) => (
                    <div key={`${o.path ?? "none"}-${i}`} style={s.omissionRow}>
                      {o.path && (
                        <span className="mono" style={s.omissionPath}>
                          {o.path}
                        </span>
                      )}
                      <span>{t(`omissions.reason.${o.reason}`)}</span>
                      {o.detail && <span style={s.muted}>{o.detail}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {generate.isError && (
          <div style={s.inlineNote}>
            <Icon.AlertTriangle size={14} style={{ color: "var(--warn)" }} />
            <span>{generate.error instanceof ApiError ? generate.error.message : t("error")}</span>
          </div>
        )}
      </div>
    </section>
  );
}
