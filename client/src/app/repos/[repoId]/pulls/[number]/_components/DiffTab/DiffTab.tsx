"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { SectionLabel, Button } from "@devdigest/ui";
import { DiffViewer, type DiffCommentApi, type DiffFindingApi } from "@/components/diff-viewer";
import { usePrComments, useCreatePrComment, useFindingAction, usePrReviews, useSmartDiff } from "@/lib/hooks";
import { notify } from "@/lib/toast";
import type { PrFile } from "@devdigest/shared";
import { FindingCard } from "../FindingCard";
import { OrderToggle, type DiffOrder } from "./_components/OrderToggle";
import { RoleGroup } from "./_components/RoleGroup";
import { latestFindingsByPath, mergeSmartOrder } from "./helpers";
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

  return (
    <section>
      <SectionLabel
        icon="Code"
        right={
          commentCount > 0 ? (
            <Button
              kind="ghost"
              size="sm"
              icon={showComments ? "EyeOff" : "Eye"}
              onClick={() => setShowComments((v) => !v)}
            >
              {showComments ? "Hide comments" : "Show comments"} ({commentCount})
            </Button>
          ) : undefined
        }
      >
        Files changed · {filesCount} files
      </SectionLabel>

      {split?.too_big && (
        <div role="note" style={s.notice}>
          <div style={s.noticeTitle}>{t("smartDiff.largeTitle", { lines: split.total_lines })}</div>
          <div style={s.noticeBody}>{t("smartDiff.largeBody")}</div>
          <ul style={s.noticeList}>
            {split.proposed_splits.map((p) => (
              <li key={p.name}>
                {p.name} ({t("smartDiff.filesCount", { count: p.files.length })})
              </li>
            ))}
          </ul>
        </div>
      )}

      {(groups || openFindingCount > 0) && (
        <div style={s.controls}>
          <span style={s.hint}>{groups && order === "smart" ? t("smartDiff.groupedByRole") : ""}</span>
          <span style={s.controlsRight}>
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
        </div>
      )}

      {groups && order === "smart" ? (
        <div style={s.groups}>
          {groups.map((g) => (
            <RoleGroup key={g.role} group={g} commenting={commenting} findings={findings} />
          ))}
        </div>
      ) : (
        <DiffViewer files={files} commenting={commenting} findings={findings} />
      )}
    </section>
  );
}
