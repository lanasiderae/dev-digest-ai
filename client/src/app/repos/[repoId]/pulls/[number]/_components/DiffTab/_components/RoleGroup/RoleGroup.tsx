/* RoleGroup — one smart-diff group: collapsible header (chevron, role label,
   files-with-findings badge, "N files") over a DiffViewer of the group's
   files. Docs/boilerplate start collapsed (AC15). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import { DiffViewer, type DiffCommentApi, type DiffFindingApi } from "@/components/diff-viewer";
import { COLLAPSED_BY_DEFAULT, ROLE_COLOR, ROLE_DESCRIPTION_KEY, ROLE_LABEL_KEY } from "../../constants";
import { filesWithFindingsCount, type MergedGroup } from "../../helpers";
import { s, chevronFor } from "./styles";

export function RoleGroup({
  group,
  commenting,
  findings,
}: {
  group: MergedGroup;
  commenting?: DiffCommentApi;
  findings?: DiffFindingApi;
}) {
  const t = useTranslations("prReview");
  const isEmpty = group.files.length === 0;
  const [open, setOpen] = React.useState(!COLLAPSED_BY_DEFAULT.includes(group.role));
  const [scrollTarget, setScrollTarget] = React.useState<{ path: string; nonce: number } | null>(null);
  const withFindings = filesWithFindingsCount(group);

  const jumpToFindings = (e: React.MouseEvent) => {
    e.stopPropagation();
    const target = group.files.find((f) => group.flaggedPaths.has(f.path));
    if (!target) return;
    setOpen(true);
    setScrollTarget({ path: target.path, nonce: Date.now() });
  };

  return (
    <div style={s.wrap}>
      <div
        role="button"
        tabIndex={isEmpty ? -1 : 0}
        aria-expanded={!isEmpty && open}
        aria-disabled={isEmpty}
        onClick={() => !isEmpty && setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (!isEmpty && (e.key === "Enter" || e.key === " ")) setOpen((o) => !o);
        }}
        style={s.header}
      >
        <Icon.ChevronRight size={14} style={chevronFor(open)} />
        <span aria-hidden="true" style={{ ...s.roleDot, background: ROLE_COLOR[group.role] }} />
        <span style={s.label}>{t(ROLE_LABEL_KEY[group.role])}</span>
        <span style={s.description}>{t(ROLE_DESCRIPTION_KEY[group.role])}</span>
        {withFindings > 0 && (
          <button
            type="button"
            onClick={jumpToFindings}
            style={s.findingsBadge}
            title={t("smartDiff.jumpToFindings")}
            aria-label={t("smartDiff.findingsCount", { count: withFindings })}
          >
            <span aria-hidden="true" style={s.findingsDot} />
            {withFindings}
          </button>
        )}
        <span style={s.count}>{t("smartDiff.filesCount", { count: group.files.length })}</span>
        <Icon.ChevronsUpDown aria-hidden="true" size={14} style={s.sortIcon} />
      </div>
      {open && !isEmpty && (
        <DiffViewer files={group.files} commenting={commenting} findings={findings} scrollTarget={scrollTarget} />
      )}
    </div>
  );
}
