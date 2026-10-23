/* hooks/project-context.ts — React Query hooks for the Project Context
   Folder feature (L05 Feature 1): discovery/preview over the server's
   `GET /repos/:id/project-context[/document]` routes.

   There is deliberately no `useSaveProjectContextSelection` here — CTX-AC-04
   persists `ProjectContextSelectionList` as one more field on an agent/skill
   (`Agent.project_context`/`Skill.project_context`), so saving reuses the
   EXISTING `useUpdateAgent`/`useUpdateSkill` hooks (see their
   `patch.project_context` note) rather than a parallel save path. */
"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "../api";
import type { ProjectContextDiscoveryResponse, ProjectContextPreview } from "@devdigest/shared";

/** Discover eligible Markdown documents under the workspace's configured
 *  roots for one repository, optionally filtered by `search`. Read-only —
 *  makes no model call and selects nothing itself. */
export function useProjectContextDiscovery(repoId: string | null | undefined, search?: string) {
  const q = search?.trim();
  return useQuery({
    queryKey: ["project-context", repoId, q ?? ""],
    queryFn: () =>
      api.get<ProjectContextDiscoveryResponse>(
        `/repos/${repoId}/project-context${q ? `?search=${encodeURIComponent(q)}` : ""}`,
      ),
    enabled: !!repoId,
  });
}

/** View-only preview of one discovered document's actual text. Fetched on
 *  demand (the user clicks "Preview"), not eagerly for every discovered row. */
export function useProjectContextDocument(repoId: string | null | undefined, path: string | null) {
  return useQuery({
    queryKey: ["project-context-document", repoId, path],
    queryFn: () =>
      api.get<ProjectContextPreview>(
        `/repos/${repoId}/project-context/document?path=${encodeURIComponent(path!)}`,
      ),
    enabled: !!repoId && !!path,
  });
}
