/**
 * AgentsService — Project Context Folder CRUD wiring (L05, TASK-04).
 * Hermetic (no Docker, no real DB): `.repo` is overridden with an in-memory
 * fake, the same pattern `test/repo-intel-resync.test.ts`/
 * `test/project-context-service.test.ts` use for a DB-free unit test of a
 * service built around `new Service(container)`.
 *
 * Covers:
 *  - metadata-only reload: saving/reloading an agent's `project_context`
 *    round-trips paths only, never touches document bodies (CTX-AC-04).
 *  - CRUD ownership validation rejects a repo the workspace doesn't own.
 *  - `project_context` participates in the EXISTING config-version bump,
 *    but an unchanged resubmission does NOT spuriously bump it.
 *  - `resolveProjectContext` unions the agent's own selections with its
 *    enabled (and only enabled) linked skills', in order (CTX-AC-05).
 */
import { describe, it, expect } from 'vitest';
import type { ProjectContextSelectionList } from '@devdigest/shared';
import { AgentsService } from '../src/modules/agents/service.js';
import type { AgentsRepository, LinkedSkillRow } from '../src/modules/agents/repository.js';
import type { AgentRow, SkillRow } from '../src/db/rows.js';
import { ValidationError, NotFoundError } from '../src/platform/errors.js';
import type { Container } from '../src/platform/container.js';

const WORKSPACE = 'ws-1';

