import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { loadMcpConfig } from '../config.js';
import { createMcpServer } from '../server.js';

const REPO_ID = '11111111-1111-1111-1111-111111111111';
const PR_ID = '22222222-2222-2222-2222-222222222222';
const AGENT_ID = '33333333-3333-3333-3333-333333333333';
const RUN_ID = '44444444-4444-4444-4444-444444444444';
const SECRET_FINDING_TITLE = 'Hardcoded Stripe secret key — must never reach a log line';

interface Script {
  runsResponses: unknown[][];
  postCalls: string[];
  getCalls: string[];
}

/** A full RunSummary fixture (every field is a required, nullable key per
 *  the contract) with sane nulls, overridable per test. */
function runSummary(overrides: Record<string, unknown>) {
  return {
    run_id: RUN_ID,
    agent_id: AGENT_ID,
    agent_name: 'General Reviewer',
    provider: 'openai',
    model: 'gpt-4.1',
    status: 'running',
    error: null,
    duration_ms: null,
    tokens_in: null,
    tokens_out: null,
    cost: null,
    findings_count: null,
    grounding: null,
    ran_at: null,
    score: null,
    blockers: null,
    ...overrides,
  };
}

function stubFetch(script: Script): typeof fetch {
  let runsCallIndex = 0;
  return (async (input: string | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const path = url.replace(/^https?:\/\/[^/]+/, '');
    const method = (init?.method ?? 'GET').toUpperCase();

    if (method === 'GET') script.getCalls.push(path);
    if (method === 'POST') script.postCalls.push(path);

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
    if (path === '/agents') {
      return new Response(
        JSON.stringify([
          {
            id: AGENT_ID,
            name: 'General Reviewer',
            description: 'd',
            provider: 'openai',
            model: 'gpt-4.1',
            system_prompt: 's',
            enabled: true,
            version: 1,
          },
        ]),
        { status: 200 },
      );
    }
    if (path === `/pulls/${PR_ID}/review` && method === 'POST') {
      return new Response(
        JSON.stringify({ pr_id: PR_ID, runs: [{ run_id: RUN_ID, agent_id: AGENT_ID, agent_name: 'General Reviewer' }], reviews: [] }),
        { status: 200 },
      );
    }
    if (path === `/pulls/${PR_ID}/runs`) {
      const body = script.runsResponses[Math.min(runsCallIndex, script.runsResponses.length - 1)];
      runsCallIndex += 1;
      return new Response(JSON.stringify(body), { status: 200 });
    }
    if (path === `/pulls/${PR_ID}/reviews`) {
      return new Response(
        JSON.stringify([
          {
            id: 'review-1',
            pr_id: PR_ID,
            agent_id: AGENT_ID,
            run_id: RUN_ID,
            agent_name: 'General Reviewer',
            kind: 'review',
            verdict: 'request_changes',
            summary: 'summary',
            score: 40,
            model: 'gpt-4.1',
            cost: 0.02,
            grounding: '1/1',
            created_at: '2026-01-01T00:00:00Z',
            findings: [
              {
                id: 'f1',
                severity: 'CRITICAL',
                category: 'security',
                title: SECRET_FINDING_TITLE,
                file: 'src/config.ts',
                start_line: 12,
                end_line: 12,
                rationale: 'r',
                confidence: 0.9,
                kind: 'finding',
                review_id: 'review-1',
                accepted_at: null,
                dismissed_at: null,
              },
            ],
          },
        ]),
        { status: 200 },
      );
    }
    throw new Error(`no fixture for ${method} ${path}`);
  }) as unknown as typeof fetch;
}

async function connect(script: Script, runTimeoutMs = 300_000, logLevel: 'silent' | 'info' = 'silent') {
  const config = {
    ...loadMcpConfig({ DEVDIGEST_MCP_LOG_LEVEL: logLevel } as NodeJS.ProcessEnv),
    runTimeoutMs,
  };
  const server = createMcpServer({ config, fetchImpl: stubFetch(script) });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return client;
}

function textOf(result: Awaited<ReturnType<Client['callTool']>>) {
  const content = result.content as Array<{ type: string; text: string }>;
  return JSON.parse(content[0]!.text);
}

describe('run_agent_on_pr', () => {
  afterEach(() => vi.restoreAllMocks());

  it('issues exactly one POST, polls /runs until done, then returns the real persisted findings', async () => {
    const script: Script = {
      runsResponses: [
        [runSummary({ status: 'running' })],
        [runSummary({ status: 'done', tokens_in: 100, tokens_out: 50, duration_ms: 500, score: 40, blockers: 1, cost: 0.02, findings_count: 1, grounding: '1/1', ran_at: '2026-01-01T00:00:00Z' })],
      ],
      postCalls: [],
      getCalls: [],
    };
    const client = await connect(script);
    const result = await client.callTool({
      name: 'run_agent_on_pr',
      arguments: { repo: 'acme/widgets', pr_number: 412, agent: 'General Reviewer' },
    });

    expect(result.isError).not.toBe(true);
    expect(script.postCalls).toEqual([`/pulls/${PR_ID}/review`]);
    expect(script.getCalls.filter((c) => c === `/pulls/${PR_ID}/runs`).length).toBeGreaterThanOrEqual(2);

    const body = textOf(result);
    expect(body.status).toBe('done');
    expect(body.findings).toHaveLength(1);
    expect(body.findings[0].title).toBe(SECRET_FINDING_TITLE);
  }, 10_000);

  it('a failed run returns a non-error result carrying the error text', async () => {
    const script: Script = {
      runsResponses: [[runSummary({ status: 'failed', error: 'model timed out' })]],
      postCalls: [],
      getCalls: [],
    };
    const client = await connect(script);
    const result = await client.callTool({
      name: 'run_agent_on_pr',
      arguments: { repo: 'acme/widgets', pr_number: 412, agent: 'General Reviewer' },
    });
    expect(result.isError).not.toBe(true);
    const body = textOf(result);
    expect(body.status).toBe('failed');
    expect(body.error).toBe('model timed out');
  });

  it('a run that never settles within the timeout returns still_running, not isError, with a get_findings pointer', async () => {
    const script: Script = {
      runsResponses: [[runSummary({ status: 'running' })]],
      postCalls: [],
      getCalls: [],
    };
    const client = await connect(script, 50);
    const result = await client.callTool({
      name: 'run_agent_on_pr',
      arguments: { repo: 'acme/widgets', pr_number: 412, agent: 'General Reviewer' },
    });
    expect(result.isError).not.toBe(true);
    const body = textOf(result);
    expect(body.status).toBe('still_running');
    expect(body.run_id).toBe(RUN_ID);
    expect(body.message).toContain('get_findings');
  });

  it('never logs findings text to stderr', async () => {
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const script: Script = {
      runsResponses: [[runSummary({ status: 'done', tokens_in: 1, tokens_out: 1, duration_ms: 1, score: 1, blockers: 0, cost: 0, findings_count: 1, grounding: '' })]],
      postCalls: [],
      getCalls: [],
    };
    const client = await connect(script, 300_000, 'info');
    await client.callTool({
      name: 'run_agent_on_pr',
      arguments: { repo: 'acme/widgets', pr_number: 412, agent: 'General Reviewer' },
    });
    expect(stderrSpy.mock.calls.length).toBeGreaterThan(0);
    for (const [line] of stderrSpy.mock.calls) {
      expect(String(line)).not.toContain(SECRET_FINDING_TITLE);
    }
  });
});
