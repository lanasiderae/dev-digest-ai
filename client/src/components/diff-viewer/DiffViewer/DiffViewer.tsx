/* DiffViewer — basic GitHub-style unified diff viewer. Renders real PrFile.patch
   (unified-diff text from the F1 API) as a list of collapsible FileCards.
   Optional inline comments (Files changed tab): hover a line → "+" → comment,
   posted live to GitHub; existing GitHub review comments render inline. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import type { PrFile } from "@/lib/types";
import { type DiffCommentApi } from "../comments";
import { type DiffFindingApi } from "../findings";
import { s } from "../styles";
import { FileCard, type FileCardScrollTarget } from "../FileCard";

export function DiffViewer({
  files,
  commenting,
  findings,
  scrollTarget,
}: {
  files: PrFile[];
  commenting?: DiffCommentApi;
  findings?: DiffFindingApi;
  /** "Jump to findings" target: the file at this path is forced open and
   *  scrolled to `lineKey` (or just into view) whenever `nonce` changes. */
  scrollTarget?: ({ path: string } & FileCardScrollTarget) | null;
}) {
  const t = useTranslations("shell");
  if (!files || files.length === 0) {
    return <div style={s.empty}>{t("diffViewer.noChangedFiles")}</div>;
  }
  return (
    <div style={s.list}>
      {files.map((f, i) => (
        <FileCard
          key={i}
          file={f}
          commenting={commenting}
          findings={findings}
          scrollTo={
            scrollTarget && scrollTarget.path === f.path
              ? { lineKey: scrollTarget.lineKey, nonce: scrollTarget.nonce }
              : null
          }
        />
      ))}
    </div>
  );
}
