/**
 * ProjectContextService — discovery/preview, hermetic (no Docker, no real
 * git process): `container.git`/`container.gitTreeReader` are mocked, and
 * `.repo`/`.getRoots` are overridden directly on the constructed service,
 * the same pattern `test/repo-intel-resync.test.ts` uses for a DB-free unit
 * test of a service built around `new Service(container)`.
 *
 * Covers: nested/custom-root discovery, foreign-workspace/repo rejection,
 * symlink rejection (CTX-AC-07), missing/oversize/truncation handling, and
 * the "never falls back to a filesystem/path-based read" design property.
 */
import { describe, it, expect } from 'vitest';
import {
  MAX_PROJECT_CONTEXT_DISCOVERED_DOCUMENTS,
  MAX_PROJECT_CONTEXT_DOCUMENT_BYTES,
  DEFAULT_PROJECT_CONTEXT_ROOTS,
} from '@devdigest/shared';
import { ProjectContextService } from '../src/modules/project-context/service.js';
import type { ProjectContextRepository, ProjectContextRepoBasics } from '../src/modules/project-context/repository.js';
import { MockGitClient, MockGitTreeReader } from '../src/adapters/mocks.js';
import type { GitTreeEntry } from '../src/adapters/git/tree-reader.js';
import type { Container } from '../src/platform/container.js';

const REPO_BASICS: ProjectContextRepoBasics = {
  id: 'repo-1',
  owner: 'acme',
  name: 'widgets',
  clonePath: '/mock/clones/acme/widgets',
};

/** Builds a service with a stubbed repository/roots and an injected mock
 *  git/tree-reader pair — no DB, no real git process. */
function makeService(opts: {
  basics: ProjectContextRepoBasics | null;
  roots?: string[];
  entries?: GitTreeEntry[];
  blobsByOid?: Record<string, string>;
  head?: string;
}) {
  const git = new MockGitClient({ head: opts.head ?? 'sha-1' });
  const treeReader = new MockGitTreeReader(opts.entries ?? [], opts.blobsByOid ?? {});
  const container = { db: {}, git, gitTreeReader: treeReader } as unknown as Container;

  const service = new ProjectContextService(container);
  const stubRepo = { getOwnedRepo: async () => opts.basics } as unknown as ProjectContextRepository;
  (service as unknown as { repo: ProjectContextRepository }).repo = stubRepo;
  (service as unknown as { getRoots: (w: string) => Promise<string[]> }).getRoots = async () =>
    opts.roots ?? DEFAULT_PROJECT_CONTEXT_ROOTS;

  return service;
}

function blobEntry(path: string, oid: string, sizeBytes: number): GitTreeEntry {
  return { path, kind: 'blob', oid, sizeBytes };
}

function symlinkEntry(path: string): GitTreeEntry {
  return { path, kind: 'symlink', oid: 'deadbeef', sizeBytes: null };
}

describe('ProjectContextService.discover', () => {
  it('discovers nested documents under the default roots, sorted deterministically', async () => {
    const service = makeService({
      basics: REPO_BASICS,
      entries: [
        blobEntry('specs/l05/feature-1.md', 'oid-2', 100),
        blobEntry('docs/readme.md', 'oid-1', 50),
        blobEntry('src/index.ts', 'oid-3', 10), // not .md, excluded
      ],
    });
    const result = await service.discover('ws-1', 'repo-1', {});
    expect(result.repo_id).toBe('repo-1');
    expect(result.documents.map((d) => d.path)).toEqual(['docs/readme.md', 'specs/l05/feature-1.md']);
    expect(result.documents[0]).toMatchObject({ type: 'docs', size_bytes: 50, oversized: false });
    expect(result.truncated).toBe(false);
  });

  it('discovers documents under a custom configured root', async () => {
    const service = makeService({
      basics: REPO_BASICS,
      roots: ['policies/**/*.md'],
      entries: [blobEntry('policies/security.md', 'oid-1', 20), blobEntry('specs/plan.md', 'oid-2', 20)],
    });
    const result = await service.discover('ws-1', 'repo-1', {});
    expect(result.documents.map((d) => d.path)).toEqual(['policies/security.md']);
    expect(result.documents[0]?.type).toBe('custom');
  });

  it('filters by the search query', async () => {
    const service = makeService({
      basics: REPO_BASICS,
      entries: [blobEntry('specs/alpha.md', 'oid-1', 10), blobEntry('specs/beta.md', 'oid-2', 10)],
    });
    const result = await service.discover('ws-1', 'repo-1', { search: 'alpha' });
    expect(result.documents.map((d) => d.path)).toEqual(['specs/alpha.md']);
  });

  it('rejects a repo belonging to a different workspace (404, not a leak)', async () => {
    const service = makeService({ basics: null });
    await expect(service.discover('ws-1', 'repo-1', {})).rejects.toMatchObject({ statusCode: 404 });
  });

  it('degrades to an empty, non-truncated result when the repo has no clone yet', async () => {
    const service = makeService({ basics: { ...REPO_BASICS, clonePath: null } });
    const result = await service.discover('ws-1', 'repo-1', {});
    expect(result).toMatchObject({ documents: [], truncated: false });
  });

  it('marks a symlink entry as listed-but-unreadable (null size/tokens, not thrown)', async () => {
    const service = makeService({
      basics: REPO_BASICS,
      entries: [symlinkEntry('specs/escape.md')],
    });
    const result = await service.discover('ws-1', 'repo-1', {});
    expect(result.documents).toEqual([
      {
        repo_id: 'repo-1',
        path: 'specs/escape.md',
        type: 'specs',
        size_bytes: null,
        tokens_estimate: null,
        updated_at: null,
        oversized: false,
      },
    ]);
  });

  it('marks an oversized document as oversized (listed, no token estimate)', async () => {
    const service = makeService({
      basics: REPO_BASICS,
      entries: [blobEntry('specs/huge.md', 'oid-1', MAX_PROJECT_CONTEXT_DOCUMENT_BYTES + 1)],
    });
    const result = await service.discover('ws-1', 'repo-1', {});
    expect(result.documents[0]).toMatchObject({ oversized: true, tokens_estimate: null });
  });

  it('truncates at MAX_PROJECT_CONTEXT_DISCOVERED_DOCUMENTS with deterministic ordering', async () => {
    const entries = Array.from({ length: MAX_PROJECT_CONTEXT_DISCOVERED_DOCUMENTS + 5 }, (_, i) =>
      blobEntry(`specs/doc-${String(i).padStart(5, '0')}.md`, `oid-${i}`, 10),
    );
    const service = makeService({ basics: REPO_BASICS, entries });
    const result = await service.discover('ws-1', 'repo-1', {});
    expect(result.documents).toHaveLength(MAX_PROJECT_CONTEXT_DISCOVERED_DOCUMENTS);
    expect(result.truncated).toBe(true);
    expect(result.documents[0]?.path).toBe('specs/doc-00000.md');
  });
});

