import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { BlastRadiusResponse } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { getBlastRadius } from './service.js';

/**
 * blast module.
 *   GET /pulls/:id/blast → per-symbol downstream callers for a PR's changed
 *                           symbols, grouped from repo-intel's already-computed
 *                           `getBlastRadius` result. DB + repo-intel read only —
 *                           no model call, no AST/import-graph rebuild on the
 *                           hot path.
 *
 * `response: { 200: BlastRadiusResponse }` is what satisfies "validate the
 * final payload against the contract before responding" — `/pulls/:id/smart-diff`
 * already sets this precedent. `IdParams` turns a malformed id into a clean
 * 422 before the handler runs; workspace scoping via `getContext` is mandatory.
 * No rate-limit override — inherits the global 120/min like every other read.
 */
export default async function blastRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const { container } = app;

  app.get(
    '/pulls/:id/blast',
    { schema: { params: IdParams, response: { 200: BlastRadiusResponse } } },
    async (req): Promise<BlastRadiusResponse> => {
      const { workspaceId } = await getContext(container, req);
      return getBlastRadius(container, workspaceId, req.params.id);
    },
  );
}
