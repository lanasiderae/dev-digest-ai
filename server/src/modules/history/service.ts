import type { Container } from '../../platform/container.js';
import type { PrHistory } from '@devdigest/shared';
import { NotFoundError } from '../../platform/errors.js';
import { sortByOverlap, toPrHistoryItem } from './helpers.js';

/** How many prior PRs to return, most-relevant first — a short, human-scanned
 *  list, not an exhaustive one. */
const MAX_PRIOR_PRS = 5;

/**
 * Prior-PR-history orchestration — reads via the reviews module's own
 * repository (`container.reviewRepo`) rather than querying `pull_requests`/
 * `pr_files` directly from this module, per onion-architecture's cross-module
 * rule (same pattern as `blast/service.ts` and `pulls/service.ts`'s
 * `getSmartDiff`). No GitHub call, no model call.
 */
export async function getPrHistory(
  container: Container,
  workspaceId: string,
  prId: string,
): Promise<PrHistory> {
  const pull = await container.reviewRepo.getPull(workspaceId, prId);
  if (!pull) throw new NotFoundError('Pull request not found');

  const files = await container.reviewRepo.getPrFiles(pull.id);
  const changedFiles = files.map((f) => f.path);
  if (changedFiles.length === 0) return { history: [] };

  const overlaps = await container.reviewRepo.getPriorPrsWithFileOverlap(pull.repoId, pull.id, changedFiles);

  return {
    history: sortByOverlap(overlaps).slice(0, MAX_PRIOR_PRS).map(toPrHistoryItem),
  };
}
