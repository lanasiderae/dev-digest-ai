import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

/**
 * Onboarding Tour data access — the ONLY layer touching the `onboarding`
 * table (a single-document cache keyed by `repo_id`; see
 * `db/schema/context.ts`). The table pre-dates this module (TASK-02 schema
 * groundwork); this is the first module to actually write to it for THIS
 * feature. Plain get/upsert, same shape as `brief/repository.ts`'s
 * `BriefRepository` for `pr_brief`.
 */
export class OnboardingTourRepository {
  constructor(private db: Db) {}

  /** Raw cached JSON (unvalidated) — the service parses/validates it against
   *  the `OnboardingTour` contract so a schema drift degrades to "no valid
   *  cache" rather than throwing. */
  async get(repoId: string): Promise<unknown | undefined> {
    const [row] = await this.db
      .select({ json: t.onboarding.json })
      .from(t.onboarding)
      .where(eq(t.onboarding.repoId, repoId));
    return row?.json;
  }

  async upsert(repoId: string, json: unknown): Promise<void> {
    await this.db
      .insert(t.onboarding)
      .values({ repoId, json })
      .onConflictDoUpdate({ target: t.onboarding.repoId, set: { json, generatedAt: new Date() } });
  }
}
