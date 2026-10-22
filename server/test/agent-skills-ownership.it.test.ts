import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startPg, dockerAvailable, type PgFixture } from './helpers/pg.js';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/platform/config.js';
import { seed } from '../src/db/seed.js';
import * as t from '../src/db/schema.js';

const hasDocker = await dockerAvailable();
const d = hasDocker ? describe : describe.skip;

if (!hasDocker) {
  // eslint-disable-next-line no-console
  console.warn('[agent-skills-ownership] Docker not available — skipping integration tests.');
}

/**
 * The agent-side `agent_skills` link endpoints (POST /agents/:id/skills) were
 * already built before the skills module existed; they only verified the
 * AGENT's workspace, never the SKILL's. Now that skills actually exist to
 * link, this guards against linking an agent to another workspace's skill.
 */
d('Agent ↔ skill link cross-workspace guard (Testcontainers pg)', () => {
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

  it('cannot link an agent to a skill owned by a different workspace', async () => {
    const app = await makeApp();

    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Isolated Agent', provider: 'openai', model: 'gpt-4o-mini', system_prompt: 'x' },
      })
    ).json();

    const [otherWs] = await pg.handle.db.insert(t.workspaces).values({ name: 'other' }).returning();
    const [foreignSkill] = await pg.handle.db
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

    const setRes = await app.inject({
      method: 'POST',
      url: `/agents/${agent.id}/skills`,
      payload: { skill_ids: [foreignSkill!.id] },
    });
    expect(setRes.statusCode).toBe(404);

    const linkOneRes = await app.inject({
      method: 'POST',
      url: `/agents/${agent.id}/skills`,
      payload: { skill_id: foreignSkill!.id },
    });
    expect(linkOneRes.statusCode).toBe(404);

    const links = (
      await app.inject({ method: 'GET', url: `/agents/${agent.id}/skills` })
    ).json();
    expect(links).toHaveLength(0);
    await app.close();
  });

  it('can link, reorder, and unlink same-workspace skills', async () => {
    const app = await makeApp();
    const agent = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Normal Agent', provider: 'openai', model: 'gpt-4o-mini', system_prompt: 'x' },
      })
    ).json();

    const skillA = (
      await app.inject({
        method: 'POST',
        url: '/skills',
        payload: { name: 'skill-a', description: 'd', type: 'custom', body: 'a' },
      })
    ).json();
    const skillB = (
      await app.inject({
        method: 'POST',
        url: '/skills',
        payload: { name: 'skill-b', description: 'd', type: 'custom', body: 'b' },
      })
    ).json();

    const setRes = await app.inject({
      method: 'POST',
      url: `/agents/${agent.id}/skills`,
      payload: { skill_ids: [skillA.id, skillB.id] },
    });
    expect(setRes.statusCode).toBe(200);
    const links = setRes.json();
    expect(links.map((l: { skill_id: string }) => l.skill_id)).toEqual([skillA.id, skillB.id]);
    expect(links.map((l: { order: number }) => l.order)).toEqual([0, 1]);

    // reorder: B before A
    const reordered = (
      await app.inject({
        method: 'POST',
        url: `/agents/${agent.id}/skills`,
        payload: { skill_ids: [skillB.id, skillA.id] },
      })
    ).json();
    expect(reordered.map((l: { skill_id: string }) => l.skill_id)).toEqual([skillB.id, skillA.id]);
    await app.close();
  });

  it('list and get annotate each agent with a real skill_count from agent_skills', async () => {
    const app = await makeApp();

    const linked = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Linked Agent', provider: 'openai', model: 'gpt-4o-mini', system_prompt: 'x' },
      })
    ).json();
    const unlinked = (
      await app.inject({
        method: 'POST',
        url: '/agents',
        payload: { name: 'Unlinked Agent', provider: 'openai', model: 'gpt-4o-mini', system_prompt: 'x' },
      })
    ).json();

    const skillA = (
      await app.inject({
        method: 'POST',
        url: '/skills',
        payload: { name: 'count-skill-a', description: 'd', type: 'custom', body: 'a' },
      })
    ).json();
    const skillB = (
      await app.inject({
        method: 'POST',
        url: '/skills',
        payload: { name: 'count-skill-b', description: 'd', type: 'custom', body: 'b' },
      })
    ).json();

    await app.inject({
      method: 'POST',
      url: `/agents/${linked.id}/skills`,
      payload: { skill_ids: [skillA.id, skillB.id] },
    });

    const list = (await app.inject({ method: 'GET', url: '/agents' })).json();
    expect(list.find((a: { id: string }) => a.id === linked.id)).toMatchObject({ skill_count: 2 });
    expect(list.find((a: { id: string }) => a.id === unlinked.id)).toMatchObject({ skill_count: 0 });

    const got = (await app.inject({ method: 'GET', url: `/agents/${linked.id}` })).json();
    expect(got.skill_count).toBe(2);
    await app.close();
  });
});
