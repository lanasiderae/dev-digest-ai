---
name: layout
description: Folder structure strategy, Next.js project-structure primitives, and where pages/components/page-specific-vs-shared components physically live
metadata:
  tags: frontend-ui-architecture, folder-structure, nextjs, colocation, components
---

# Layout

## Folder Structure Strategy (HIGH)

Neither React nor Next.js mandates a file structure — both say so explicitly in their own docs. That's not a gap to fill with a "correct" answer; it's a deliberate choice teams make once and then apply consistently.

- **Type-based** (flat top-level `components/`, `hooks/`, `utils/`): lower friction, no categorization debates, nesting only ever grows inside an individual component's own folder. Favored when feature boundaries shift often.
- **Feature-based** (`features/<feature>/{api,components,hooks,types}`): scales better for large apps, **but only if paired with an enforced unidirectional-import rule** (shared → features → app, features never import each other) — typically an ESLint rule like `import/no-restricted-paths`. Adopting feature folders without that guardrail gets the pattern's coupling risk without its main benefit.
- Pick one strategy for the whole app. Mixing both ad hoc is worse than either alone.
- Cap nesting at 3-4 folder levels. Going deeper is a signal a layer should collapse or a feature boundary should move, not that you need a 5th folder.
- **In this repo**: the client already applies feature/route colocation (`client/src/app/**/_components/<Name>/` per route, shared data hooks centralized in `client/src/lib/hooks/*`). Follow that pattern for new UI rather than introducing a parallel top-level `components/` tree — see root `CLAUDE.md`'s Naming conventions.

## Next.js Project-Structure Primitives (HIGH)

These exist specifically so organization doesn't have to fight routing:

- Only `page.tsx`/`route.ts` make a route segment publicly reachable. Any other file colocated in that segment is never served — it's safe to colocate components, hooks, and helpers right next to the route that owns them.
- Prefix a folder with `_` (e.g. `_components/`) to opt it out of routing entirely while keeping it colocated with its route.
- Use `(group)` route groups to organize routes without affecting the URL.
- Don't invent a structure that changes URLs just to express organization — private folders and route groups are the primitives built for that.

## Pages vs. Page-Specific vs. Shared Components (HIGH)

- Keep `page.tsx` thin: route wiring and composition only (calling data hooks, laying out the page's top-level pieces) — no feature logic inline. If a page's JSX is doing real work, that's the signal to extract it into a component, not to let the page grow.
- A component used by exactly one route is **page-specific** and stays colocated in that route's private folder (e.g. `_components/<Name>/`) — it's page-specific until a second route genuinely needs it, not promoted to a shared `components/` tree just because "components" sounds like the natural top-level name.
- A component used across 2+ routes (the rule of two again — nav, breadcrumbs, app-wide shortcuts, a shared design-system primitive) promotes to a **shared, cross-cutting** location kept separate from any single route's private folder.
- **In this repo**: `client/AGENTS.md` states this exactly — pages are thin, feature logic lives in colocated `_components/<Name>/`, cross-cutting chrome (nav, breadcrumbs, shortcuts) lives in `src/components/app-shell`. Treat that as the applied example of this rule, not a parallel convention to reconcile.

## Component: Own File vs. Own Folder (MEDIUM)

- Default: one component, one file.
- Promote to a folder (`ComponentName/ComponentName.tsx` + `index.ts` + co-located test, and/or a local sub-component/hook/helper) once it needs a **second** associated file — not before, and not preemptively for every component. No source gives a hard line-count threshold; it's a qualitative "does a second file exist yet" test, same rule of two as everything else.
- For *when* to split a component's logic into smaller components in the first place (as opposed to where the pieces then live), that's `react-best-practices`' call — this skill only covers the resulting file layout.
- **Tests always colocate** with the file they test, named `<Name>.test.ts(x)`, living inside the component's own folder once it has one — never hoisted into a parallel `__tests__/` tree or a top-level `tests/` directory. A test file is itself the "second file" that most often triggers promoting a component from a single file into its own folder.
- A single-component `index.ts` re-export is fine and low-cost. Avoid directory-wide or feature-wide barrel files that aggregate many modules — tree-shaking is graph traversal that frequently fails on barrel chains, and it **does not run at all in dev mode**, so every barrel import pays its full cost there regardless of what the production bundler does. Measured regressions run from 2x to 10x+ chunk size. Import directly from the source file once you're crossing more than a handful of cohesive, closely-related exports.
