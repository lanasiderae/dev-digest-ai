import { describe, expect, it } from 'vitest';
import type { DevDigestApi } from './client.js';
import { resolveAgent, resolvePull, resolveRepo, ResolveError } from './resolve.js';

function fakeApi(responses: Record<string, unknown>) {
  const calls: string[] = [];
  const api: DevDigestApi = {
    get: async (path) => {
      calls.push(path);
      return responses[path] as never;
    },
    post: async (path) => {
      calls.push(path);
      return responses[path] as never;
    },
  };
  return { api, calls };
}

async function expectResolveError(fn: () => Promise<unknown>): Promise<ResolveError> {
  try {
    await fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ResolveError);
    return err as ResolveError;
  }
  throw new Error('expected the resolver to throw a ResolveError');
}

describe('resolveRepo', () => {
  it('matches full_name case-insensitively', async () => {
    const { api, calls } = fakeApi({
      '/repos': [{ id: 'repo-1', full_name: 'Acme/Widgets' }],
    });
    const repo = await resolveRepo(api, 'acme/widgets');
    expect(repo).toEqual({ id: 'repo-1', fullName: 'Acme/Widgets' });
    // repo is never interpolated into a URL — only /repos was ever requested.
    expect(calls).toEqual(['/repos']);
  });

  it("an unknown repo's message contains the stub's known full_names", async () => {
    const { api } = fakeApi({
      '/repos': [{ id: 'repo-1', full_name: 'owner/alpha' }, { id: 'repo-2', full_name: 'owner/beta' }],
    });
    const err = await expectResolveError(() => resolveRepo(api, 'owner/gamma'));
    expect(err.message).toContain('owner/gamma');
    expect(err.message).toContain('owner/alpha');
    expect(err.message).toContain('owner/beta');
  });
});

describe('resolvePull', () => {
  it('matches by exact PR number', async () => {
    const { api, calls } = fakeApi({
      '/repos/repo-1/pulls': [{ id: 'pr-1', number: 412, head_sha: 'deadbeef' }],
    });
    const pull = await resolvePull(api, 'repo-1', 412);
    expect(pull).toEqual({ id: 'pr-1', number: 412, headSha: 'deadbeef' });
    expect(calls).toEqual(['/repos/repo-1/pulls']);
  });

  it("an unknown PR's message contains the numbers seen", async () => {
    const { api } = fakeApi({
      '/repos/repo-1/pulls': [{ id: 'pr-1', number: 415, head_sha: 'a' }, { id: 'pr-2', number: 414, head_sha: 'b' }],
    });
    const err = await expectResolveError(() => resolvePull(api, 'repo-1', 412));
    expect(err.message).toContain('412');
    expect(err.message).toContain('415');
    expect(err.message).toContain('414');
  });
});

describe('resolveAgent', () => {
  it('matches by exact uuid before name', async () => {
    const { api } = fakeApi({ '/agents': [{ id: 'agent-uuid-1', name: 'General Reviewer' }] });
    const agent = await resolveAgent(api, 'agent-uuid-1');
    expect(agent).toEqual({ id: 'agent-uuid-1', name: 'General Reviewer' });
  });

  it('matches by case-insensitive name', async () => {
    const { api } = fakeApi({ '/agents': [{ id: 'agent-uuid-1', name: 'General Reviewer' }] });
    const agent = await resolveAgent(api, 'general reviewer');
    expect(agent).toEqual({ id: 'agent-uuid-1', name: 'General Reviewer' });
  });

  it("an unknown agent's message contains the known agent names", async () => {
    const { api } = fakeApi({
      '/agents': [{ id: 'a1', name: 'General Reviewer' }, { id: 'a2', name: 'Security Reviewer' }],
    });
    const err = await expectResolveError(() => resolveAgent(api, 'sec'));
    expect(err.message).toContain('General Reviewer');
    expect(err.message).toContain('Security Reviewer');
  });

  it('an ambiguous agent name errors', async () => {
    const { api } = fakeApi({
      '/agents': [{ id: 'a1', name: 'Reviewer' }, { id: 'a2', name: 'Reviewer' }],
    });
    await expectResolveError(() => resolveAgent(api, 'reviewer'));
  });
});
