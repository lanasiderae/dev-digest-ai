/* FileCard — one collapsible file in the diff: header (path, +/- stat, comment
   count) and, when open, its parsed lines plus any outdated comments. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@devdigest/ui";
import type { FindingRecord, PrFile } from "@/lib/types";
import { AUTO_EXPAND_MAX_LINES } from "../constants";
import { parsePatch, type Line } from "../helpers";
import {
  buildThreads,
  cs,
  keysForLine,
  partitionThreads,
  type CommentThread,
  type DiffCommentApi,
} from "../comments";
import { partitionFindings, type DiffFindingApi } from "../findings";
import { s, chevronFor } from "../styles";
import { CodeLine } from "../CodeLine";
import { OutdatedComments } from "../OutdatedComments";

/** Threads anchored to a given parsed line (RIGHT=new, LEFT=old). */
function threadsForLine(ln: Line, matched: Map<string, CommentThread[]>): CommentThread[] {
  if (matched.size === 0) return [];
  const out: CommentThread[] = [];
  for (const key of keysForLine(ln)) {
    const list = matched.get(key);
    if (list) out.push(...list);
  }
  return out;
}

/** Findings anchored to a given parsed line (new side only). */
function findingsForLine(ln: Line, matched: Map<string, FindingRecord[]>): FindingRecord[] {
  if (matched.size === 0) return [];
  const out: FindingRecord[] = [];
  for (const key of keysForLine(ln)) {
    const list = matched.get(key);
    if (list) out.push(...list);
  }
  return out;
}

/** A "jump to findings" request: force this file open and scroll to it. */
export interface FileCardScrollTarget {
  /** The finding's anchor key (`${side}:${line}`, e.g. `RIGHT:42`) to scroll
   *  to within this file. When it doesn't match a rendered line (a finding
   *  outside the visible patch), falls back to scrolling the file into view. */
  lineKey?: string;
  /** Bumped (e.g. `Date.now()`) by the caller so a repeat click on the same
   *  `lineKey` still re-triggers the scroll. */
  nonce: number;
}

export function FileCard({
  file,
  commenting,
  findings,
  scrollTo,
}: {
  file: PrFile;
  commenting?: DiffCommentApi;
  findings?: DiffFindingApi;
  /** Set by a caller — e.g. "jump to findings" — to force this card open and
   *  scroll to a specific line (or the card itself). Null/undefined does
   *  nothing. */
  scrollTo?: FileCardScrollTarget | null;
}) {
  const t = useTranslations("shell");
  const [open, setOpen] = React.useState(
    (file.additions ?? 0) + (file.deletions ?? 0) <= AUTO_EXPAND_MAX_LINES
  );
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (scrollTo == null) return;
    setOpen(true);
  }, [scrollTo]);
  // Runs again once `open` actually flips to true (lines are only in the DOM
  // then), so a closed file's lines exist before we look for `lineKey`.
  React.useEffect(() => {
    if (scrollTo == null || !open) return;
    // Deferred a frame: scrollIntoView() fires a synchronous `scroll` event,
    // and calling it mid-commit trips Next's dev overlay into a flushSync-
    // during-render warning (its own floating-position listener reacts to
    // that scroll). A rAF lets this commit finish first.
    const raf = requestAnimationFrame(() => {
      const line = scrollTo.lineKey
        ? rootRef.current?.querySelector<HTMLElement>(`[data-line-key="${scrollTo.lineKey}"]`)
        : null;
      (line ?? rootRef.current)?.scrollIntoView({ behavior: "smooth", block: line ? "center" : "start" });
    });
    return () => cancelAnimationFrame(raf);
  }, [scrollTo, open]);
  const lines = React.useMemo(() => parsePatch(file.patch), [file.patch]);

  // Group this file's comments into threads, then split into ones we can anchor
  // to a rendered line vs. "outdated" (GitHub dropped the line / it's not here).
  const comments = commenting?.comments;
  const { matched, outdated } = React.useMemo(() => {
    if (!comments) return { matched: new Map<string, CommentThread[]>(), outdated: [] };
    const fileThreads = buildThreads(comments.filter((c) => c.path === file.path));
    const renderedKeys = new Set<string>();
    for (const ln of lines) for (const k of keysForLine(ln)) renderedKeys.add(k);
    return partitionThreads(fileThreads, renderedKeys);
  }, [comments, file.path, lines]);

  // Same split for review findings: anchored to a rendered new-side line vs
  // not (AC27's "outside the visible patch" bucket).
  const { matchedFindings, outsideFindings } = React.useMemo(() => {
    if (!findings) return { matchedFindings: new Map<string, FindingRecord[]>(), outsideFindings: [] };
    const renderedKeys = new Set<string>();
    for (const ln of lines) for (const k of keysForLine(ln)) renderedKeys.add(k);
    const part = partitionFindings(findings.forPath(file.path), renderedKeys);
    return { matchedFindings: part.matched, outsideFindings: part.outside };
  }, [findings, file.path, lines]);

  const commentCount = commenting
    ? commenting.comments.filter((c) => c.path === file.path).length
    : 0;

  // Mirrors DiffTab's `openFindingCount` semantics: dismissed findings don't
  // count — this dot flags files still needing attention, not history.
  const hasOpenFindings = !!findings && findings.forPath(file.path).some((f) => !f.dismissed_at);

  return (
    <div ref={rootRef} style={s.fileCard}>
      <div onClick={() => setOpen((o) => !o)} style={s.fileHeader}>
        <Icon.ChevronRight size={13} style={chevronFor(open)} />
        <Icon.FileText size={14} style={s.fileIcon} />
        <span className="mono" style={s.filePath}>
          {file.path}
        </span>
        {hasOpenFindings && (
          <span
            role="img"
            aria-label={t("diffViewer.fileHasFindings")}
            title={t("diffViewer.fileHasFindings")}
            style={s.findingsDot}
          />
        )}
        <span className="mono tnum" style={s.fileStat}>
          <span style={s.addText}>+{file.additions}</span>{" "}
          <span style={s.delText}>−{file.deletions}</span>
        </span>
        {commentCount > 0 && (
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, color: "var(--text-muted)" }}
          >
            <Icon.MessageSquare size={12} />
            {commentCount}
          </span>
        )}
      </div>
      {open && (
        <div style={s.fileBody}>
          {lines.length === 0 ? (
            <div style={s.noDiff}>{t("diffViewer.noDiffText")}</div>
          ) : (
            lines.map((ln, i) => (
              <CodeLine
                key={i}
                ln={ln}
                path={file.path}
                threads={threadsForLine(ln, matched)}
                commenting={commenting}
                findingsHere={findingsForLine(ln, matchedFindings)}
                findingsApi={findings}
              />
            ))
          )}
          {commenting && commenting.showComments && <OutdatedComments threads={outdated} />}
          {findings && findings.visible && outsideFindings.length > 0 && (
            <div style={cs.outdatedWrap}>
              <span style={cs.outdatedTitle}>{t("diffViewer.findingsOutsideDiff")}</span>
              {outsideFindings.map((f) => (
                <div key={f.id}>{findings.renderFinding(f)}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