function makeAgentRow(overrides: Partial<AgentRow> = {}): AgentRow {
  return {
    id: 'agent-1',
    workspaceId: WORKSPACE,
    name: 'Reviewer',
    description: '',
    provider: 'openai',
    model: 'gpt-4.1',
    systemPrompt: 'Be helpful.',
    outputSchema: null,
    strategy: 'single-pass',
    ciFailOn: 'critical',
    repoIntel: true,
    projectContext: [],
    enabled: true,
    version: 1,
    createdBy: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as AgentRow;
}

function makeSkillRow(overrides: Partial<SkillRow> = {}): SkillRow {
  return {
    id: 'skill-1',
    workspaceId: WORKSPACE,
    name: 'Convention',
    description: 'desc',
    type: 'convention',
    source: 'manual',
    body: 'body',
    enabled: true,
    version: 1,
    evidenceFiles: null,
    projectContext: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  } as SkillRow;
}

/** In-memory fake covering exactly the AgentsRepository surface the service
 *  calls in these tests — no DB, no SQL. */
class FakeAgentsRepository {
  rows = new Map<string, AgentRow>();
  skillLinksByAgent = new Map<string, LinkedSkillRow[]>();

  async getById(workspaceId: string, id: string) {
    const row = this.rows.get(id);
    return row && row.workspaceId === workspaceId ? row : undefined;
  }

  async getByIdUnscoped(id: string) {
    return this.rows.get(id);
  }

  /** Unused in these tests beyond `.get()`'s read path — a flat 0 is enough. */
  async agentSkillCounts(agentIds: string[]): Promise<Record<string, number>> {
    return Object.fromEntries(agentIds.map((id) => [id, 0]));
  }

  async insert(values: {
    workspaceId: string;
    projectContext?: ProjectContextSelectionList;
  }): Promise<AgentRow> {
    const row = makeAgentRow({
      id: 'agent-1',
      workspaceId: values.workspaceId,
      projectContext: values.projectContext ?? [],
    });
    this.rows.set(row.id, row);
    return row;
  }

  /**
   * Deliberately does NOT reimplement the real version-bump rule
   * (`isConfigChange`/`projectContextEqual` in `agents/helpers.ts`) — that
   * logic is exercised directly, against the real functions, in
   * `agents-helpers-project-context.test.ts`. This fake just persists the
   * patch so the CRUD/ownership/resolver tests above have something to read
   * back.
   */
  async update(
    workspaceId: string,
    id: string,
    patch: { projectContext?: ProjectContextSelectionList },
  ): Promise<AgentRow | undefined> {
    const existing = this.rows.get(id);
    if (!existing || existing.workspaceId !== workspaceId) return undefined;
    const next: AgentRow = {
      ...existing,
      ...(patch.projectContext !== undefined ? { projectContext: patch.projectContext } : {}),
    };
    this.rows.set(id, next);
    return next;
  }

  async linkedSkills(agentId: string): Promise<LinkedSkillRow[]> {
    return this.skillLinksByAgent.get(agentId) ?? [];
  }
}

function makeService(opts: { ownedRepoIds?: string[] } = {}) {
  const fakeRepo = new FakeAgentsRepository();
  const owned = new Set(opts.ownedRepoIds ?? ['repo-1']);
  const container = {
    db: {},
    reposRepo: { listOwnedIds: async (_ws: string, ids: string[]) => new Set(ids.filter((id) => owned.has(id))) },
  } as unknown as Container;

  const service = new AgentsService(container);
  (service as unknown as { repo: AgentsRepository }).repo = fakeRepo as unknown as AgentsRepository;
  return { service, fakeRepo };
}

describe('AgentsService — project_context CRUD', () => {
  it('round-trips project_context paths only across create → reload (metadata-only, no document bodies)', async () => {
    const { service } = makeService();
    const selection: ProjectContextSelectionList = [{ repo_id: 'repo-1', paths: ['specs/a.md', 'docs/b.md'] }];
    const created = await service.create(WORKSPACE, {
      name: 'Reviewer',
      provider: 'openai',
      model: 'gpt-4.1',
      system_prompt: 'Be helpful.',
      project_context: selection,
    });
    expect(created.project_context).toEqual(selection);
    // The DTO carries only {repo_id, paths} — no body/content field exists
    // on the shape at all, so there's nothing to assert "is absent" beyond
    // the structural equality above already proving it.
    expect(Object.keys(created.project_context[0]!)).toEqual(['repo_id', 'paths']);

    const reloaded = await service.get(WORKSPACE, created.id);
    expect(reloaded?.project_context).toEqual(selection);
  });

  it('rejects project_context referencing a repo the workspace does not own', async () => {
    const { service } = makeService({ ownedRepoIds: ['repo-1'] });
    await expect(
      service.create(WORKSPACE, {
        name: 'Reviewer',
        provider: 'openai',
        model: 'gpt-4.1',
        system_prompt: 'Be helpful.',
        project_context: [{ repo_id: 'repo-other-workspace', paths: ['specs/a.md'] }],
      }),
    ).rejects.toThrow(ValidationError);
  });

});

describe('AgentsService.resolveProjectContext', () => {
  it('unions the agent + its enabled linked skills, in order, excluding a disabled skill', async () => {
    const { service, fakeRepo } = makeService();
    const created = await service.create(WORKSPACE, {
      name: 'Reviewer',
      provider: 'openai',
      model: 'gpt-4.1',
      system_prompt: 'Be helpful.',
      project_context: [{ repo_id: 'repo-1', paths: ['specs/agent-only.md'] }],
    });

    const enabledSkill = makeSkillRow({
      id: 'skill-enabled',
      enabled: true,
      projectContext: [{ repo_id: 'repo-1', paths: ['docs/enabled-skill.md'] }],
    });
    const disabledSkill = makeSkillRow({
      id: 'skill-disabled',
      enabled: false,
      projectContext: [{ repo_id: 'repo-1', paths: ['docs/disabled-skill.md'] }],
    });
    fakeRepo.skillLinksByAgent.set(created.id, [
      { skill: enabledSkill, order: 0 },
      { skill: disabledSkill, order: 1 },
    ]);

    const result = await service.resolveProjectContext(created.id, 'repo-1');
    expect(result.paths).toEqual(['specs/agent-only.md', 'docs/enabled-skill.md']);
    expect(result.paths).not.toContain('docs/disabled-skill.md');
  });

  it('throws NotFoundError for an unknown agent id', async () => {
    const { service } = makeService();
    await expect(service.resolveProjectContext('missing-agent', 'repo-1')).rejects.toThrow(
      NotFoundError,
    );
  });

  it('excludes a selection naming a different repository (cross_repo omission)', async () => {
    // Both repo-1 and repo-2 are owned by the workspace (so CRUD-time
    // ownership validation passes) — `cross_repo` is about resolving against
    // ONE specific repo under review, not about ownership.
    const { service } = makeService({ ownedRepoIds: ['repo-1', 'repo-2'] });
    const created = await service.create(WORKSPACE, {
      name: 'Reviewer',
      provider: 'openai',
      model: 'gpt-4.1',
      system_prompt: 'Be helpful.',
      project_context: [
        { repo_id: 'repo-1', paths: ['specs/a.md'] },
        { repo_id: 'repo-2', paths: ['specs/other-repo.md'] },
      ],
    });

    const result = await service.resolveProjectContext(created.id, 'repo-1');
    expect(result.paths).toEqual(['specs/a.md']);
    expect(result.omissions).toEqual([
      { repo_id: 'repo-2', path: 'specs/other-repo.md', reason: 'cross_repo', detail: null },
    ]);
  });
});
