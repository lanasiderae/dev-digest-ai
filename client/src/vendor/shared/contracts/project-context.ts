import { z } from 'zod';

/**
 * Project Context Folder (L05, Feature 1).
 *
 * Manual, repository-scoped Markdown-document selection for an agent/skill,
 * plus the discovery/preview API shapes and the omission/snapshot metadata
 * surfaced in a review's trace. Distinct from the pre-existing, unrelated
 * `platform.ts` `SpecFile`/`IndexStatus` pair (repo-intel's code-chunk
 * embedding/indexing pipeline) and from `skills.ts`'s `evidence_files`
 * (a different, pre-existing feature) — neither is attachment storage for
 * this feature.
 *
 * Selection metadata stores PATHS ONLY (never document bodies); the actual
 * text sent to a model is a separate, non-versioned run-trace snapshot (see
 * `ProjectContextSnapshot` below and `trace.ts`'s `RunTrace.project_context`).
 * No attachment-versioning is introduced here.
 */

// ---- Discovery roots / caps ----

/** C4 default discovery root, confined to the imported repository; no host
    paths. Nested matching directories are discovered recursively. */
export const DEFAULT_PROJECT_CONTEXT_ROOTS: string[] = ['**/{specs,docs,insights}/**/*.md'];

/** C5: 100 attachments max per agent/skill (total selected paths across every
    repo entry), enforced here via a Zod refinement, not a DB constraint. */
export const MAX_PROJECT_CONTEXT_ATTACHMENTS = 100;

/** C5: 256 KiB per document. */
export const MAX_PROJECT_CONTEXT_DOCUMENT_BYTES = 256 * 1024;

/** C5: 2,000 discovered documents per repository. */
export const MAX_PROJECT_CONTEXT_DISCOVERED_DOCUMENTS = 2000;

// ---- Selection metadata (stored on an agent/skill) ----

/** One repository's selected paths, in save order. `paths` are normalized
    relative paths, not document bodies. */
export const ProjectContextSelection = z.object({
  repo_id: z.string(),
  paths: z.array(z.string()),
});
export type ProjectContextSelection = z.infer<typeof ProjectContextSelection>;

/** The full selection metadata stored on an agent or skill: an ordered list
    of per-repository selections, capped at `MAX_PROJECT_CONTEXT_ATTACHMENTS`
    total paths across every entry. Default empty — selecting nothing is the
    healthy-empty case, not "unavailable". */
export const ProjectContextSelectionList = z
  .array(ProjectContextSelection)
  .default([])
  .refine(
    (list) => list.reduce((n, sel) => n + sel.paths.length, 0) <= MAX_PROJECT_CONTEXT_ATTACHMENTS,
    { message: `at most ${MAX_PROJECT_CONTEXT_ATTACHMENTS} attached documents total` },
  );
export type ProjectContextSelectionList = z.infer<typeof ProjectContextSelectionList>;

// ---- Discovery / preview (GET /repos/:id/project-context[/document]) ----

/** `specs`/`docs`/`insights` are the three C4 default-root categories;
    `custom` is any other configured root. */
export const ProjectContextDocumentType = z.enum(['specs', 'docs', 'insights', 'custom']);
export type ProjectContextDocumentType = z.infer<typeof ProjectContextDocumentType>;

export const ProjectContextDiscoveryQuery = z.object({
  search: z.string().optional(),
});
export type ProjectContextDiscoveryQuery = z.infer<typeof ProjectContextDiscoveryQuery>;

export const ProjectContextDocumentQuery = z.object({
  path: z.string().min(1),
});
export type ProjectContextDocumentQuery = z.infer<typeof ProjectContextDocumentQuery>;

/** One discovered document. `size_bytes`/`tokens_estimate` are null when they
    could not be read (e.g. a broken symlink entry skipped at discovery time);
    `oversized` is true when `size_bytes` exceeds `MAX_PROJECT_CONTEXT_DOCUMENT_BYTES`
    — such a document is listed (so the user understands why it's excluded)
    but is not selectable/readable. */
