import { eq } from 'drizzle-orm';
import type { Db } from '../../db/client.js';
import * as t from '../../db/schema.js';

/**
 * PR Brief data access — the ONLY layer touching `pr_brief` (a single-document
 * cache keyed by `pr_id`; see `db/schema/reviews.ts`). No `headSha`/fingerprint
 * columns on this table by design (TASK-02) — provenance/staleness fields all
 * live INSIDE the stored `json` document (the `PrBrief` contract), so this
 * repository is a plain get/upsert, same shape as `pullRepo.upsertIntent`/
 * `getIntent` for `pr_intent`.
 */
export class BriefRepository {
  constructor(private db: Db) {}

  /** Raw cached JSON (unvalidated) — the service parses/validates it against
   *  the `PrBrief` contract so a schema drift degrades to "no valid cache"
   *  rather than throwing. */
  async get(prId: string): Promise<unknown | undefined> {
    const [row] = await this.db.select({ json: t.prBrief.json }).from(t.prBrief).where(eq(t.prBrief.prId, prId));
    return row?.json;
  }

  async upsert(prId: string, json: unknown): Promise<void> {
    await this.db
      .insert(t.prBrief)
      .values({ prId, json })
      .onConflictDoUpdate({ target: t.prBrief.prId, set: { json } });
  }
}
