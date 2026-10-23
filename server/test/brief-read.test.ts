/**
 * L05/TASK-08 — `BriefService.read` (GET /pulls/:id/brief), hermetic. Covers
 * the cache-only contract (BRIEF-AC-06): no cache, a cached reload with
 * ZERO model calls, head-sha staleness, and the explicit `agent_id` query
 * comparison — including proving the D1 distinction that the cached
 * generation's reviewer provenance (display-only, read from the cache) and
 * the live "agent_id to compare against" query param are two different
 * inputs that are never conflated into one field.
 */
import { describe, it, expect } from 'vitest';
import type { Container } from '../src/platform/container.js';
import type { PrBrief } from '@devdigest/shared';
import type { PullRow } from '../src/db/rows.js';
import { BriefService } from '../src/modules/brief/service.js';

function makePull(overrides: Partial<PullRow> = {}): PullRow {
  return {
    id: 'pr-1',
    workspaceId: 'ws-1',
    repoId: 'repo-1',
    number: 7,
    title: 'Add rate limiting',
    author: 'marisa.koch',
    branch: 'feat/x',
    base: 'main',
    headSha: 'sha-1',
    lastReviewedSha: null,
    additions: 10,
    deletions: 2,
    filesCount: 1,
    status: 'open',
    body: null,
    openedAt: null,
    updatedAt: null,
    ...overrides,
  } as unknown as PullRow;
}

function makeCachedBrief(overrides: Partial<PrBrief> = {}): PrBrief {
  return {
    summary: 'Cached summary',
    intent: null,
    blast: null,
    risks: { risks: [] },
    history: { history: [] },
    review_focus: [],
    sources: {
      intent: { status: 'unavailable', reason: 'not_generated' },
      blast: { status: 'unavailable', reason: null },
      issue: { status: 'unavailable', reason: 'No linked issue referenced in this PR.' },
      reviewer_context: { status: 'unavailable', reason: 'Reviewer context not selected.' },
      documents: { status: 'unavailable', reason: 'No project-context documents selected.' },
    },
    provenance: {
      reviewer_agent_id: null,
      skill_ids: [],
      documents: [],
      pr_linked_spec_path: null,
      head_sha: 'sha-1',
      context_fingerprint: 'fp-cached',
      generated_at: '2026-10-22T00:00:00.000Z',
    },
    ...overrides,
  } as PrBrief;
}

function makeService(opts: { pull?: Partial<PullRow>; cachedRaw?: unknown; identity?: unknown }) {
  const pull = makePull(opts.pull);
  const reviewRepo = { getPull: async () => pull };
  const llmCalls: unknown[] = [];
  const llm = {
    completeStructured: async (req: unknown) => {
      llmCalls.push(req);
      throw new Error('GET must never call the model');
    },
    complete: async () => {
      throw new Error('GET must never call the model');
    },
    listModels: async () => [],
    embed: async () => {
      throw new Error('GET must never call the model');
    },
  };
  const container = {
    reviewRepo,
    llm: async () => llm,
    db: {},
  } as unknown as Container;

  const service = new BriefService(container);
  (service as unknown as { repo: { get: () => Promise<unknown> } }).repo = { get: async () => opts.cachedRaw };
  (service as unknown as { computeContextIdentity: (...args: unknown[]) => Promise<unknown> }).computeContextIdentity =
    async () => opts.identity ?? { fingerprint: 'fp-cached' };

  return { service, llmCalls };
}

describe('BriefService.read — cache-only (BRIEF-AC-06)', () => {
  it('returns brief: null, stale: false when nothing has ever been generated', async () => {
    const { service, llmCalls } = makeService({ cachedRaw: undefined });
    const result = await service.read('ws-1', 'pr-1');
    expect(result).toEqual({ brief: null, stale: false, stale_reasons: [] });
    expect(llmCalls).toHaveLength(0);
  });

  it('reloads a valid cached brief with ZERO model calls', async () => {
    const cached = makeCachedBrief();
    const { service, llmCalls } = makeService({ cachedRaw: cached });
    const result = await service.read('ws-1', 'pr-1');
    expect(result.brief).toEqual(cached);
    expect(result.stale).toBe(false);
    expect(llmCalls).toHaveLength(0);
  });

  it('marks stale when the PR head SHA has advanced since generation', async () => {
    const cached = makeCachedBrief({ provenance: { ...makeCachedBrief().provenance, head_sha: 'sha-OLD' } });
    const { service } = makeService({ pull: { headSha: 'sha-NEW' }, cachedRaw: cached });
    const result = await service.read('ws-1', 'pr-1');
    expect(result.stale).toBe(true);
    expect(result.stale_reasons).toContain('head_sha_changed');
  });

  it('without an agent_id query, hydrates the cache\'s OWN reviewer provenance for display — distinct from any live selector state (D1)', async () => {
    const cached = makeCachedBrief({
      provenance: { ...makeCachedBrief().provenance, reviewer_agent_id: 'agent-abc' },
    });
    const { service } = makeService({ cachedRaw: cached });
    const result = await service.read('ws-1', 'pr-1'); // no agent_id query param at all

    // Display-only cached-generation identity, read straight from the cache —
    // GET never substitutes/compares it against anything when no query
    // param is given (the live "selector for the NEXT POST" is a value the
    // caller tracks itself, never returned/compared here).
    expect(result.brief?.provenance.reviewer_agent_id).toBe('agent-abc');
    expect(result.stale_reasons).not.toContain('reviewer_changed');
  });

  it('with an explicit agent_id query DIFFERENT from the cached provenance, flags reviewer_changed', async () => {
    const cached = makeCachedBrief({
      provenance: { ...makeCachedBrief().provenance, reviewer_agent_id: 'agent-abc' },
    });
    const { service } = makeService({ cachedRaw: cached });
    const result = await service.read('ws-1', 'pr-1', 'agent-xyz');
    expect(result.stale).toBe(true);
    expect(result.stale_reasons).toContain('reviewer_changed');
  });

  it('with an explicit agent_id query matching the cached reviewer but a changed selection, flags context_changed', async () => {
    const cached = makeCachedBrief({
      provenance: { ...makeCachedBrief().provenance, reviewer_agent_id: 'agent-abc', context_fingerprint: 'fp-old' },
    });
    const { service } = makeService({ cachedRaw: cached, identity: { fingerprint: 'fp-new' } });
    const result = await service.read('ws-1', 'pr-1', 'agent-abc');
    expect(result.stale).toBe(true);
    expect(result.stale_reasons).toContain('context_changed');
  });

  it('treats a cache that no longer matches the PrBrief contract as "no valid cache"', async () => {
    const { service } = makeService({ cachedRaw: { not: 'a brief' } });
    const result = await service.read('ws-1', 'pr-1');
    expect(result).toEqual({ brief: null, stale: false, stale_reasons: [] });
  });
});
