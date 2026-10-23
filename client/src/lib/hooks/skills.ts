/* hooks/skills.ts — React Query hooks for the Skills Lab page + editor. */
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import type { ProjectContextSelectionList, Skill, SkillSource, SkillType, SkillVersion } from "@devdigest/shared";

export function useSkills() {
  return useQuery({
    queryKey: ["skills"],
    queryFn: () => api.get<Skill[]>("/skills"),
  });
}

export function useSkill(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill", id],
    queryFn: () => api.get<Skill>(`/skills/${id}`),
    enabled: !!id,
  });
}

export function useSkillVersions(id: string | null | undefined) {
  return useQuery({
    queryKey: ["skill-versions", id],
    queryFn: () => api.get<SkillVersion[]>(`/skills/${id}/versions`),
    enabled: !!id,
  });
}

/** A single version's body snapshot — fetched on demand (diff/restore),
 *  not eagerly for every row in the version list. */
export function useSkillVersion(id: string | null | undefined, version: number | null) {
  return useQuery({
    queryKey: ["skill-version", id, version],
    queryFn: () => api.get<SkillVersion>(`/skills/${id}/versions/${version}`),
    enabled: !!id && version != null,
  });
}

export interface CreateSkillInput {
  name: string;
  description: string;
  type: SkillType;
  body: string;
  source?: SkillSource;
  enabled?: boolean;
  evidence_files?: string[];
}

export function useCreateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSkillInput) => api.post<Skill>("/skills", input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["skills"] }),
  });
}

export interface UpdateSkillInput {
  id: string;
  patch: Partial<Pick<Skill, "name" | "description" | "type" | "body" | "enabled">> & {
    // `project_context` (L05 CTX-AC-04) isn't on the `Skill` contract yet —
    // CRUD threading lands in TASK-04. Carried here as a forward-compatible
    // extra field on the SAME existing PUT /skills/:id call (not a parallel
    // save path), matching `UpdateAgentInput`'s identical note in
    // lib/hooks/agents.ts.
    project_context?: ProjectContextSelectionList;
  };
}

export function useUpdateSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateSkillInput) => api.put<Skill>(`/skills/${id}`, patch),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.setQueryData(["skill", data.id], data);
      qc.invalidateQueries({ queryKey: ["skill-versions", data.id] });
    },
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.del<{ ok: boolean }>(`/skills/${id}`),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["skills"] });
      qc.removeQueries({ queryKey: ["skill", id] });
      // Deleting a skill cascades its agent_skills links server-side —
      // whichever agents had it linked need their skill_count refetched.
      qc.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export interface ImportPreview {
  name?: string;
  body: string;
}

/** Preview-only: fetches a URL server-side. Nothing is persisted, so no
 *  cache invalidation — the confirm step is a normal useCreateSkill() call. */
export function useImportSkillUrl() {
  return useMutation({
    mutationFn: (url: string) => api.post<ImportPreview>("/skills/import/url", { url }),
  });
}

export interface ArchiveImportCandidate {
  path: string;
  body: string;
}

export interface ArchiveImportPreview {
  name?: string;
  body: string;
  candidates: ArchiveImportCandidate[];
  resolvedIndex?: number;
}

/** Preview-only: uploads + parses a .zip archive server-side. Nothing is
 *  persisted — same confirm step as the URL-import flow. */
export function useImportSkillArchive() {
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file, file.name);
      return api.postForm<ArchiveImportPreview>("/skills/import/archive", form);
    },
  });
}
