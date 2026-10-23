import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { AgentStats, AgentPerf } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { AgentStatsService } from './service.js';

/**
 * agent-stats module (L08, Part 5 — Agent Performance Dashboard).
 *   GET /agents/:id/stats   → per-agent run/cost/duration/accept-rate stats
 *   GET /agents/performance → cross-agent dashboard (summary + per-agent rows
 *                             + cost breakdown by agent/by model)
 *
 * Both share the same query shape (`range=1d|30d` or `from`/`to`) so "reuse
 * the same aggregation rules" (brief, Part 5) is enforced by one shared
 * `resolveRange` helper, not by convention alone. This query schema is
 * colocated here (not added to `vendor/shared/contracts/observability.ts` or
 * `productionize.ts`) since it is a request-only shape local to these two
 * routes, not a cross-package response contract.
 */
const StatsRangeQuery = z.object({
  range: z.enum(['1d', '30d']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export default async function agentStatsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new AgentStatsService(app.container);

  app.get(
    '/agents/:id/stats',
    { schema: { params: IdParams, querystring: StatsRangeQuery, response: { 200: AgentStats } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.getAgentStats(workspaceId, req.params.id, {
        preset: req.query.range,
        from: req.query.from,
        to: req.query.to,
      });
    },
  );

  app.get(
    '/agents/performance',
    { schema: { querystring: StatsRangeQuery, response: { 200: AgentPerf } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.getAgentPerformance(workspaceId, {
        preset: req.query.range,
        from: req.query.from,
        to: req.query.to,
      });
    },
  );
}
