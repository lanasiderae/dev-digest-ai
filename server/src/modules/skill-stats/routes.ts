import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { SkillStats } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { SkillStatsService } from './service.js';

/**
 * skill-stats module — the Skills Lab analogue of agent-stats (L08):
 *   GET /skills/:id/stats → used-by/pull-frequency/accept-rate/findings
 *                           stats for one skill.
 *
 * Shares the exact `range=1d|30d`/`from`/`to` query shape as `GET
 * /agents/:id/stats` (same `resolveRange` helper, imported from agent-stats).
 */
const StatsRangeQuery = z.object({
  range: z.enum(['1d', '30d']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

export default async function skillStatsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new SkillStatsService(app.container);

  app.get(
    '/skills/:id/stats',
    { schema: { params: IdParams, querystring: StatsRangeQuery, response: { 200: SkillStats } } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.getSkillStats(workspaceId, req.params.id, {
        preset: req.query.range,
        from: req.query.from,
        to: req.query.to,
      });
    },
  );
}
