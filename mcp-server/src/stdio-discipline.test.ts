import { describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';

/**
 * Spawns the REAL entrypoint (`tsx src/index.ts`) and drives it over raw
 * stdio — no test-only env backdoor to inject a fetch stub into the real
 * process. The one `tools/call` uses a deliberately invalid argument (zod
 * rejects it before any HTTP request), keeping this test network-free.
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TSX_BIN = path.join(ROOT, 'node_modules', '.bin', 'tsx');
const ENTRYPOINT = path.join(ROOT, 'src', 'index.ts');

interface JsonRpcLine {
  jsonrpc: '2.0';
  id?: number;
  method?: string;
  result?: unknown;
  error?: unknown;
}

function parseLines(buf: string): JsonRpcLine[] {
  return buf
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as JsonRpcLine);
}

describe('stdio discipline', () => {
  it('every stdout line is valid JSON-RPC 2.0; startup log is stderr-only; exits cleanly on close', async () => {
    const child = spawn(TSX_BIN, [ENTRYPOINT], {
      env: { ...process.env, DEVDIGEST_API_BASE: 'http://127.0.0.1:3001' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString('utf8')));
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString('utf8')));

    function send(msg: unknown) {
      child.stdin.write(JSON.stringify(msg) + '\n');
    }

    async function waitForResponse(id: number, timeoutMs = 10_000): Promise<JsonRpcLine> {
      const start = Date.now();
      for (;;) {
        const lines = parseLines(stdout);
        const match = lines.find((l) => l.id === id);
        if (match) return match;
        if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for response id=${id}`);
        await new Promise((r) => setTimeout(r, 25));
      }
    }

    send({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: LATEST_PROTOCOL_VERSION,
        capabilities: {},
        clientInfo: { name: 'stdio-discipline-test', version: '0.0.0' },
      },
    });
    await waitForResponse(1);
    send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });

    send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
    const listResponse = await waitForResponse(2);
    expect(listResponse.error).toBeUndefined();

    // Deliberately invalid: `repo` fails RepoArg's regex, `pr_number` is negative —
    // zod rejects this before the handler runs, so no HTTP request is made.
    send({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'get_blast_radius', arguments: { repo: 'not-a-valid-repo', pr_number: -1 } },
    });
    const callResponse = await waitForResponse(3);
    // Either a protocol-level error or a tool-level isError result is acceptable —
    // what matters is that it settled without ever reaching the network.
    expect(callResponse.error !== undefined || (callResponse.result as { isError?: boolean } | undefined)?.isError).toBeTruthy();

    // Every stdout line so far parses as JSON-RPC 2.0.
    for (const line of parseLines(stdout)) {
      expect(line.jsonrpc).toBe('2.0');
    }
    // The startup log line is stderr-only — never on stdout.
    expect(stderr).toContain('devdigest-mcp started');
    expect(stdout).not.toContain('devdigest-mcp started');

    child.stdin.end();
    const exitCode = await new Promise<number | null>((resolve) => child.on('close', resolve));
    expect(exitCode).not.toBeNull();
  }, 20_000);

  it('a disallowed non-loopback DEVDIGEST_API_BASE without opt-in exits 1 with exactly one stderr line and nothing on stdout', async () => {
    const child = spawn(TSX_BIN, [ENTRYPOINT], {
      env: { ...process.env, DEVDIGEST_API_BASE: 'http://example.com' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => (stdout += d.toString('utf8')));
    child.stderr.on('data', (d: Buffer) => (stderr += d.toString('utf8')));

    const exitCode = await new Promise<number | null>((resolve) => child.on('close', resolve));
    expect(exitCode).toBe(1);
    expect(stdout).toBe('');
    const stderrLines = stderr.split('\n').filter((l) => l.length > 0);
    expect(stderrLines).toHaveLength(1);
    expect(stderrLines[0]).toContain('DEVDIGEST_MCP_ALLOW_REMOTE_API');
  }, 10_000);
});
