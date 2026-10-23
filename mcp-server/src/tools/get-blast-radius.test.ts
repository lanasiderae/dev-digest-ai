import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import type { BlastRadiusResponse } from '@devdigest/shared';
import { loadMcpConfig } from '../config.js';
import { createMcpServer } from '../server.js';
import { wrapUntrusted } from '../untrusted.js';

const REPO_ID = '11111111-1111-1111-1111-111111111111';
const PR_ID = '22222222-2222-2222-2222-222222222222';

function stubFetch(blast: BlastRadiusResponse): { fetchImpl: typeof fetch; calls: string[] } {
  const calls: string[] = [];
  const fetchImpl = (async (input: string | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    calls.push(path);
    if (path === '/repos') {
      return new Response(
        JSON.stringify([
          {
            id: REPO_ID,
            workspace_id: 'w1',
            owner: 'acme',
            name: 'widgets',
            full_name: 'acme/widgets',
            default_branch: 'main',
            clone_path: null,
            last_polled_at: null,
            created_by: null,
          },
        ]),
        { status: 200 },
      );
    }
    if (path === `/repos/${REPO_ID}/pulls`) {
      return new Response(
        JSON.stringify([
          {
            id: PR_ID,
            number: 412,
            title: 't',
            author: 'a',
            branch: 'b',
            base: 'main',
            head_sha: 'deadbeef',
            additions: 1,
            deletions: 0,
            files_count: 1,
            status: 'open',
          },
        ]),
        { status: 200 },
      );
    }
    if (path === `/pulls/${PR_ID}/blast`) {
      return new Response(JSON.stringify(blast), { status: 200 });
    }
    throw new Error(`no fixture for ${path}`);
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

async function callBlastTool(blast: BlastRadiusResponse) {
  const { fetchImpl, calls } = stubFetch(blast);
  const config = loadMcpConfig({ DEVDIGEST_MCP_LOG_LEVEL: 'silent' } as NodeJS.ProcessEnv);
  const server = createMcpServer({ config, fetchImpl });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  const result = await client.callTool({
    name: 'get_blast_radius',
    arguments: { repo: 'acme/widgets', pr_number: 412 },
  });
  return { result, calls };
}

function textOf(result: Awaited<ReturnType<typeof callBlastTool>>['result']) {
  const content = result.content as Array<{ type: string; text: string }>;
  return JSON.parse(content[0]!.text);
}

describe('get_blast_radius', () => {
  it('passes through a healthy, already-grouped payload — callers as file:line (name), per-symbol endpoints, one GET /pulls/:id/blast', async () => {
    const { result, calls } = await callBlastTool({
      blast: {
        changed_symbols: [
          { name: 'rateLimit', file: 'a.ts', kind: 'function' },
          { name: 'orphan', file: 'a.ts', kind: 'function' },
        ],
        downstream: [
          {
            symbol: 'rateLimit',
            callers: [{ name: 'publicRouter', file: 'b.ts', line: 23 }],
            endpoints_affected: ['GET /x'],
            crons_affected: [],
          },
        ],
        summary: 'ignored by the server test, passed through here',
      },
      degraded: false,
      reason: null,
    });

    const body = textOf(result);
    expect(body.degraded).toBe(false);
    const rateLimit = body.downstream.find((d: { symbol: string }) => d.symbol === 'rateLimit');
    expect(rateLimit.callers).toEqual([wrapUntrusted('b.ts:23 (publicRouter)')]);
    expect(rateLimit.endpoints_affected).toEqual(['GET /x']);

    // Zero-caller symbol is explicitly marked, not omitted.
    const orphan = body.downstream.find((d: { symbol: string }) => d.symbol === 'orphan');
    expect(orphan.callers).toBe('no callers found');

    // No re-grouping of its own — exactly one call to the blast endpoint.
    expect(calls.filter((c) => c.endsWith('/blast'))).toHaveLength(1);
  });

  it('explains a healthy map with no changed symbols', async () => {
    const { result } = await callBlastTool({
      blast: { changed_symbols: [], downstream: [], summary: 'No changed symbols detected.' },
      degraded: false,
      reason: null,
    });
    expect(textOf(result).empty_state).toBe('No changed code symbols.');
  });

  it('surfaces degraded:true with its reason', async () => {
    const { result } = await callBlastTool({
      blast: { changed_symbols: [], downstream: [], summary: 's' },
      degraded: true,
      reason: 'index_partial',
    });
    const body = textOf(result);
    expect(body.degraded).toBe(true);
    expect(body.degraded_reason).toBe('index_partial');
    expect(body.empty_state).toBeUndefined();
  });
});
