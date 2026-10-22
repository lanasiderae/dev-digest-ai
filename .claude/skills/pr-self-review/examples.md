# PR Self Review — Examples

Snippets below use this repo's real module/component names. See
[SKILL.md](SKILL.md) for the matching table and gate rules, and
[README.md](README.md) for scoping.

## 1. Dispatch: matching real changed files to real skills

A PR diff touches:

```
server/src/modules/pulls/routes.ts
client/src/vendor/shared/contracts/findings.ts
client/src/app/agents/_components/AgentCard/AgentCard.tsx
```

Walking the matching table in `SKILL.md`:

| File | Matched skill(s) | Why |
|---|---|---|
| `server/src/modules/pulls/routes.ts` | `onion-architecture`, `fastify-best-practices` | under `server/src/modules/**`, and it's a `routes.ts` |
| `client/src/vendor/shared/contracts/findings.ts` | `zod` | it's a `*/vendor/shared/contracts/*.ts` Zod contract file |
| `client/src/app/agents/_components/AgentCard/AgentCard.tsx` | `react-best-practices`, `frontend-ui-architecture` | `client/src/**/*.tsx`, component folder shape |

`drizzle-orm-patterns`, `postgresql-table-design`, `next-best-practices`,
`react-testing-library`, `security`, `typescript-expert` all have **no
match** in this diff — don't force them in. A dispatch that force-applies
every skill to every file regardless of the table is the anti-pattern this
skill exists to avoid (it's also exactly how you get noisy, ignorable
findings instead of a trustworthy gate).

## 2. A real CRITICAL finding, applying a matched skill's actual rule

`server/src/modules/pulls/routes.ts` matched `onion-architecture`. Reading
that skill's `rules/enforcement.md` ("Adapters Are Off-Limits From
Routes") against the current file:

```ts
// server/src/modules/pulls/routes.ts:37 — current code
gh = await container.github();
```

`pulls/` has no `service.ts` — this route calls the GitHub adapter
directly. Per `onion-architecture`'s own severity table, a route reaching
past `service.ts` into a container adapter is **CRITICAL**
("Violates the dependency rule itself"). This finding is pre-existing, not
introduced by the hypothetical diff above — which is exactly why the gate
only fires on **lines the diff actually touches or adds to**, not on every
pre-existing violation in a file the PR happens to touch. Re-flagging a
PR for unrelated existing debt it didn't introduce would make the gate
useless noise; only new or widened CRITICAL violations block.

## 3. The BLOCKED banner

If a diff *introduces* a new direct adapter call (not just touches a file
that already has one), the dispatch output looks like:

```
🚫 BLOCKED — 1 CRITICAL finding

- server/src/modules/pulls/routes.ts:412 [onion-architecture, CRITICAL]
  New route handler calls `container.llm()` directly; `pulls/` has no
  service.ts to own this orchestration.
  Fix: move the LLM call into a new/existing service.ts method and have
  the route call that instead.

git push / gh pr create withheld until this is fixed or you explicitly
say to override.
```

## 4. Pass-through: HIGH/MEDIUM only, never blocks

Same diff, but the only finding is `frontend-ui-architecture` flagging
`AgentCard.tsx` for missing its `index.ts` barrel re-export (HIGH —
convention violation, no runtime break):

```
No CRITICAL findings — proceeding.

HIGH
- client/src/app/agents/_components/AgentCard/AgentCard.tsx
  [frontend-ui-architecture, HIGH] Missing index.ts barrel re-export per
  the component-folder naming convention.
```

The PR proceeds; the HIGH finding is surfaced, not enforced.

## 5. Recording an override

If the user explicitly accepts a CRITICAL finding rather than fixing it,
that acceptance must survive into the PR body, not just this
conversation:

```md
## Pre-PR self-review
- Accepted (not fixed): `pulls/routes.ts:412` [onion-architecture,
  CRITICAL] — direct `container.llm()` call from a route. Deferred because
  `pulls/` already has two other pre-existing instances of this pattern;
  tracked for a follow-up module-wide fix rather than fixing one call site
  in isolation.
```

Silently dropping the finding instead of recording the override is the
one failure mode this skill cannot catch on its own — the gate only works
if the override is written down.
