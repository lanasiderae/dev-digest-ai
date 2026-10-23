/** Isolated browser-test entrypoint: real services/DB, no secret access. */
import { buildApp } from './app.js';
import { loadConfig } from './platform/config.js';

if (process.env.E2E_FIXTURES !== '1') throw new Error('E2E_FIXTURES=1 is required');
// Use the existing test-mode rate-limit exemption: ten navigation/reload
// journeys otherwise exceed the interactive API's 120 requests/minute.
const config = { ...loadConfig(), nodeEnv: 'test' as const };
const app = await buildApp({ config, overrides: {
  secrets: { get: async () => undefined },
} });
// Read-only smoke flows must never accidentally invoke paid generation.
app.addHook('onRequest', async (request, reply) => {
  if (request.method === 'POST' && /\/(brief|onboarding|review)(?:\?|$)/.test(request.url)) {
    return reply.code(403).send({ error: 'Generation is disabled in deterministic browser smoke tests.' });
  }
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => { await app.close(); process.exit(0); });
}
await app.listen({ port: config.apiPort, host: '0.0.0.0' });
