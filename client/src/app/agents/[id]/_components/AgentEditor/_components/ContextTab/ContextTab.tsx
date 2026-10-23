/* ContextTab — agent's Project Context Folder selection (L05 CTX-AC-02/04).
   Mirrors ConfigTab's local-draft-seeded-from-props pattern: caller renders
   this with key={agent.id}, so switching agents resets the draft, and the
   draft itself survives a Config<->Context tab round trip the same way
   ConfigTab's own unsaved fields do (reset to the last SAVED value, since
   React remounts this component on tab switch — no new global store). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Button } from "@devdigest/ui";
import type { Agent } from "@devdigest/shared";
import { useUpdateAgent } from "../../../../../../../lib/hooks/agents";
import { readProjectContext, type WithProjectContext } from "../../../../../../../lib/hooks/project-context";
import { useToast } from "../../../../../../../lib/toast";
import { ProjectContextSelector } from "../../../../../../../components/project-context/ProjectContextSelector";
import { s } from "./styles";

export function ContextTab({ agent }: { agent: WithProjectContext<Agent> }) {
  const t = useTranslations("agents");
  const toast = useToast();
  const update = useUpdateAgent();
  const [draft, setDraft] = React.useState(readProjectContext(agent));

  // Reuses the EXISTING agent save/update hook (same PUT /agents/:id call
  // ConfigTab already uses) rather than a parallel save path for this one
  // field — see `UpdateAgentInput.patch.project_context`'s note.
  const save = () =>
    update.mutate(
      { id: agent.id, patch: { project_context: draft } },
      { onSuccess: (data) => toast.success(t("config.savedToast", { version: data.version })) },
    );

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <h2 style={s.h2}>{t("context.title")}</h2>
        <Button kind="primary" icon="Check" onClick={save} disabled={update.isPending}>
          {update.isPending ? t("config.saving") : t("context.save")}
        </Button>
        {update.isSuccess && <span style={s.savedNote}>{t("config.saved", { version: update.data?.version })}</span>}
      </div>
      <p style={s.hint}>{t("context.hint")}</p>
      <ProjectContextSelector value={draft} onChange={setDraft} />
    </div>
  );
}
