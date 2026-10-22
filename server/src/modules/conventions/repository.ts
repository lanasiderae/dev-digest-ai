import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

/**
 * Conventions data-access. Owns `conventions` only. Queries `repos` directly
 * for clone info (same pattern as `repo-intel/repository.ts`'s
 * `getRepoBasics` — a module reads another module's table directly through
 * its own repository rather than importing that module's repository class).
 * Workspace-scoped throughout.
 */

export type ConventionRow = typeof t.conventions.$inferSelect;

export interface RepoCloneInfo {
  workspaceId: string;
  clonePath: string | null;
}

export interface InsertConvention {
  workspaceId: string;
  repoId: string;
  rule: string;
  evidencePath: string;
  evidenceSnippet: string;
  confidence: number;
}

export interface UpdateConvention {
  rule?: string;
  accepted?: boolean;
  rejected?: boolean;
}

export class ConventionsRepository {
  constructor(private db: Db) {}

  async getRepoCloneInfo(repoId: string): Promise<RepoCloneInfo | undefined> {
    const [row] = await this.db
      .select({ workspaceId: t.repos.workspaceId, clonePath: t.repos.clonePath })
      .from(t.repos)
      .where(eq(t.repos.id, repoId));
    return row;
  }

  async list(workspaceId: string, repoId: string): Promise<ConventionRow[]> {
    return this.db
      .select()
      .from(t.conventions)
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.repoId, repoId)));
  }

  /**
   * Re-scan: drop every candidate the user hasn't made a decision on yet for
   * this repo (`accepted=false AND rejected=false`), then insert the fresh
   * batch — accepted AND rejected rows are both left untouched, so a re-scan
   * can't silently undo a decision the user already made either way.
   */
  async replacePending(
    workspaceId: string,
    repoId: string,
    rows: InsertConvention[],
  ): Promise<ConventionRow[]> {
    await this.db
      .delete(t.conventions)
      .where(
        and(
          eq(t.conventions.workspaceId, workspaceId),
          eq(t.conventions.repoId, repoId),
          eq(t.conventions.accepted, false),
          eq(t.conventions.rejected, false),
        ),
      );
    if (rows.length === 0) return [];
    return this.db
      .insert(t.conventions)
      .values(rows.map((r) => ({ ...r, accepted: false, rejected: false })))
      .returning();
  }

  /** `rule`+`evidencePath` pairs already rejected for this repo — used to
   *  keep a re-scan from silently re-proposing something the user rejected. */
  async listRejectedKeys(
    workspaceId: string,
    repoId: string,
  ): Promise<{ rule: string; evidencePath: string | null }[]> {
    return this.db
      .select({ rule: t.conventions.rule, evidencePath: t.conventions.evidencePath })
      .from(t.conventions)
      .where(
        and(
          eq(t.conventions.workspaceId, workspaceId),
          eq(t.conventions.repoId, repoId),
          eq(t.conventions.rejected, true),
        ),
      );
  }

  async updateById(
    workspaceId: string,
    id: string,
    patch: UpdateConvention,
  ): Promise<ConventionRow | undefined> {
    const [row] = await this.db
      .update(t.conventions)
      .set({
        ...(patch.rule !== undefined ? { rule: patch.rule } : {}),
        ...(patch.accepted !== undefined ? { accepted: patch.accepted } : {}),
        ...(patch.rejected !== undefined ? { rejected: patch.rejected } : {}),
      })
      .where(and(eq(t.conventions.workspaceId, workspaceId), eq(t.conventions.id, id)))
      .returning();
    return row;
  }
}
