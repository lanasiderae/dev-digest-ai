import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * TASK-02 evidence: parity between the two vendored contract copies for the
 * files this task touches, plus a review of the generated migration's SQL.
 *
 * This repo's two vendored `vendor/shared` copies are NOT required to be
 * byte-identical in general — several pre-existing files intentionally
 * differ (CI-only Agent/Skill manifest types the client doesn't need; see
 * `server/INSIGHTS.md`/`client/AGENTS.md`). But every file this task
 * created or edited (`brief.ts`, `trace.ts`, `platform.ts`,
 * `project-context.ts`, `onboarding.ts`, the barrel `index.ts`) has no such
 * reason to differ — both the client UI and the server need the exact same
 * shapes — so this test pins them to byte-identical, matching how they were
 * landed. If a future task deliberately diverges one of these for a
 * real reason, update this test's exception list, don't delete the check.
 */
const SERVER_ROOT = resolve(__dirname, '../src/vendor/shared');
const CLIENT_ROOT = resolve(__dirname, '../../client/src/vendor/shared');

const MUST_MATCH_FILES = [
  'index.ts',
  'contracts/brief.ts',
  'contracts/trace.ts',
  'contracts/platform.ts',
  'contracts/project-context.ts',
  'contracts/onboarding.ts',
];

describe('vendored contract parity (server vs client) — L05 touched files', () => {
  for (const rel of MUST_MATCH_FILES) {
    it(`${rel} is byte-identical in both vendored copies`, () => {
      const serverSrc = readFileSync(resolve(SERVER_ROOT, rel), 'utf8');
      const clientSrc = readFileSync(resolve(CLIENT_ROOT, rel), 'utf8');
      expect(clientSrc).toBe(serverSrc);
    });
  }

  it('both new contract files exist in both vendored copies', () => {
    const serverContracts = readdirSync(resolve(SERVER_ROOT, 'contracts'));
    const clientContracts = readdirSync(resolve(CLIENT_ROOT, 'contracts'));
    expect(serverContracts).toContain('project-context.ts');
    expect(serverContracts).toContain('onboarding.ts');
    expect(clientContracts).toContain('project-context.ts');
    expect(clientContracts).toContain('onboarding.ts');
  });
});

describe('generated migration review (0013_famous_kree.sql)', () => {
  const migrationPath = resolve(__dirname, '../src/db/migrations/0013_famous_kree.sql');

  it('adds exactly the two expected project_context jsonb columns, nothing else', () => {
    const sql = readFileSync(migrationPath, 'utf8');
    const statements = sql
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);

    expect(statements).toHaveLength(2);
    expect(statements).toContain(
      `ALTER TABLE "skills" ADD COLUMN "project_context" jsonb DEFAULT '[]'::jsonb NOT NULL;`,
    );
    expect(statements).toContain(
      `ALTER TABLE "agents" ADD COLUMN "project_context" jsonb DEFAULT '[]'::jsonb NOT NULL;`,
    );

    // No DROP/RENAME/ALTER COLUMN TYPE anywhere in this migration — an
    // additive column-only change, matching the plan's "prefer jsonb over
    // new SQL columns" default for everything except this one indexable-
    // free, always-point-lookup-by-id case.
    expect(sql).not.toMatch(/DROP |RENAME |ALTER COLUMN .* TYPE/i);
  });
});
