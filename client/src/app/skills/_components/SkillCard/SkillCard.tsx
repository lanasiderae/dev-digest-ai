/* SkillCard — type chip, source/vetting badge, enabled toggle. Mirrors
   AgentCard's layout and interaction conventions (stopPropagation on the
   toggle/delete so they don't trigger the card's own onClick). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Badge, Toggle, ConfirmModal, Tooltip } from "@devdigest/ui";
import type { Skill } from "@devdigest/shared";
import { useDeleteSkill } from "../../../../lib/hooks/skills";
import { formatPercent } from "../../../../lib/format-stats";
import { typeColor } from "./helpers";
import { s } from "./styles";

export function SkillCard({
  skill,
  active,
  onClick,
  onToggle,
}: {
  skill: Skill;
  active?: boolean;
  onClick?: () => void;
  onToggle?: (enabled: boolean) => void;
}) {
  const t = useTranslations("skills");
  const del = useDeleteSkill();
  const color = typeColor(skill.type);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const needsVetting = skill.source !== "manual" && !skill.enabled;

  return (
    <div onClick={onClick} style={s.card(!!active)}>
      <div style={s.headerRow}>
        <div style={{ ...s.iconBox, ...s.body(skill.enabled) }}>
          <Icon.Sparkles size={15} />
        </div>
        <Tooltip label={skill.name} style={{ flex: 1 }}>
          <span style={{ ...s.name, ...s.body(skill.enabled) }}>{skill.name}</span>
        </Tooltip>
        {onToggle && (
          <div onClick={(e) => e.stopPropagation()}>
            <Toggle on={skill.enabled} onChange={onToggle} size={14} />
          </div>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setConfirmDelete(true);
          }}
          disabled={del.isPending}
          title="Delete skill"
          aria-label="Delete skill"
          style={{
            background: "none",
            border: "none",
            cursor: del.isPending ? "not-allowed" : "pointer",
            color: "var(--text-muted)",
            display: "inline-flex",
            padding: 4,
          }}
        >
          <Icon.Trash size={14} style={del.isPending ? { animation: "ddspin 1s linear infinite" } : undefined} />
        </button>
      </div>
      <div style={s.body(skill.enabled)}>
        <div style={s.description}>{skill.description}</div>
        <div style={s.metaRow}>
          <span className="mono" style={s.typeChip(color)}>
            {t(`listItem.type.${skill.type}`)}
          </span>
          {skill.source !== "manual" && (
            <Badge color="var(--text-secondary)">{t(`listItem.source.${skill.source}`)}</Badge>
          )}
          {needsVetting && (
            <span title={t("listItem.vettingTitle")}>
              <Badge color="var(--warn)" icon="AlertTriangle">
                {t("listItem.needsVetting")}
              </Badge>
            </span>
          )}
        </div>
        <div style={s.versionLine}>
          {t("listItem.versionLine", { source: t(`listItem.source.${skill.source}`), version: skill.version })}
        </div>
        <div style={s.statsRow}>
          <Icon.Cpu size={12} />
          <span>{t("listItem.agentCount", { count: skill.agent_count ?? 0 })}</span>
          <span>·</span>
          <span>{t("listItem.pullFreq", { value: formatPercent(skill.pull_frequency ?? null) })}</span>
        </div>
      </div>

      {confirmDelete && (
        <div onClick={(e) => e.stopPropagation()}>
          <ConfirmModal
            title="Delete this skill?"
            body={`"${skill.name}" will be permanently deleted, including its version history. This cannot be undone.`}
            pending={del.isPending}
            onCancel={() => setConfirmDelete(false)}
            onConfirm={() => {
              del.mutate(skill.id);
              setConfirmDelete(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
