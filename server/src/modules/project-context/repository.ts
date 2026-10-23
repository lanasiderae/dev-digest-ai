import { and, eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

/**
 * project-context data-access layer. Only query: a WORKSPACE-SCOPED repo
 * lookup. `repo-intel/repository.ts`'s `getRepoBasics(repoId)` has no
 * workspace filter (that module's routes resolve tenancy separately but
 * don't scope the repo row itself — see its own routes.ts comment, "the
 * facade itself is tenant-agnostic"); this module reads actual repository
 * content from disk, so a cross-workspace `repoId` must 404 here rather
 * than fall through to a clone-access call.
 */
export interface ProjectContextRepoBasics {
  id: string;
  owner: string;
  name: string;
  clonePath: string | null;
}

export class ProjectContextRepository {
  constructor(private db: Db) {}

  /** Returns `null` for a repo that doesn't exist OR belongs to a different
      workspace — the two cases are deliberately indistinguishable to the
      caller, so a cross-workspace id doesn't leak whether it exists. */
  async getOwnedRepo(workspaceId: string, repoId: string): Promise<ProjectContextRepoBasics | null> {
    const [row] = await this.db
      .select({
        id: t.repos.id,
        owner: t.repos.owner,
        name: t.repos.name,
        clonePath: t.repos.clonePath,
      })
      .from(t.repos)
      .where(and(eq(t.repos.id, repoId), eq(t.repos.workspaceId, workspaceId)));
    return row ?? null;
  }
}
