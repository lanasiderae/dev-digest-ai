/* ConventionCard — one evidence-backed convention candidate: rule (editable
   inline), evidence file:line + snippet, confidence bar, Accept/Reject toggle. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, ProgressBar, Textarea } from "@devdigest/ui";
import type { ConventionCandidate } from "@devdigest/shared";
import { s } from "./styles";

export function ConventionCard({
  candidate,
  onAccept,
  onReject,
  onEditRule,
  pending,
}: {
  candidate: ConventionCandidate;
  onAccept: () => void;
  onReject: () => void;
  onEditRule: (rule: string) => void;
  pending?: boolean;
}) {
  const t = useTranslations("conventions");
  const pct = Math.round(candidate.confidence * 100);
  const color = pct >= 85 ? "var(--ok)" : pct >= 65 ? "var(--warn)" : "var(--text-muted)";
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(candidate.rule);

  const startEdit = () => {
    setDraft(candidate.rule);
    setEditing(true);
  };
  const saveEdit = () => {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== candidate.rule) onEditRule(trimmed);
    setEditing(false);
  };

  return (
    <div style={s.card(candidate.accepted, candidate.rejected)}>
      <div style={s.headerRow}>
        {editing ? (
          <div style={s.editBox}>
            <Textarea value={draft} onChange={setDraft} rows={2} />
            <div style={s.editActions}>
              <Button kind="ghost" size="sm" onClick={() => setEditing(false)}>
                {t("card.cancelEdit")}
              </Button>
              <Button kind="primary" size="sm" disabled={!draft.trim()} onClick={saveEdit}>
                {t("card.saveEdit")}
              </Button>
            </div>
          </div>
        ) : (
          <div style={s.rule}>{candidate.rule}</div>
        )}
        <div style={s.actions}>
          {!editing && (
            <Button
              kind="ghost"
              size="sm"
              icon="Edit"
              disabled={pending}
              aria-label={t("card.edit")}
              title={t("card.edit")}
              onClick={startEdit}
            />
          )}
          <Button
            kind={candidate.accepted ? "primary" : "secondary"}
            size="sm"
            icon="Check"
            disabled={pending || editing}
            onClick={onAccept}
          >
            {candidate.accepted ? t("card.accepted") : t("card.accept")}
          </Button>
          <Button
            kind={candidate.rejected ? "danger" : "secondary"}
            size="sm"
            icon="X"
            disabled={pending || editing}
            onClick={onReject}
          >
            {candidate.rejected ? t("card.rejected") : t("card.reject")}
          </Button>
        </div>
      </div>

      {candidate.evidence_path && (
        <div style={s.evidencePath} className="mono">
          {candidate.evidence_path}
        </div>
      )}
      {candidate.evidence_snippet && <div style={s.snippet} className="mono">{candidate.evidence_snippet}</div>}

      <div style={s.footer}>
        <div style={s.confidenceBar}>
          <div style={s.confidenceLabel}>
            {t("card.confidence")} · {pct}%
          </div>
          <ProgressBar value={pct} color={color} height={4} />
        </div>
      </div>
    </div>
  );
}
