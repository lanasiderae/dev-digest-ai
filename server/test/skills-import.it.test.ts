import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ZipFile } from 'yazl';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[skills-import] Docker not available — skipping integration tests.');
}

async function buildZipBuffer(entries: { path: string; content: string }[]): Promise<Buffer> {
  const zip = new ZipFile();
  for (const e of entries) zip.addBuffer(Buffer.from(e.content, 'utf8'), e.path);
  zip.end();
  const chunks: Buffer[] = [];
  for await (const chunk of zip.outputStream as AsyncIterable<Buffer>) chunks.push(chunk);
  return Buffer.concat(chunks);
}

/** Hand-build a single-file multipart/form-data body (no multipart client lib
 *  needed — app.inject() accepts a raw Buffer payload + matching header). */
function buildMultipartBody(fieldName: string, filename: string, content: Buffer, boundary: string): Buffer {
  const head = Buffer.from(
    `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="${fieldName}"; filename="${filename}"\r\n` +
      `Content-Type: application/zip\r\n\r\n`,
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return Buffer.concat([head, content, tail]);
}

d('Skill import preview flows (Testcontainers pg)', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp(skillsUrlFetch?: (url: string) => Promise<{ name?: string; body: string }>) {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({ config, db: pg.handle.db, overrides: { skillsUrlFetch } });
  }

  it('POST /skills/import/url returns a preview and writes NOTHING to the DB', async () => {
    const before = await pg.handle.db.select().from(t.skills);
    const app = await makeApp(async () => ({ name: 'remote-skill', body: '# Remote\nBody.' }));

    const preview = await app.inject({
      method: 'POST',
      url: '/skills/import/url',
      payload: { url: 'https://example.com/skill.md' },
    });
    expect(preview.statusCode).toBe(200);
    expect(preview.json()).toEqual({ name: 'remote-skill', body: '# Remote\nBody.' });

    const after = await pg.handle.db.select().from(t.skills);
    expect(after).toHaveLength(before.length);
    await app.close();
  });

  it('confirming a URL-import preview via POST /skills persists with enabled=false', async () => {
    const app = await makeApp(async () => ({ name: 'remote-skill', body: '# Remote\nBody.' }));
    const preview = (
      await app.inject({
        method: 'POST',
        url: '/skills/import/url',
        payload: { url: 'https://example.com/skill.md' },
      })
    ).json();

    const created = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: {
        name: preview.name,
        description: 'Imported from a URL.',
        type: 'custom',
        body: preview.body,
        source: 'imported_url',
        // A client bug/bypass sending enabled:true must still be forced off server-side.
        enabled: true,
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().enabled).toBe(false);
    expect(created.json().source).toBe('imported_url');
    await app.close();
  });

  it('POST /skills/import/archive returns a resolved preview and writes NOTHING to the DB', async () => {
    const before = await pg.handle.db.select().from(t.skills);
    const app = await makeApp();
    const zipBuf = await buildZipBuffer([{ path: 'SKILL.md', content: '# Archive Skill\nBody text.' }]);
    const boundary = 'testboundary123';

    const res = await app.inject({
      method: 'POST',
      url: '/skills/import/archive',
      payload: buildMultipartBody('file', 'skill.zip', zipBuf, boundary),
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.resolvedIndex).toBe(0);
    expect(body.name).toBe('Archive Skill');
    expect(body.body).toContain('Body text.');

    const after = await pg.handle.db.select().from(t.skills);
    expect(after).toHaveLength(before.length);
    await app.close();
  });

  it('an archive with an executable entry is rejected (422), not persisted', async () => {
    const app = await makeApp();
    const zipBuf = await buildZipBuffer([
      { path: 'SKILL.md', content: '# Fine' },
      { path: 'run.sh', content: '#!/bin/sh\necho pwned' },
    ]);
    const boundary = 'testboundary456';

    const res = await app.inject({
      method: 'POST',
      url: '/skills/import/archive',
      payload: buildMultipartBody('file', 'skill.zip', zipBuf, boundary),
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
    });
    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('validation_error');
    await app.close();
  });

  it('confirming an archive-import preview via POST /skills persists with enabled=false', async () => {
    const app = await makeApp();
    const created = await app.inject({
      method: 'POST',
      url: '/skills',
      payload: {
        name: 'Archive Skill',
        description: 'Imported from an archive.',
        type: 'custom',
        body: '# Archive Skill\nBody text.',
        source: 'extracted',
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json().enabled).toBe(false);
    await app.close();
  });
});
