/* /repos/:repoId/conventions — scan the cloned repo for implicit conventions,
   accept/reject the evidence-backed candidates, then combine the accepted
   ones into a single `repo-conventions` Skill via the (generalized)
   CreateSkillModal. */
"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, EmptyState, ErrorState, Skeleton } from "@devdigest/ui";
import { AppShell } from "@/components/app-shell";
import { RepoNotFound } from "@/components/repo-not-found";
import { useActiveRepo, useRepoNotFound } from "@/lib/repo-context";
import { useConventions, useExtractConventions, useUpdateConvention } from "@/lib/hooks/conventions";
import { useSetAgentSkills } from "@/lib/hooks/agents";
import { api, ApiError } from "@/lib/api";
import { CreateSkillModal } from "@/app/skills/_components/SkillsListView/_components/CreateSkillModal";
import { githubRepoUrl } from "@/lib/github-urls";
import type { Agent, AgentSkillLink } from "@devdigest/shared";
import { ConventionCard } from "./_components/ConventionCard";
import { buildSkillDraft } from "./helpers";
import { s } from "./styles";

const SKELETON_ROWS = 3;

export function ConventionsView() {
  const t = useTranslations("conventions");
  const params = useParams<{ repoId: string }>();
  const repoId = params.repoId;
  const router = useRouter();
  const { activeRepo } = useActiveRepo();
  const repoNotFound = useRepoNotFound(repoId);
  const { data: candidates, isLoading, isError, error, refetch } = useConventions(repoId);
  const extract = useExtractConventions(repoId);
  const update = useUpdateConvention(repoId);
  const setAgentSkills = useSetAgentSkills();
  const [creatingSkill, setCreatingSkill] = React.useState(false);

  const repoName = activeRepo?.full_name ?? t("page.repoFallback");
  const list = candidates ?? [];
  // Rejected candidates stay persisted (so a re-scan never re-proposes
  // them), but they're hidden from the working list — rejecting one should
  // visibly remove it, not just leave it sitting there dimmed.
  const visibleList = list.filter((c) => !c.rejected);
  const accepted = list.filter((c) => c.accepted);

  // Link the new repo-conventions skill to an agent, same as #42 requires —
  // reuses the existing agent↔skill mechanism (Agent editor's Skills tab)
  // instead of adding a picker to the modal (which #51 doesn't call for).
  // Best-effort: the skill is already saved either way, and can still be
  // linked by hand from the Agent editor if this fails.
  const linkToDefaultAgent = async (skillId: string) => {
    try {
      const agents = await api.get<Agent[]>("/agents");
      const target = agents.find((a) => a.enabled) ?? agents[0];
      if (!target) return;
      const links = await api.get<AgentSkillLink[]>(`/agents/${target.id}/skills`);
      await setAgentSkills.mutateAsync({
        agentId: target.id,
        skillIds: [...links.map((l) => l.skill_id), skillId],
      });
    } catch {
      // swallow — best-effort
    }
  };

  const crumb = [{ label: t("page.crumbLab") }, { label: t("page.crumbConventions") }];

  if (repoNotFound) {
    return (
      <AppShell crumb={crumb}>
        <RepoNotFound />
      </AppShell>
    );
  }

  return (
    <AppShell crumb={crumb}>
      {creatingSkill && (
        <CreateSkillModal
          onClose={() => setCreatingSkill(false)}
          onCreated={(skillId) => {
            setCreatingSkill(false);
            void linkToDefaultAgent(skillId);
            router.push(`/skills/${skillId}`);
          }}
          initial={buildSkillDraft(repoName, accepted)}
        />
      )}

      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>
            {t("page.headingPrefix")}
            {activeRepo ? (
              <a
                href={githubRepoUrl(repoName)}
                target="_blank"
                rel="noopener noreferrer"
                style={s.repoLink}
              >
                {repoName}
              </a>
            ) : (
              repoName
            )}
          </h1>
          <p style={s.pageSubtitle}>
            {visibleList.length > 0
              ? t("page.candidateCount", { count: visibleList.length })
              : t("page.subtitle")}
          </p>
        </div>
        {list.length > 0 ? (
          <Button
            kind="primary"
            icon="RefreshCw"
            loading={extract.isPending}
            disabled={extract.isPending}
            onClick={() => extract.mutate()}
          >
            {extract.isPending ? t("page.scanning") : t("page.rescan")}
          </Button>
        ) : (
          <Button
            kind="primary"
            icon="RefreshCw"
            loading={extract.isPending}
            disabled={extract.isPending}
            onClick={() => extract.mutate()}
          >
            {extract.isPending ? t("page.scanning") : t("page.runExtraction")}
          </Button>
        )}
      </div>

      {extract.isError && (
        <div style={s.errorBanner}>
          {t("page.extractionFailed")}
          {extract.error instanceof ApiError ? `: ${extract.error.message}` : ""}
        </div>
      )}

      {visibleList.length > 0 && (
        <div style={s.toolbar}>
          <span style={s.acceptedCount}>
            {t("page.acceptedOf", { accepted: accepted.length, total: visibleList.length })}
          </span>
          <div style={s.toolbarActions}>
            <Button
              kind="ghost"
              size="sm"
              disabled={accepted.length === 0 || update.isPending}
              onClick={() => {
                for (const c of accepted) {
                  update.mutate({ id: c.id, patch: { accepted: false, rejected: false } });
                }
              }}
            >
              {t("page.deselectAll")}
            </Button>
            {accepted.length > 0 && (
              <Button kind="primary" size="sm" icon="Sparkles" onClick={() => setCreatingSkill(true)}>
                {t("page.createSkill")}
              </Button>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div style={s.loadingStack}>
          {Array.from({ length: SKELETON_ROWS }).map((_, i) => (
            <Skeleton key={i} height={96} />
          ))}
        </div>
      ) : isError ? (
        <div style={s.emptyWrap}>
          <ErrorState
            title={t("page.loadError")}
            body={error instanceof ApiError ? error.message : ""}
            onRetry={() => refetch()}
          />
        </div>
      ) : visibleList.length === 0 ? (
        <div style={s.emptyWrap}>
          <EmptyState
            icon="ListChecks"
            title={t("page.empty.title")}
            body={t("page.empty.body")}
            cta={t("page.empty.cta")}
            onCta={() => extract.mutate()}
          />
        </div>
      ) : (
        <div style={s.list}>
          {visibleList.map((c) => (
            <ConventionCard
              key={c.id}
              candidate={c}
              pending={update.isPending}
              onAccept={() => update.mutate({ id: c.id, patch: { accepted: true, rejected: false } })}
              onReject={() => update.mutate({ id: c.id, patch: { accepted: false, rejected: true } })}
              onEditRule={(rule) => update.mutate({ id: c.id, patch: { rule } })}
            />
          ))}
        </div>
      )}
    </AppShell>
  );
}