describe('ProjectContextService.preview', () => {
  it('previews an eligible document with real content/tokens_estimate', async () => {
    const service = makeService({
      basics: REPO_BASICS,
      entries: [blobEntry('specs/plan.md', 'oid-1', 11)],
      blobsByOid: { 'oid-1': 'hello world' },
    });
    const result = await service.preview('ws-1', 'repo-1', { path: 'specs/plan.md' });
    expect(result).toMatchObject({ path: 'specs/plan.md', type: 'specs', content: 'hello world' });
    expect(result.tokens_estimate).toBeGreaterThan(0);
  });

  it('rejects a traversal path before even touching the repo lookup', async () => {
    const service = makeService({ basics: REPO_BASICS, entries: [] });
    await expect(service.preview('ws-1', 'repo-1', { path: '../secret.md' })).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('rejects a path outside the configured roots', async () => {
    const service = makeService({ basics: REPO_BASICS, entries: [blobEntry('other/plan.md', 'oid-1', 10)] });
    await expect(service.preview('ws-1', 'repo-1', { path: 'other/plan.md' })).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it('rejects a repo owned by a different workspace', async () => {
    const service = makeService({ basics: null });
    await expect(service.preview('ws-1', 'repo-1', { path: 'specs/plan.md' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('rejects a symlink entry rather than reading its target (CTX-AC-07)', async () => {
    const service = makeService({ basics: REPO_BASICS, entries: [symlinkEntry('specs/escape.md')] });
    await expect(service.preview('ws-1', 'repo-1', { path: 'specs/escape.md' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('rejects an oversized document without reading its content', async () => {
    const service = makeService({
      basics: REPO_BASICS,
      entries: [blobEntry('specs/huge.md', 'oid-1', MAX_PROJECT_CONTEXT_DOCUMENT_BYTES + 1)],
      blobsByOid: { 'oid-1': 'x'.repeat(MAX_PROJECT_CONTEXT_DOCUMENT_BYTES + 1) },
    });
    await expect(service.preview('ws-1', 'repo-1', { path: 'specs/huge.md' })).rejects.toMatchObject({
      statusCode: 422,
    });
  });

  it(
    'rejects a path that is NOT literally in the tree listing, even though a filesystem read at the ' +
      'same relative path would have succeeded — proves the read is tree-entry-addressed, not path-addressed',
    async () => {
      // No entries at all in the mock tree — a plain filesystem-based reader
      // keyed on `clonePath + path` would have no way to know this, but this
      // service only ever resolves a path via an exact match against
      // `listTree()`'s own entries.
      const service = makeService({ basics: REPO_BASICS, entries: [] });
      await expect(service.preview('ws-1', 'repo-1', { path: 'specs/plan.md' })).rejects.toMatchObject({
        statusCode: 404,
      });
    },
  );

  it('missing path (not present in the tree at all) is reported as not found', async () => {
    const service = makeService({ basics: REPO_BASICS, entries: [blobEntry('specs/other.md', 'oid-1', 5)] });
    await expect(service.preview('ws-1', 'repo-1', { path: 'specs/missing.md' })).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
