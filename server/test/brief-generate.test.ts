/**
 * L05/TASK-08 — `BriefService.generate` (POST /pulls/:id/brief), hermetic
 * (no Docker, no real git/DB): `container.reviewRepo`/`agentsRepo`/
 * `repoIntel`/`github`/`llm` are plain stubs, `container.db` is a minimal
 * chainable stub standing in for `resolveFeatureModel`'s one settings read
 * (same pattern `review-executor-project-context.test.ts` uses for a
 * different query), and `BriefService.computeContextIdentity` (private) is
 * overridden directly — the same private-field-cast convention
 * `project-context-service.test.ts`/`repo-intel-resync.test.ts` already use
 * — so most tests don't need a real git/ProjectContextService round trip.
 *
 * Covers: no-agent/missing-source generation (BRIEF-AC-02), explicit
 * `agent_id: null` regeneration never substitutes a reviewer, one
 * structured attempt with the budget cap enforced and no raw diff
 * hunks/patches anywhere in the prompt (BRIEF-AC-09/10), invalid-path
 * grounding rejection WITH byte-identical cache preservation (BRIEF-AC-04),
 * and the head/context race checks before persistence (BRIEF-AC-12).
 */
import { describe, it, expect } from 'vitest';
import type { Container } from '../src/platform/container.js';
import type { PullRow } from '../src/db/rows.js';
import { BriefService } from '../src/modules/brief/service.js';
import { ConflictError, ValidationError } from '../src/platform/errors.js';
import { BRIEF_INPUT_TOKEN_CAP } from '../src/modules/brief/constants.js';

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

const CHAR_TOKENIZER = { count: (t: string) => t.length };

const FIXED_IDENTITY = {
  reviewerAgentId: null,
  skillIds: [] as string[],
  documents: [] as never[],
  prLinkedSpecPath: null,
  omissions: [] as never[],
  fingerprint: 'fp-fixed',
};

interface MakeServiceOpts {
  pull?: Partial<PullRow>;
  prFiles?: { path: string; additions: number; deletions: number; patch: string | null }[];
  intent?: unknown;
  blastThrows?: boolean;
  llmData?: unknown;
  llmError?: Error;
  rawSql?: unknown;
  cached?: unknown;
  identitySequence?: unknown[];
  freshPull?: PullRow;
}

function makeService(opts: MakeServiceOpts = {}) {
  const pull = makePull(opts.pull);
  const prFiles = opts.prFiles ?? [{ path: 'src/config.ts', additions: 4, deletions: 0, patch: '@@ -1,3 +1,4 @@\n+secret' }];

  const upserted: { prId: string; json: unknown }[] = [];
  const briefRepoStub = {
    get: async () => opts.cached,
    upsert: async (prId: string, json: unknown) => {
      upserted.push({ prId, json });
    },
  };

  // Flips to true the instant the (slow) model call returns — simulates "the
  // PR advanced / context changed WHILE the model call was in flight": every
  // `getPull` before this point (blast/history/the initial fetch) sees the
  // ORIGINAL `pull`; only `generate()`'s own explicit pre-persist recheck
  // call (which happens strictly after the model call returns) sees
  // `freshPull`. A plain call counter doesn't work here because
  // `getBlastRadius`/`getPrHistory` also call `getPull` internally before
  // the model call ever runs.
  let modelCallReturned = false;
  const completeStructuredCalls: unknown[] = [];
  const llm = {
    id: 'openai' as const,
    listModels: async () => [],
    complete: async () => {
      throw new Error('must not call complete()');
    },
    completeStructured: async (req: { schema: { safeParse: (v: unknown) => { success: boolean; data?: unknown; error?: unknown } } }) => {
      completeStructuredCalls.push(req);
      modelCallReturned = true;
      if (opts.llmError) throw opts.llmError;
      const parsed = req.schema.safeParse(
        opts.llmData ?? { summary: 'A small config change.', risks: [], review_focus: [] },
      );
      if (!parsed.success) throw new Error(`fixture failed schema: ${JSON.stringify(parsed.error)}`);
      return { data: parsed.data, model: 'gpt-4.1', tokensIn: 10, tokensOut: 5, costUsd: 0, raw: '', attempts: 1 };
    },
    embed: async () => {
      throw new Error('must not call embed()');
    },
  };

  const db = {
    select: () => ({
      from: () => ({
        where: async () => [], // no settings rows → registry default feature model
      }),
    }),
  };

  const freshPull = opts.freshPull ?? pull;
  const reviewRepo = {
    getPull: async () => (modelCallReturned ? freshPull : pull),
    getRepo: async () => ({ owner: 'acme', name: 'widgets' }),
    getPrFiles: async () => prFiles,
    getIntent: async () => opts.intent,
    getPriorPrsWithFileOverlap: async () => [],
  };

  const repoIntel = {
    getBlastRadius: async () => {
      if (opts.blastThrows) throw new Error('repo-intel unavailable');
      return { changedSymbols: [], callers: [] };
    },
    getIndexState: async () => ({ lastIndexedSha: null }),
  };

  const github = async () => ({
    getIssue: async () => {
      throw new Error('no issue configured for this test');
    },
  });

  const container = {
    db,
    reviewRepo,
    agentsRepo: {
      getById: async () => {
        throw new Error('agentsRepo.getById should not be called when computeContextIdentity is stubbed');
      },
      linkedSkills: async () => [],
    },
    tokenizer: CHAR_TOKENIZER,
    llm: async () => llm,
    github,
    repoIntel,
    rawSql: opts.rawSql,
  } as unknown as Container;

  const service = new BriefService(container);
  (service as unknown as { repo: typeof briefRepoStub }).repo = briefRepoStub;

  let identityCall = 0;
  const sequence = opts.identitySequence ?? [FIXED_IDENTITY, FIXED_IDENTITY];
  (service as unknown as { computeContextIdentity: (...args: unknown[]) => Promise<unknown> }).computeContextIdentity =
    async () => {
      const value = sequence[Math.min(identityCall, sequence.length - 1)];
      identityCall++;
      return value;
    };

  return { service, upserted, completeStructuredCalls, pull };
}

