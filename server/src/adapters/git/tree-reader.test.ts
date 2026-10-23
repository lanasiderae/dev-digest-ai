import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import { SimpleGitTreeReader, BlobTooLargeError } from './tree-reader.js';

describe('SimpleGitTreeReader', () => {
  let cloneDir: string;
  let repoPath: string;
  let revision: string;
  const repo = { owner: 'acme', name: 'widgets' };

  beforeEach(async () => {
    cloneDir = await mkdtemp(join(tmpdir(), 'tree-reader-test-'));
    repoPath = join(cloneDir, repo.owner, repo.name);
    await mkdir(join(repoPath, 'specs'), { recursive: true });
    await writeFile(join(repoPath, 'specs', 'a.md'), 'hello world');
    await writeFile(join(repoPath, 'big.md'), 'x'.repeat(300));
    // A symlink entry committed alongside real files — git stores this as a
    // blob (mode 120000) whose content is the link target text, never
    // something the reader should treat as readable document content.
    await symlink('a.md', join(repoPath, 'specs', 'link.md'));

    const git = simpleGit(repoPath);
    await git.init();
    await git.addConfig('user.email', 'test@example.com');
    await git.addConfig('user.name', 'Test');
    await git.add(['.']);
    await git.commit('init');
    revision = (await git.revparse(['HEAD'])).trim();
  });

  afterEach(async () => {
    await rm(cloneDir, { recursive: true, force: true });
  });

  it('lists blob entries with path/size from one ls-tree call', async () => {
    const reader = new SimpleGitTreeReader(cloneDir);
    const entries = await reader.listTree(repo, revision);

    const a = entries.find((e) => e.path === 'specs/a.md');
    expect(a).toMatchObject({ kind: 'blob', sizeBytes: 11 });
    expect(a?.oid).toMatch(/^[0-9a-f]{40}$/);

    const big = entries.find((e) => e.path === 'big.md');
    expect(big?.sizeBytes).toBe(300);
  });

  it('reports a symlink entry by kind, distinct from a real blob', async () => {
    const reader = new SimpleGitTreeReader(cloneDir);
    const entries = await reader.listTree(repo, revision);
    const link = entries.find((e) => e.path === 'specs/link.md');
    expect(link?.kind).toBe('symlink');
  });

  it('readBlob returns bounded content by object id', async () => {
    const reader = new SimpleGitTreeReader(cloneDir);
    const entries = await reader.listTree(repo, revision);
    const a = entries.find((e) => e.path === 'specs/a.md')!;
    const result = await reader.readBlob(repo, a.oid!, 1024);
    expect(result.content).toBe('hello world');
    expect(result.sizeBytes).toBe(11);
  });

  it('rejects a blob exceeding maxBytes WITHOUT reading its content', async () => {
    const reader = new SimpleGitTreeReader(cloneDir);
    const entries = await reader.listTree(repo, revision);
    const big = entries.find((e) => e.path === 'big.md')!;
    await expect(reader.readBlob(repo, big.oid!, 10)).rejects.toThrow(BlobTooLargeError);
  });

  it('is immune to a TOCTOU swap of the working-tree file after listing (object-store read, not filesystem)', async () => {
    const reader = new SimpleGitTreeReader(cloneDir);
    const entries = await reader.listTree(repo, revision);
    const a = entries.find((e) => e.path === 'specs/a.md')!;

    // Simulate an attacker (or an unrelated concurrent resync) swapping the
    // working-tree file for a symlink escaping the repo, AFTER listTree
    // already resolved this entry's object id.
    await rm(join(repoPath, 'specs', 'a.md'));
    await symlink('/etc/hosts', join(repoPath, 'specs', 'a.md'));

    const result = await reader.readBlob(repo, a.oid!, 1024);
    // Still the committed object's content — the swap never had an effect
    // because readBlob never looked at the working-tree path at all.
    expect(result.content).toBe('hello world');
  });
});
