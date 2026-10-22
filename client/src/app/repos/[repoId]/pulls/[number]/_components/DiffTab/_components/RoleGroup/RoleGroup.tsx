/* RoleGroup — one smart-diff group: collapsible header (chevron, role label,
   open-findings badge, "N files") over a DiffViewer of the group's files.
   Docs/boilerplate start collapsed (AC15). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import { DiffViewer, type DiffCommentApi, type DiffFindingApi } from "@/components/diff-viewer";
import { COLLAPSED_BY_DEFAULT, ROLE_COLOR, ROLE_DESCRIPTION_KEY, ROLE_LABEL_KEY } from "../../constants";
import { type MergedGroup } from "../../helpers";
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

  // Total OPEN findings across this group's files, every severity included —
  // matches what's actually rendered as finding cards (same semantics as
  // DiffTab's own `openFindingCount`), not a count of distinct files.
  const openFindings = React.useMemo(() => {
    if (!findings) return 0;
    return group.files.reduce((n, f) => n + findings.forPath(f.path).filter((x) => !x.dismissed_at).length, 0);
  }, [group.files, findings]);

  const jumpToFindings = (e: React.MouseEvent) => {
    e.stopPropagation();
    const target = findings && group.files.find((f) => findings.forPath(f.path).some((x) => !x.dismissed_at));
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
        {openFindings > 0 && (
          <button
            type="button"
            onClick={jumpToFindings}
            style={s.findingsBadge}
            title={t("smartDiff.jumpToFindings")}
            aria-label={t("smartDiff.findingsCount", { count: openFindings })}
          >
            <span aria-hidden="true" style={s.findingsDot} />
            {openFindings}
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
