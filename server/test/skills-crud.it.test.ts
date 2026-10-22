import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[skills-crud] Docker not available — skipping integration tests.');
}

const createBody = {
  name: 'pr-quality-rubric',
  description: 'Flags low-quality PRs missing tests or docs.',
  type: 'rubric' as const,
  body: '# PR quality\nRequire tests for new behavior.',
};

d('Skills CRUD + versioning (Testcontainers pg)', () => {
  let pg: PgFixture;

  beforeAll(async () => {
    pg = await startPg();
    await seed(pg.handle.db);
  });
  afterAll(async () => {
    await pg?.stop();
  });

  function makeApp() {
    const config = loadConfig({ ...process.env, NODE_ENV: 'test' } as NodeJS.ProcessEnv);
    return buildApp({ config, db: pg.handle.db });
  }

  it('create → v1 snapshot exists, defaults enabled=true for manual source', async () => {
    const app = await makeApp();
    const created = await app.inject({ method: 'POST', url: '/skills', payload: createBody });
    expect(created.statusCode).toBe(201);
    const skill = created.json();
    expect(skill.version).toBe(1);
    expect(skill.enabled).toBe(true);
    expect(skill.source).toBe('manual');

    const versions = (
      await app.inject({ method: 'GET', url: `/skills/${skill.id}/versions` })
    ).json();
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ skill_id: skill.id, version: 1, body: createBody.body });
    await app.close();
  });

  it('updating the body bumps the version and appends a snapshot (newest-first)', async () => {
    const app = await makeApp();
    const skill = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json();

    const updated = (
      await app.inject({
        method: 'PUT',
        url: `/skills/${skill.id}`,
        payload: { body: '# PR quality v2\nRequire tests AND docs.' },
      })
    ).json();
    expect(updated.version).toBe(2);

    const versions = (
      await app.inject({ method: 'GET', url: `/skills/${skill.id}/versions` })
    ).json();
    expect(versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);
    expect(versions[0].body).toContain('v2');
    await app.close();
  });

  it('updating name/description/type/enabled only does NOT bump the version', async () => {
    const app = await makeApp();
    const skill = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json();

    await app.inject({
      method: 'PUT',
      url: `/skills/${skill.id}`,
      payload: { name: 'renamed-rubric', description: 'new desc', enabled: false },
    });

    const versions = (
      await app.inject({ method: 'GET', url: `/skills/${skill.id}/versions` })
    ).json();
    expect(versions).toHaveLength(1);

    const refetched = (await app.inject({ method: 'GET', url: `/skills/${skill.id}` })).json();
    expect(refetched.name).toBe('renamed-rubric');
    expect(refetched.enabled).toBe(false);
    expect(refetched.version).toBe(1);
    await app.close();
  });

  it('GET /skills/:id/versions/:version returns one snapshot', async () => {
    const app = await makeApp();
    const skill = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json();
    await app.inject({ method: 'PUT', url: `/skills/${skill.id}`, payload: { body: 'v2 body' } });

    const v1 = await app.inject({ method: 'GET', url: `/skills/${skill.id}/versions/1` });
    expect(v1.statusCode).toBe(200);
    expect(v1.json()).toMatchObject({ version: 1, body: createBody.body });
    await app.close();
  });

  it('delete cascades skill_versions', async () => {
    const app = await makeApp();
    const skill = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json();

    const del = await app.inject({ method: 'DELETE', url: `/skills/${skill.id}` });
    expect(del.statusCode).toBe(200);

    const remaining = await pg.handle.db
      .select()
      .from(t.skillVersions)
      .where(eq(t.skillVersions.skillId, skill.id));
    expect(remaining).toHaveLength(0);

    expect((await app.inject({ method: 'GET', url: `/skills/${skill.id}` })).statusCode).toBe(404);
    await app.close();
  });

  it('404s for an unknown skill / unknown version, and a cross-workspace skill', async () => {
    const app = await makeApp();
    const ghost = '00000000-0000-0000-0000-000000000000';
    expect((await app.inject({ method: 'GET', url: `/skills/${ghost}` })).statusCode).toBe(404);
    expect((await app.inject({ method: 'DELETE', url: `/skills/${ghost}` })).statusCode).toBe(404);

    const skill = (
      await app.inject({ method: 'POST', url: '/skills', payload: createBody })
    ).json();
    expect(
      (await app.inject({ method: 'GET', url: `/skills/${skill.id}/versions/99` })).statusCode,
    ).toBe(404);

    const [otherWs] = await pg.handle.db.insert(t.workspaces).values({ name: 'other' }).returning();
    const [foreign] = await pg.handle.db
      .insert(t.skills)
      .values({
        workspaceId: otherWs!.id,
        name: 'foreign-skill',
        description: 'd',
        type: 'custom',
        source: 'manual',
        body: 'b',
      })
      .returning();
    expect((await app.inject({ method: 'GET', url: `/skills/${foreign!.id}` })).statusCode).toBe(404);
    await app.close();
  });

  it('list and get annotate each skill with a real agent_count from agent_skills', async () => {
    const app = await makeApp();

    const linked = (await app.inject({ method: 'POST', url: '/skills', payload: createBody })).json();
    const unlinked = (
      await app.inject({
        method: 'POST',
        url: '/skills',
        payload: { ...createBody, name: 'unused-skill' },
      })
    ).json();

    const agentA = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Agent A', provider: 'openai', model: 'gpt-4o-mini', system_prompt: 'x' },
      })
    ).json();
    const agentB = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Agent B', provider: 'openai', model: 'gpt-4o-mini', system_prompt: 'x' },
      })
    ).json();

    for (const agent of [agentA, agentB]) {
      await app.inject({
        method: 'POST',
        url: `/agents/${agent.id}/skills`,
        payload: { skill_ids: [linked.id] },
      });
    }

    const list = (await app.inject({ method: 'GET', url: '/skills' })).json();
    expect(list.find((s: { id: string }) => s.id === linked.id)).toMatchObject({ agent_count: 2 });
    expect(list.find((s: { id: string }) => s.id === unlinked.id)).toMatchObject({ agent_count: 0 });

    const got = (await app.inject({ method: 'GET', url: `/skills/${linked.id}` })).json();
    expect(got.agent_count).toBe(2);
    await app.close();
  });
});
