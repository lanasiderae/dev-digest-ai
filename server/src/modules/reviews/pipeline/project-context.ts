import type {
  ModelInfo,
  ProjectContextDocumentTrace,
  ProjectContextOmission,
  ProjectContextSnapshot,
} from '@devdigest/shared';
import { wrapUntrusted } from '@devdigest/reviewer-core';
import { estimateWithEncoding, resolveContextWindowTokens, type Tokenizer } from '../../../adapters/tokenizer/index.js';
import type { ResolvedProjectContextDocument } from '../../project-context/service.js';

/**
 * Pure (no I/O, no container) project-context attach-budget logic for a
 * review run (L05/TASK-06 — CTX-AC-05/06/08/09). Everything DB/git-backed
 * (resolving selections, reading document bodies) stays in
 * `run-executor.ts`'s orchestration + `ProjectContextService.resolveDocuments`;
 * this file only decides HOW MUCH of what was already read fits the
 * attached-block budget, and assembles the exact text/snapshot sent.
 */

/**
 * C5/C7 — the `## Project context` attached-block token budget: 20% of the
 * resolved model's context window, clamped to [4,000, 32,000], when the
 * model's real window is known. When it is NOT known,
 * `resolveContextWindowTokens`'s own 16,000 fallback is used directly AS
 * THE BUDGET rather than being run through the 20%/clamp formula — 20% of
 * that same 16,000 fallback would be 3,200, which the clamp would then push
 * back UP to the 4,000 floor, silently discarding the spec's literal
 * "falling back to 16,000" figure (C5: "Attached-block budget is 20% of the
 * selected model context window, clamped to 4,000–32,000 tokens, falling
 * back to 16,000 when unknown"). Treating "unknown window" as "budget =
 * 16,000 flat" is the reading that actually produces 16,000 in that case.
 */
export function resolveProjectContextBudgetTokens(modelInfo: ModelInfo | null | undefined): number {
  const windowTokens = resolveContextWindowTokens(modelInfo);
  const hasKnownWindow = typeof modelInfo?.contextLength === 'number' && modelInfo.contextLength > 0;
  if (!hasKnownWindow) return windowTokens; // already DEFAULT_CONTEXT_WINDOW_TOKENS (16,000)
  return Math.min(32_000, Math.max(4_000, Math.round(windowTokens * 0.2)));
}

export interface ProjectContextAttachmentResult {
  /**
   * Raw (unwrapped) document texts, in final kept order — pass this
   * directly as `reviewPullRequest`'s `specs` input. `assemblePrompt`
   * (reviewer-core/src/prompt.ts) applies the SAME
   * `wrapUntrusted('spec-${i}', ...)` wrapping, in the same order, that
   * `snapshot.attached_specs` below is built from — so the two stay
   * byte-identical (CTX-AC-06 prompt/snapshot parity). This module never
   * wraps `specs` itself before handing it to `reviewPullRequest`; the
   * wrapping below is ONLY to measure/record what `assemblePrompt` will
   * independently produce.
   */
  specs: string[];
  snapshot: ProjectContextSnapshot;
}

const EMPTY_SNAPSHOT: ProjectContextSnapshot = {
  documents: [],
  total_tokens: 0,
  omissions: [],
  attached_specs: null,
};

/** An attachment result with no documents, carrying forward any omissions
 *  already produced upstream (selection resolution / document reads). */
export function emptyProjectContextAttachment(
  omissions: ProjectContextOmission[] = [],
): ProjectContextAttachmentResult {
  return { specs: [], snapshot: { ...EMPTY_SNAPSHOT, omissions } };
}

/**
 * Wraps each resolved document the same way `assemblePrompt` will, drops
 * WHOLE documents from the TAIL (resolved order — never a partial/
 * misleading fragment of one) until the running wrapped-token total fits
 * `budgetTokens`, and assembles the final `specs[]` + `ProjectContextSnapshot`.
 * Pure — unit-testable with a plain `{count}` tokenizer fixture, no
 * container/DB/git.
 */
export function buildProjectContextAttachment(
  documents: ResolvedProjectContextDocument[],
  priorOmissions: ProjectContextOmission[],
  budgetTokens: number,
  tokenizer: Tokenizer,
): ProjectContextAttachmentResult {
  if (documents.length === 0) return emptyProjectContextAttachment(priorOmissions);

  // Budget pass: a fixed placeholder label index. The real final index
  // (assigned below, after the cut) differs by at most a digit or two —
  // negligible against a 4,000+-token budget, and irrelevant to which
  // documents fit since the cut point depends on cumulative size, not the
  // label text itself.
  let runningTotal = 0;
  let cutIndex = documents.length;
  for (let i = 0; i < documents.length; i++) {
    const wrapped = wrapUntrusted('spec-0', documents[i]!.content);
    const tokens = estimateWithEncoding(tokenizer, wrapped).tokens;
    if (runningTotal + tokens > budgetTokens) {
      cutIndex = i;
      break;
    }
    runningTotal += tokens;
  }

  const kept = documents.slice(0, cutIndex);
  const droppedTail = documents.slice(cutIndex);

  const omissions: ProjectContextOmission[] = [
    ...priorOmissions,
    ...droppedTail.map((doc) => ({
      repo_id: doc.repo_id,
      path: doc.path,
      reason: 'budget' as const,
      detail: null,
    })),
  ];

  if (kept.length === 0) return { specs: [], snapshot: { ...EMPTY_SNAPSHOT, omissions } };

  // Final pass, with the REAL final index — this is what `assemblePrompt`
  // will independently compute from the same `specs` array, in the same
  // order, so `attached_specs` below is byte-identical to what's actually
  // rendered under "## Project context".
  const wrappedBlocks = kept.map((doc, i) => wrapUntrusted(`spec-${i}`, doc.content));
  const perDocTokens = wrappedBlocks.map((block) => estimateWithEncoding(tokenizer, block).tokens);
  const documentsTrace: ProjectContextDocumentTrace[] = kept.map((doc, i) => ({
    repo_id: doc.repo_id,
    path: doc.path,
    type: doc.type,
    revision: doc.revision,
    tokens: perDocTokens[i]!,
  }));

  return {
    specs: kept.map((doc) => doc.content),
    snapshot: {
      documents: documentsTrace,
      total_tokens: perDocTokens.reduce((a, b) => a + b, 0),
      omissions,
      attached_specs: wrappedBlocks.join('\n\n'),
    },
  };
}
