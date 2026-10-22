import type { FastifyInstance } from 'fastify';
import type { ZodTypeProvider } from 'fastify-type-provider-zod';
import { z } from 'zod';
import multipart from '@fastify/multipart';
import { SkillType } from '@devdigest/shared';
import { getContext } from '../_shared/context.js';
import { IdParams } from '../_shared/schemas.js';
import { NotFoundError, ValidationError } from '../../platform/errors.js';
import { MAX_ARCHIVE_BYTES } from './constants.js';
import { SkillsService } from './service.js';

/** `/skills/:id/versions/:version` — id is a uuid, version a positive integer. */
const VersionParams = z.object({
  id: z.string().uuid(),
  version: z.coerce.number().int().positive(),
});

/**
 * Skills module.
 *   GET    /skills                     → list (workspace-scoped)
 *   GET    /skills/:id                 → one skill
 *   POST   /skills                     → create (from-scratch AND the confirm
 *                                         step of every import flow)
 *   PUT    /skills/:id                 → update
 *   DELETE /skills/:id                 → delete
 *   GET    /skills/:id/versions        → body-version history (newest first)
 *   GET    /skills/:id/versions/:version → one body snapshot
 *   POST   /skills/import/url          → preview only, no DB write
 *   POST   /skills/import/archive      → preview only, no DB write (multipart)
 */

const CreateSkillBody = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  type: SkillType,
  body: z.string().min(1),
  source: z.enum(['manual', 'imported_url', 'extracted', 'community']).optional(),
  enabled: z.boolean().optional(),
  evidence_files: z.array(z.string()).optional(),
});

const UpdateSkillBody = z.object({
  name: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  type: SkillType.optional(),
  body: z.string().min(1).optional(),
  enabled: z.boolean().optional(),
});

const ImportUrlBody = z.object({ url: z.string().url() });

export default async function skillsRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new SkillsService(app.container);

  // Scoped to this module only (Fastify plugin encapsulation) — its request
  // body size limit is independent of the app's global 1MB default.
  await app.register(multipart, {
    limits: { fileSize: MAX_ARCHIVE_BYTES, files: 1 },
  });

  app.get('/skills', async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    return service.list(workspaceId);
  });

  app.get('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.get(workspaceId, req.params.id);
    if (!skill) throw new NotFoundError('Skill not found');
    return skill;
  });

  app.post('/skills', { schema: { body: CreateSkillBody } }, async (req, reply) => {
    const { workspaceId } = await getContext(app.container, req);
    const skill = await service.create(workspaceId, req.body);
    reply.status(201);
    return skill;
  });

  app.put(
    '/skills/:id',
    { schema: { params: IdParams, body: UpdateSkillBody } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const skill = await service.update(workspaceId, req.params.id, req.body);
      if (!skill) throw new NotFoundError('Skill not found');
      return skill;
    },
  );

  app.delete('/skills/:id', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const ok = await service.delete(workspaceId, req.params.id);
    if (!ok) throw new NotFoundError('Skill not found');
    return { ok: true };
  });

  app.get('/skills/:id/versions', { schema: { params: IdParams } }, async (req) => {
    const { workspaceId } = await getContext(app.container, req);
    const versions = await service.listVersions(workspaceId, req.params.id);
    if (!versions) throw new NotFoundError('Skill not found');
    return versions;
  });

  app.get(
    '/skills/:id/versions/:version',
    { schema: { params: VersionParams } },
    async (req) => {
      const { workspaceId } = await getContext(app.container, req);
      const version = await service.getVersion(workspaceId, req.params.id, req.params.version);
      if (!version) throw new NotFoundError('Skill version not found');
      return version;
    },
  );

  app.post('/skills/import/url', { schema: { body: ImportUrlBody } }, async (req) => {
    await getContext(app.container, req);
    return service.importFromUrl(req.body.url);
  });

  // Multipart — no JSON body schema; validated/parsed by hand below.
  app.post('/skills/import/archive', async (req) => {
    await getContext(app.container, req);
    const file = await req.file();
    if (!file) throw new ValidationError('No archive file was uploaded.');
    if (!/\.zip$/i.test(file.filename)) {
      throw new ValidationError('Only .zip archives are supported.');
    }
    const buffer = await file.toBuffer();
    // Defense-in-depth: don't rely solely on the multipart plugin's internal
    // fileSize limit behavior across versions — re-check explicitly.
    if (buffer.length > MAX_ARCHIVE_BYTES) {
      throw new ValidationError(`Archive is too large (max ${MAX_ARCHIVE_BYTES} bytes).`);
    }
    return service.importFromArchive(buffer);
  });
}
