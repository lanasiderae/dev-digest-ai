"use client";

import React from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { SectionLabel, Button } from "@devdigest/ui";
import { DiffViewer, type DiffCommentApi, type DiffFindingApi } from "@/components/diff-viewer";
import { usePrComments, useCreatePrComment, useFindingAction, usePrReviews, useSmartDiff } from "@/lib/hooks";
import { notify } from "@/lib/toast";
import type { PrFile } from "@devdigest/shared";
import { FindingCard } from "../FindingCard";
import { OrderToggle, type DiffOrder } from "./_components/OrderToggle";
import { RoleGroup } from "./_components/RoleGroup";
import { latestFindingsByPath, mergeSmartOrder, sumDiffStats } from "./helpers";
import { s } from "./styles";

interface DiffTabProps {
  prId: string | null;
  filesCount: number;
  files: PrFile[];
  /** Inline commenting is offered only on open PRs (GitHub rejects otherwise). */
  canComment?: boolean;
  repoFullName?: string | null;
  headSha?: string | null;
}

export function DiffTab({ prId, filesCount, files, canComment, repoFullName, headSha }: DiffTabProps) {
  const t = useTranslations("prReview");
  const searchParams = useSearchParams();
  const { data: comments } = usePrComments(prId);
  const create = useCreatePrComment(prId);
  const { data: smartDiff } = useSmartDiff(prId);
  const { data: reviews } = usePrReviews(prId);
  const action = useFindingAction();
  // Comments start hidden so the diff is clean by default — toggle to reveal.
  const [showComments, setShowComments] = React.useState(false);
  const [findingsVisible, setFindingsVisible] = React.useState(true);
  const [order, setOrder] = React.useState<DiffOrder>("smart");

  const commentCount = comments?.length ?? 0;

  const findingsByPath = React.useMemo(() => latestFindingsByPath(reviews ?? []), [reviews]);
  const openFindingCount = React.useMemo(
    () => [...findingsByPath.values()].flat().filter((f) => !f.dismissed_at).length,
    [findingsByPath],
  );

  const commenting: DiffCommentApi = {
    comments: comments ?? [],
    canComment: !!canComment && !!prId,
    showComments,
    posting: create.isPending,
    onSubmit: async (input) => {
      try {
        const res = await create.mutateAsync(input);
        setShowComments(true); // a just-posted comment shouldn't stay hidden
        return res;
      } catch (err) {
        notify.error(err instanceof Error ? err.message : "Couldn't post the comment to GitHub.");
        throw err;
      }
    },
  };

  const findings: DiffFindingApi = {
    forPath: (path) => findingsByPath.get(path) ?? [],
    visible: findingsVisible,
    renderFinding: (f) => (
      <FindingCard
        f={f}
        defaultExpanded
        pending={action.isPending}
        repoFullName={repoFullName}
        headSha={headSha}
        onAction={(a) => action.mutate({ findingId: f.id, action: a, prId: prId ?? undefined })}
      />
    ),
  };

  // Smart order needs the smart-diff response; while it loads/errors, fall
  // back to the original (GitHub) order (AC19 also reachable manually).
  const groups = React.useMemo(() => (smartDiff ? mergeSmartOrder(files, smartDiff) : null), [files, smartDiff]);
  const split = smartDiff?.split_suggestion;
  const stats = React.useMemo(() => sumDiffStats(files), [files]);

  // `?file=<path>&line=<n>` navigation target (PR Brief's review focus/risk
  // links — BRIEF-AC-05/13/16). `line` is the new (RIGHT) side's line number;
  // `lineKey`'s "SIDE:line" format must match `components/diff-viewer/comments.ts`'s
  // `lineKey()`. `nonce` is a pure function of the target itself (not a clock
  // read, which React's purity rule rejects in render) — it only needs to
  // differ when the target's path/line does, which a new memoized object
  // already signals via identity to FileCard's scroll effect.
  const focusFile = searchParams.get("file");
  const focusLineRaw = searchParams.get("line");
  const focusTarget = React.useMemo(() => {
    if (!focusFile) return null;
    const line = focusLineRaw != null ? Number(focusLineRaw) : null;
    return {
      path: focusFile,
      lineKey: line != null && Number.isFinite(line) ? `RIGHT:${line}` : undefined,
      nonce: focusFile.length * 1_000_000 + (line ?? 0),
    };
  }, [focusFile, focusLineRaw]);

  return (
    <section>
      <SectionLabel
        icon="Code"
        right={
          <span style={s.headerRight}>
            {commentCount > 0 && (
              <Button
                kind="ghost"
                size="sm"
                icon={showComments ? "EyeOff" : "Eye"}
                onClick={() => setShowComments((v) => !v)}
              >
                {showComments ? "Hide comments" : "Show comments"} ({commentCount})
              </Button>
            )}
            {groups && <OrderToggle order={order} onChange={setOrder} />}
            {openFindingCount > 0 && (
              <Button
                kind="ghost"
                size="sm"
                icon={findingsVisible ? "EyeOff" : "Eye"}
                onClick={() => setFindingsVisible((v) => !v)}
              >
                {t(findingsVisible ? "smartDiff.hideFindings" : "smartDiff.showFindings", {
                  count: openFindingCount,
                })}
              </Button>
            )}
          </span>
        }
      >
        Files changed · {filesCount} files
      </SectionLabel>

      <div className="mono tnum" style={s.stats}>
        {t("smartDiff.filesCount", { count: filesCount })} ·{" "}
        <span style={{ color: "var(--code-add-text)" }}>+{stats.additions}</span>{" "}
        <span style={{ color: "var(--code-del-text)" }}>−{stats.deletions}</span>
      </div>

      {/* Only Smart order groups files by role; Original order has nothing
          for the split suggestion to act on, so the warning is scoped to
          Smart order only. */}
      {split?.too_big && order === "smart" && (
        <div role="note" style={s.notice}>
          <div style={s.noticeTitle}>{t("smartDiff.largeTitle", { lines: split.total_lines })}</div>
        </div>
      )}

      {groups && order === "smart" ? (
        <div style={s.groups}>
          {groups.map((g) => (
            <RoleGroup key={g.role} group={g} commenting={commenting} findings={findings} focusTarget={focusTarget} />
          ))}
        </div>
      ) : (
        <DiffViewer files={files} commenting={commenting} findings={findings} scrollTarget={focusTarget} />
      )}
    </section>
  );
}
