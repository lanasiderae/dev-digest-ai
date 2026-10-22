---
name: frontend-ui-architecture
version: 1.2.0
description: "Frontend code architecture and project organization for React/Next.js apps — where components, hooks, utils, constants, types, and business-logic/data-access layers should physically live in the codebase, feature-based vs type-based folder structures, the colocate-vs-centralize decision, file/folder naming conventions, and the Next.js project-structure primitives (private folders, route groups) used for organization. Use this whenever creating a new component/hook/util/constants/types file, deciding where a piece of logic belongs, scaffolding a new feature's folder structure, splitting or relocating files during a refactor, or reviewing a PR for project structure and file organization — even when the user just asks 'where should this go' or 'should this be a hook or a util' without saying the word 'architecture'. Scoped strictly to WHERE code lives and HOW the codebase is organized: it does not cover component-internal design, hooks correctness, state-management rules, or performance (see react-best-practices for those) or Next.js routing/data-fetching/rendering mechanics, metadata, or bundling (see next-best-practices for those)."
---

# Frontend UI Architecture

**Version 1.2.0** · For sources, see [README.md](README.md).

Modern React/Next.js codebases, and the official docs and maintainers behind them, converge on one meta-principle applied at every granularity — component, hook, state, constant, type: **colocate by default, and promote code to a shared/central location only once a second genuine, unrelated consumer needs it.** Never centralize on anticipated reuse. This single rule ("the rule of two") resolves most of the "where does this go" questions this skill covers, and it's why each rule file below is short — the hard part is applying it consistently, not memorizing exceptions.

## When to use

Use this skill when you need to:
- Decide where a new component, hook, util, constant, or type file should live
- Scaffold a new feature's folder structure, or decide between feature-based vs. type-based organization
- Decide whether a component is page-specific or should be promoted to a shared location
- Decide where business logic / data-access code belongs (hook vs. util vs. fetcher layer)
- Review a PR for project structure, file organization, or naming conventions

## How to use

Read the rule files for the full picture and the citations behind it:

- [rules/layout.md](rules/layout.md) — folder structure strategy, Next.js project-structure primitives, pages vs. page-specific vs. shared components, the component own-file-vs-own-folder threshold
- [rules/conventions.md](rules/conventions.md) — the checkable rules: where business logic lives, constants/utils/types placement, naming conventions, and the closing decision checklist
- [examples.md](examples.md) — before/after code for every rule above
- [README.md](README.md) — every source this skill is grounded in, plus the research notes/report this skill was built from

**Recommended reading order:**
- **Scaffolding a new feature or component?** → `layout.md` (structure) → `conventions.md`'s checklist
- **Deciding where a piece of logic, a constant, or a type belongs?** → `conventions.md`
- **Reviewing a PR for structure/organization?** → both files top to bottom, cross-checking `examples.md`

## Severity Levels

- **CRITICAL** — Wrong placement causes real bugs or breaks a structural guarantee (e.g. client secrets, stale queries)
- **HIGH** — Wrong placement causes churn, hidden coupling, or bundle regressions as the app grows
- **MEDIUM** — Wrong placement hurts discoverability/consistency but isn't actively harmful yet

## Guiding Principle: Colocate by Default, Promote on Second Use

Start every new component, hook, util, constant, or type **colocated** with the one feature/route/component that needs it, and promote it to a shared location only when a **second real consumer** exists today — not "might need it later." Centralizing early produces orphaned, undiscoverable files that nobody deletes when the feature that needed them goes away; colocated code gets deleted along with its feature. A generic catch-all `utils`/`constants`/`helpers` file degrades the same way once every unrelated value gets dumped into it ("dunghill anti-pattern" — see README.md sources). Every rule in `rules/*.md` applies this identically to folder structure, hooks-vs-utils, constants, and types — it's the same decision each time, not four different rules.

## Core Principles

- **Colocate first, promote on the rule of two** — never centralize on anticipated reuse.
- **Hooks are thin adapters, not the logic itself** — a function is a hook only if it calls another hook internally.
- **Pages stay thin** — feature logic lives in page-specific components; only a component with 2+ real consumers promotes to a shared, cross-cutting location.
- **Tests always colocate** with the file they test — never a parallel `__tests__/`/`tests/` tree.
- **Barrel files scale with scope, not with the pattern** — fine at one component, costly once they aggregate a whole feature or directory.
