/* RunFindingsPopover — read-only list of ONE agent run's findings, shown from
   the Timeline's per-run severity badges. Unlike the PR list's FindingsPopover
   (which lazy-fetches via usePrReviews), the findings here are already in
   hand (FindingsTab already holds every ReviewRecord), so this is purely
   presentational. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { SeverityBadge, CategoryTag, MonoLink, ConfidenceNum, EmptyState } from "@devdigest/ui";
import type { FindingRecord } from "@devdigest/shared";
import { SEVERITY_ORDER } from "@/lib/severity";
import { githubBlobUrl } from "@/lib/github-urls";
import { s } from "./styles";

export function RunFindingsPopover({
  findings,
  headSha,
  repoFullName,
  onClose,
}: {
  findings: FindingRecord[];
  headSha?: string | null;
  repoFullName?: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("prReview");
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  const sorted = [...findings].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  return (
    <div ref={ref} style={s.popover} onClick={(e) => e.stopPropagation()}>
      <div style={s.header}>{t("timeline.findingsInRun", { count: sorted.length })}</div>
      {sorted.length === 0 ? (
        <EmptyState icon="CheckCircle" title={t("timeline.noFindings")} />
      ) : (
        sorted.map((f) => (
          <div key={f.id} style={s.item}>
            <SeverityBadge severity={f.severity} compact />
            <div style={s.itemMain}>
              <div style={s.itemTitleRow}>
                <span style={s.itemTitle}>{f.title}</span>
                <CategoryTag category={f.category} />
              </div>
              <div style={s.itemMetaRow}>
                <MonoLink
                  href={
                    repoFullName && headSha
                      ? githubBlobUrl(repoFullName, headSha, f.file, f.start_line, f.end_line)
                      : undefined
                  }
                >
                  {f.file}:{f.start_line === f.end_line ? f.start_line : `${f.start_line}-${f.end_line}`}
                </MonoLink>
                <ConfidenceNum value={f.confidence} />
              </div>
              <div style={s.itemRationale}>{f.rationale}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
