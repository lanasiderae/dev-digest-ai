import { z } from 'zod';
import { Agent } from '@devdigest/shared';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { DevDigestApi } from '../api/client.js';
import type { Logger } from '../log.js';

/**
 * `list_agents` — the configured review agents DevDigest can run. Read-only.
 * Use this to discover a valid `agent` argument for `run_agent_on_pr`. This
 * does NOT list repos or pull requests — use `gh` or GitHub's own MCP server
 * for that; this server only addresses data already imported into DevDigest.
 *
 * `system_prompt` is deliberately dropped from the response — it's the
 * largest field and would turn this into a raw API dump.
 */
export function registerListAgentsTool(server: McpServer, deps: { api: DevDigestApi; log: Logger }) {
  server.registerTool(
    'list_agents',
    {
      title: 'List configured review agents',
      description:
        'List the review agents configured in this DevDigest instance (name, provider, model, enabled). ' +
        'Use this to find a valid `agent` argument for run_agent_on_pr. Does not list repos or PRs.',
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const agents = await deps.api.get('/agents', z.array(Agent));
      const out = agents.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        provider: a.provider,
        model: a.model,
        enabled: a.enabled,
        strategy: a.strategy,
        skill_count: a.skill_count ?? 0,
      }));
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ agents: out, total: out.length }) }],
      };
    },
  );
}
