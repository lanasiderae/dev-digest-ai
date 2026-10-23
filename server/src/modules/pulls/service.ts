import type { Container } from '../../platform/container.js';
import type { SmartDiffResponse } from '@devdigest/shared';
import { NotFoundError } from '../../platform/errors.js';
import { buildSmartDiff, openFindingLinesByPath } from './helpers.js';
import { latestReviewPerAgent } from './status.js';
import type { FindingAnchorRow } from './types.js';

/**
 * Smart Diff orchestration — reads via the reviews module's own repository
 * (`container.reviewRepo`) rather than querying `reviews`/`findings` tables
 * directly from this module, per onion-architecture's cross-module rule.
 * No GitHub call, no model call (AC24).
 */
export async function getSmartDiff(
  container: Container,
  workspaceId: string,
  prId: string,
): Promise<SmartDiffResponse> {
  const pull = await container.reviewRepo.getPull(workspaceId, prId);
  if (!pull) throw new NotFoundError('Pull request not found');

  const files = await container.reviewRepo.getPrFiles(pull.id);
  const reviews = await container.reviewRepo.reviewsForPull(pull.id);

  // Latest review per agent, `kind='review'` only (mirrors DiffTab's own
  // "one review per agent" rule) — then only that review's `kind='finding'`
  // findings anchor a line (other kinds, e.g. lethal-trifecta, don't).
  const latestPerAgent = latestReviewPerAgent(reviews.filter((r) => r.review.kind === 'review').map((r) => r.review));
  const latestReviewIds = new Set([...latestPerAgent.values()].flat().map((r) => r.id));
  const anchors: FindingAnchorRow[] = reviews
    .filter((r) => latestReviewIds.has(r.review.id))
    .flatMap((r) => r.findings)
    .filter((f) => f.kind === 'finding')
    .map((f) => ({ file: f.file, startLine: f.startLine, dismissedAt: f.dismissedAt }));

  return buildSmartDiff(files, openFindingLinesByPath(anchors));
}
