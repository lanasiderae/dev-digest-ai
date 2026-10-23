import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { PrHistory } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { getPrHistory } from './service.js';

/**
 * history module.
 *   GET /pulls/:id/history → prior merged PRs in the same repo that touched
 *                             any of this PR's changed files. DB read only —
 *                             no model call, no GitHub call.
 *
 * Mirrors `blast/routes.ts`: `response: { 200: PrHistory }` validates the
 * payload against the contract before responding; `IdParams` turns a
 * malformed id into a clean 422 before the handler runs; workspace scoping
 * via `getContext` is mandatory. No rate-limit override — inherits the
 * global 120/min like every other read.
 */
export default async function historyRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;

  app.get(
    '/pulls/:id/history',
    { schema: { params: IdParams, response: { 200: PrHistory } } },
    async (req): Promise<PrHistory> => {
      const { workspaceId } = await getContext(container, req);
      return getPrHistory(container, workspaceId, req.params.id);
    },
  );
}
