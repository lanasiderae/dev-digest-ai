import { z } from 'zod';

/**
 * PR Brief building blocks: Intent, Blast radius, Risks, PR History,
 * Smart Diff. Composed into PrBrief.
 */

// ---- Intent ----
export const Intent = z.object({
  intent: z.string(),
  in_scope: z.array(z.string()),
  out_of_scope: z.array(z.string()),
});
export type Intent = z.infer<typeof Intent>;

// ---- Blast radius ----
export const ChangedSymbol = z.object({
  name: z.string(),
  file: z.string(),
  kind: z.string(),
});
export type ChangedSymbol = z.infer<typeof ChangedSymbol>;

export const BlastCaller = z.object({
  name: z.string(),
  file: z.string(),
  line: z.number().int(),
});
export type BlastCaller = z.infer<typeof BlastCaller>;

export const DownstreamImpact = z.object({
  symbol: z.string(),
  callers: z.array(BlastCaller),
  endpoints_affected: z.array(z.string()),
  crons_affected: z.array(z.string()),
});
export type DownstreamImpact = z.infer<typeof DownstreamImpact>;

export const BlastRadius = z.object({
  changed_symbols: z.array(ChangedSymbol),
  downstream: z.array(DownstreamImpact),
  summary: z.string(),
});
export type BlastRadius = z.infer<typeof BlastRadius>;

// ---- Risks ----
export const RiskSeverity = z.enum(['high', 'medium', 'low']);
export type RiskSeverity = z.infer<typeof RiskSeverity>;

export const Risk = z.object({
  kind: z.string(),
  title: z.string(),
  explanation: z.string(),
  severity: RiskSeverity,
  file_refs: z.array(z.string()),
});
export type Risk = z.infer<typeof Risk>;

export const Risks = z.object({
  risks: z.array(Risk),
});
export type Risks = z.infer<typeof Risks>;

// ---- PR History ----
export const PrHistoryItem = z.object({
  pr_number: z.number().int(),
  title: z.string(),
  merged_at: z.string(),
  author: z.string(),
  files_overlap: z.array(z.string()),
  notes: z.string(),
});
export type PrHistoryItem = z.infer<typeof PrHistoryItem>;

export const PrHistory = z.object({
  history: z.array(PrHistoryItem),
});
export type PrHistory = z.infer<typeof PrHistory>;

// ---- Smart Diff ----
export const SmartDiffRole = z.enum(['core', 'tests', 'wiring', 'docs', 'boilerplate']);
export type SmartDiffRole = z.infer<typeof SmartDiffRole>;

export const SmartDiffFile = z.object({
  path: z.string(),
  pseudocode_summary: z.string().nullish(),
  additions: z.number().int(),
  deletions: z.number().int(),
  finding_lines: z.array(z.number().int()),
});
export type SmartDiffFile = z.infer<typeof SmartDiffFile>;

export const SmartDiffGroup = z.object({
  role: SmartDiffRole,
  files: z.array(SmartDiffFile),
});
export type SmartDiffGroup = z.infer<typeof SmartDiffGroup>;

export const ProposedSplit = z.object({
  name: z.string(),
  files: z.array(z.string()),
});
export type ProposedSplit = z.infer<typeof ProposedSplit>;

export const SmartDiff = z.object({
  groups: z.array(SmartDiffGroup),
  split_suggestion: z.object({
    too_big: z.boolean(),
    total_lines: z.number().int(),
    proposed_splits: z.array(ProposedSplit),
  }),
});
export type SmartDiff = z.infer<typeof SmartDiff>;

// ---- Review focus (file:line navigation into Files changed) ----
export const ReviewFocusItem = z.object({
  file: z.string(),
  /** 1-based; exact-line diff navigation uses existing diff metadata, never
      a line fed to/invented by the model from raw hunks. */
  line: z.number().int().positive(),
  reason: z.string(),
});
export type ReviewFocusItem = z.infer<typeof ReviewFocusItem>;

// ---- Source availability / degradation (never silently healthy-empty) ----
export const BriefSourceStatus = z.enum(['available', 'degraded', 'unavailable']);
export type BriefSourceStatus = z.infer<typeof BriefSourceStatus>;

export const BriefSource = z.object({
  status: BriefSourceStatus,
  /** Human-readable reason when `status !== 'available'`. For
      `reviewer_context`, the literal "Reviewer context not selected." is the
      expected C2 case, not an error. Null when available. */
  reason: z.string().nullable(),
});
export type BriefSource = z.infer<typeof BriefSource>;

/** One source per generation input that can be missing/degraded without
    blocking generation (BRIEF-AC-02). */
export const BriefSources = z.object({
  intent: BriefSource,
  blast: BriefSource,
  issue: BriefSource,
  reviewer_context: BriefSource,
  documents: BriefSource,
});
export type BriefSources = z.infer<typeof BriefSources>;

// ---- Generation provenance (cached-generation identity, never the live
// reviewer-selector state — see plan finding D1: these must never be
// rendered/stored as the same field) ----
export const BriefDocumentProvenance = z.object({
  repo_id: z.string(),
  path: z.string(),
  /** The pinned clone revision this document was read at; null if unknown. */
  revision: z.string().nullable(),
  /** Content digest, for change detection independent of path/revision. */
  digest: z.string().nullable(),
});
export type BriefDocumentProvenance = z.infer<typeof BriefDocumentProvenance>;

export const BriefProvenance = z.object({
  /** Explicit reviewer agent id used for THIS generation; null means no
      reviewer was selected for this generation — never inferred from a
      prior run (C2). Read-only cached-generation identity; the live
      reviewer-selector control for the NEXT regeneration is a separate
      field/value owned by the API request, not this one. */
  reviewer_agent_id: z.string().nullable(),
  /** Enabled safe skill ids attached to that reviewer, resolution order. */
  skill_ids: z.array(z.string()),
  documents: z.array(BriefDocumentProvenance),
  /** Explicit PR-linked spec path, when unioned in under C2; null otherwise. */
  pr_linked_spec_path: z.string().nullable(),
  /** PR head SHA this brief was generated against. */
  head_sha: z.string(),
  /** Deterministic fingerprint of {reviewer_agent_id, skill_ids, documents,
      order} — lets the API detect a changed context selection independently
      of head_sha movement. */
  context_fingerprint: z.string(),
  generated_at: z.string(),
});
export type BriefProvenance = z.infer<typeof BriefProvenance>;

// ---- Composed PR Brief (pr_brief.json) ----
export const PrBrief = z.object({
  summary: z.string(),
  /** Null when Intent was never derived / is unavailable for this PR — NOT
      the same as a derived Intent with empty in/out-of-scope lists, which is
      a healthy-empty `Intent` value, never represented as null. */
  intent: Intent.nullable(),
  /** Null when Blast Radius couldn't be computed (e.g. repo-intel disabled
      or index unavailable) — NOT the same as a computed `BlastRadius` with
      no changed symbols/downstream impact, which stays a healthy-empty
      object, never null. */
  blast: BlastRadius.nullable(),
  risks: Risks,
  history: PrHistory,
  review_focus: z.array(ReviewFocusItem),
  sources: BriefSources,
  provenance: BriefProvenance,
});
export type PrBrief = z.infer<typeof PrBrief>;
