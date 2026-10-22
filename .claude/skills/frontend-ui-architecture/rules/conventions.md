---
name: conventions
description: The checkable rules for where business logic, constants, utils, and types live, plus file/export naming conventions and the closing decision checklist
metadata:
  tags: frontend-ui-architecture, business-logic, hooks, naming, constants, types
---

# Conventions

These are the checkable rules — see `layout.md` for the structural picture they sit inside, and `examples.md` for before/after snippets of each one.

## Where Business Logic Lives (CRITICAL)

- **Hooks are thin adapters, not the logic itself.** A function only earns the `use` prefix and hook status if it calls another hook internally — that's a mechanical, not stylistic, test (it's also why a hook can be called conditionally only if it doesn't call other hooks). If it doesn't call a hook, it's a plain function and belongs in `utils/`, full stop.
- **Data-access layering**, colocated per feature rather than one global `services/` folder: typed request/response contract → plain fetcher function (calls one shared API client) → thin custom hook wrapping the fetcher in your query layer (TanStack Query/SWR/etc.) for caching and loading/error state. The hook's job is centralizing query keys and shared config (`staleTime`, retry policy) — not holding business rules.
- **State ownership split**: if the server owns a value, it lives in the query/cache layer, not copied into local state (a local copy silently opts out of background refetch). If the client fully owns a value, local `useState` or a client store. Decide ownership first; the storage location follows from that, not the other way around.
- **Next.js Server/Client boundary**: default new logic to the server (data access, secrets, authorization) and reach for a Client Component specifically when you need state, effects, browser APIs, or a custom hook. A Server Action is a real network boundary reachable directly via POST, not just through your UI — it must re-verify authorization itself, never rely on the calling UI having already checked.
- If this app already fetches everything client-side through a dedicated hook layer instead of Server-Component fetching (as this repo's client does — see `client/docs/ui-architecture.md`), that's a valid and consistent ownership model; the point above is to pick one model and apply it everywhere, not to force RSC-first fetching on an app that made a different, consistent choice.

## Constants, Utils, and Types Placement (MEDIUM)

- No major style guide prescribes one universal `constants.ts`. The real-world pattern is two-tier: a small, deliberately centralized `config/`-style module for environment-derived, genuinely app-wide values, and everything else (feature-specific literals, option lists, enums) colocated with the feature that owns it, promoted only on the rule-of-two.
- `utils/` holds React-free, pure functions only. The moment a "util" needs to call a hook, it's not a util anymore — see the hook test above.
- Types: start inline or in a small colocated `*.types.ts` next to the feature/util that needs them. Move a type into a central `types/` directory only once two or more *unrelated* features need the identical shape — not "might reuse this."

## Naming Conventions (MEDIUM)

- Component files: PascalCase.
- Everything else — utils, hooks, constants, types files: kebab-case.
- Hook exports: camelCase with a mandatory `use` prefix — this is a React requirement (hooks are detected by name), not a style preference, even though the file itself stays kebab-case (`use-click-outside.ts` exporting `useClickOutside`).
- Exported constants: `SCREAMING_SNAKE_CASE` only when exported, declared `const`, and trusted never to change (including nested properties) — typically environment-derived config. Everything else, including file-local constants, stays camelCase.
- This matches and reinforces root `CLAUDE.md`'s own Naming conventions section for this repo — treat that file as authoritative if the two ever disagree.

## Quick Decision Checklist

- **New file** — does it belong to one feature/component, or does a second unrelated consumer need it *today*? One → colocate. Two+ → promote to shared.
- **New function** — does it call a hook? → hook (`use`-prefixed, camelCase). Otherwise → plain util (kebab-case file).
- **New data access** — needs caching/loading/error state in the UI? → wrap the fetcher in a hook. Otherwise → a plain fetcher function is enough.
- **New component file** — does it now need a second file (test, style, sub-component, local hook)? → promote to its own folder. Otherwise → stays a single file.
- **New constant** — exported, env-derived, and truly fixed? → `SCREAMING_SNAKE_CASE` in the small config module. Otherwise → colocate, camelCase.
- **New type** — used in exactly one place today? → inline or colocated `*.types.ts`. Needed identically by 2+ unrelated features? → central `types/`.
- **New page** — keep `page.tsx` thin; put its real UI/logic in a colocated page-specific component, not inline in the page file.
- **New test** — colocate `<Name>.test.ts(x)` next to the file it tests. Never a parallel `__tests__/`/`tests/` tree.
