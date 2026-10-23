/* /repos/:repoId/onboarding — Onboarding Tour (L05 Feature 3, TASK-11).
   Repo-scoped guided tour, distinct from the pre-existing, unrelated
   `/onboarding` (no :repoId) add-repository screen — see client/INSIGHTS.md's
   note on the two same-named-in-English features; that other route/feature is
   intentionally untouched by this one. Mirrors
   `app/repos/[repoId]/conventions/_components/ConventionsView`'s shape: a
   thin AppShell wrapper with repo-not-found handling, delegating the actual
   content to a colocated, independently-testable sub-component. */
"use client";

import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AppShell } from "@/components/app-shell";
import { RepoNotFound } from "@/components/repo-not-found";
import { useActiveRepo, useRepoNotFound } from "@/lib/repo-context";
import { OnboardingTourPanel } from "./_components/OnboardingTourPanel";
import { s } from "./styles";

export function OnboardingTourView() {
  const t = useTranslations("onboarding-tour");
  const params = useParams<{ repoId: string }>();
  const repoId = params.repoId;
  const { activeRepo } = useActiveRepo();
  const repoNotFound = useRepoNotFound(repoId);

  const repoName = activeRepo?.full_name ?? repoId;
  const crumb = [{ label: repoName, mono: true }, { label: t("title") }];

  if (repoNotFound) {
    return (
      <AppShell crumb={crumb}>
        <RepoNotFound />
      </AppShell>
    );
  }

  return (
    <AppShell crumb={crumb}>
      <div style={s.pageHeader}>
        <div>
          <h1 style={s.pageTitle}>{t("title")}</h1>
          <p style={s.pageSubtitle}>{t("subtitle")}</p>
        </div>
      </div>
      <div style={s.body}>
        <OnboardingTourPanel repoId={repoId} repoFullName={activeRepo?.full_name} />
      </div>
    </AppShell>
  );
}
