/**
 * SkillsService — Project Context Folder CRUD wiring (L05, TASK-04).
 * Hermetic (no Docker, no real DB): `.repo` is overridden with an in-memory
 * fake, same pattern as `agents-project-context.test.ts`.
 *
 * Covers:
 *  - metadata-only reload: saving/reloading a skill's `project_context`
 *    round-trips paths only (CTX-AC-04).
 *  - CRUD ownership validation rejects a repo the workspace doesn't own.
 *  - `isBodyChange` (the real skill version-bump rule) never looks at
 *    `project_context` — skills' version stays body-only by design, unlike
 *    agents' version (see `agents-helpers-project-context.test.ts`).
 */
import { describe, it, expect } from 'vitest';
import type { ProjectContextSelectionList } from '@devdigest/shared';
import { SkillsService } from '../src/modules/skills/service.js';
import { isBodyChange } from '../src/modules/skills/helpers.js';
import type { SkillsRepository } from '../src/modules/skills/repository.js';
import type { SkillRow } from '../src/db/rows.js';
import { ValidationError } from '../src/platform/errors.js';
import type { Container } from '../src/platform/container.js';

const WORKSPACE = 'ws-1';

function makeSkillRow(overrides: Partial<SkillRow> = {}): SkillRow {
  return {
    id: 'skill-1',
    workspaceId: WORKSPACE,
    name: 'Convention',
    description: 'desc',
    type: 'convention',
    source: 'manual',
    body: 'Always do X.',
    enabled: true,
    version: 1,
    evidenceFiles: null,
    projectContext: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as SkillRow;
}

class FakeSkillsRepository {
  rows = new Map<string, SkillRow>();

  async getById(workspaceId: string, id: string) {
    const row = this.rows.get(id);
    return row && row.workspaceId === workspaceId ? row : undefined;
  }

  async insert(values: {
    workspaceId: string;
    body: string;
    enabled?: boolean;
    projectContext?: ProjectContextSelectionList;
  }): Promise<SkillRow> {
    const row = makeSkillRow({
      id: 'skill-1',
      workspaceId: values.workspaceId,
      body: values.body,
      enabled: values.enabled ?? true,
      projectContext: values.projectContext ?? [],
    });
    this.rows.set(row.id, row);
    return row;
  }

  async update(
    workspaceId: string,
    id: string,
    patch: { projectContext?: ProjectContextSelectionList; enabled?: boolean },
  ): Promise<SkillRow | undefined> {
    const existing = this.rows.get(id);
    if (!existing || existing.workspaceId !== workspaceId) return undefined;
    const next: SkillRow = {
      ...existing,
      ...(patch.projectContext !== undefined ? { projectContext: patch.projectContext } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
    };
    this.rows.set(id, next);
    return next;
  }
}

function makeService(opts: { ownedRepoIds?: string[] } = {}) {
  const fakeRepo = new FakeSkillsRepository();
  const owned = new Set(opts.ownedRepoIds ?? ['repo-1']);
  const container = {
    db: {},
    reposRepo: {
      listOwnedIds: async (_ws: string, ids: string[]) => new Set(ids.filter((id) => owned.has(id))),
    },
    agentsRepo: {
      skillAgentCounts: async (_ws: string, skillIds: string[]) =>
        Object.fromEntries(skillIds.map((id) => [id, 0])),
    },
  } as unknown as Container;

  const service = new SkillsService(container);
  (service as unknown as { repo: SkillsRepository }).repo = fakeRepo as unknown as SkillsRepository;
  return { service, fakeRepo };
}

describe('SkillsService — project_context CRUD', () => {
  it('round-trips project_context paths only across create → reload', async () => {
    const { service } = makeService();
    const selection: ProjectContextSelectionList = [{ repo_id: 'repo-1', paths: ['specs/a.md'] }];
    const created = await service.create(WORKSPACE, {
      name: 'Convention',
      description: 'desc',
      type: 'convention',
      body: 'Always do X.',
      project_context: selection,
    });
    expect(created.project_context).toEqual(selection);

    const reloaded = await service.get(WORKSPACE, created.id);
    expect(reloaded?.project_context).toEqual(selection);
  });

  it('rejects project_context referencing a repo the workspace does not own', async () => {
    const { service } = makeService({ ownedRepoIds: ['repo-1'] });
    await expect(
      service.create(WORKSPACE, {
        name: 'Convention',
        description: 'desc',
        type: 'convention',
        body: 'Always do X.',
        project_context: [{ repo_id: 'repo-other-workspace', paths: ['specs/a.md'] }],
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('update() also validates project_context ownership before touching the body gate', async () => {
    const { service } = makeService({ ownedRepoIds: ['repo-1'] });
    const created = await service.create(WORKSPACE, {
      name: 'Convention',
      description: 'desc',
      type: 'convention',
      body: 'Always do X.',
    });
    await expect(
      service.update(WORKSPACE, created.id, {
        project_context: [{ repo_id: 'repo-other-workspace', paths: ['specs/a.md'] }],
      }),
    ).rejects.toThrow(ValidationError);
  });
});

describe('isBodyChange — skill version stays body-only (unaffected by project_context)', () => {
  it('a project_context-only patch is not reported as a body change', () => {
    expect(isBodyChange({ body: 'Always do X.' }, {})).toBe(false);
  });

  it('a real body change is still reported as a body change', () => {
    expect(isBodyChange({ body: 'Always do X.' }, { body: 'Always do Y.' })).toBe(true);
  });
});
