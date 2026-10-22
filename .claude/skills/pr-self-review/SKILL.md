---
name: pr-self-review
description: "Pre-PR gate for dev-digest-ai. Diffs local changes against main, matches the changed files against this repo's own .claude/skills/ catalog (UI skills on client/ files, backend-architecture skills on server/ files, full-stack skills wherever their own trigger applies), runs each matched skill's rules against those files, and blocks opening or pushing the PR if any finding is CRITICAL. Use before running `git push`/`gh pr create`, after gathering git status/diff/log but before drafting the PR body, or whenever asked to self-review, pre-review, or run a pre-PR check on local changes. Not a substitute for /code-review (general correctness bugs) or /security-review (OWASP) — this skill's only job is enforcing THIS repo's own cataloged standards against the diff and gating the PR on that."
---

# PR Self Review

**Type:** Workflow (Skill Dispatcher) · For sources/scoping, see
[README.md](README.md) · For a worked example, see
[examples.md](examples.md)

Unlike this catalog's domain-knowledge skills (`onion-architecture`,
`security`, …), this skill holds no review rules of its own. Its entire job
is to **dispatch**: read the diff, decide which *other* cataloged skills
apply to which changed files, invoke each matched skill's actual rules
against its files, and aggregate the results into one go/no-go gate. If you
ever find yourself adding a domain rule directly to this file instead of to
the skill that owns that domain, that's a sign it belongs elsewhere — see
"Scope boundary" in [README.md](README.md).

It runs inside the agent's own PR-creation flow and refuses to let the
agent proceed past a CRITICAL finding. It does not touch branch protection
or CI — see "Limits" below.

## When to use

- Automatically, before `git push` / `gh pr create` — run this right after
  gathering `git status`/`git diff`/`git log` and before drafting the PR
  body (that gathering step is part of Claude Code's own PR-creation flow,
  not something defined in this repo's `CLAUDE.md`).
- Manually, on demand — invoke as `/pr-self-review` any time to check the
  current working tree without opening a PR.

## How it works

1. **Compute the diff.** Combine both:
   - committed-but-unmerged changes: `git diff main...HEAD --name-only`
   - uncommitted changes: `git status --porcelain` (staged + unstaged +
     untracked, since those will be part of the PR too)

   Read `git diff main...HEAD` and `git diff HEAD` for the actual content,
   not just filenames — matching below needs both path and, for full-stack
   skills, content.

2. **Match changed files to skills** using the table below. A file can
   match more than one skill. Skip skills with no match — don't force one.

3. **Apply each matched skill's rules** to only the files it matched, the
   same way that skill would behave if invoked during a PR review (read
   its `SKILL.md` and any `rules/*.md`/`examples.md` it points to). Collect
   every violation as a finding: `{file, line, skill, native severity,
   rule violated, fix}`.

   Scope findings to **lines the diff actually adds or changes**, not every
   pre-existing violation sitting in a touched file. A PR that edits one
   line of `pulls/routes.ts` shouldn't block on that file's unrelated
   existing debt — only on violations the diff itself introduces or
   widens. Pre-existing violations are still worth a non-blocking mention
   (so they don't go unnoticed) but never count toward the CRITICAL gate.
   See `examples.md` #2.

4. **Normalize severity** to this skill's own CRITICAL/HIGH/MEDIUM scale
   using the table below, then **gate**:
   - **Any CRITICAL finding → BLOCK.** Do not run `git push` or
     `gh pr create`. Output a `🚫 BLOCKED` section listing every CRITICAL
     finding with `file:line`, the violated rule, and the concrete fix.
     Stop there unless the user explicitly says to override.
   - HIGH/MEDIUM findings never block — report them under the same banner
     for awareness, grouped by file, and proceed.
   - No findings at all → report that explicitly (don't stay silent) and
     proceed.

   An override must be explicit from the user (e.g. "push anyway") — never
   assume one. If the user overrides, note it in the PR description (which
   finding, and why it was accepted) so the record survives the PR.

## File → skill matching table

Only skills with review-relevant rules are listed; `mermaid-diagram` and
`engineering-insights` have no PR-gating role and are never matched.

| Skill | Matches when the diff touches | Basis |
|---|---|---|
| `onion-architecture` | any file under `server/src/modules/**` | layering/dependency-direction rules apply per-module |
| `fastify-best-practices` | `server/src/modules/**/routes.ts`, `server/platform/**`, `server/src/app.ts` | route/plugin/lifecycle code |
| `drizzle-orm-patterns` | `server/src/db/schema/**`, `server/src/db/migrations/**`, any `**/repository.ts` | schema + query code |
| `postgresql-table-design` | `server/src/db/schema/**`, `server/src/db/migrations/**` | raw table/index/constraint design |
| `next-best-practices` | `client/src/app/**` (`page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, `error.tsx`, etc.) | App Router conventions |
| `react-best-practices` | any `client/src/**/*.tsx`, `client/src/lib/hooks/**` | component/hook/state patterns |
| `frontend-ui-architecture` | any `client/src/**` file move/add (new component, hook, util, constants, type) | placement/naming/colocation |
| `react-testing-library` | any `client/**/*.test.tsx` | RTL/Vitest patterns |
| `zod` | any file defining/importing `z.object`/`z.infer` — typically `*/vendor/shared/contracts/**`, server-side input schemas | content signal, not path |
| `security` | any route handler, auth/secret-handling code, user-input parsing, or file upload code, in either package | content signal: "can an attacker control this value?" |
| `typescript-expert` | diff introduces `any`, unsafe casts/assertions, complex generics, or cross-package type-dep changes flagged in `CLAUDE.md`'s CI note | content signal — don't blanket-apply to every `.ts` touch, that's noise |

If a changed path doesn't fall under `server/` or `client/` (e.g.
`reviewer-core/`, `e2e/`, root config), no catalog skill applies — fall back
to that package's own `AGENTS.md` conventions, but don't invent a CRITICAL
gate finding from it.

## Severity normalization

Some matched skills already define CRITICAL/HIGH/MEDIUM
(`onion-architecture`, `frontend-ui-architecture`) — use their tier
directly. For skills without native tiers, apply this rubric:

- **CRITICAL** — breaks a structural guarantee, causes data loss/corruption,
  a security exploit, or a production-breaking runtime error. Also:
  `security`'s own HIGH-confidence ("vulnerable pattern + attacker-controlled
  input confirmed") findings map to CRITICAL here.
- **HIGH** — violates an established repo convention in a way that creates
  real coupling, churn, or breaking-change risk as the code grows.
  `security`'s MEDIUM-confidence findings map to HIGH.
- **MEDIUM** — ergonomics/consistency/discoverability issue; not actively
  harmful yet. `security`'s LOW-confidence findings are dropped (per that
  skill's own rule — don't report theoretical findings).

## Limits

This is an agent-side gate inside this conversation, not a server-enforced
one — it cannot stop a `git push` run outside this session, a direct
`gh pr create` from another tool, or a merge once the PR is already open.
If the user wants a hard stop, that requires a real CI check or branch
protection rule, which is outside this skill's scope — say so rather than
implying this gate is enforced anywhere but here.

## Quick decision checklist

1. Diffed against `main`, including uncommitted changes?
2. Every changed file matched against the table (or explicitly skipped as
   out-of-catalog)?
3. Each matched skill's actual rules applied — not just its name invoked?
4. Every finding normalized to CRITICAL/HIGH/MEDIUM?
5. Any CRITICAL → blocked, banner shown, `git push`/`gh pr create` withheld
   until fixed or explicitly overridden (and the override recorded in the
   PR body)?
