import type { Container } from '../../platform/container.js';
import type { BlastRadiusResponse, RepoRef } from '@devdigest/shared';
import { NotFoundError } from '../../platform/errors.js';
import { mapOldLineToNewLine, toBlastRadius } from './helpers.js';
import type { BlastCallerRow, BlastResult } from '../repo-intel/types.js';
import type { PullRow } from '../../db/rows.js';

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
  const corrected = await correctCallerLinesForHead(container, pull, result);

  return {
    blast: toBlastRadius(corrected),
    degraded: corrected.degraded ?? false,
    reason: corrected.reason ?? null,
  };
}

/**
 * Caller `line`s come out of `getBlastRadius` keyed to `repo_index_state.
 * last_indexed_sha` (the persistent index's commit), but the UI/MCP tool
 * link every caller to the PR's `head_sha`. Any commit between those two
 * shas that inserts/removes lines above a caller shifts it, so the GitHub
 * link can land on the wrong line without this correction.
 *
 * Best-effort, never throws: skipped entirely when there's nothing to
 * correct (no callers, no indexed sha, or the index is already at head),
 * and falls back to the indexed line for a file whose head content isn't
 * reachable (fetches the PR head once and retries before giving up).
 */
async function correctCallerLinesForHead(
  container: Container,
  pull: PullRow,
  result: BlastResult,
): Promise<BlastResult> {
  if (result.callers.length === 0) return result;

  const state = await container.repoIntel.getIndexState(pull.repoId);
  if (!state.lastIndexedSha || state.lastIndexedSha === pull.headSha) return result;

  const repo = await container.reviewRepo.getRepo(pull.repoId);
  if (!repo) return result;
  const ref: RepoRef = { owner: repo.owner, name: repo.name };

  const diff = await loadHeadDiff(container, ref, pull, state.lastIndexedSha);
  if (!diff) return result;

  const hunksByFile = new Map(diff.files.map((f) => [f.path, f.hunks]));
  const callers: BlastCallerRow[] = result.callers.map((c) => {
    const hunks = hunksByFile.get(c.file);
    if (!hunks || hunks.length === 0) return c; // untouched between the two shas
    return { ...c, line: mapOldLineToNewLine(hunks, c.line) };
  });

  return { ...result, callers };
}

async function loadHeadDiff(container: Container, ref: RepoRef, pull: PullRow, baseSha: string) {
  try {
    return await container.git.diffDirect(ref, baseSha, pull.headSha);
  } catch {
    // The PR's head commit may not be fetched into the clone yet — fetch it
    // once and retry; give up (keep indexed lines) if it's still unreachable.
    try {
      await container.git.fetchPullHead(ref, pull.number);
      return await container.git.diffDirect(ref, baseSha, pull.headSha);
    } catch {
      return null;
    }
  }
}
