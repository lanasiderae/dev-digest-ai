import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { loadMcpConfig } from '../config.js';
import { createMcpServer } from '../server.js';

const REPO_ID = '11111111-1111-1111-1111-111111111111';
const PR_ID = '22222222-2222-2222-2222-222222222222';

const FIXTURES: Record<string, unknown> = {
  '/repos': [{ id: REPO_ID, workspace_id: 'w1', owner: 'acme', name: 'widgets', full_name: 'acme/widgets', default_branch: 'main', clone_path: null, last_polled_at: null, created_by: null }],
  [`/repos/${REPO_ID}/pulls`]: [{ id: PR_ID, number: 412, title: 't', author: 'a', branch: 'b', base: 'main', head_sha: 'sha', additions: 1, deletions: 0, files_count: 1, status: 'open' }],
  '/agents': [{ id: 'a1', name: 'General Reviewer', description: 'd', provider: 'openai', model: 'gpt-4.1', system_prompt: 's', enabled: true, version: 1, strategy: 'single-pass', ci_fail_on: 'critical', repo_intel: true, skill_count: 0 }],
  [`/pulls/${PR_ID}/reviews`]: [{ id: 'r1', pr_id: PR_ID, agent_id: 'a1', run_id: 'run1', agent_name: 'General Reviewer', kind: 'review', verdict: 'approve', summary: 's', score: 95, model: 'gpt-4.1', cost: 0.01, grounding: '1/1', created_at: '2026-01-01T00:00:00Z', findings: [] }],
  [`/repos/${REPO_ID}/conventions`]: [{ id: 'c1', rule: 'r', evidence_path: 'e.ts', evidence_snippet: 's', confidence: 0.9, accepted: true, rejected: false }],
  [`/pulls/${PR_ID}/blast`]: { blast: { changed_symbols: [], downstream: [], summary: 's' }, degraded: false, reason: null },
};

/** A write-endpoint denylist. The stub throws if hit by ANY of the 4
 *  read-only tools, and if a non-GET method is ever used. */
const WRITE_DENYLIST = [/\/review$/, /\/conventions\/extract$/, /\/resync$/, /\/findings\/.+\/(accept|dismiss)$/];

function stubFetch(): typeof fetch {
  return (async (input: string | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    const method = (init?.method ?? 'GET').toUpperCase();
    if (method !== 'GET') throw new Error(`read-only tool issued a non-GET request: ${method} ${path}`);
    if (WRITE_DENYLIST.some((re) => re.test(path))) throw new Error(`read-only tool hit a write endpoint: ${path}`);
    const body = FIXTURES[path];
    if (body === undefined) throw new Error(`no fixture for ${path}`);
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
}

async function connectedClient() {
  const config = loadMcpConfig({ DEVDIGEST_MCP_LOG_LEVEL: 'silent' } as NodeJS.ProcessEnv);
  const server = createMcpServer({ config, fetchImpl: stubFetch() });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

describe('read-only tools never write, never hit the denylist', () => {
  it('list_agents succeeds with a canned GET response', async () => {
    const client = await connectedClient();
    const result = await client.callTool({ name: 'list_agents', arguments: {} });
    expect(result.isError).not.toBe(true);
  });

  it('get_findings succeeds with a canned GET response', async () => {
    const client = await connectedClient();
    const result = await client.callTool({ name: 'get_findings', arguments: { repo: 'acme/widgets', pr_number: 412 } });
    expect(result.isError).not.toBe(true);
  });

  it('get_conventions succeeds with a canned GET response', async () => {
    const client = await connectedClient();
    const result = await client.callTool({ name: 'get_conventions', arguments: { repo: 'acme/widgets' } });
    expect(result.isError).not.toBe(true);
  });

  it('get_blast_radius succeeds with a canned GET response', async () => {
    const client = await connectedClient();
    const result = await client.callTool({
      name: 'get_blast_radius',
      arguments: { repo: 'acme/widgets', pr_number: 412 },
    });
    expect(result.isError).not.toBe(true);
  });
});
