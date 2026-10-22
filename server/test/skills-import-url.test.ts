import { describe, it, expect, vi } from 'vitest';
import { fetchSkillUrl } from '../src/modules/skills/import/url.js';
import { ValidationError } from '../src/platform/errors.js';

const PUBLIC_IP_RESOLVE = async () => [{ address: '93.184.216.34' }]; // example.com-ish public IP
const PRIVATE_IP_RESOLVE = async () => [{ address: '10.0.0.5' }];

function textResponse(body: string, init: Partial<{ status: number; contentType: string }> = {}) {
  return new Response(body, {
    status: init.status ?? 200,
    headers: { 'content-type': init.contentType ?? 'text/markdown' },
  });
}

describe('fetchSkillUrl', () => {
  it('returns the fetched body text on the happy path', async () => {
    const fetchImpl = vi.fn(async () => textResponse('# Hello\nBody.'));
    const result = await fetchSkillUrl('https://example.com/skill.md', {
      fetchImpl,
      resolveImpl: PUBLIC_IP_RESOLVE,
    });
    expect(result.body).toBe('# Hello\nBody.');
    expect(result.name).toBe('Hello');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-https URL before any fetch call', async () => {
    const fetchImpl = vi.fn();
    await expect(
      fetchSkillUrl('http://example.com/skill.md', { fetchImpl, resolveImpl: PUBLIC_IP_RESOLVE }),
    ).rejects.toThrow(ValidationError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a hostname that resolves to a private IP', async () => {
    const fetchImpl = vi.fn();
    await expect(
      fetchSkillUrl('https://internal.example/skill.md', {
        fetchImpl,
        resolveImpl: PRIVATE_IP_RESOLVE,
      }),
    ).rejects.toThrow(/private or internal/);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a redirect response instead of following it', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 302, headers: { location: 'https://evil.example' } }));
    await expect(
      fetchSkillUrl('https://example.com/skill.md', { fetchImpl, resolveImpl: PUBLIC_IP_RESOLVE }),
    ).rejects.toThrow(/redirected/);
  });

  it('rejects an unexpected content type', async () => {
    // text/html matches /^text\// so would pass through — use an unambiguous
    // non-text type to exercise the rejection path.
    const binFetch = vi.fn(
      async () => new Response('binary', { status: 200, headers: { 'content-type': 'image/png' } }),
    );
    await expect(
      fetchSkillUrl('https://example.com/skill.png', { fetchImpl: binFetch, resolveImpl: PUBLIC_IP_RESOLVE }),
    ).rejects.toThrow(/content type/);
  });

  it('aborts once the streamed response exceeds the byte cap', async () => {
    const big = 'x'.repeat(2 * 1024 * 1024); // over the 1MB cap
    const fetchImpl = vi.fn(async () => textResponse(big));
    await expect(
      fetchSkillUrl('https://example.com/skill.md', { fetchImpl, resolveImpl: PUBLIC_IP_RESOLVE }),
    ).rejects.toThrow(/too large/);
  });
});
