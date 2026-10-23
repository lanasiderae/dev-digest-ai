import { timestamp } from 'drizzle-orm/pg-core';

/**
 * Shared internal column helpers for the schema domain files. NOT re-exported
 * by the `db/schema.ts` barrel — it stays out of the public schema surface.
 */

/** Standard `created_at` column: timestamptz, defaults to now(), not null. */
export const now = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();

/**
 * Project Context Folder (L05) selection metadata row shape, stored on
 * `agents.project_context`/`skills.project_context` — paths only, never
 * document bodies; mirrors `@devdigest/shared`'s `ProjectContextSelection`.
 * Kept as a plain inline type (not imported from vendor/shared) to match this
 * schema directory's existing convention of no cross-package schema imports.
 */
export type ProjectContextSelectionRow = { repo_id: string; paths: string[] }[];
