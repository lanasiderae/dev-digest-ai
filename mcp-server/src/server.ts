import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { McpConfig } from './config.js';
import { createLogger, type Logger } from './log.js';
import { createApi } from './api/client.js';
import { registerListAgentsTool } from './tools/list-agents.js';
import { registerGetFindingsTool } from './tools/get-findings.js';
import { registerGetConventionsTool } from './tools/get-conventions.js';
import { registerGetBlastRadiusTool } from './tools/get-blast-radius.js';
import { registerRunAgentOnPrTool } from './tools/run-agent-on-pr.js';

/** How many tools this server exposes — a hard design ceiling (see
 *  `mcp-server/AGENTS.md`), asserted by `tools-contract.test.ts`. */
export const TOOL_COUNT = 5;

/**
 * Builds the api client and registers exactly the 5 tools — nothing else
 * (no resources, no prompts). A factory (not a singleton) so tests can link
 * it to an in-memory transport with a stub `fetchImpl`.
 */
export function createMcpServer(opts: { config: McpConfig; log?: Logger; fetchImpl?: typeof fetch }): McpServer {
  const log = opts.log ?? createLogger(opts.config.logLevel);
  const api = createApi({
    baseUrl: opts.config.apiBase,
    requestTimeoutMs: opts.config.requestTimeoutMs,
    log,
    ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
  });

  const server = new McpServer({ name: 'devdigest-mcp', version: '0.0.0' });

  registerListAgentsTool(server, { api, log });
  registerGetFindingsTool(server, { api, log });
  registerGetConventionsTool(server, { api, log });
  registerGetBlastRadiusTool(server, { api, log });
  registerRunAgentOnPrTool(server, { api, log, runTimeoutMs: opts.config.runTimeoutMs });

  return server;
}
