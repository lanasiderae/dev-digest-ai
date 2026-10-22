/* UrlImportTab — preview-then-confirm URL import. Step 1 (Fetch) hits
   POST /skills/import/url, which fetches server-side and returns a preview
   WITHOUT writing to the DB. Step 2 (Import skill) is the normal
   useCreateSkill() call, which the server forces enabled=false for
   (source: 'imported_url') regardless of anything this tab sends. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button, FormField, TextInput, SelectInput, Textarea } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import { useImportSkillUrl, useCreateSkill } from "../../../../../../../../lib/hooks/skills";
import { TYPE_OPTIONS } from "./constants";
import { s } from "./styles";

export function UrlImportTab({ onImported }: { onImported: (skillId: string) => void }) {
  const t = useTranslations("skills");
  const fetchPreview = useImportSkillUrl();
  const create = useCreateSkill();

  const [url, setUrl] = React.useState("");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<SkillType>("custom");
  const [body, setBody] = React.useState("");
  const [hasPreview, setHasPreview] = React.useState(false);

  const typeOptions = TYPE_OPTIONS.map((v) => ({ value: v, label: t(`listItem.type.${v}`) }));

  const fetchIt = async () => {
    const preview = await fetchPreview.mutateAsync(url);
    setName(preview.name ?? "");
    setBody(preview.body);
    setDescription(`Imported from ${url}.`);
    setHasPreview(true);
  };

  const confirm = async () => {
    const skill = await create.mutateAsync({
      name: name.trim(),
      description: description.trim(),
      type,
      body,
      source: "imported_url",
    });
    onImported(skill.id);
  };

  const error = fetchPreview.error instanceof Error ? fetchPreview.error.message : undefined;
  const canConfirm = name.trim().length > 0 && description.trim().length > 0 && body.trim().length > 0;

  return (
    <div style={s.wrap}>
      <FormField label={t("url.label")} hint={t("url.hint")}>
        <div style={s.row}>
          <div style={s.urlField}>
            <TextInput value={url} onChange={setUrl} placeholder={t("url.placeholder")} />
          </div>
          <Button kind="secondary" onClick={fetchIt} disabled={!url.trim() || fetchPreview.isPending}>
            {fetchPreview.isPending ? t("url.fetching") : t("url.import")}
          </Button>
        </div>
      </FormField>

      {error && <div style={s.error}>{error}</div>}

      {hasPreview && (
        <>
          <FormField label={t("create.fields.name")} required>
            <TextInput value={name} onChange={setName} />
          </FormField>
          <FormField label={t("create.fields.description")} required>
            <TextInput value={description} onChange={setDescription} />
          </FormField>
          <FormField label={t("create.fields.type")}>
            <SelectInput value={type} onChange={(v) => setType(v as SkillType)} options={typeOptions} />
          </FormField>
          <FormField label={t("file.bodyLabel")} hint={t("file.bodyHint")}>
            <Textarea value={body} onChange={setBody} rows={8} mono />
          </FormField>
          <div style={s.actions}>
            <Button kind="primary" icon="Check" onClick={confirm} disabled={create.isPending || !canConfirm}>
              {create.isPending ? t("file.importing") : t("file.import")}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
