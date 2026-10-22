/* CommunityImportTab — UI shell for searching/importing from a vetted
   community catalog. No such catalog exists yet anywhere in this repo, so
   this tab is intentionally non-functional ("coming soon"): every input is
   disabled and it fires zero network calls. */
"use client";

import { useTranslations } from "next-intl";
import { Icon, TextInput, SelectInput } from "@devdigest/ui";
import { s } from "./styles";

export function CommunityImportTab() {
  const t = useTranslations("skills");
  return (
    <div style={s.wrap}>
      <div style={s.notice}>
        <Icon.Info size={16} style={{ flexShrink: 0, marginTop: 1, color: "var(--text-muted)" }} />
        <span>{t("community.comingSoon")}</span>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <div style={{ flex: 1 }}>
          <TextInput value="" placeholder={t("community.searchPlaceholder")} disabled />
        </div>
        <div style={{ width: 160 }}>
          <SelectInput value="all" options={[{ value: "all", label: t("community.allLanguages") }]} />
        </div>
      </div>
    </div>
  );
}
