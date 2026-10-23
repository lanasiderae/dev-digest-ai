import { sql } from 'drizzle-orm';
import { pgTable, uuid, text, integer, boolean, jsonb, primaryKey } from 'drizzle-orm/pg-core';
import { now, type ProjectContextSelectionRow } from './_shared';
import { workspaces } from './core';

export const skills = pgTable('skills', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description').notNull(),
  type: text('type', { enum: ['rubric', 'convention', 'security', 'custom'] }).notNull(),
  source: text('source', {
    enum: ['manual', 'imported_url', 'extracted', 'community'],
  }).notNull(),
  body: text('body').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  version: integer('version').notNull().default(1),
  // Pre-existing, unrelated field (not this feature's attachment storage —
  // see `project-context.ts`'s header comment).
  evidenceFiles: jsonb('evidence_files').$type<string[]>(),
  // Project Context Folder (L05): same shape/cap/semantics as
  // `agents.project_context` above it in the sibling schema file — ordered
  // per-repository selected document paths only, default empty, capped at
  // 100 attachments total via the shared Zod refinement. Participates in the
  // EXISTING `version`/`skillVersions` snapshot semantics; no second
  // versioning mechanism is added.
  projectContext: jsonb('project_context')
    .$type<ProjectContextSelectionRow>()
    .notNull()
    .default(sql`'[]'::jsonb`),
  createdAt: now(),
});

export const skillVersions = pgTable(
  'skill_versions',
  {
    skillId: uuid('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    body: text('body').notNull(),
    createdAt: now(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.skillId, t.version] }) }),
);
