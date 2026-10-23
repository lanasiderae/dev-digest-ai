import { and, eq, inArray, ne } from 'drizzle-orm';
import type { Db } from '../../../db/client.js';
import * as t from '../../../db/schema.js';
import type { Intent } from '@devdigest/shared';
import type { PullRow } from '../../../db/rows.js';

// ---- PR lookup (workspace-scoped) -----------------------------------------

export async function getPull(
  db: Db,
  workspaceId: string,
  prId: string,
): Promise<PullRow | undefined> {
  const [row] = await db
    .select()
    .from(t.pullRequests)
    .where(and(eq(t.pullRequests.workspaceId, workspaceId), eq(t.pullRequests.id, prId)));
  return row;
}

export async function getRepo(
  db: Db,
  repoId: string,
): Promise<typeof t.repos.$inferSelect | undefined> {
  const [row] = await db.select().from(t.repos).where(eq(t.repos.id, repoId));
  return row;
}

export async function getPrFiles(
  db: Db,
  prId: string,
): Promise<(typeof t.prFiles.$inferSelect)[]> {
  return db.select().from(t.prFiles).where(eq(t.prFiles.prId, prId));
}

/** One merged PR in the same repo that touched at least one of `filePaths`,
 *  paired with which of those paths it actually touched. */
export interface PriorPrOverlap {
  pr: PullRow;
  overlapPaths: string[];
}

/**
 * Prior merged PRs in `repoId` (excluding `excludePrId`) that touched any of
 * `filePaths` — the data source for the "Prior PRs touching these files"
 * footer. Grouped in JS (one row per matching pr_files path) rather than a
 * SQL array_agg, matching this repo's existing style (e.g. `status.ts`'s
 * `latestReviewPerAgent`). An empty `filePaths` short-circuits to `[]` — no
 * query, nothing to overlap with.
 */
export async function getPriorPrsWithFileOverlap(
  db: Db,
  repoId: string,
  excludePrId: string,
  filePaths: string[],
): Promise<PriorPrOverlap[]> {
  if (filePaths.length === 0) return [];

  const rows = await db
    .select({ pr: t.pullRequests, path: t.prFiles.path })
    .from(t.prFiles)
    .innerJoin(t.pullRequests, eq(t.prFiles.prId, t.pullRequests.id))
    .where(
      and(
        eq(t.pullRequests.repoId, repoId),
        ne(t.pullRequests.id, excludePrId),
        eq(t.pullRequests.status, 'merged'),
        inArray(t.prFiles.path, filePaths),
      ),
    );

  const byPr = new Map<string, PriorPrOverlap>();
  for (const row of rows) {
    const existing = byPr.get(row.pr.id);
    if (existing) existing.overlapPaths.push(row.path);
    else byPr.set(row.pr.id, { pr: row.pr, overlapPaths: [row.path] });
  }
  return [...byPr.values()];
}

/**
 * Record the commit a review just ran against, so the PR list can derive
 * `reviewed` vs `needs_review` (head moved since the last review) vs `stale`.
 */
export async function markReviewed(db: Db, prId: string, sha: string): Promise<void> {
  await db
    .update(t.pullRequests)
    .set({ lastReviewedSha: sha })
    .where(eq(t.pullRequests.id, prId));
}

// ---- intent ---------------------------------------------------------------

/** A stored intent plus the head_sha it was derived against — lets the
 *  caller tell a still-fresh intent from a stale one (new commits since). */
export interface StoredIntent extends Intent {
  headSha: string | null;
}

export async function upsertIntent(db: Db, prId: string, intent: Intent, headSha: string): Promise<void> {
  await db
    .insert(t.prIntent)
    .values({
      prId,
      intent: intent.intent,
      inScope: intent.in_scope,
      outOfScope: intent.out_of_scope,
      headSha,
    })
    .onConflictDoUpdate({
      target: t.prIntent.prId,
      set: { intent: intent.intent, inScope: intent.in_scope, outOfScope: intent.out_of_scope, headSha },
    });
}

export async function getIntent(db: Db, prId: string): Promise<StoredIntent | undefined> {
  const [row] = await db.select().from(t.prIntent).where(eq(t.prIntent.prId, prId));
  if (!row) return undefined;
  return { intent: row.intent, in_scope: row.inScope, out_of_scope: row.outOfScope, headSha: row.headSha };
}
