import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import {
  ProjectContextDiscoveryQuery,
  ProjectContextDiscoveryResponse,
  ProjectContextDocumentQuery,
  ProjectContextPreview,
} from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { ProjectContextService } from './service.js';

/**
 * project-context module (L05, Feature 1 — "Project Context Folder").
 *   GET /repos/:id/project-context          → discovery (CTX-AC-01/04/07/08)
 *   GET /repos/:id/project-context/document → view-only preview (CTX-AC-02/07/08)
 *
 * Transport layer only — every business/safety decision (workspace repo
 * ownership, root-glob eligibility, symlink/traversal rejection, size caps)
 * lives in `ProjectContextService`; see its doc comment and
 * `adapters/git/tree-reader.ts` for why reads are git-object-addressed
 * rather than filesystem-path-addressed.
 */
export default async function projectContextRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new ProjectContextService(app.container);

  app.get(
    '/repos/:id/project-context',
    {
      schema: {
        params: IdParams,
        querystring: ProjectContextDiscoveryQuery,
        response: { 200: ProjectContextDiscoveryResponse },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.discover(workspaceId, req.params.id, req.query);
    },
  );

  app.get(
    '/repos/:id/project-context/document',
    {
      schema: {
        params: IdParams,
        querystring: ProjectContextDocumentQuery,
        response: { 200: ProjectContextPreview },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.preview(workspaceId, req.params.id, req.query);
    },
  );
}
