/* SkillVersionsTab — real version history (GET /skills/:id/versions), an
   inline diff against the current body (GET .../versions/:version, diffed
   client-side), and "restore" (PUT the old body through the existing update
   endpoint — the repository already snapshots+bumps version on body change,
   so this is a non-destructive revert, not a history rewrite). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Badge, ConfirmModal, ErrorState, Skeleton } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useSkillVersion, useSkillVersions, useUpdateSkill } from "../../../../../../../lib/hooks/skills";
import { diffLines, formatVersionDate, sortVersionsDesc } from "./helpers";
import { s } from "./styles";

export function SkillVersionsTab({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const { data: versions, isLoading, isError } = useSkillVersions(skill.id);
  const [diffVersion, setDiffVersion] = React.useState<number | null>(null);
  const [restoreVersion, setRestoreVersion] = React.useState<number | null>(null);

  if (isLoading) {
    return (
      <div>
        <Skeleton height={18} width={160} />
        <div style={{ marginTop: 12 }}>
          <Skeleton height={56} />
        </div>
      </div>
    );
  }
  if (isError || !versions) {
    return <ErrorState body={t("versions.loadError")} />;
  }

  const sorted = sortVersionsDesc(versions);

  return (
    <div>
      <div style={s.header}>
        <h3 style={s.h3}>
          {t("versions.title")}
          <Badge mono>{t("versions.count", { count: sorted.length })}</Badge>
        </h3>
        <p style={s.hint}>{t("versions.hint")}</p>
      </div>

      {sorted.map((v, i) => {
        const current = v.version === skill.version;
        // Every row diffs "this version" against "the one right before it" —
        // for the current row that's the previous snapshot (there's nothing
        // to compare its own live body against); for every other row it's
        // simply the live current body, fetched via the `skill` prop already.
        const compareVersion = current ? sorted[i + 1]?.version : v.version;
        return (
          <VersionRow
            key={v.version}
            skillId={skill.id}
            version={v.version}
            createdAt={v.created_at}
            current={current}
            compareVersion={compareVersion}
            diffing={diffVersion === v.version}
            onToggleDiff={() => setDiffVersion(diffVersion === v.version ? null : v.version)}
            onRestore={() => setRestoreVersion(v.version)}
            currentBody={skill.body}
          />
        );
      })}

      {restoreVersion != null && (
        <RestoreConfirm skillId={skill.id} version={restoreVersion} onDone={() => setRestoreVersion(null)} />
      )}
    </div>
  );
}

function VersionRow({
  skillId,
  version,
  createdAt,
  current,
  compareVersion,
  diffing,
  onToggleDiff,
  onRestore,
  currentBody,
}: {
  skillId: string;
  version: number;
  createdAt: string;
  current: boolean;
  /** Version to diff this row against — undefined only for a current row
   *  that has no earlier snapshot (a skill with just one version). */
  compareVersion: number | undefined;
  diffing: boolean;
  onToggleDiff: () => void;
  onRestore: () => void;
  currentBody: string;
}) {
  const t = useTranslations("skills");
  const { data: snapshot, isLoading } = useSkillVersion(skillId, diffing ? (compareVersion ?? null) : null);

  return (
    <div>
      <div style={s.row}>
        <div style={s.rowMain}>
          <span style={s.rowTitle}>{t("versions.version", { version })}</span>
          <div style={s.rowDate}>{formatVersionDate(createdAt)}</div>
        </div>
        <div style={s.rowActions}>
          {current && (
            <Badge color="var(--ok)" icon="CheckCircle">
              {t("versions.current")}
            </Badge>
          )}
          {compareVersion != null && (
            <Button kind="ghost" size="sm" icon="Eye" onClick={onToggleDiff}>
              {t("versions.diff")}
            </Button>
          )}
          {!current && (
            <Button kind="secondary" size="sm" icon="History" onClick={onRestore}>
              {t("versions.restore")}
            </Button>
          )}
        </div>
      </div>

      {diffing && (
        <div style={s.diffBox}>
          {isLoading && <div style={{ padding: 10 }}>{t("versions.diffLoading")}</div>}
          {snapshot &&
            diffLines(snapshot.body, currentBody).map((line, i) => (
              <div key={i} style={s.diffLine(line.type)}>
                <span style={s.diffGutter}>{line.type === "add" ? "+" : line.type === "del" ? "-" : ""}</span>
                <span>{line.text || " "}</span>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

function RestoreConfirm({
  skillId,
  version,
  onDone,
}: {
  skillId: string;
  version: number;
  onDone: () => void;
}) {
  const t = useTranslations("skills");
  const { data: snapshot, isLoading: snapshotLoading } = useSkillVersion(skillId, version);
  const update = useUpdateSkill();

  return (
    <ConfirmModal
      title={t("versions.restoreTitle", { version })}
      body={t("versions.restoreBody", { version })}
      confirmLabel={t("versions.restoreConfirm")}
      danger={false}
      pending={snapshotLoading || update.isPending}
      onCancel={onDone}
      onConfirm={() => {
        if (!snapshot) return;
        update.mutate({ id: skillId, patch: { body: snapshot.body } }, { onSuccess: onDone });
      }}
    />
  );
}