describe('BriefService.generate — no-reviewer / missing-source generation (BRIEF-AC-02)', () => {
  it('generates successfully with agent_id: null and records every missing source truthfully', async () => {
    const { service, completeStructuredCalls, upserted } = makeService({ blastThrows: true });

    const brief = await service.generate('ws-1', 'pr-1', null);

    expect(brief.provenance.reviewer_agent_id).toBeNull();
    expect(brief.sources.reviewer_context).toEqual({ status: 'unavailable', reason: 'Reviewer context not selected.' });
    expect(brief.sources.intent.status).toBe('unavailable');
    expect(brief.sources.blast.status).toBe('unavailable');
    expect(brief.sources.issue).toEqual({ status: 'unavailable', reason: 'No linked issue referenced in this PR.' });
    expect(brief.sources.documents.status).toBe('unavailable');
    expect(brief.intent).toBeNull();
    expect(brief.blast).toBeNull();
    expect(completeStructuredCalls).toHaveLength(1); // exactly one attempt
    expect(upserted).toHaveLength(1);
  });

  it('never infers a reviewer from a prior run: explicit null stays null in provenance', async () => {
    const { service } = makeService();
    const brief = await service.generate('ws-1', 'pr-1', null);
    expect(brief.provenance.reviewer_agent_id).toBeNull();
    expect(brief.provenance.skill_ids).toEqual([]);
  });
});

describe('BriefService.generate — one-attempt / budget / no-hunks (BRIEF-AC-09/10)', () => {
  it('calls completeStructured exactly once with disableTransportRetry set and never includes raw patch text', async () => {
    const { service, completeStructuredCalls } = makeService({
      prFiles: [{ path: 'src/config.ts', additions: 4, deletions: 0, patch: '@@ -10,3 +10,4 @@\n+  stripeKey: "sk_live_xxx",' }],
    });

    await service.generate('ws-1', 'pr-1', null);

    expect(completeStructuredCalls).toHaveLength(1);
    const req = completeStructuredCalls[0] as { disableTransportRetry: boolean; maxRetries: number; messages: { content: string }[] };
    expect(req.disableTransportRetry).toBe(true);
    expect(req.maxRetries).toBe(0);
    const fullPrompt = req.messages.map((m) => m.content).join('\n');
    expect(fullPrompt).not.toContain('@@ -10,3');
    expect(fullPrompt).not.toContain('sk_live_xxx');
  });

  it('fails BEFORE calling the model when mandatory facts alone exceed the 8,000-token budget', async () => {
    const hugeFiles = Array.from({ length: 400 }, (_, i) => ({
      path: `src/very/deeply/nested/package/module-${i}/file-${'x'.repeat(40)}.ts`,
      additions: 1,
      deletions: 0,
      patch: null,
    }));
    const { service, completeStructuredCalls } = makeService({ prFiles: hugeFiles });

    await expect(service.generate('ws-1', 'pr-1', null)).rejects.toThrow(ValidationError);
    expect(completeStructuredCalls).toHaveLength(0);
    // Sanity: the fixture is actually over budget under the 1-char/1-token tokenizer.
    const totalChars = hugeFiles.reduce((s, f) => s + f.path.length, 0);
    expect(totalChars).toBeGreaterThan(BRIEF_INPUT_TOKEN_CAP);
  });
});

