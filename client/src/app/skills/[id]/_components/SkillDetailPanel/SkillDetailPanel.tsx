/* SkillDetailPanel — preview (rendered Markdown + metadata) ↔ edit mode.
   Mirrors ConfigTab's local-state-seeded-from-props pattern; caller renders
   this with key={skill.id} so switching skills resets all local state. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import {
  Button,
  Badge,
  FormField,
  TextInput,
  SelectInput,
  Textarea,
  Toggle,
  Markdown,
  Icon,
  Tabs,
} from "@devdigest/ui";
import type { Skill, SkillType } from "@devdigest/shared";
import { useUpdateSkill } from "../../../../../lib/hooks/skills";
import { SkillVersionsTab } from "./_components/SkillVersionsTab";
import { TYPE_OPTIONS } from "./constants";
import { s } from "./styles";

type TabKey = "config" | "preview" | "versions";

export function SkillDetailPanel({ skill }: { skill: Skill }) {
  const t = useTranslations("skills");
  const update = useUpdateSkill();

  const [tab, setTab] = React.useState<TabKey>("preview");
  const [name, setName] = React.useState(skill.name);
  const [description, setDescription] = React.useState(skill.description);
  const [type, setType] = React.useState<SkillType>(skill.type);
  const [body, setBody] = React.useState(skill.body);
  const [enabled, setEnabled] = React.useState(skill.enabled);

  const typeOptions = TYPE_OPTIONS.map((v) => ({ value: v, label: t(`listItem.type.${v}`) }));
  const untrusted = skill.source !== "manual";
  const bodyChanged = body !== skill.body;

  const save = () =>
    update.mutate({
      id: skill.id,
      patch: { name, description, type, body, enabled },
      // onSuccess is the default global toast; the inline "Saved (vN)" note
      // below comes straight from the mutation's own result.
    });

  const resetDraft = () => {
    setName(skill.name);
    setDescription(skill.description);
    setType(skill.type);
    setBody(skill.body);
    setEnabled(skill.enabled);
  };

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <Icon.Sparkles size={18} style={{ color: "var(--accent)" }} />
        <h2 style={s.h2}>{skill.name}</h2>
        <Badge mono color="var(--text-secondary)">
          {t(`listItem.type.${skill.type}`)}
        </Badge>
        <Badge color={skill.enabled ? "var(--ok)" : "var(--text-muted)"}>
          {skill.enabled ? t("preview.enabled") : t("preview.disabled")}
        </Badge>
        <Badge mono>{t("preview.version", { version: skill.version })}</Badge>
        <Button kind="ghost" size="sm" icon="Play" disabled title={t("preview.runOnEvalsDisabledHint")}>
          {t("preview.runOnEvals")}
        </Button>
      </div>

      {untrusted && (
        <div style={s.notice}>
          <Icon.AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1, color: "var(--warn)" }} />
          <span>{t("preview.untrustedNotice")}</span>
        </div>
      )}

      <Tabs
        tabs={[
          { key: "config", label: t("preview.tabConfig"), icon: "Settings" },
          { key: "preview", label: t("preview.tabPreview"), icon: "Eye" },
          { key: "versions", label: t("preview.tabVersions"), icon: "History" },
        ]}
        value={tab}
        onChange={(k) => setTab(k as TabKey)}
        pad="0"
      />

      <div style={{ marginTop: 16 }}>
        {tab === "preview" && (
          <>
            <p style={{ color: "var(--text-secondary)", fontSize: 13.5, marginBottom: 16 }}>
              {skill.description}
            </p>
            <div style={s.bodyPreview}>
              <Markdown>{skill.body}</Markdown>
            </div>
          </>
        )}

        {tab === "versions" && <SkillVersionsTab skill={skill} />}

        {tab === "config" && (
          <>
            <div style={s.header}>
              <h3 style={{ fontSize: 15, fontWeight: 700, flex: 1 }}>{t("preview.configTitle")}</h3>
              <label style={s.enabledLabel}>
                {enabled ? t("preview.enabled") : t("preview.disabled")}
                <Toggle on={enabled} onChange={setEnabled} size={16} />
              </label>
            </div>
            <FormField label={t("create.fields.name")} required>
              <TextInput value={name} onChange={setName} />
            </FormField>
            <FormField
              label={t("create.fields.description")}
              hint={t("create.fields.descriptionHint")}
              required
            >
              <TextInput value={description} onChange={setDescription} />
            </FormField>
            <FormField label={t("create.fields.type")}>
              <SelectInput value={type} onChange={(v) => setType(v as SkillType)} options={typeOptions} />
            </FormField>
            <FormField
              label={t("preview.bodyLabel")}
              hint={bodyChanged ? t("preview.bodyHint") : undefined}
            >
              <Textarea value={body} onChange={setBody} rows={12} mono />
            </FormField>
            <div style={s.actions}>
              <Button kind="ghost" onClick={resetDraft}>
                {t("preview.cancel")}
              </Button>
              <Button kind="primary" icon="Check" onClick={save} disabled={update.isPending}>
                {update.isPending ? t("preview.saving") : t("preview.save")}
              </Button>
              {update.isSuccess && (
                <span style={s.savedNote}>{t("preview.version", { version: update.data?.version })}</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
