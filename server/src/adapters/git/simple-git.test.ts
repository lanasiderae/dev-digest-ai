import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SimpleGitClient } from './simple-git.js';

describe('SimpleGitClient.readFile', () => {
  let cloneDir: string;
  const repo = { owner: 'acme', name: 'widgets' };

  beforeEach(async () => {
    cloneDir = await mkdtemp(join(tmpdir(), 'simple-git-test-'));
    const repoPath = join(cloneDir, repo.owner, repo.name);
    await mkdir(join(repoPath, 'docs'), { recursive: true });
    await writeFile(join(repoPath, 'docs', 'plan.md'), 'plan content');
    // A file outside the clone, used as a traversal/symlink target.
    await writeFile(join(cloneDir, 'secret.md'), 'top secret');
  });

  afterEach(async () => {
    await rm(cloneDir, { recursive: true, force: true });
  });

  it('reads a file inside the clone', async () => {
    const client = new SimpleGitClient(cloneDir);
    await expect(client.readFile(repo, 'docs/plan.md')).resolves.toBe('plan content');
  });

  it('rejects a path that escapes the clone via ..', async () => {
    const client = new SimpleGitClient(cloneDir);
    await expect(client.readFile(repo, '../../secret.md')).rejects.toThrow(/escapes repo clone/);
  });

  it('rejects a path that escapes the clone via a symlink', async () => {
    const repoPath = join(cloneDir, repo.owner, repo.name);
    await symlink(join(cloneDir, 'secret.md'), join(repoPath, 'docs', 'escape.md'));
    const client = new SimpleGitClient(cloneDir);
    await expect(client.readFile(repo, 'docs/escape.md')).rejects.toThrow(/escapes repo clone/);
  });

  it('propagates a plain ENOENT for a missing in-clone file', async () => {
    const client = new SimpleGitClient(cloneDir);
    await expect(client.readFile(repo, 'docs/missing.md')).rejects.toThrow(/ENOENT/);
  });
});
