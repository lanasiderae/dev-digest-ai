/* AddSkillDrawer — "Add a skill" drawer with File / URL / Community tabs.
   Mirrors RunTraceDrawer's drawer+tabs composition. Each tab owns its own
   preview-before-save flow; nothing is persisted until the tab's own
   confirm step creates the skill via useCreateSkill. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Drawer, Tabs } from "@devdigest/ui";
import { FileImportTab } from "./_components/FileImportTab";
import { UrlImportTab } from "./_components/UrlImportTab";
import { CommunityImportTab } from "./_components/CommunityImportTab";
import { DRAWER_WIDTH, TABS } from "./constants";
import { s } from "./styles";

export function AddSkillDrawer({
  initialTab = "file",
  onClose,
  onImported,
}: {
  initialTab?: string;
  onClose: () => void;
  onImported: (skillId: string) => void;
}) {
  const t = useTranslations("skills");
  const [tab, setTab] = React.useState(initialTab);
  const tabs = TABS.map((tb) => ({ key: tb.key, label: t(tb.labelKey), icon: tb.icon }));

  const handleImported = (skillId: string) => {
    onImported(skillId);
    onClose();
  };

  return (
    <Drawer width={DRAWER_WIDTH} title={t("drawer.title")} subtitle={t("drawer.subtitle")} onClose={onClose}>
      <Tabs tabs={tabs} value={tab} onChange={setTab} pad="0" />
      <div style={s.body}>
        {tab === "file" && <FileImportTab onImported={handleImported} />}
        {tab === "url" && <UrlImportTab onImported={handleImported} />}
        {tab === "community" && <CommunityImportTab />}
      </div>
    </Drawer>
  );
}
