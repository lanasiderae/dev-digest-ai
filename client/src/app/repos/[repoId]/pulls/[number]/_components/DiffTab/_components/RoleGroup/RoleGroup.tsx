/* RoleGroup — one smart-diff group: collapsible header (chevron, role label,
   files-with-findings badge, "N files") over a DiffViewer of the group's
   files. Docs/boilerplate start collapsed (AC15). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import { DiffViewer, type DiffCommentApi, type DiffFindingApi } from "@/components/diff-viewer";
import { COLLAPSED_BY_DEFAULT, ROLE_LABEL_KEY } from "../../constants";
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
  const withFindings = filesWithFindingsCount(group);

  return (
    <div style={s.wrap}>
      <button
        type="button"
        aria-expanded={!isEmpty && open}
        disabled={isEmpty}
        onClick={() => setOpen((o) => !o)}
        style={s.header}
      >
        <Icon.ChevronRight size={14} style={chevronFor(open)} />
        <span style={s.label}>{t(ROLE_LABEL_KEY[group.role])}</span>
        {withFindings > 0 && (
          <span style={s.findingsBadge} aria-label={t("smartDiff.findingsCount", { count: withFindings })}>
            <span aria-hidden="true" style={s.findingsDot} />
            {withFindings}
          </span>
        )}
        <span style={s.count}>{t("smartDiff.filesCount", { count: group.files.length })}</span>
      </button>
      {open && !isEmpty && <DiffViewer files={group.files} commenting={commenting} findings={findings} />}
    </div>
  );
}
