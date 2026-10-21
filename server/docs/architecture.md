# server architecture — DI container + adapters

How the Fastify API is composed: the request/DI flow, the adapter interfaces
behind the container, and how a module is registered. Deeper than
`server/README.md` (a map) and `server/CLAUDE.md` (a short agent brief) —
this explains *why* the pieces are shaped this way.

## Composition root: `buildApp()`

`server/src/app.ts`'s `buildApp()` is the single place everything gets wired:

1. Load `AppConfig` (`platform/config.ts`) and open the Postgres connection
   (`db/client.ts`), unless a test passes both in via `BuildAppOptions`.
2. Register the Zod type provider (`fastify-type-provider-zod`) as the
   validator/serializer compiler — this is what lets a route's `schema:
   { params, body, response }` double as both request validation and
   response serialization (see "Route validation" in `server/CLAUDE.md`).
3. Construct one `Container` (below) per app instance and decorate the
   Fastify instance with it (`app.container`), so every route handler reads
   `req.server.container.<adapter>`.
4. Register transport/security plugins — `@fastify/helmet`, `@fastify/cors`,
   `@fastify/rate-limit`, `fastify-sse-v2` — **before** the feature modules,
   so every module inherits them automatically rather than opting in per
   route.
5. Register every entry in `modules/index.ts`'s `modules` record as a
   Fastify plugin.
6. Await `ReviewService`'s reaper for orphaned `running` runs (left behind
   by a previous, now-dead process) before the server starts accepting
   requests — see the inline comment at `app.ts` for why this must be
   awaited, not fire-and-forgotten, and why it assumes a single API
   instance.
7. Install a structured error handler that maps `AppError` subclasses (and
   Zod validation failures) to a consistent `ApiErrorBody` envelope.

`buildApp()` returns the Fastify instance directly (not `.listen()`-ed) so
tests can call `app.inject()` without a real port — this is why every
integration test in `server/test/*.it.test.ts` builds its own app via
`buildApp({ db: pg.handle.db, overrides: {...} })` against a Testcontainers
Postgres, rather than hitting a running dev server.

## The DI container (`platform/container.ts`)

One `Container` instance per app, holding:

- **Eager**: `config`, `db`, `secrets` (`SecretsProvider`), `auth`
  (`AuthProvider`), `jobs` (`JobRunner`), `runBus` (the SSE event bus) —
  constructed in the constructor since every request needs them.
- **Lazy, cached getters**: `git`, `codeIndex`, `repoIntel`, `depgraph`,
  `tokenizer`, `priceBook`, `agentsRepo`, `reviewRepo` — each is a
  `this._x ??= new X(...)` getter, built on first access and reused for the
  container's lifetime. `repoIntel` is itself built from `this` (the
  container), since `RepoIntelService` needs several other adapters.
- **Lazy, async, secret-gated**: `github()`, `llm(id)`, `embedder()` — these
  need a secret key from `SecretsProvider` before they can construct a real
  client, so they're `async` methods rather than getters, and throw
  `ConfigError` (not a generic error) when the key is missing. `llm()`
  additionally caches by provider id in `llmCache`, and
  `invalidateSecretCaches()` clears that cache (plus `_github`/`_embedder`)
  after a secret is rewritten via `SecretsProvider.set`, so a freshly-saved
  key takes effect without restarting the process.

Every one of these is declared as an **interface** import from
`@devdigest/shared` (`GitClient`, `GitHubClient`, `LLMProvider`, `CodeIndex`,
`Embedder`, …), with the container choosing a concrete adapter class
(`SimpleGitClient`, `OctokitGitHubClient`, `OpenAIProvider`, …). This is the
whole point of the pattern: modules and services depend on the interface
type, never the concrete class, so `ContainerOverrides` (passed into
`buildApp({ overrides })`) can swap in a mock for any of them — this is
exactly what `server/src/adapters/mocks.ts` (`MockLLMProvider`,
`MockGitHubClient`, `MockGitClient`, …) plugs into for tests, per
`server/CLAUDE.md`'s "never real network calls or keys in unit tests" rule.

### Adapter directories (`server/src/adapters/*`)

Each subfolder implements one of the container's interfaces against a real
backend:

| Folder | Interface | Backend |
|---|---|---|
| `llm/` | `LLMProvider` | OpenAI, Anthropic (`openrouter`'s provider actually lives in `reviewer-core` and is imported back in, since the CI runner shares it) |
| `github/` | `GitHubClient` | Octokit |
| `git/` | `GitClient` | `simple-git` against `server/clones/**` |
| `codeindex/` | `CodeIndex` | ripgrep over the git working tree |
| `embedder/` | `Embedder` | OpenAI embeddings |
| `secrets/` | `SecretsProvider` | `~/.devdigest/secrets.json` (the one read chokepoint — see `server/CLAUDE.md` Do not touch) |
| `auth/` | `AuthProvider` | local no-auth (single-user course app) |
| `depgraph/` | `DepGraph` | dependency-cruiser, for repo-intel's import graph |
| `tokenizer/` | `Tokenizer` | `js-tiktoken`, for repo-map token budgeting |
| `astgrep/` | — | ast-grep bindings used by repo-intel's symbol extraction |

Pricing is a separate concern from any one adapter: `PriceBook`
(`platform/price-book.ts`) holds a synchronous `estimate(model, tokensIn,
tokensOut)` — synchronous because it's injected as a per-call cost hook into
the OpenRouter provider, which can't `await`. It prefers live OpenRouter
`/models` pricing (cached, refreshed on a TTL) and falls back to the static
table in `adapters/llm/pricing.ts` (`estimateCost`) for OpenAI/Anthropic
models, or on a cold/failed cache. An unpriced model returns `null`, never a
guessed number — callers (e.g. `reviews/helpers.ts`'s `computeRunCost`)
propagate that `null` rather than coercing it to `0`.

## Modules (`server/src/modules/*`)

Each feature module is a self-contained Fastify plugin at
`modules/<name>/routes.ts`, registered by name in `modules/index.ts`'s
`modules` record — **statically**, not via filesystem autoload, specifically
so the same registration code works under `tsx` (dev), the production build,
and vitest (native dynamic `import()` of `.ts` files isn't portable across
those). Adding a module is exactly: create `modules/<name>/routes.ts`
exporting a default Fastify plugin, add one import + one record entry in
`modules/index.ts`. This is the Part-0 starter's module set (`settings`,
`repos`, `pulls`, `polling`, `workspace`, `agents`, `reviews`, `repoIntel`);
each course lesson (L01–L08) adds its own module the same way, without
touching any other module or the shared Zod contracts.

Two repositories (`AgentsRepository`, `ReviewRepository`) are constructed
once in the container itself, not per-module, specifically so a module
doesn't have to reach into another module's folder to read shared entities
— `container.agentsRepo`/`container.reviewRepo` are the composition root's
way of sharing cross-cutting data access without modules importing each
other directly.
