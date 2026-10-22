# Onion Architecture Skill — Sources

This skill (current version: **1.1.0**, see `SKILL.md` frontmatter) was built from a four-part research pass covering: Onion Architecture's core principles and layers, its relationship to Clean/Hexagonal architecture, TypeScript/Node/Fastify/Drizzle/Zod implementation patterns, and overengineering pitfalls — synthesized into one report and cross-checked against this repo's own `server/docs/architecture.md`, `server/AGENTS.md`, root `CLAUDE.md`, and the actual file layout of `server/src/modules/*`.

The skill content is split, mirroring `fastify-best-practices`' `rules/` convention rather than one monolithic file: `rules/layers.md` (the structural picture — layers, file-role mapping, when a module needs more structure) and `rules/enforcement.md` (the checkable rules — dependency direction, the adapters-off-limits-from-routes prohibition, Drizzle/Zod boundary, repository-interface threshold, named anti-patterns, decision checklist). `SKILL.md` itself is a lean index pointing at both, plus `examples.md`.

Every claim in `rules/*.md` and `examples.md` traces back to one of the sources below. Where a source is secondary (an aggregator or community blog corroborating, rather than originating, a claim) it's noted as such.

## How this skill was scoped

- **In scope**: dependency direction inside one `server/src/modules/<name>/` folder, when a module needs more structure than `routes.ts` alone, where Drizzle row types vs. domain shapes vs. Zod contracts belong, and when a repository interface is worth adding.
- **Explicitly out of scope** (to avoid duplicating sibling skills in this repo):
  - Fastify plugin registration, hooks, route schema syntax → `fastify-best-practices`
  - Drizzle schema definition, query/relation authoring, migrations → `drizzle-orm-patterns`
  - Zod schema syntax and parsing mechanics → `zod`
  - Postgres column types, indexing, constraints → `postgresql-table-design`

## Sources

| URL | Title | Relevance |
|---|---|---|
| https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/ | Jeffrey Palermo: The Onion Architecture, part 1 | Primary/original source — the dependency rule, named layers, motivation |
| https://herbertograca.com/2017/09/21/onion-architecture/ | herbertograca.com: Onion Architecture | Modern restatement; explicit disagreement with Palermo on repository-interface placement; "any outer layer can call any inner layer" relaxed-call-direction point |
| https://milanjovanovic.tech/blog/clean-architecture-vs-onion-vs-hexagonal | milanjovanovic.tech: Clean vs Onion vs Hexagonal Architecture | Direct comparison of the three patterns' vocabulary and organizing axis; "Onion is Hexagonal with a layering vocabulary" framing used to scope this skill against the repo's existing DI container |
| https://code-maze.com/dotnet-differences-between-onion-architecture-and-clean-architecture/ | Code Maze: Onion vs Clean Architecture in .NET | Corroborating comparison source |
| https://www.tothenew.com/blog/learn-onion-architecture-as-a-complete-beginner-and-implement-as-an-architect | tothenew.com: Learn Onion Architecture as a Complete Beginner | Four-layer breakdown (Domain/Application/Infrastructure/Presentation) |
| https://github.com/iammukeshm/OnionArchitecture | GitHub: iammukeshm/OnionArchitecture | Corroborates four-layer breakdown and "all layers depend only on core" framing |
| https://medium.com/@debasisdasnospdii/onion-architecture-an-example-folder-structure-nest-js-480ea9c6ec3a | Onion Architecture: An Example Folder Structure (Nest.js) | Node/TS folder-structure example (domain/application/infrastructure/ui) |
| https://medium.com/@myjob.rajesh/onion-architecture-in-node-js-05a475ada097 | Onion Architecture in Node.js | Node.js-specific restatement of inner-defines/outer-implements interface rule |
| https://sankhadip.medium.com/onion-architecture-in-node-js-with-typescript-5508612a4391 | Onion Architecture in Node.js with TypeScript | Additional Node/TS implementation example |
| https://github.com/marcoturi/fastify-boilerplate | GitHub: marcoturi/fastify-boilerplate | Concrete Fastify + DDD/CQRS boilerplate; per-feature vertical-slice layer contract (Route/Handler/Domain/Repository) and repository port/implementation split — the closest real-world analog to this repo's per-module layout |
| https://medium.com/@deivisonisidoro_94304/revolutionizing-software-development-unveiling-the-power-of-clean-architecture-with-typescript-5ee968357d35 | Building Robust Clean Architecture with TypeScript | Framework-independence and unit-testability rationale for the layered split |
| https://medium.com/@pethumshayam66/mastering-backend-development-a-practical-guide-to-clean-architecture-129de1bd1306 | Mastering Backend Development: A Practical Guide to Clean Architecture | Application-layer-owns-repository-interfaces framing; auth-at-interface-layer point |
| https://medium.com/@vimulatus/repository-pattern-in-nest-js-with-drizzle-orm-e848aa75ecae | Repository Pattern in Nest.js with Drizzle ORM | Drizzle-specific repository-interface-in-application-layer guidance |
| https://www.arnaudlanglade.com/repository-design-pattern/ | arnaudlanglade.com: Repository Design Pattern | "Business operations, not database operations" naming test for repository methods |
| https://medium.com/@abied.abiad/the-repository-pattern-your-gateway-to-clean-data-c72235f34916 | The Repository Pattern: A Necessary Abstraction or Over-Engineering? | Data-source-swap rationale for the repository pattern |
| https://blog.paulserban.eu/post/drizzle-orm-best-practices-principles-patterns-and-real-world-case-studies/ | Drizzle ORM Best Practices | Drizzle's plain-TypeScript-type generation (`$inferSelect`/`$inferInsert`) as a lower-friction basis for repository mapping than ActiveRecord-style ORMs |
| https://victorrentea.ro/blog/overengineering-in-onion-hexagonal-architectures/ | victorrentea.ro: Overengineering in Onion/Hexagonal Architectures | Primary source for the named overengineering anti-patterns (single-implementation interfaces, pass-through methods, DTO proliferation, domain/ORM duplication) and the CRUD-complexity decision rule — the backbone of this skill's "match ceremony to complexity" principle |
| https://medium.com/@gunjanmodi/is-clean-architecture-overengineering-ccca6ff34dcc | Is Clean Architecture Overengineering? | Corroborates overengineering risk for small/solo projects; converse case for complex/long-lived systems |
| https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/ | Alexis King: Parse, Don't Validate | Primary source for the parse-vs-validate distinction underlying Zod's role as this repo's Presentation→Application boundary |
| https://dev.to/eme_gug_0821b41b948be6516/why-your-typescript-still-crashes-in-production-validating-data-at-the-boundary-with-zod-n13 | Why Your TypeScript Still Crashes in Production: Validating Data at the Boundary with Zod | Zod-specific restatement of "parse once at the boundary, trust it after" |
| https://joshkaramuth.com/blog/tanstack-zod-dto/ | Stop Trusting Your API: Zod and React Query | "DTO = schema + parse function + inferred type" framing connecting Zod contracts to the DTO concept |