describe('BriefService.generate — grounding rejection preserves the old cache (BRIEF-AC-03/04)', () => {
  it('rejects a result whose risk file_refs name a file outside the PR/Blast union, and leaves the old cache untouched', async () => {
    const OLD_CACHE = { summary: 'old', fakeField: true };
    const { service, upserted } = makeService({
      cached: OLD_CACHE,
      llmData: {
        summary: 'Looks fine',
        risks: [{ kind: 'security', title: 'Bad', explanation: 'x', severity: 'high', file_refs: ['not/in/pr.ts'] }],
        review_focus: [],
      },
    });

    await expect(service.generate('ws-1', 'pr-1', null)).rejects.toThrow(ValidationError);
    expect(upserted).toHaveLength(0); // never wrote a new cache
  });

  it('rejects a risk with NO file reference at all', async () => {
    const { service, upserted } = makeService({
      llmData: {
        summary: 'Looks fine',
        risks: [{ kind: 'security', title: 'Bad', explanation: 'x', severity: 'high', file_refs: [] }],
        review_focus: [],
      },
    });

    await expect(service.generate('ws-1', 'pr-1', null)).rejects.toThrow(ValidationError);
    expect(upserted).toHaveLength(0);
  });

  it('accepts a review_focus file that IS in the PR diff', async () => {
    const { service, upserted } = makeService({
      llmData: {
        summary: 'Looks fine',
        risks: [],
        review_focus: [{ file: 'src/config.ts', line: 3, reason: 'new secret-looking value' }],
      },
    });

    const brief = await service.generate('ws-1', 'pr-1', null);
    expect(brief.review_focus).toEqual([{ file: 'src/config.ts', line: 3, reason: 'new secret-looking value' }]);
    expect(upserted).toHaveLength(1);
  });
});

describe('BriefService.generate — head/context race (BRIEF-AC-12)', () => {
  it('rejects and preserves the old cache when the PR head advanced during generation', async () => {
    const OLD_CACHE = { summary: 'old', marker: 'untouched' };
    const { service, upserted } = makeService({
      cached: OLD_CACHE,
      freshPull: makePull({ headSha: 'sha-2' }), // advanced mid-generation
    });

    await expect(service.generate('ws-1', 'pr-1', null)).rejects.toThrow(ConflictError);
    expect(upserted).toHaveLength(0);
  });

  it('rejects and preserves the old cache when the resolved context identity changed mid-generation', async () => {
    const OLD_CACHE = { summary: 'old' };
    const { service, upserted } = makeService({
      cached: OLD_CACHE,
      identitySequence: [FIXED_IDENTITY, { ...FIXED_IDENTITY, fingerprint: 'fp-changed' }],
    });

    await expect(service.generate('ws-1', 'pr-1', null)).rejects.toThrow(ConflictError);
    expect(upserted).toHaveLength(0);
  });
});

describe('BriefService.generate — model failure preserves the old cache', () => {
  it('propagates a transport failure and never writes a new cache', async () => {
    const OLD_CACHE = { summary: 'old' };
    const { service, upserted } = makeService({ cached: OLD_CACHE, llmError: new Error('upstream 500') });

    await expect(service.generate('ws-1', 'pr-1', null)).rejects.toThrow('upstream 500');
    expect(upserted).toHaveLength(0);
  });
});
