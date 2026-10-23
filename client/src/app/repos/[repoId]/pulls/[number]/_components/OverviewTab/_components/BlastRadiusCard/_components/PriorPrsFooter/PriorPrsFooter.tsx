/* PriorPrsFooter — the "Prior PRs touching these files" footer inside the
   Blast Radius card. A single collapsed-by-default disclosure (same
   role=button/aria-expanded/rotating-chevron convention as the card's own
   per-symbol rows — reuses the exact `chevronFor` helper from
   BlastRadiusCard/styles.ts rather than duplicating it). A PR with no
   overlap renders a static, non-interactive empty row instead of a
   disclosure with nothing to expand. Loading/error render nothing — same
   non-essential posture as the rest of the Overview tab's cards. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import { usePrHistory } from "@/lib/hooks/pr-history";
import { githubPrUrl } from "@/lib/github-urls";
import { chevronFor } from "../../styles";
import { formatMergedAt } from "./helpers";
import { s } from "./styles";

export function PriorPrsFooter({
  prId,
  repoFullName,
}: {
  prId: string | null | undefined;
  repoFullName: string | null | undefined;
}) {
  const t = useTranslations("blast");
  const { data, isLoading, isError } = usePrHistory(prId);
  const [open, setOpen] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  if (isLoading || isError || !data) return null;

  const { history } = data;

  if (history.length === 0) {
    return (
      <div style={s.root}>
        <div style={s.triggerStatic}>
          <Icon.History size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <span style={s.title}>{t("history.empty")}</span>
        </div>
      </div>
    );
  }

  return (
    <div style={s.root}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{ ...s.trigger, background: hovered ? "var(--bg-hover)" : undefined }}
      >
        <Icon.History size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
        <span style={s.title}>{t("history.title")}</span>
        <span style={s.count}>{history.length}</span>
        <Icon.ChevronRight size={14} style={chevronFor(open)} />
      </div>

      {open && (
        <div style={s.list}>
          {history.map((item) => {
            const mergedAt = formatMergedAt(item.merged_at);
            return (
              <div key={item.pr_number} style={s.item}>
                <div style={s.itemHeader}>
                  <Icon.GitPullRequest size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                  {repoFullName ? (
                    <a
                      href={githubPrUrl(repoFullName, item.pr_number)}
                      target="_blank"
                      rel="noreferrer"
                      style={s.itemTitle}
                    >
                      #{item.pr_number} {item.title}
                    </a>
                  ) : (
                    <span style={s.itemTitle}>
                      #{item.pr_number} {item.title}
                    </span>
                  )}
                </div>
                <div style={s.itemMeta}>
                  {t("history.mergedBy", { author: item.author, date: mergedAt ?? "—" })}
                  {" · "}
                  {t("history.overlapCount", { count: item.files_overlap.length })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
