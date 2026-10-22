# Onion Architecture — Examples

Snippets below use this repo's real module names and shapes (verified directly against `server/src/modules/*` while writing this skill). See [rules/layers.md](rules/layers.md) and [rules/enforcement.md](rules/enforcement.md) for the rules these illustrate, and [README.md](README.md) for sources.

## 1. Route-only module is correct for CRUD — don't add empty layers

`settings/` has no `service.ts` or `repository.ts` — `routes.ts` talks to `container.db` directly:

```ts
// settings/routes.ts — GOOD: no added layer, because there's nothing to orchestrate
app.get('/settings', async (req) => {
  const { workspaceId } = await getContext(container, req);
  const rows = await container.db
    .select()
    .from(t.settings)
    .where(eq(t.settings.workspaceId, workspaceId));
  return rowsToSettings(rows);
});
```

```ts
// BAD: adding a pass-through service.ts/repository.ts "to match" other modules
// service.ts
export class SettingsService {
  constructor(private repo: SettingsRepository) {}
  getSettings(workspaceId: string) {
    return this.repo.getSettings(workspaceId); // adds nothing — pure forwarding
  }
}
// repository.ts
export class SettingsRepository {
  constructor(private db: Db) {}
  getSettings(workspaceId: string) {
    return this.db.select().from(t.settings).where(eq(t.settings.workspaceId, workspaceId));
  }
}
```
This is the "indirection without abstraction" anti-pattern — two new files and zero new behavior. `polling`, `pulls`, and `workspace` follow the same route-only shape as `settings` for the same reason.

## 2. Dependency direction inside a module that *does* have the full chain

`reviews/` has `routes.ts` → `service.ts` → `repository.ts`:

```ts
// GOOD: routes.ts only ever calls into service.ts
// reviews/routes.ts
const service = new ReviewService(container);
app.post('/pulls/:id/review', ..., async (req) => {
  const targets = await service.resolveTargets(workspaceId, body);
  const { runs, reviews } = await service.runReview(workspaceId, req.params.id, targets, req.log);
  return { pr_id: req.params.id, runs, reviews };
});
```

```ts
// BAD: a route reaching past service.ts straight into repository.ts
// reviews/routes.ts
import { ReviewRepository } from './repository.js';
const repo = new ReviewRepository(container.db);
app.get('/pulls/:id/reviews', async (req) => {
  return repo.getReviewsForPull(req.params.id); // skips the Application layer entirely —
                                                   // any orchestration/auth-shaping service.ts
                                                   // would normally add is now bypassed
});
```

## 3. Extracting pure domain logic once it's genuinely hard to unit-test

`reviews/helpers.ts` already does this for diff/finding-reduction logic, re-exporting `reduceReviews`/`sliceDiff` from the framework-free `reviewer-core` engine rather than leaving them embedded in `service.ts`:

```ts
// reviews/helpers.ts — GOOD: no Drizzle or Fastify types in the signature
export { reduceReviews, sliceDiff } from '@devdigest/reviewer-core';

export function findingRowToDto(row: FindingRow): ReviewDtoFinding {
  // pure mapping — takes a row shape in, returns a DTO shape out, no DB/HTTP access
  ...
}
```

Follow this precedent when a new business rule (e.g. a cost-allocation or ranking computation) starts needing a DB or a Fastify request just to exercise its logic in a test — pull the computation itself into a plain function first, and leave the DB/HTTP call as a thin wrapper around it.

```ts
// BAD: a pure computation trapped inside service.ts, forcing every test through the DB
export class ReviewService {
  async computeRunCost(runId: string) {
    const run = await this.repo.getRun(runId); // DB round-trip required just to test the math below
    return run.tokensIn * PRICE_IN + run.tokensOut * PRICE_OUT;
  }
}
```

```ts
// GOOD: the math is a plain function; the DB call is a one-line wrapper around it
// helpers.ts
export function computeRunCost(run: Pick<RunRow, 'tokensIn' | 'tokensOut'>): number {
  return run.tokensIn * PRICE_IN + run.tokensOut * PRICE_OUT; // no DB, unit-testable directly
}
// service.ts
async computeRunCost(runId: string) {
  return computeRunCost(await this.repo.getRun(runId));
}
```

