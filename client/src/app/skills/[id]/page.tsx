/* /skills/:id — Skill detail/editor. Left skill list + preview/edit panel.
   Mirrors /agents/[id]/page.tsx's two-pane layout. */
"use client";

import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button, ErrorState, Skeleton } from "@devdigest/ui";
import { AppShell } from "../../../components/app-shell";
import { SkillCard } from "../_components/SkillCard";
import { SkillDetailPanel } from "./_components/SkillDetailPanel";
import { useSkills, useSkill, useUpdateSkill } from "../../../lib/hooks/skills";
import { ApiError } from "../../../lib/api";
import { usePageTitle } from "../../../lib/use-page-title";

export default function SkillDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations("skills");
  const { id } = params;

  const { data: skills } = useSkills();
  const { data: skill, isLoading, isError, error, refetch } = useSkill(id);
  const update = useUpdateSkill();
  usePageTitle(skill?.name ?? null);

  const crumb = [
    { label: t("page.crumbLab") },
    { label: t("page.crumbSkills"), href: "/skills" },
    { label: skill?.name ?? t("detail.crumbSkill") },
  ];

  if (isError || (!isLoading && !skill)) {
    return (
      <AppShell crumb={crumb}>
        <ErrorState
          fullScreen
          title={t("detail.notFound.title")}
          body={error instanceof ApiError ? error.message : t("detail.notFound.body")}
          onRetry={() => refetch()}
        />
      </AppShell>
    );
  }

  return (
    <AppShell crumb={crumb}>
      <div style={{ display: "flex", height: "calc(100vh - 52px)" }}>
        <div
          style={{
            width: 280,
            flexShrink: 0,
            borderRight: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            background: "var(--bg-surface)",
          }}
        >
          <div style={{ padding: "16px 16px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, flex: 1 }}>{t("page.heading")}</h1>
              <Button kind="secondary" size="sm" icon="ChevronLeft" onClick={() => router.push("/skills")}>
                {t("detail.back")}
              </Button>
            </div>
          </div>
          <div style={{ flex: 1, overflow: "auto", padding: "0 12px 12px" }}>
            {(skills ?? []).map((sk) => (
              <SkillCard
                key={sk.id}
                skill={sk}
                active={sk.id === id}
                onClick={() => router.push(`/skills/${sk.id}`)}
                onToggle={(enabled) => update.mutate({ id: sk.id, patch: { enabled } })}
              />
            ))}
          </div>
        </div>

        {isLoading || !skill ? (
          <div style={{ flex: 1, padding: 28, display: "flex", flexDirection: "column", gap: 16 }}>
            <Skeleton height={24} width={240} />
            <Skeleton height={200} />
          </div>
        ) : (
          <SkillDetailPanel key={skill.id} skill={skill} />
        )}
      </div>
    </AppShell>
  );
}
