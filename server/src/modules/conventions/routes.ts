import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { ConventionsService } from './service.js';

/**
 * Conventions module.
 *   POST  /repos/:id/conventions/extract → scan the clone, persist fresh
 *                                           candidates (replacing any prior
 *                                           ones the user hasn't accepted)
 *   GET   /repos/:id/conventions         → list candidates for the repo
 *   PATCH /conventions/:id               → accept/reject or edit a candidate's rule
 */

const UpdateConventionBody = z.object({
  rule: z.string().min(1).optional(),
  accepted: z.boolean().optional(),
  rejected: z.boolean().optional(),
});

export default async function conventionsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new ConventionsService(app.container);

  app.post(
    '/repos/:id/conventions/extract',
    { schema: { params: IdParams } },
    async (req, reply) => {
      const { workspaceId } = await getContext(app.container, req);
      const candidates = await service.extract(workspaceId, req.params.id);
      reply.status(201);
      return candidates;
    },
  );

  app.get('/repos/:id/conventions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId, req.params.id);
  });

  app.patch(
    '/conventions/:id',
    { schema: { params: IdParams, body: UpdateConventionBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.update(workspaceId, req.params.id, req.body);
    },
  );
}
