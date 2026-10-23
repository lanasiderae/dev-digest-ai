import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { loadMcpConfig } from '../config.js';
import { createMcpServer, TOOL_COUNT } from '../server.js';

async function connectedClient() {
  const config = loadMcpConfig({ DEVDIGEST_MCP_LOG_LEVEL: 'silent' } as NodeJS.ProcessEnv);
  const server = createMcpServer({ config, fetchImpl: (() => Promise.reject(new Error('unused'))) as typeof fetch });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: 'test-client', version: '0.0.0' });
  await Promise.all([client.connect(clientTransport), server.connect(serverTransport)]);
  return { client, server };
}

describe('MCP tool contract', () => {
  it('exposes exactly the 5 designed tools, with readOnlyHint set only on the 4 read tools', async () => {
    const { client } = await connectedClient();
    const { tools } = await client.listTools();

    expect(tools).toHaveLength(TOOL_COUNT);
    expect(new Set(tools.map((t) => t.name))).toEqual(
      new Set(['list_agents', 'run_agent_on_pr', 'get_findings', 'get_conventions', 'get_blast_radius']),
    );

    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeTruthy();
      expect(tool.inputSchema.type).toBe('object');

      if (tool.name === 'run_agent_on_pr') {
        expect(tool.annotations?.readOnlyHint).not.toBe(true);
      } else {
        expect(tool.annotations?.readOnlyHint).toBe(true);
      }
    }
  });
});
