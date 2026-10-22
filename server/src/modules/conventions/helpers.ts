import { z } from 'zod';
import type { ConventionCandidate } from '@devdigest/shared';
import type { ConventionRow, InsertConvention } from './repository.js';

/**
 * Pure helpers for the conventions module — DB row ⇄ DTO mapping, the raw
 * LLM output schema, and code-based evidence validation. No I/O.
 */

/** Map a persisted convention row to the public `ConventionCandidate` DTO. */
export function toConventionDto(row: ConventionRow): ConventionCandidate {
  return {
    id: row.id,
    rule: row.rule,
    evidence_path: row.evidencePath ?? '',
    evidence_snippet: row.evidenceSnippet ?? '',
    confidence: row.confidence ?? 0,
    accepted: row.accepted,
    rejected: row.rejected,
  };
}

/** Raw shape the LLM is asked to return — one candidate per detected rule. */
export const LlmConventionCandidate = z.object({
  category: z.string(),
  rule: z.string(),
  evidence: z.object({
    file: z.string(),
    line: z.number().int().positive(),
  }),
  confidence: z.number().min(0).max(1),
});
export type LlmConventionCandidate = z.infer<typeof LlmConventionCandidate>;

export const LlmConventionExtraction = z.object({
  candidates: z.array(LlmConventionCandidate),
});
export type LlmConventionExtraction = z.infer<typeof LlmConventionExtraction>;

/** One sampled file's content, keyed by its repo-relative path. */
export type SampleFiles = Map<string, string>;

/**
 * Code-based validation of a raw LLM candidate's evidence: the cited file
 * must be one of the files actually sampled (never a file the model
 * hallucinated), and the cited line must fall within that file's real line
 * count. Candidates that fail either check are discarded, not repaired.
 */
export function validateEvidence(candidate: LlmConventionCandidate, samples: SampleFiles): boolean {
  const content = samples.get(candidate.evidence.file);
  if (content === undefined) return false;
  const lineCount = content.split('\n').length;
  return candidate.evidence.line >= 1 && candidate.evidence.line <= lineCount;
}

/** The evidence snippet stored for a validated candidate: the cited line,
 *  trimmed, falling back to the rule text itself only if the line is blank. */
export function snippetForEvidence(candidate: LlmConventionCandidate, samples: SampleFiles): string {
  const content = samples.get(candidate.evidence.file) ?? '';
  const lines = content.split('\n');
  const line = lines[candidate.evidence.line - 1]?.trim();
  return line || candidate.rule;
}

/** Map a validated LLM candidate to an insertable row. */
export function toInsertConvention(
  workspaceId: string,
  repoId: string,
  candidate: LlmConventionCandidate,
  samples: SampleFiles,
): InsertConvention {
  return {
    workspaceId,
    repoId,
    rule: candidate.rule,
    evidencePath: candidate.evidence.file,
    evidenceSnippet: snippetForEvidence(candidate, samples),
    confidence: candidate.confidence,
  };
}
