/* RoleGroup — one smart-diff group: collapsible header (chevron, role label,
   open-findings badge, "N files") over a DiffViewer of the group's files.
   Docs/boilerplate start collapsed (AC15). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import { DiffViewer, type DiffCommentApi, type DiffFindingApi } from "@/components/diff-viewer";
import { COLLAPSED_BY_DEFAULT, ROLE_COLOR, ROLE_DESCRIPTION_KEY, ROLE_LABEL_KEY } from "../../constants";
import { findingJumpTargets, type MergedGroup } from "../../helpers";
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
  const [scrollTarget, setScrollTarget] = React.useState<{ path: string; lineKey?: string; nonce: number } | null>(
    null,
  );
  // Which stop in `jumpTargets` the next click goes to — lets repeated clicks
  // on the same badge step through every open finding, not just the first.
  const [jumpIndex, setJumpIndex] = React.useState(0);

  // Total OPEN findings across this group's files, every severity included —
  // matches what's actually rendered as finding cards (same semantics as
  // DiffTab's own `openFindingCount`), not a count of distinct files.
  const openFindings = React.useMemo(() => {
    if (!findings) return 0;
    return group.files.reduce((n, f) => n + findings.forPath(f.path).filter((x) => !x.dismissed_at).length, 0);
  }, [group.files, findings]);

  const jumpTargets = React.useMemo(
    () => (findings ? findingJumpTargets(group.files, findings.forPath) : []),
    [group.files, findings],
  );

  const jumpToFindings = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (jumpTargets.length === 0) return;
    const i = jumpIndex % jumpTargets.length;
    const next = jumpTargets[i]!;
    setJumpIndex(i + 1);
    setOpen(true);
    setScrollTarget({ path: next.path, lineKey: next.lineKey, nonce: Date.now() });
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
            title={
              jumpTargets.length > 1
                ? t("smartDiff.jumpToFindingsStep", {
                    current: (jumpIndex % jumpTargets.length) + 1,
                    total: jumpTargets.length,
                  })
                : t("smartDiff.jumpToFindings")
            }
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
