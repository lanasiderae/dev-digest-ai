"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, Modal, FormField, TextInput, SelectInput, Textarea } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { useCreateSkill } from "../../../../../../lib/hooks/skills";
import { DEFAULT_TYPE, MODAL_WIDTH, TYPE_OPTIONS } from "./constants";
import { s } from "./styles";

/** Create-skill modal — name/description/type/body. The description field
 *  carries a helper hint explaining it's the skill's "interface": it should
 *  be written as a directive instruction, since that's what tells an agent
 *  when to use the skill. `onCreated` lets the caller open the new skill
 *  (e.g. in the list page's inline preview panel) without this modal
 *  deciding how/where that happens. */
export function CreateSkillModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (skillId: string) => void;
}) {
  const t = useTranslations("skills");
  const create = useCreateSkill();
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<SkillType>(DEFAULT_TYPE);
  const [body, setBody] = React.useState("");

  const typeOptions = TYPE_OPTIONS.map((v) => ({ value: v, label: t(`listItem.type.${v}`) }));

  const submit = async () => {
    const skill = await create.mutateAsync({
      name: name.trim(),
      description: description.trim(),
      type,
      body,
      source: "manual",
    });
    onCreated(skill.id);
  };

  const canSubmit = name.trim().length > 0 && description.trim().length > 0 && body.trim().length > 0;

  return (
    <Modal
      width={MODAL_WIDTH}
      title={t("create.title")}
      subtitle={t("create.subtitle")}
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