## 4. Drizzle rows are fine in `service.ts` — not fine on the wire

```ts
// GOOD: repository returns the Drizzle-inferred row type; service.ts consumes it directly
// reviews/repository.ts
export type ReviewRow = typeof t.reviews.$inferSelect;
getReview(id: string): Promise<ReviewRow | undefined> { ... }
```

```ts
// BAD: that same row type reaching a route response / Zod contract unconverted
app.get('/reviews/:id', async (req) => {
  return repo.getReview(req.params.id); // ReviewRow — a later column rename in
                                         // db/schema/*.ts now silently breaks the API contract
});
```

```ts
// GOOD: map explicitly once there's divergence between the row shape and the response shape
// (reviews/helpers.ts already does exactly this for findings — see reviewRowToDto-style mappers)
app.get('/reviews/:id', async (req) => {
  const row = await repo.getReview(req.params.id);
  return row ? reviewRowToDto(row) : null; // Response shape is a Zod contract from vendor/shared
});
```

## 5. Adapters are off-limits from routes — even in a route-only module

```ts
// BAD — this is the actual current shape of settings/routes.ts's test-connection handler:
// a route calling container adapters directly, with no service.ts in the module at all.
app.post('/settings/test-connection', { schema: { body: ConnTestRequest } }, async (req) => {
  const { provider, key } = req.body;
  if (key) {
    await container.secrets.set(SECRET_KEY_BY_PROVIDER[provider], key);
  }
  if (provider === GITHUB_PROVIDER) {
    const gh = await container.github();          // adapter call straight from the route
    const login = await gh.currentLogin();
    return { provider, ok: true, message: `Connected as @${login}` };
  }
  const llm = await container.llm(provider);        // same issue
  const models = await llm.listModels();
  return { provider, ok: true, message: `OK — ${models.length} models available` };
});
```
This is a known, pre-existing gap in `settings/routes.ts`, `polling/routes.ts`, and `pulls/routes.ts` (all call `container.github()`/`container.llm()` directly) — flagged here as the anti-pattern, not something to mass-refactor on sight. The fix going forward, applied the next time one of these handlers is touched, or to any *new* route that needs an adapter:

```ts
// GOOD — the route stays Presentation-only; the adapter call moves to a plain
// exported function (no class needed just to hold one function):
// settings/service.ts
export async function testConnection(container: Container, provider: Provider, key?: string) {
  if (key) await container.secrets.set(SECRET_KEY_BY_PROVIDER[provider], key);
  if (provider === GITHUB_PROVIDER) {
    const login = await (await container.github()).currentLogin();
    return { provider, ok: true, message: `Connected as @${login}` };
  }
  const models = await (await container.llm(provider)).listModels();
  return { provider, ok: true, message: `OK — ${models.length} models available` };
}

// settings/routes.ts
app.post('/settings/test-connection', { schema: { body: ConnTestRequest } }, async (req) => {
  return testConnection(container, req.body.provider, req.body.key);
});
```
A plain `container.db` read in a route-only module (e.g. `settings`'s `GET /settings`) is **not** the same category — see `rules/enforcement.md` for why adapter calls get the stricter rule.

## 6. Repository interfaces: container adapters earn them, per-module repositories usually don't

```ts
// GOOD: platform/container.ts — a real interface for a genuinely swappable cross-cutting adapter
export interface GitClient {
  clone(url: string, dest: string): Promise<void>;
  diff(ref: string): Promise<string>;
}
// SimpleGitClient implements it for real; MockGitClient implements it for tests —
// two real implementations justify the interface.
```

```ts
// BAD: a speculative interface for a repository with exactly one implementation
// repos/repository.port.ts
export interface IReposRepository {
  getRepo(id: string): Promise<RepoRow | undefined>;
}
// repos/repository.ts
export class ReposRepository implements IReposRepository { ... } // the only implementation that
                                                                    // exists or is planned — the
                                                                    // interface adds a file with no
                                                                    // swap it actually enables; direct
                                                                    // construction + testcontainers
                                                                    // already cover the test need.
```
Add the interface only once a second real implementation (or a swap need direct construction can't satisfy) actually exists — not in anticipation of one.
