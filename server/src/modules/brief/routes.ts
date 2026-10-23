import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { BriefGenerateRequest, BriefReadQuery, BriefReadResponse, PrBrief } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { BriefService } from './service.js';

/**
 * PR Brief module (L05, Feature 2 — BRIEF-AC-01–04/06/09–12).
 *   GET /pulls/:id/brief  → cache-only read, NO generation (`{brief, stale, stale_reasons}`).
 *   POST /pulls/:id/brief → generate/regenerate (`{agent_id}`, required —
 *                           a uuid or explicit `null`, never omitted).
 *
 * Transport layer only — every business/safety decision (budget, grounding,
 * staleness, concurrency) lives in `BriefService`; see its doc comment.
 */
export default async function briefRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new BriefService(app.container);

  app.get(
    '/pulls/:id/brief',
    {
      schema: {
        params: IdParams,
        querystring: BriefReadQuery,
        response: { 200: BriefReadResponse },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.read(workspaceId, req.params.id, req.query.agent_id);
    },
  );

  app.post(
    '/pulls/:id/brief',
    {
      schema: {
        params: IdParams,
        body: BriefGenerateRequest,
        response: { 200: PrBrief },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.generate(workspaceId, req.params.id, req.body.agent_id);
    },
  );
}
