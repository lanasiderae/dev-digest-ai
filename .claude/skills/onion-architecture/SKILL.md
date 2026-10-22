---
name: onion-architecture
version: 1.1.0
description: "Onion Architecture for this repo's backend modules (server/src/modules/<name>/): dependency direction inside a module (routes.ts → service.ts → repository.ts, inward only), the prohibition on calling container adapters (LLM/GitHub/git/secrets) or repository.ts directly from routes.ts, when a module needs an explicit domain split vs. when it doesn't, where Drizzle row types vs. Zod contracts vs. domain shapes belong, and when a repository interface is actually worth adding. Use this whenever creating a new server module, adding a cross-file call inside an existing module, wiring a new adapter call, deciding where a business rule belongs, or reviewing a PR for layering/coupling inside server/src/modules/**. Scoped strictly to dependency DIRECTION and LAYER PLACEMENT inside a module — it does not cover Fastify plugin/route mechanics (see fastify-best-practices), Drizzle schema/query authoring (see drizzle-orm-patterns), Zod schema syntax (see zod), or Postgres schema design (see postgresql-table-design)."
---

# Onion Architecture

**Version 1.1.0** · For sources, see [README.md](README.md).

Onion Architecture's one rule: **dependencies point inward only**, enforced here via Dependency Inversion — outer layers implement interfaces the inner layers own, never the reverse ([Jeffrey Palermo](https://jeffreypalermo.com/2008/07/the-onion-architecture-part-1/)). This repo already has that inversion wired up at the cross-cutting level (`server/platform/container.ts` + `server/src/adapters/*`, textbook Ports & Adapters per `server/docs/architecture.md`). This skill's job is the layering *inside* one `server/src/modules/<name>/` folder, where the fixed file-role vocabulary from root `CLAUDE.md` (`routes.ts`/`service.ts`/`repository.ts`/`helpers.ts`/`constants.ts`) already exists but the inward-call rule wasn't written down anywhere checkable until now.

## When to use

Use this skill when you need to:
- Create a new `server/src/modules/<name>/` module, or decide whether it needs `service.ts`/`repository.ts` at all
- Add a call between files inside an existing module (route → service, service → repository, service → container adapter)
- Decide where a business rule or a data shape (Drizzle row, Zod contract, domain shape) belongs
- Review a PR for layering, dependency-direction, or adapter-coupling issues inside `server/src/modules/**`

## How to use

Read the rule files for the full picture and the citations behind it:

- [rules/layers.md](rules/layers.md) — the layers, the file-role-to-layer mapping, which modules have the full chain vs. route-only, and when a module needs more structure
- [rules/enforcement.md](rules/enforcement.md) — the checkable rules: dependency direction, the adapters-off-limits-from-routes prohibition, Drizzle/Zod boundary placement, repository-interface threshold, named anti-patterns, and the closing decision checklist
- [examples.md](examples.md) — before/after code for every rule above, using this repo's real module names
- [README.md](README.md) — every source this skill is grounded in, plus the research notes/report this skill was built from

**Recommended reading order:**
- **Creating a new module?** → `layers.md` (structure) → `enforcement.md`'s checklist
- **Adding a call to a container adapter?** → `enforcement.md`'s "Adapters Are Off-Limits From Routes"
- **Reviewing a PR for layering?** → `enforcement.md` top to bottom, cross-checking `examples.md`

## Severity Levels

- **CRITICAL** — Violates the dependency rule itself (an inner file reaching into an outer one, a route calling a repository or adapter directly) or collapses the Presentation/Application boundary
- **HIGH** — Doesn't break the rule today but creates a real coupling or breaking-change risk as the module grows
- **MEDIUM** — Ceremony/ergonomics judgment calls — getting these "wrong" doesn't break anything, it just adds or removes structure at the wrong time

## Guiding Principle: Match Ceremony to Complexity

Applying full Onion/Clean/Hexagonal layering to every module regardless of complexity is a **named overengineering anti-pattern**, not best practice: "if the domain complexity of your problem is fairly low (CRUD-like)... Onion/Hexagonal might not be the best choice" ([victorrentea.ro](https://victorrentea.ro/blog/overengineering-in-onion-hexagonal-architectures/)). Every rule in `rules/*.md` is a *threshold* rule — add a layer, an interface, or a type split only once a concrete trigger exists (real orchestration, an adapter call, a second implementation) — never preemptively "because the pattern says so." This is the same shape as this repo's own `frontend-ui-architecture` skill's "rule of two."

## Core Principles

- **Dependencies point inward, always** — a route never reaches past `service.ts` into `repository.ts` or a container adapter.
- **Adapters are the one thing worth protecting even in a route-only module** — a plain `container.db` read is low-risk; a direct `container.github()`/`container.llm()` call from a route is not.
- **Ceremony follows complexity, not the pattern's name** — a route-only module with no `service.ts`/`repository.ts` is correctly structured, not incomplete.
- **Parse at the boundary, trust it after** — this repo's existing Zod/`fastify-type-provider-zod` convention already does this correctly.
- **Question every interface with one implementation** — the container's adapter interfaces earned theirs; a lone per-module repository usually hasn't yet.
