---
name: enforcement
description: The checkable dependency-direction rules for server/src/modules/<name>/ — what a route, service, or repository file is and isn't allowed to call, and the named anti-patterns to reject
metadata:
  tags: onion-architecture, dependency-rule, enforcement, repository-pattern, drizzle, zod
---

# Enforcement

These are the checkable rules — see `layers.md` for the structural picture they enforce, and `examples.md` for before/after snippets of each one.

## The Dependency Rule Inside a Module (CRITICAL)

Where the `routes.ts → service.ts → repository.ts` chain exists:
- Calls flow inward only. A route must never import a module's `repository.ts` directly once that module *has* one — that's Presentation reaching past Application straight into Infrastructure, the one thing the dependency rule forbids outright.
- `repository.ts` must never import `service.ts` (Infrastructure depending on Application inverts the rule) or `routes.ts`.
- Skipping a layer in the *inward* direction is fine — e.g. `routes.ts` calling a cross-module repository already constructed on the container (`container.agentsRepo`) directly is consistent with the rule, since "any outer layer can directly call any inner layer" without breaking direction ([herbertograca.com](https://herbertograca.com/2017/09/21/onion-architecture/)). What's forbidden is calling *outward* — a more-inner layer depending on something more Presentation-facing than itself.

## Adapters Are Off-Limits From Routes (CRITICAL)

A `routes.ts` handler must never call a container **adapter** method directly — `container.github()`, `container.llm(...)`, `container.embedder()`, `container.git`, `container.secrets.set(...)` — those calls belong in `service.ts`. Adapters are exactly the volatile, swappable, infrastructure-facing things the Ports & Adapters container exists to protect (`layers.md`); a route handler that calls one directly is doing real orchestration and error-handling work the Fastify boilerplate's own layer contract reserves for a handler/service, not a route: "**Route** — handles the HTTP request. Validates input, formats the response. No business logic" ([marcoturi/fastify-boilerplate](https://github.com/marcoturi/fastify-boilerplate)).

This is a **stricter rule than plain `container.db` reads** get (see `layers.md`'s CRUD-module exception) — a direct Drizzle read for a simple CRUD list is low-risk; a direct call to an external API client or an LLM provider is not, because it's exactly the dependency the architecture is named for protecting.

**Known gap, not a pattern to extend**: as of this skill's writing, `polling/routes.ts` and `pulls/routes.ts` call `container.github()` directly, and `settings/routes.ts`'s `POST /settings/test-connection` calls both `container.github()` and `container.llm(provider)` directly — all three predate this skill and have no `service.ts` today. That's existing debt, not something to mass-refactor on sight. Apply this rule going forward: any **new** route touching an adapter gets a service function (it doesn't need a full service *class* — a module can export a couple of plain functions from `service.ts` without inventing a `ReviewService`-style class if there's no state to hold), and if one of these three handlers is next touched for an unrelated reason, move its adapter call behind a service function at the same time rather than extending the direct-call pattern further.

## Repository Return Types: Drizzle Rows vs. Domain Shapes (HIGH)

- A repository method returning a raw Drizzle-inferred type (`typeof t.reviews.$inferSelect`) up to `service.ts` is fine and research-backed, not a violation to "fix" by hand-mapping every row into a parallel domain class — doing that for simple CRUD "quadruples CRUD code" for no benefit ([victorrentea.ro](https://victorrentea.ro/blog/overengineering-in-onion-hexagonal-architectures/)). Drizzle generates plain TypeScript types rather than ORM-managed entity classes specifically so this is low-friction ([blog.paulserban.eu](https://blog.paulserban.eu/post/drizzle-orm-best-practices-principles-patterns-and-real-world-case-studies/)).
- Repository *method names* should still speak the domain's language, not the database's — `getPull`, `computeRunCost` over `selectWhereIdEquals` — this repo's `ReviewRepository` already does this ([arnaudlanglade.com](https://www.arnaudlanglade.com/repository-design-pattern/)).
- **The boundary to actually guard**: a Drizzle row type reaching a Zod contract or an HTTP response unconverted. That's where a column rename in `db/schema/*.ts` silently becomes a breaking API change instead of a contained Infrastructure-layer edit. If a route's response shape and a table's row shape are about to diverge (a computed field, a renamed column, a field that shouldn't be exposed), that's the trigger to map explicitly in `service.ts` — not before.

## Zod Contracts as the Parse Boundary (HIGH)

- This repo's existing rule — Zod contracts from `src/vendor/shared` double as both route validation and response serialization via `fastify-type-provider-zod`, and handlers must not hand-roll `Schema.parse(req.body)` (per `server/AGENTS.md`) — is already correct "parse, don't validate" behavior at the module's Presentation→Application boundary: a parse produces a richer, trusted type in one step instead of a boolean plus a separate cast ([Alexis King: Parse, Don't Validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/)). Don't second-guess this convention or add a redundant re-validation step inside `service.ts` — once parsed at the route boundary, the data is trusted.
- The one judgment call: when a module's business rules need a shape **richer** than the wire contract (a derived field, an invariant the wire format can't express), that's the signal to introduce a distinct domain-input type for that rule — not something to do preemptively for every module's input.

## Repository Interfaces — When They're Worth It (MEDIUM)

Don't add a `*.repository.port.ts`-style interface for a single per-module repository just because "Onion Architecture has repository interfaces." "Question any interface with a single implementation, in the same module" ([victorrentea.ro](https://victorrentea.ro/blog/overengineering-in-onion-hexagonal-architectures/)) — this repo's existing testcontainers-based integration tests (`server/AGENTS.md`) and direct-construction unit tests already cover the swap need a module-local repository interface would otherwise exist to serve. Add the interface only once a repository genuinely needs a second implementation or a mock that direct construction can't provide.

## Named Anti-Patterns to Reject (MEDIUM)

- An interface with exactly one implementation and no concrete second-implementation plan — "speculative generality," a code smell, not architecture ([medium.com: Is Clean Architecture Overengineering?](https://medium.com/@gunjanmodi/is-clean-architecture-overengineering-ccca6ff34dcc)).
- A hand-rolled "domain DTO" that duplicates an existing Zod contract with an identical shape and no added invariant — pure maintenance burden with no benefit ([victorrentea.ro](https://victorrentea.ro/blog/overengineering-in-onion-hexagonal-architectures/)).
- A parallel domain-model class mirroring a Drizzle table 1:1 for a CRUD module, requiring manual sync on every schema change — "use a single model, but learn the ORM magic" instead ([victorrentea.ro](https://victorrentea.ro/blog/overengineering-in-onion-hexagonal-architectures/)).
- A `domain/` or `core/` folder added to a module before any function in it fails the "hard to unit-test without infrastructure" trigger in `layers.md`.
- An empty `service.ts`/`repository.ts` pair added to a route-only module purely to "match" modules that have the full chain, with no orchestration, adapter call, or second consumer to justify it.

## Quick Decision Checklist

- **New module?** — start with `routes.ts` alone, reading `container.db` directly for simple CRUD. Add `service.ts` the moment a handler needs orchestration across more than one table/call, or needs to call a container adapter.
- **New cross-file call in a module with the full chain?** — inward (routes→service, service→repository) or skipping straight to a more-inner layer? Fine. Outward (repository→service, repository→routes), or a route reaching past service into repository? Not allowed — restructure the call.
- **A route about to call `container.github()`, `container.llm()`, `container.embedder()`, `container.git`, or `container.secrets.set()` directly?** → stop — put that call in `service.ts`, even a plain exported function if the module has no class-based service yet.
- **A business rule getting hard to unit-test** because testing it needs a real DB, a Fastify request, or a live adapter? → extract it to a plain function with no Drizzle/Fastify/adapter types in its signature.
- **About to return a Drizzle row from a route handler or embed it in a Zod response contract?** → map it explicitly in `service.ts` first; don't let the row type reach the wire.
- **Tempted to add a repository interface?** → does this repository have, or will it soon have, a second real implementation? No → skip it.
- **Tempted to add a parallel domain model for a CRUD module?** → if the module's only job is read/write a table with no extra business rule, don't; the Drizzle-inferred type is the model.
