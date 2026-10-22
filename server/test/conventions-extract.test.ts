/**
 * `ConventionsService.extract` — code-based evidence validation.
 *
 * Asserts the WIRING: a candidate citing a file that was never sampled, or a
 * line number outside that file's real line count, is discarded; only a
 * candidate with real evidence survives into the persisted batch.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLLMProvider } from '../src/adapters/mocks.js';
import { ConventionsService } from '../src/modules/conventions/service.js';
import type { ConventionsRepository, InsertConvention } from '../src/modules/conventions/repository.js';
import { EXTRACTION_SCHEMA_NAME } from '../src/modules/conventions/constants.js';
import type { Container } from '../src/platform/container.js';

let clonePath: string;

beforeAll(async () => {
  clonePath = await mkdtemp(join(tmpdir(), 'conventions-test-'));
  await writeFile(
    join(clonePath, 'users.ts'),
    ['export async function getUser(id: string) {', '  return await db.users.find(id);', '}'].join('\n'),
    'utf8',
  );
});

afterAll(async () => {
  await rm(clonePath, { recursive: true, force: true });
});

function makeService(opts: {
  structured: unknown;
  rankedPaths: string[];
  clonePathOverride?: string | null;
  rejectedKeys?: { rule: string; evidencePath: string | null }[];
}) {
  const inserted: InsertConvention[] = [];
  const repo = {
    getRepoCloneInfo: async () => ({
      workspaceId: 'ws1',
      clonePath: opts.clonePathOverride === undefined ? clonePath : opts.clonePathOverride,
    }),
    list: async () => [],
    listRejectedKeys: async () => opts.rejectedKeys ?? [],
    replacePending: async (_ws: string, _repo: string, rows: InsertConvention[]) => {
      inserted.push(...rows);
      return rows.map((r, i) => ({
        id: `row-${i}`,
        workspaceId: r.workspaceId,
        repoId: r.repoId,
        rule: r.rule,
        evidencePath: r.evidencePath,
        evidenceSnippet: r.evidenceSnippet,
        confidence: r.confidence,
        accepted: false,
        rejected: false,
      }));
    },
    updateById: async () => undefined,
  } as unknown as ConventionsRepository;

  const llm = new MockLLMProvider('openai', { structuredBySchema: { [EXTRACTION_SCHEMA_NAME]: opts.structured } });
  const dbStub = { select: () => ({ from: () => ({ where: async () => [] }) }) };
  const container = {
    db: dbStub,
    repoIntel: { getConventionSamples: async () => opts.rankedPaths },
    llm: async () => llm,
  } as unknown as Container;

  const service = new ConventionsService(container);
  (service as unknown as { repo: ConventionsRepository }).repo = repo;
  return { service, inserted };
}

describe('ConventionsService.extract', () => {
  it('keeps a candidate with a real file + in-range line, discards hallucinated evidence', async () => {
    const { service, inserted } = makeService({
      rankedPaths: ['users.ts'],
      structured: {
        candidates: [
          {
            category: 'style',
            rule: 'Use async/await instead of .then() chains',
            evidence: { file: 'users.ts', line: 2 },
            confidence: 0.9,
          },
          {
            category: 'style',
            rule: 'Hallucinated — file was never sampled',
            evidence: { file: 'does/not/exist.ts', line: 1 },
            confidence: 0.8,
          },
          {
            category: 'style',
            rule: 'Hallucinated — line past the end of the file',
            evidence: { file: 'users.ts', line: 999 },
            confidence: 0.7,
          },
        ],
      },
    });

    const result = await service.extract('ws1', 'repo1');

    expect(result).toHaveLength(1);
    expect(result[0]!.rule).toBe('Use async/await instead of .then() chains');
    expect(inserted).toHaveLength(1);
    expect(inserted[0]!.evidencePath).toBe('users.ts');
  });

  it('drops a candidate matching a rule the user already rejected for this repo', async () => {
    const { service, inserted } = makeService({
      rankedPaths: ['users.ts'],
      rejectedKeys: [{ rule: 'Use async/await instead of .then() chains', evidencePath: 'users.ts' }],
      structured: {
        candidates: [
          {
            category: 'style',
            rule: 'Use async/await instead of .then() chains',
            evidence: { file: 'users.ts', line: 2 },
            confidence: 0.9,
          },
        ],
      },
    });

    const result = await service.extract('ws1', 'repo1');

    expect(result).toHaveLength(0);
    expect(inserted).toHaveLength(0);
  });

  it('throws when the repo has no clone yet', async () => {
    const { service } = makeService({ rankedPaths: [], structured: { candidates: [] }, clonePathOverride: null });
    await expect(service.extract('ws1', 'repo1')).rejects.toThrow(/not cloned/);
  });
});
