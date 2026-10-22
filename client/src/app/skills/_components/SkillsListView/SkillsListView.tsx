/* /skills — Skills master-detail: a narrow skill list + a large detail pane,
   matching /skills/[id]/page.tsx's own two-pane shape (same list column
   width, same SkillCard rows) so the page looks identical whether or not a
   skill is selected. Selecting a skill never navigates — it's client state
   (`previewId`) that fills the big right pane with SkillDetailPanel, so
   /skills/[id] stays available purely as a shareable deep link. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Dropdown, EmptyState, ErrorState, Skeleton, Icon } from "@devdigest/ui";
import { AppShell } from "../../../../components/app-shell";
import { useSkills, useUpdateSkill } from "../../../../lib/hooks/skills";
import { SkillCard } from "../SkillCard";
import { SkillDetailPanel } from "../../[id]/_components/SkillDetailPanel";
import { CreateSkillModal } from "./_components/CreateSkillModal";
import { AddSkillDrawer } from "./_components/AddSkillDrawer";
import { filterSkills } from "./helpers";
import { s } from "./styles";

export function SkillsListView() {
  const t = useTranslations("skills");
  const { data: skills, isLoading, isError, refetch } = useSkills();
  const update = useUpdateSkill();
  const [creating, setCreating] = React.useState(false);
  const [importTab, setImportTab] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [previewId, setPreviewId] = React.useState<string | null>(null);

  const list = filterSkills(skills ?? [], search);
  // null (not undefined) when the previewed skill was just deleted out from
  // under the pane — the `previewSkill &&` guard below then clears it.
  const previewSkill = (skills ?? []).find((sk) => sk.id === previewId) ?? null;

  return (
    <AppShell crumb={[{ label: t("page.crumbLab") }, { label: t("page.crumbSkills") }]}>
      {creating && (
        <CreateSkillModal
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setPreviewId(id);
          }}
        />
      )}
      {importTab && (
        <AddSkillDrawer
          initialTab={importTab}
          onClose={() => setImportTab(null)}
          onImported={(id) => setPreviewId(id)}
        />
      )}
      <div style={s.page}>
        <div style={s.list}>
          <div style={s.listHeader}>
            <div style={s.listHeaderRow}>
              <h1 style={s.h1}>{t("page.heading")}</h1>
              <Dropdown
                width={220}
                align="right"
                trigger={
                  <Button kind="primary" size="sm" icon="Plus" iconRight="ChevronDown">
                    {t("page.addSkill")}
                  </Button>
                }
                items={[
                  { label: t("page.menu.createNew"), icon: "Edit", onClick: () => setCreating(true) },
                  { divider: true },
                  { label: t("page.menu.fromFile"), icon: "FileText", onClick: () => setImportTab("file") },
                  { label: t("page.menu.fromUrl"), icon: "Link", onClick: () => setImportTab("url") },
                  { label: t("page.menu.community"), icon: "Globe", onClick: () => setImportTab("community") },
                ]}
              />
            </div>
            <div style={s.search}>
              <Icon.Search size={13} style={s.searchIcon} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("page.searchPlaceholder")}
                style={s.searchInput}
              />
            </div>
          </div>

          <div style={s.listScroll}>
            {isLoading && (
              <>
                <Skeleton height={64} />
                <div style={{ marginTop: 8 }}>
                  <Skeleton height={64} />
                </div>
              </>
            )}
            {isError && <ErrorState body={t("page.loadError")} onRetry={() => refetch()} />}
            {!isLoading && !isError && list.length === 0 && (
              <EmptyState
                icon="Sparkles"
                title={t("page.empty.title")}
                body={t("page.empty.body")}
                cta={t("page.empty.cta")}
                onCta={() => setImportTab("file")}
              />
            )}
            {list.map((skill) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                active={skill.id === previewId}
                onClick={() => setPreviewId(skill.id)}
                onToggle={(enabled) => update.mutate({ id: skill.id, patch: { enabled } })}
              />
            ))}
          </div>
        </div>

        {previewSkill ? (
          <SkillDetailPanel key={previewSkill.id} skill={previewSkill} />
        ) : (
          <div style={s.selectPrompt}>
            <EmptyState icon="Sparkles" title={t("page.selectPrompt.title")} body={t("page.selectPrompt.body")} />
          </div>
        )}
      </div>
    </AppShell>
  );
}
