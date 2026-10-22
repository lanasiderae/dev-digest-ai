/* SkillsTab — attach/detach/reorder an agent's linked skills. Order is
   persisted via the existing POST /agents/:id/skills full-replace endpoint
   (already built, unchanged by this feature) and determines the sequence
   skill bodies are concatenated into the assembled review prompt. Reorder
   supports both a drag handle (native HTML5 DnD — no drag library needed)
   and up/down move buttons as a keyboard/no-JS-drag fallback. */
"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Icon, Toggle, IconBtn, ErrorState, EmptyState, Skeleton, Button } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useSkills } from "../../../../../../../lib/hooks/skills";
import { useAgentSkills, useSetAgentSkills } from "../../../../../../../lib/hooks/agents";
import { typeColor } from "../../../../../../skills/_components/SkillCard/helpers";
import { attachId, detachId, filterRows, joinSkillRows, moveLinkedId, reorderLinkedId } from "./helpers";
import { s } from "./styles";

export function SkillsTab({ agent }: { agent: Agent }) {
  const router = useRouter();
  const t = useTranslations("agents");
  const tSkills = useTranslations("skills");
  const { data: skills, isLoading: skillsLoading, isError: skillsError } = useSkills();
  const { data: links, isLoading: linksLoading, isError: linksError } = useAgentSkills(agent.id);
  const setSkills = useSetAgentSkills();
  const [search, setSearch] = React.useState("");
  const [dragId, setDragId] = React.useState<string | null>(null);

  const isLoading = skillsLoading || linksLoading;
  const isError = skillsError || linksError;

  const rows = React.useMemo(
    () => joinSkillRows(skills ?? [], links ?? []),
    [skills, links],
  );
  const filtered = filterRows(rows, search);

  const linkedIds = React.useMemo(
    () => [...(links ?? [])].sort((a, b) => a.order - b.order).map((l) => l.skill_id),
    [links],
  );
  const linkedEnabledCount = rows.filter((r) => r.linked && r.skill.enabled).length;

  const apply = (nextIds: string[]) => setSkills.mutate({ agentId: agent.id, skillIds: nextIds });

  if (isLoading) {
    return (
      <div>
        <Skeleton height={20} width={160} />
        <div style={{ marginTop: 16 }}>
          <Skeleton height={44} />
        </div>
      </div>
    );
  }
  if (isError) {
    return <ErrorState body={t("skillsTab.loadError")} />;
  }
  if (rows.length === 0) {
    return (
      <EmptyState
        icon="Sparkles"
        title={t("skillsTab.empty")}
        cta={t("skillsTab.goToSkills")}
        onCta={() => router.push("/skills")}
      />
    );
  }

  return (
    <div>
      <div style={s.header}>
        <h2 style={s.h2}>{t("skills.title")}</h2>
        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
          {t("skills.enabledCount", { linked: linkedEnabledCount, total: linkedIds.length })}
        </span>
      </div>
      <div style={s.orderHint}>{t("skills.orderHint")}</div>

      <div style={s.search}>
        <Icon.Search size={13} style={{ color: "var(--text-muted)" }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("skills.filterPlaceholder")}
          style={s.searchInput}
        />
      </div>

      {filtered.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{t("skillsTab.noMatch")}</div>
      )}

      {filtered.map(({ skill, linked }) => {
        const idx = linkedIds.indexOf(skill.id);
        // Only a linked AND enabled (vetted) skill may be drag-reordered —
        // a linked-but-disabled skill shows the "needs vetting" badge below
        // and must stay inert until it's vetted, same as it's excluded from
        // the prompt until then.
        const draggableRow = linked && skill.enabled;
        return (
          <div
            key={skill.id}
            style={s.row(dragId === skill.id)}
            draggable={draggableRow}
            onDragStart={() => draggableRow && setDragId(skill.id)}
            onDragOver={(e) => draggableRow && dragId && e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (draggableRow && dragId) apply(reorderLinkedId(linkedIds, dragId, skill.id));
              setDragId(null);
            }}
            onDragEnd={() => setDragId(null)}
          >
            {draggableRow ? (
              <Icon.GripVertical size={14} style={{ color: "var(--text-muted)", cursor: "grab" }} />
            ) : (
              <span style={{ width: 14 }} />
            )}
            <Toggle
              on={linked}
              onChange={(on) => apply(on ? attachId(linkedIds, skill.id) : detachId(linkedIds, skill.id))}
              size={14}
            />
            <span style={s.name}>{skill.name}</span>
            <span className="mono" style={s.typeChip(typeColor(skill.type))}>
              {tSkills(`listItem.type.${skill.type}`)}
            </span>
            {linked && !skill.enabled && (
              <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                {t("skillsTab.linkedDisabledBadge")}
              </span>
            )}
            <div style={s.moveCol}>
              <IconBtn
                icon="ArrowUp"
                label={t("skillsTab.moveUp")}
                size={22}
                onClick={() => draggableRow && apply(moveLinkedId(linkedIds, skill.id, "up"))}
              />
              <IconBtn
                icon="ArrowDown"
                label={t("skillsTab.moveDown")}
                size={22}
                onClick={() => draggableRow && apply(moveLinkedId(linkedIds, skill.id, "down"))}
              />
            </div>
            {linked && <span className="tnum" style={{ fontSize: 11, color: "var(--text-muted)" }}>#{idx + 1}</span>}
          </div>
        );
      })}

      <div style={{ marginTop: 16 }}>
        <Button kind="ghost" size="sm" icon="Sparkles" onClick={() => router.push("/skills")}>
          {t("skillsTab.goToSkills")}
        </Button>
      </div>
    </div>
  );
}