## Project-specific grounding (not external sources, but load-bearing)

- `server/docs/architecture.md` — confirms the existing DI container (`platform/container.ts`) and `src/adapters/*` already implement Ports & Adapters for cross-cutting concerns; this skill extends that, it doesn't introduce a parallel pattern.
- `server/AGENTS.md` — the schema-first Zod/`fastify-type-provider-zod` rule this skill treats as already-correct "parse, don't validate" at the module boundary; also the testcontainers-integration-test pattern cited as already covering most per-module repository swap needs.
- Root `CLAUDE.md` Naming conventions — the `routes.ts`/`service.ts`/`repository.ts`/`helpers.ts`/`constants.ts` file-role vocabulary this skill's dependency rule applies to.
- `server/src/modules/*` (read directly while building this skill) — the actual file layout behind every example: `agents`, `repo-intel`, `repos`, `reviews` have the full `routes.ts`/`service.ts`/`repository.ts` chain; `settings`, `workspace`, `polling`, `pulls` are `routes.ts`-only; `reviews/helpers.ts` already re-exports pure logic (`reduceReviews`/`sliceDiff`) from the framework-free `reviewer-core` engine; `reviews/repository.ts` returns Drizzle `$inferSelect` row types directly.
- `grep -n "container\.\(llm\|github\|git\|embedder\|secrets\)\b" */routes.ts` across `server/src/modules` (run while building this skill) — found `polling/routes.ts`, `pulls/routes.ts`, and `settings/routes.ts` all call `container.github()`/`container.llm()` directly from route handlers with no `service.ts`. This is the concrete, in-repo evidence behind `rules/enforcement.md`'s "Adapters Are Off-Limits From Routes" rule, and is documented there as a known pre-existing gap rather than silently treated as already-compliant.

## Scope note: `reviewer-core`

`reviewer-core` (the pure review engine — `openai` SDK + `zod`, no Fastify, no DB) is **not** covered by this skill. It has no `modules/<name>/` layout to apply the dependency-rule table to, and its own `AGENTS.md`/`docs/pipeline.md` already document its structure. This skill is scoped to `server/src/modules/**`, where the file-role vocabulary and the layering question this research answers both actually apply.
