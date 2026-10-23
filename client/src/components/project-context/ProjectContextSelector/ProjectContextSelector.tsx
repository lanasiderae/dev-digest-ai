/* ProjectContextSelector — shared document picker for the Project Context
   Folder feature (L05 Feature 1). Two real consumers: the agent Context tab
   (`app/agents/[id]/_components/AgentEditor/_components/ContextTab`) and the
   skill "Project context to use" section
   (`app/skills/[id]/_components/SkillDetailPanel`) — per
   frontend-ui-architecture's rule of two, this lives under the cross-route
   `src/components/` tree, not colocated with either route.

   Controlled, like a form input: the caller owns `value`/`onChange` (the
   draft `ProjectContextSelectionList`) and persists it via its own existing
   save hook (`useUpdateAgent`/`useUpdateSkill`) — this component makes no
   save call itself. Discovery/preview make no model call either (CTX-AC-05). */
"use client";

import React from "react";
import { useTranslations } from "next-intl";
import { Icon, Checkbox, SelectInput, Skeleton, ErrorState, EmptyState, Button } from "@devdigest/ui";
import {
  DEFAULT_PROJECT_CONTEXT_ROOTS,
  MAX_PROJECT_CONTEXT_ATTACHMENTS,
  MAX_PROJECT_CONTEXT_DOCUMENT_BYTES,
  MAX_PROJECT_CONTEXT_DISCOVERED_DOCUMENTS,
} from "@/vendor/shared/contracts/project-context";
import type { ProjectContextSelectionList } from "@devdigest/shared";
import { useRepos, useSettings } from "../../../lib/hooks";
import { useProjectContextDiscovery, useProjectContextDocument } from "../../../lib/hooks/project-context";
import {
  computeTokenTotal,
  isPathSelected,
  mergeKnownTokens,
  missingSelectedPaths,
  selectedPathsForRepo,
  toggleSelectedPath,
  totalSelectedCount,
} from "./helpers";
import { s } from "./styles";

export interface ProjectContextSelectorProps {
  value: ProjectContextSelectionList;
  onChange: (next: ProjectContextSelectionList) => void;
}

