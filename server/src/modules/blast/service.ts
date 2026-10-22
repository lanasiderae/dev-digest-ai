import type { Container } from '../../platform/container.js';
import type { BlastRadiusResponse } from '@devdigest/shared';
import { NotFoundError } from '../../platform/errors.js';
import { toBlastRadius } from './helpers.js';

/**
 * Blast Radius orchestration — reads via the reviews module's own repository
 * (`container.reviewRepo`) rather than querying `pull_requests`/`pr_files`
 * directly from this module, per onion-architecture's cross-module rule (see
 * `pulls/service.ts`'s `getSmartDiff` for the same pattern).
 *
 * Calls `container.repoIntel.getBlastRadius` exactly once — no loop, no
 * per-symbol re-call. The facade's `degraded`/`reason` optionals are mapped
 * explicitly here so the internal optional shape never reaches the wire.
 */
export async function getBlastRadius(
  container: Container,
  workspaceId: string,
  prId: string,
): Promise<BlastRadiusResponse> {
  const pull = await container.reviewRepo.getPull(workspaceId, prId);
  if (!pull) throw new NotFoundError('Pull request not found');

  const files = await container.reviewRepo.getPrFiles(pull.id);
  const changedFiles = files.map((f) => f.path);

  const result = await container.repoIntel.getBlastRadius(pull.repoId, changedFiles);

  return {
    blast: toBlastRadius(result),
    degraded: result.degraded ?? false,
    reason: result.reason ?? null,
  };
}
