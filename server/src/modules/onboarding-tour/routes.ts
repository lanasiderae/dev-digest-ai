import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { OnboardingGenerateResponse, OnboardingReadResponse } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { OnboardingTourService } from './service.js';

/**
 * Onboarding Tour module (L05, Feature 3 — ONBOARD-AC-01–08).
 *   GET /repos/:id/onboarding  → cache-only read, NO generation
 *                                (`{tour}`).
 *   POST /repos/:id/onboarding → generate/regenerate
 *                                (`{tour, cached_tour_preserved}`).
 *
 * Distinct from the pre-existing, unrelated CLIENT page route `/onboarding`
 * (the add-repository screen) — client page routes and server API routes
 * are different namespaces, and no server route currently backs that screen
 * at all (confirmed by grep before this module was added). Also distinct
 * from any route registered under the module name `onboarding` — this
 * module is deliberately named `onboarding-tour` to avoid that confusion;
 * see `service.ts`'s doc comment for the full provenance.
 *
 * Transport layer only — every business/safety decision (eligibility,
 * budget, grounding, concurrency, cache preservation) lives in
 * `OnboardingTourService`; see its doc comment.
 */
export default async function onboardingTourRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new OnboardingTourService(app.container);

  app.get(
    '/repos/:id/onboarding',
    {
      schema: {
        params: IdParams,
        response: { 200: OnboardingReadResponse },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.read(workspaceId, req.params.id);
    },
  );

  app.post(
    '/repos/:id/onboarding',
    {
      schema: {
        params: IdParams,
        response: { 200: OnboardingGenerateResponse },
      },
    },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      return service.generate(workspaceId, req.params.id);
    },
  );
}