export function ProjectContextSelector({ value, onChange }: ProjectContextSelectorProps) {
  const t = useTranslations("project-context");
  const { data: settings } = useSettings();
  const { data: repos, isLoading: reposLoading } = useRepos();

  const [activeRepoId, setActiveRepoId] = React.useState<string | null>(value[0]?.repo_id ?? null);
  const [search, setSearch] = React.useState("");
  const [previewPath, setPreviewPath] = React.useState<string | null>(null);
  const [knownTokens, setKnownTokens] = React.useState<Record<string, number>>({});

  // Default the repo picker once the list loads, if nothing is pre-selected.
  React.useEffect(() => {
    if (activeRepoId == null && repos && repos.length > 0) setActiveRepoId(repos[0]!.id);
  }, [activeRepoId, repos]);

  // Unfiltered listing — used to detect "selected but no longer discovered"
  // and to learn token estimates, independent of the current search text
  // (a search-filtered listing would otherwise make a selected, filtered-out
  // document look falsely "missing"). When `search` is empty this is the
  // exact same React Query cache entry as `filtered` below, so it costs no
  // extra request in the common case.
  const baseline = useProjectContextDiscovery(activeRepoId);
  const filtered = useProjectContextDiscovery(activeRepoId, search);

  React.useEffect(() => {
    if (!activeRepoId || !baseline.data) return;
    setKnownTokens((prev) => mergeKnownTokens(prev, activeRepoId, baseline.data!.documents));
  }, [activeRepoId, baseline.data]);

  const roots = settings?.project_context?.roots ?? DEFAULT_PROJECT_CONTEXT_ROOTS;
  const selectedPaths = activeRepoId ? selectedPathsForRepo(value, activeRepoId) : [];
  const missing = activeRepoId && baseline.data ? missingSelectedPaths(selectedPaths, baseline.data.documents) : [];
  const totalSelected = totalSelectedCount(value);
  const atCap = totalSelected >= MAX_PROJECT_CONTEXT_ATTACHMENTS;
  const { total: tokenTotal, unknownCount: tokenUnknown } = computeTokenTotal(value, knownTokens);

  const preview = useProjectContextDocument(activeRepoId, previewPath);

  const setPath = (path: string, selected: boolean) => {
    if (!activeRepoId) return;
    onChange(toggleSelectedPath(value, activeRepoId, path, selected));
  };

  const removeMissing = (path: string) => setPath(path, false);

  if (!reposLoading && (!repos || repos.length === 0)) {
    return <EmptyState icon="Folder" title={t("selector.noRepos")} />;
  }

  return (
    <div style={s.wrap}>
      <div style={s.rootsHint}>{t("selector.rootsHint", { roots: roots.join(", ") })}</div>

      <div style={s.controlsRow}>
        <div style={s.repoPicker}>
          <SelectInput
            value={activeRepoId ?? ""}
            onChange={(v) => setActiveRepoId(v)}
            options={(repos ?? []).map((r) => ({ value: r.id, label: r.full_name }))}
            mono={false}
          />
        </div>
        <div style={s.search}>
          <Icon.Search size={13} style={{ color: "var(--text-muted)" }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("selector.searchPlaceholder")}
            style={s.searchInput}
          />
        </div>
      </div>

      {missing.length > 0 && (
        <div style={s.banner("warn")}>
          <Icon.AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1, color: "var(--warn)" }} />
          <div>
            <div>{t("selector.missingWarning", { count: missing.length, paths: missing.join(", ") })}</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {missing.map((p) => (
                <Button key={p} kind="ghost" size="sm" title={p} onClick={() => removeMissing(p)}>
                  {t("selector.remove")}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {filtered.data?.truncated && (
        <div style={s.banner("muted")}>
          <Icon.Info size={14} style={{ flexShrink: 0, marginTop: 1, color: "var(--text-muted)" }} />
          <span>{t("selector.truncatedWarning", { max: MAX_PROJECT_CONTEXT_DISCOVERED_DOCUMENTS })}</span>
        </div>
      )}

      {atCap && (
        <div style={s.banner("warn")}>
          <Icon.AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1, color: "var(--warn)" }} />
          <span>{t("selector.attachmentCapWarning", { max: MAX_PROJECT_CONTEXT_ATTACHMENTS })}</span>
        </div>
      )}

      {filtered.isLoading ? (
        <Skeleton height={120} />
      ) : filtered.isError ? (
        <ErrorState body={t("selector.loadError")} />
      ) : (filtered.data?.documents.length ?? 0) === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          {search ? t("selector.noMatch") : t("selector.empty")}
        </div>
      ) : (
        <div style={s.list}>
          {filtered.data!.documents.map((doc) => {
            const checked = activeRepoId ? isPathSelected(value, activeRepoId, doc.path) : false;
            const disabled = doc.oversized || (atCap && !checked);
            return (
              <div key={doc.path} style={s.row(disabled)}>
                <Checkbox
                  checked={checked}
                  onChange={(v) => !disabled && setPath(doc.path, v)}
                  label={<span style={s.path}>{doc.path}</span>}
                />
                <span className="mono" style={s.typeChip}>
                  {t(`selector.type.${doc.type}`)}
                </span>
                {doc.oversized && (
                  <span style={{ fontSize: 11, color: "var(--warn)" }}>
                    {t("selector.oversizedBadge", { maxKb: Math.round(MAX_PROJECT_CONTEXT_DOCUMENT_BYTES / 1024) })}
                  </span>
                )}
                <Button kind="ghost" size="sm" icon="Eye" onClick={() => setPreviewPath(doc.path)}>
                  {t("selector.preview")}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <div style={s.footer}>
        <span>{t("selector.selectedCount", { count: totalSelected })}</span>
        <span>
          {t("selector.tokensTotal", { tokens: tokenTotal })}{" "}
          {tokenUnknown > 0 && t("selector.tokensUnknown", { count: tokenUnknown })}
        </span>
      </div>

      {previewPath && (
        <div style={s.previewPanel}>
          <div style={s.previewHeader}>
            <strong style={{ fontSize: 13 }}>{t("selector.previewTitle", { path: previewPath })}</strong>
            <Button kind="ghost" size="sm" icon="X" onClick={() => setPreviewPath(null)}>
              {t("selector.previewClose")}
            </Button>
          </div>
          {preview.isLoading ? (
            <Skeleton height={80} />
          ) : preview.isError ? (
            <ErrorState body={t("selector.previewLoadError")} />
          ) : (
            <>
              <pre style={s.previewBody}>{preview.data?.content}</pre>
              {preview.data && (
                <span style={{ fontSize: 11.5, color: "var(--text-muted)" }}>
                  {t("selector.previewTokens", { tokens: preview.data.tokens_estimate })}
                </span>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
