/* ProjectContextSection — CTX-AC-06: the "Project context" section of the
   Trace tab. Renders `RunTrace.project_context` (a `ProjectContextSnapshot`,
   `.nullish()`): the per-document snapshot (path/type/revision/tokens), the
   total token count, any omissions (reason/detail), and the literal
   `project context attached specs` expandable sub-section revealing the
   exact guarded text actually sent to the model, collapsed by default.

   Three distinct states:
   - `snapshot == null` — nothing attached/resolved for this run (e.g. a
     trace persisted before this field existed) — explicit "not available",
     never an empty-but-implying-something-was-sent section.
   - `snapshot.documents.length === 0` (object exists) — the healthy-empty
     case: selections existed but were all omitted, or there were none —
     still show any `omissions` so the user understands why nothing is
     attached.
   - `snapshot.documents.length > 0` — the populated case: per-document
     list, total tokens, omissions, and the expandable attached-specs text. */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@devdigest/ui";
import type { RunTrace } from "@devdigest/shared";
import { PROMPT_COLORS } from "../../constants";
import { s } from "../../styles";
import { TraceSection } from "../TraceSection";
import { PromptBlock } from "../PromptBlock";

export function ProjectContextSection({ snapshot }: { snapshot: RunTrace["project_context"] }) {
  const t = useTranslations("runs");

  if (snapshot == null) {
    return (
      <TraceSection icon="FileText" title={t("trace.projectContext.title")}>
        <span style={s.noToolCalls}>{t("trace.projectContext.notAvailable")}</span>
      </TraceSection>
    );
  }

  const { documents, total_tokens, omissions, attached_specs } = snapshot;

  return (
    <TraceSection
      icon="FileText"
      title={t("trace.projectContext.title")}
      right={<Badge color="var(--text-muted)">{documents.length}</Badge>}
    >
      {documents.length === 0 ? (
        <span style={s.noToolCalls}>{t("trace.projectContext.none")}</span>
      ) : (
        <>
          <div style={s.ctxDocList}>
            {documents.map((doc, i) => (
              <div key={`${doc.repo_id}:${doc.path}:${i}`} style={s.ctxDocRow}>
                <span className="mono" style={s.ctxDocPath}>
                  {doc.path}
                </span>
                <Badge color="var(--text-muted)">{doc.type}</Badge>
                <span className="mono" style={s.ctxDocRevision}>
                  {doc.revision}
                </span>
                <span className="mono tnum" style={s.ctxDocTokens}>
                  {t("trace.projectContext.docTokens", { count: doc.tokens })}
                </span>
              </div>
            ))}
          </div>
          <div style={s.ctxTotal}>{t("trace.projectContext.totalTokens", { count: total_tokens })}</div>
        </>
      )}

      {omissions.length > 0 && (
        <div style={s.ctxOmissionsWrap}>
          <div style={s.ctxOmissionsTitle}>{t("trace.projectContext.omissions")}</div>
          {omissions.map((om, i) => (
            <div key={`${om.repo_id}:${om.path}:${i}`} style={s.ctxOmissionRow}>
              <span className="mono" style={s.ctxDocPath}>
                {om.path}
              </span>
              <span style={s.ctxOmissionReason}>{t(`trace.projectContext.reason.${om.reason}`)}</span>
              {om.detail && <span style={s.ctxOmissionDetail}>{om.detail}</span>}
            </div>
          ))}
        </div>
      )}

      {attached_specs != null && (
        <PromptBlock
          label={t("trace.projectContext.attachedSpecsLabel")}
          text={attached_specs}
          color={PROMPT_COLORS.specs}
        />
      )}
    </TraceSection>
  );
}
