/* FindingsPopover — read-only list of one PR's latest-review findings, shown
   from the list page's Findings column. Lazy-fetches via the existing
   usePrReviews hook (the same data FindingsTab/FindingCard use on the PR
   detail page) rather than a new endpoint.

   Rendered through a portal into document.body, positioned from the
   trigger's real screen coordinates: the list's tableCard has
   `overflow: hidden` (for its rounded corners), which clipped this popover
   whenever a row had no room below it — e.g. the last row in the table. A
   portal escapes that ancestor clipping entirely; the position is computed
   fresh each time it opens and flips above the trigger when there isn't
   enough room below. */
"use client";

import React from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { SeverityBadge, CategoryTag, MonoLink, ConfidenceNum, Skeleton, EmptyState } from "@devdigest/ui";
import { usePrReviews } from "@/lib/hooks/reviews";
import { useActiveRepo } from "@/lib/repo-context";
import { githubBlobUrl } from "@/lib/github-urls";
import { SEVERITY_ORDER } from "../FindingsCell/constants";
import { s } from "./styles";

const POPOVER_WIDTH = 360;
const VIEWPORT_MARGIN = 16;
const MIN_SPACE_BELOW = 160;

export function computePosition(anchor: HTMLElement): React.CSSProperties {
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - VIEWPORT_MARGIN;
  const spaceAbove = rect.top - VIEWPORT_MARGIN;
  const openUpward = spaceBelow < MIN_SPACE_BELOW && spaceAbove > spaceBelow;
  const left = Math.min(
    Math.max(VIEWPORT_MARGIN, rect.left),
    window.innerWidth - POPOVER_WIDTH - VIEWPORT_MARGIN,
  );
  return openUpward
    ? { left, bottom: window.innerHeight - rect.top + 6, maxHeight: Math.max(120, spaceAbove) }
    : { left, top: rect.bottom + 6, maxHeight: Math.max(120, spaceBelow) };
}

export function FindingsPopover({
  prId,
  headSha,
  anchorRef,
  onMouseEnter,
  onMouseLeave,
  onClose,
}: {
  prId: string;
  headSha: string;
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Cancel/restart the trigger's close-on-leave timer — since this popover
     is portaled to document.body, it's a DOM sibling of the trigger, not a
     descendant, so these can't rely on mouseenter/leave bubbling up to the
     trigger; the parent passes its own handlers down instead. */
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("prReview");
  const { activeRepo } = useActiveRepo();
  const { data: reviews, isLoading, isError } = usePrReviews(prId);
  const ref = React.useRef<HTMLDivElement>(null);
  const [pos, setPos] = React.useState<React.CSSProperties | null>(null);

  React.useLayoutEffect(() => {
    if (anchorRef.current) setPos(computePosition(anchorRef.current));
  }, [anchorRef]);

  React.useEffect(() => {
    const onMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // The page (not the table, which doesn't scroll internally) can scroll
    // or resize while the popover is open — its fixed position would go
    // stale, so just close it rather than tracking a moving target.
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onClose, true);
    window.addEventListener("resize", onClose);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onClose, true);
      window.removeEventListener("resize", onClose);
    };
  }, [onClose]);

  // Reviews come newest-first (see usePrReviews) — the first 'review'-kind
  // entry is the latest review, matching the list column's own "latest
  // review only" rule.
  const latest = reviews?.find((r) => r.kind === "review");
  const findings = [...(latest?.findings ?? [])].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity),
  );

  if (!pos) return null;

  return createPortal(
    <div
      ref={ref}
      style={{ ...s.popover, position: "fixed", ...pos }}
      onClick={(e) => e.stopPropagation()}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <div style={s.header}>{t("list.findingsPopover.title", { count: findings.length })}</div>
      {isLoading ? (
        <Skeleton height={60} />
      ) : isError ? (
        <div style={s.empty}>{t("list.findingsPopover.errorBody")}</div>
      ) : findings.length === 0 ? (
        <EmptyState icon="CheckCircle" title={t("list.findingsPopover.empty")} />
      ) : (
        findings.map((f) => (
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
                    activeRepo?.full_name
                      ? githubBlobUrl(activeRepo.full_name, headSha, f.file, f.start_line, f.end_line)
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
    </div>,
    document.body,
  );
}