export const ProjectContextDiscoveredDocument = z.object({
  repo_id: z.string(),
  path: z.string(),
  type: ProjectContextDocumentType,
  size_bytes: z.number().int().nullable(),
  /** Heuristic/estimated token count (not a model-reported actual). */
  tokens_estimate: z.number().int().nullable(),
  updated_at: z.string().nullable(),
  oversized: z.boolean(),
});
export type ProjectContextDiscoveredDocument = z.infer<typeof ProjectContextDiscoveredDocument>;

export const ProjectContextDiscoveryResponse = z.object({
  repo_id: z.string(),
  /** The pinned synced default-branch clone revision this discovery ran
      against — distinct from any PR head SHA. */
  revision: z.string(),
  documents: z.array(ProjectContextDiscoveredDocument),
  /** True when discovery hit `MAX_PROJECT_CONTEXT_DISCOVERED_DOCUMENTS` and
      stopped early (deterministic order, so the same prefix truncates). */
  truncated: z.boolean(),
});
export type ProjectContextDiscoveryResponse = z.infer<typeof ProjectContextDiscoveryResponse>;

/** View-only preview of one document's actual text — never an edit surface. */
export const ProjectContextPreview = z.object({
  repo_id: z.string(),
  path: z.string(),
  type: ProjectContextDocumentType,
  revision: z.string(),
  content: z.string(),
  tokens_estimate: z.number().int(),
});
export type ProjectContextPreview = z.infer<typeof ProjectContextPreview>;

// ---- Omissions (shared by discovery/preview failures and the trace) ----

export const ProjectContextOmissionReason = z.enum([
  /** Selected path no longer exists at the pinned revision. */
  'missing',
  /** Exceeds the 256 KiB per-document cap. */
  'oversized',
  /** Traversal/absolute-path/symlink escape rejected. */
  'unsafe_path',
  /** Path belonged to a repository other than the one being reviewed. */
  'cross_repo',
  /** Dropped (as a whole document) to fit the attached-block token budget. */
  'budget',
  /** Deduplicated — an earlier (direct-agent, or earlier-ordered skill)
      selection already included this path. */
  'duplicate',
]);
export type ProjectContextOmissionReason = z.infer<typeof ProjectContextOmissionReason>;

export const ProjectContextOmission = z.object({
  repo_id: z.string(),
  path: z.string(),
  reason: ProjectContextOmissionReason,
  detail: z.string().nullable(),
});
export type ProjectContextOmission = z.infer<typeof ProjectContextOmission>;

// ---- Trace snapshot (what a review actually sent — see trace.ts) ----

/** One document actually included in a review's "## Project context" block. */
export const ProjectContextDocumentTrace = z.object({
  repo_id: z.string(),
  path: z.string(),
  type: ProjectContextDocumentType,
  revision: z.string(),
  /** Actual token count of this document's rendered text, including its
      injection-wrapper overhead (delimiters/heading) — not an estimate. */
  tokens: z.number().int(),
});
export type ProjectContextDocumentTrace = z.infer<typeof ProjectContextDocumentTrace>;

/** Persisted distinctly from `ProjectContextSelection` (path-only metadata):
    this is what was actually resolved and sent for one run. `attached_specs`
    is the full guarded snapshot text actually sent under "## Project
    context" — the UI's expandable trace section is labeled literally
    `project context attached specs` and renders exactly this field; null
    when no project-context documents were resolved for this run (healthy
    empty — no agent/skill selections — is `documents: [], attached_specs:
    null`, same as "nothing eligible"; there is no separate "unavailable"
    state for this snapshot since resolution never fails the run itself). */
export const ProjectContextSnapshot = z.object({
  documents: z.array(ProjectContextDocumentTrace),
  /** Sum of every included document's `tokens`, including wrapper overhead. */
  total_tokens: z.number().int(),
  omissions: z.array(ProjectContextOmission),
  attached_specs: z.string().nullable(),
});
export type ProjectContextSnapshot = z.infer<typeof ProjectContextSnapshot>;
