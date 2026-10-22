"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Modal, FormField, TextInput, SelectInput, Textarea, Icon } from "@devdigest/ui";
import type { SkillSource, SkillType } from "@devdigest/shared";
import { useCreateSkill } from "../../../../../../lib/hooks/skills";
import { detectInjectionPatterns } from "../../../../../../lib/injection-scan";
import { DEFAULT_TYPE, MODAL_WIDTH, TYPE_OPTIONS } from "./constants";
import { s } from "./styles";

/** Create-skill modal — name/description/type/body. The description field
 *  carries a helper hint explaining it's the skill's "interface": it should
 *  be written as a directive instruction, since that's what tells an agent
 *  when to use the skill. `onCreated` lets the caller open the new skill
 *  (e.g. in the list page's inline preview panel) without this modal
 *  deciding how/where that happens.
 *
 *  `initial` prefills the form (e.g. from the Conventions page, combining
 *  accepted candidates into a `source: "extracted"` skill) — omitted, the
 *  form starts blank as a normal "+ Add Skill" create. */
export function CreateSkillModal({
  onClose,
  onCreated,
  initial,
}: {
  onClose: () => void;
  onCreated: (skillId: string) => void;
  initial?: {
    name?: string;
    description?: string;
    type?: SkillType;
    body?: string;
    source?: SkillSource;
    evidenceFiles?: string[];
  };
}) {
  const t = useTranslations("skills");
  const create = useCreateSkill();
  const [name, setName] = React.useState(initial?.name ?? "");
  const [description, setDescription] = React.useState(initial?.description ?? "");
  const [type, setType] = React.useState<SkillType>(initial?.type ?? DEFAULT_TYPE);
  const [body, setBody] = React.useState(initial?.body ?? "");

  const typeOptions = TYPE_OPTIONS.map((v) => ({ value: v, label: t(`listItem.type.${v}`) }));

  const submit = async () => {
    const skill = await create.mutateAsync({
      name: name.trim(),
      description: description.trim(),
      type,
      body,
      source: initial?.source ?? "manual",
      evidence_files: initial?.evidenceFiles,
    });
    onCreated(skill.id);
  };

  const canSubmit = name.trim().length > 0 && description.trim().length > 0 && body.trim().length > 0;
  const injectionFlagged = detectInjectionPatterns(body).length > 0;

  return (
    <Modal
      width={MODAL_WIDTH}
      title={t("create.title")}
      subtitle={initial?.source === "extracted" ? t("create.subtitleFromConventions") : t("create.subtitle")}
      onClose={onClose}
      footer={
        <div style={s.footer}>
          <Button kind="ghost" onClick={onClose}>
            {t("create.cancel")}
          </Button>
          <Button kind="primary" icon="Plus" onClick={submit} disabled={create.isPending || !canSubmit}>
            {create.isPending ? t("create.creating") : t("create.create")}
          </Button>
        </div>
      }
    >
      <div style={s.body}>
        {injectionFlagged && (
          <div style={s.injectionBanner}>
            <Icon.AlertOctagon size={16} style={{ flexShrink: 0, marginTop: 1, color: "var(--crit)" }} />
            <span>{t("preview.injectionBanner")}</span>
          </div>
        )}
        <FormField label={t("create.fields.name")} required>
          <TextInput value={name} onChange={setName} placeholder={t("create.fields.namePlaceholder")} />
        </FormField>
        <FormField
          label={t("create.fields.description")}
          hint={t("create.fields.descriptionHint")}
          required
        >
          <TextInput
            value={description}
            onChange={setDescription}
            placeholder={t("create.fields.descriptionPlaceholder")}
          />
        </FormField>
        <FormField label={t("create.fields.type")}>
          <SelectInput value={type} onChange={(v) => setType(v as SkillType)} options={typeOptions} />
        </FormField>
        <FormField label={t("create.fields.body")} required>
          <Textarea
            value={body}
            onChange={setBody}
            rows={10}
            mono
            placeholder={t("create.fields.bodyPlaceholder")}
          />
        </FormField>
      </div>
    </Modal>
  );
}
