/* FileImportTab — Markdown file paste/upload (entirely client-side, no
   server round trip) OR .zip archive import (POST /skills/import/archive,
   preview-only — nothing is persisted until the explicit "Import skill"
   confirm below, a normal useCreateSkill() call). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Button, FormField, TextInput, SelectInput, Textarea } from "@devdigest/ui";
import type { SkillType } from "@devdigest/shared";
import {
  useImportSkillArchive,
  useCreateSkill,
  type ArchiveImportCandidate,
} from "../../../../../../../../lib/hooks/skills";
import { ApiError } from "../../../../../../../../lib/api";
import { ACCEPTED_EXTENSIONS, TYPE_OPTIONS } from "./constants";
import { deriveNameFromMarkdown, isZipFile, readFileAsText } from "./helpers";
import { s } from "./styles";

export function FileImportTab({ onImported }: { onImported: (skillId: string) => void }) {
  const t = useTranslations("skills");
  const importArchive = useImportSkillArchive();
  const create = useCreateSkill();
  const inputRef = React.useRef<HTMLInputElement>(null);

  const [fileError, setFileError] = React.useState<string | undefined>();
  const [candidates, setCandidates] = React.useState<ArchiveImportCandidate[]>([]);
  const [selectedCandidate, setSelectedCandidate] = React.useState<number | undefined>();
  const [hasContent, setHasContent] = React.useState(false);

  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [type, setType] = React.useState<SkillType>("custom");
  const [body, setBody] = React.useState("");

  const typeOptions = TYPE_OPTIONS.map((v) => ({ value: v, label: t(`listItem.type.${v}`) }));

  const pickCandidate = (i: number) => {
    const c = candidates[i]!;
    setSelectedCandidate(i);
    setBody(c.body);
    setName((prev) => prev || deriveNameFromMarkdown(c.body) || "");
    setHasContent(true);
  };

  const onFile = async (file: File) => {
    setFileError(undefined);
    setCandidates([]);
    setSelectedCandidate(undefined);
    setHasContent(false);

    if (isZipFile(file)) {
      try {
        const preview = await importArchive.mutateAsync(file);
        if (preview.resolvedIndex !== undefined) {
          const resolved = preview.candidates[preview.resolvedIndex]!;
          setBody(resolved.body);
          setName(preview.name ?? "");
          setHasContent(true);
        } else if (preview.candidates.length > 1) {
          setCandidates(preview.candidates);
        } else {
          setFileError("No Markdown file was found in that archive.");
        }
      } catch (err) {
        setFileError(err instanceof ApiError ? err.message : "Could not read that archive.");
      }
      return;
    }

    try {
      const text = await readFileAsText(file);
      setBody(text);
      setName((prev) => prev || deriveNameFromMarkdown(text) || "");
      setHasContent(true);
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Could not read that file.");
    }
  };

  const confirm = async () => {
    const skill = await create.mutateAsync({
      name: name.trim(),
      description: description.trim(),
      type,
      body,
      source: "extracted",
    });
    onImported(skill.id);
  };

  const canConfirm = name.trim().length > 0 && description.trim().length > 0 && body.trim().length > 0;

  return (
    <div style={s.wrap}>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        style={{ display: "none" }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void onFile(file);
          e.target.value = "";
        }}
      />
      <div style={s.dropzone} onClick={() => inputRef.current?.click()}>
        <Icon.Upload size={16} />
        {importArchive.isPending ? t("archive.importing") : t("archive.dropPlaceholder")}
      </div>

      {fileError && <div style={s.error}>{fileError}</div>}

      {candidates.length > 0 && selectedCandidate === undefined && (
        <>
          <FormField label={t("archive.ambiguous.title")} hint={t("archive.ambiguous.body")}>
            <div style={s.candidateList}>
              {candidates.map((c, i) => (
                <button
                  key={c.path}
                  type="button"
                  style={s.candidateButton(false)}
                  onClick={() => pickCandidate(i)}
                >
                  {c.path}
                </button>
              ))}
            </div>
          </FormField>
        </>
      )}

      {hasContent && (
        <>
          <FormField label={t("file.nameLabel")} hint={t("file.nameHint")}>
            <TextInput value={name} onChange={setName} placeholder={t("file.namePlaceholder")} />
          </FormField>
          <FormField label={t("create.fields.description")} required>
            <TextInput
              value={description}
              onChange={setDescription}
              placeholder={t("create.fields.descriptionPlaceholder")}
            />
          </FormField>
          <FormField label={t("create.fields.type")}>
            <SelectInput value={type} onChange={(v) => setType(v as SkillType)} options={typeOptions} />
          </FormField>
          <FormField label={t("file.bodyLabel")} hint={t("file.bodyHint")}>
            <Textarea value={body} onChange={setBody} rows={8} mono placeholder={t("file.bodyPlaceholder")} />
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
