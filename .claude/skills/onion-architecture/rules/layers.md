---
name: layers
description: The Onion/Hexagonal layers this repo already has, and how the fixed server/src/modules/<name>/ file-role vocabulary maps onto them
metadata:
  tags: onion-architecture, layering, modules, dependency-injection, ports-and-adapters
---

# Layers

## The cross-cutting layer this repo already has

Onion Architecture's one rule: **dependencies point inward only**. Inner layers (domain/business rules) know nothing about outer layers (databases, HTTP frameworks, external APIs); outer layers depend on and implement interfaces the inner layers define, never the reverse ([Jeffrey Palermo: The Onion Architecture](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/)).

This repo already has that inversion wired up at the **cross-cutting** level, before this skill existed:
- `server/platform/container.ts` defines interfaces (`GitClient`, `GitHubClient`, `LLMProvider`, `Embedder`, `CodeIndex`, `SecretsProvider`, …) that modules depend on.
- `server/src/adapters/*` provides the concrete implementations (`SimpleGitClient`, `OctokitGitHubClient`, `OpenAIProvider`, …) selected by the DI container.
- Tests swap them for mocks via `src/adapters/mocks.ts`.
(All confirmed directly in `server/docs/architecture.md`.)

That's textbook Ports & Adapters, and Onion Architecture is widely described as "Hexagonal plus an internal layering vocabulary" ([milanjovanovic.tech](https://milanjovanovic.tech/blog/clean-architecture-vs-onion-vs-hexagonal)). **This skill's job is the layering *inside* one `modules/<name>/` folder** — the cross-cutting adapter boundary above is not something a module author re-implements; it's the thing a module *consumes* through the container.

## The four layers, mapped onto this repo's fixed file-role vocabulary

Root `CLAUDE.md`'s Naming conventions already fixes the file-role vocabulary for `server/src/modules/<name>/` (`routes.ts`, `service.ts`, `repository.ts`, `helpers.ts`/`constants.ts`). This skill maps that vocabulary onto Onion's layers rather than inventing new folder names:

| File | Onion layer | May call into |
|---|---|---|
| `routes.ts` | Presentation | `service.ts` — never an adapter or `repository.ts` directly (see `enforcement.md`) |
| `service.ts` | Application | `repository.ts`, container adapters (`container.github()`, `container.llm()`, …), other services via the container, pure domain logic |
| `repository.ts` | Infrastructure | the DB (`Db`/Drizzle) only — nothing else in the module |
| (pure functions in `helpers.ts`, or a dedicated file once warranted) | Domain | nothing — no Drizzle types, no Fastify types, no adapter calls in the signature |

There is no dedicated `domain.ts`/`domain/` file in this repo's convention today. "Domain" in this skill means a *property* a function has (framework-free, infrastructure-free), not a folder every module must grow — see the threshold below.

## Not every module has all three files, and that's correct

In this repo today:
- `agents`, `repo-intel`, `repos`, and `reviews` have the full `routes.ts` / `service.ts` / `repository.ts` chain.
- `settings`, `workspace`, `polling`, and `pulls` are `routes.ts`-only for their data reads, querying `container.db` directly in the handler (e.g. `settings/routes.ts`'s `GET /settings` runs a Drizzle query inline).

That split already matches the complexity each module actually has — don't "complete" a route-only module by adding empty `service.ts`/`repository.ts` wrappers that just forward calls (see `enforcement.md`'s anti-patterns). The one caveat: several of these same route-only modules call a **container adapter** (not just `container.db`) directly from the handler today — `polling/routes.ts` and `pulls/routes.ts` call `container.github()`, and `settings/routes.ts` calls both `container.github()` and `container.llm(provider)` directly inside `POST /settings/test-connection`. That's a pre-existing gap against the rule in `enforcement.md`, not a pattern to extend — see that file for why adapter calls are treated differently from a plain `container.db` read.

## When a module needs an explicit Domain split vs. when it doesn't

- **CRUD-like modules** (`settings`, `workspace`, `polling`, `pulls` today) — `routes.ts` alone, or `routes.ts → service.ts → repository.ts` with `service.ts` as a thin pass-through, *is* correctly structured, not incomplete. A thin `service.ts` is the cost of keeping the Presentation/Infrastructure boundary enforceable once a module needs one — it's not a smell to "simplify away" by merging it back into `routes.ts`.
- **Modules with genuine orchestration or business rules** (`reviews` — target resolution, multi-agent fan-out, cost computation, SSE event emission; `repo-intel` — ranking/indexing) are where pulling out **pure, framework-free logic** — functions with no Drizzle types, no Fastify types, and no adapter calls in their signatures — out of `service.ts`/`helpers.ts` has real payoff: that logic becomes unit-testable without mocking infrastructure, and it's the actual "Domain" Onion Architecture is named for. `reviews/helpers.ts` already does this for `reduceReviews`/`sliceDiff` (re-exported from the framework-free `reviewer-core` engine) — follow that precedent for new pure rules rather than leaving them embedded in `service.ts`.
- The trigger for extracting logic is concrete and testable, not aesthetic: "is this business rule becoming hard to unit-test because testing it requires standing up a DB, a Fastify request, or a live adapter?" If yes, extract it into a plain function (it can live in `helpers.ts` if the module has no dedicated domain file yet — don't invent a `domain.ts` for one function). If no, leave it where it is.
- The same threshold applies in the other direction: a route-only module should gain a `service.ts` only once it actually needs orchestration across more than one table/call, calls a container adapter (per `enforcement.md`), or a second route handler needs to share logic that currently lives inline — not preemptively to "match" modules that have the full chain.

## Repository interfaces — when they're worth a place in the layering

The container's existing adapter pattern (`GitClient`, `LLMProvider`, etc. in `platform/container.ts`) is the model for when an interface earns a place in the layering: genuinely swappable cross-cutting implementations, selected at the composition root, swapped for mocks in tests. A single per-module `repository.ts` is *not* automatically in the same category — see `enforcement.md` for the concrete threshold before adding a `*.repository.port.ts`-style interface.
