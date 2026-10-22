## Overview

Course-starter for an agentic PR-reviewer (import a PR → AI agent review →
grounded findings). Five standalone packages, no workspace, all TypeScript:

- `server/` (`@devdigest/api`) — Fastify 5 API + Drizzle ORM
  (Postgres/pgvector), `:3001`.
- `client/` (`@devdigest/web`) — Next.js 15 (App Router) + React 19 web
  studio, `:3000`.
- `reviewer-core/` (`@devdigest/reviewer-core`) — the pure review engine;
  key libraries: `openai` SDK (LLM calls), `zod` (structured-output
  validation).
- `e2e/` (`@devdigest/e2e`) — deterministic browser flows, driven by the
  `agent-browser` CDP CLI (a separate global tool, not an npm dependency —
  see `e2e/AGENTS.md`).
- `mcp-server/` (`@devdigest/mcp-server`) — a local stdio MCP server, a thin
  HTTP client of `server/`'s API exposing 5 tools to an MCP-capable agent
  (see `mcp-server/AGENTS.md`).

Sharing is via tsconfig path aliases, not publishing. Only Postgres
(pgvector) runs in Docker.

Other top-level folders (not packages — no `package.json`, nothing to
`cd`/`pnpm dev` into):

- `scripts/` — `dev.sh` (full boot from zero) and `e2e.sh` (hermetic e2e
  runner), see Commands below.
- `.claude/` — Claude Code config for this repo: `skills/` (on-demand
  skills, e.g. `engineering-insights`) and `rules/` (always-applied rules,
  currently empty) — see Reference below.

## Commands

- Full boot from zero: `./scripts/dev.sh` (flags: `--no-seed` `--no-client`
  `--db-only` `--help`). It starts Postgres, creates `.env` files from
  `.env.example` if missing, installs deps, migrates + seeds, launches API
  and web.
- Manual sequence: `docker compose up -d` → `cd server && pnpm install &&
  pnpm db:migrate && pnpm db:seed && pnpm dev` → `cd client && pnpm install
  && pnpm dev`.
- Validation (phase 4 below) — the exact command per package. Note the
  package-manager split: `server`/`client` use **pnpm**,
  `reviewer-core`/`e2e`/`mcp-server` use **npm**.
  - `cd server && pnpm exec vitest run --exclude '**/*.it.test.ts' && pnpm
    typecheck && pnpm lint` — unit lane, hermetic (no Docker). Integration is
    the separate `pnpm exec vitest run .it.test` and needs Docker; plain
    `pnpm test` runs both and will fail without it.
  - `cd client && pnpm test && pnpm typecheck && pnpm lint`
  - `cd reviewer-core && npm test && npm run typecheck && npm run lint`
  - `cd e2e && npm run typecheck && npm run lint` — flows are
    `./scripts/e2e.sh` (hermetic), not part of typecheck.
  - `cd mcp-server && npm test && npm run typecheck && npm run lint`
- Anything beyond the above is in each package's own
  `AGENTS.md`/`README.md` — don't assume a script name without checking
  there first.

## Workflow

Non-trivial changes in this repo follow five phases:

1. **Initiation** — read this file, the relevant package's `AGENTS.md`, and
   anything its "Reference" section points at (`README.md`, `docs/`,
   `specs/`) before touching code in that package.
2. **Planning** — for anything beyond a trivial/isolated fix, work out the
   approach (affected files, existing patterns to reuse, open questions)
   before editing; use plan mode for anything that benefits from sign-off
   first.
3. **Implementation** — make the change, following this file's Conventions
   and Naming conventions sections and the target package's own `AGENTS.md`.
4. **Validation** — run that package's test/typecheck/lint commands (see
   "Commands" above and each package's own `AGENTS.md`), plus a manual check
   for anything UI-facing; don't report a change done on edited-but-unrun
   code.
5. **Completion** — record any reusable, non-obvious finding from the work
   (a gotcha, a dead end, a working pattern) via the `engineering-insights`
   skill, which writes to the touched package's `INSIGHTS.md`.

## Conventions

- Migrations are **never applied on boot** — `pnpm db:migrate` is a manual
  step, always, even after pulling schema changes.
- Secrets (API keys, `GITHUB_TOKEN`) live in `~/.devdigest/secrets.json`
  (mode `0600`), never in `.env`-committed form, the DB, or git;
  `process.env` is only a fallback.
- `REPO_INTEL_ENABLED`, the grounding gate, and the prompt-injection guard
  are structural safety/quality mechanisms baked into the review pipeline —
  not optional flags to work around when a review "looks wrong."
- CI is **path-filtered per package**, and filters encode cross-package type
  deps — e.g. `reviewer-core/**` changes also trigger `server-unit` because
  the server type-checks against `reviewer-core/src` directly.

## Naming conventions

- **Component folders** (`client/src/app/**/_components/<Name>/`): PascalCase
  folder matching a PascalCase `<Name>.tsx`, plus `index.ts` (barrel
  re-export), `styles.ts` (co-located `export const s = {...}`), and
  `<Name>.test.tsx`. `constants.ts`/`helpers.ts` are added only when a
  component needs local constants or pure helpers worth separating out.
- **Non-component TS/TSX files**: kebab-case (`format-cost.ts`,
  `github-urls.ts`, `price-book.ts`, `run-executor.ts`).
- **Server module files** (`server/src/modules/<name>/`): a fixed file-role
  vocabulary, consistent across every module —`routes.ts` (the Fastify
  plugin entry), `service.ts` (orchestration), `repository.ts` (DB access),
  `helpers.ts`/`constants.ts` (as needed). A new module follows this same
  file set rather than inventing new role names.
- **React hooks**: camelCase, `use`-prefixed (`usePulls`, `usePrReviews`,
  `useFindingAction`), grouped by domain under `client/src/lib/hooks/*`.
- **Zod contracts** (`*/src/vendor/shared/contracts/*.ts`): PascalCase
  schema const whose name matches its inferred TS type
  (`export const Finding = z.object(...); export type Finding = z.infer<...>`).
- **Drizzle schema** (`server/src/db/schema/*.ts`): camelCase JS table/column
  identifiers mapped explicitly to snake_case Postgres names
  (`pullRequests = pgTable('pull_requests', { headSha: text('head_sha') })`).
- **i18n message keys** (`client/messages/<locale>/*.json`): nested camelCase,
  namespaced by feature/section (`list.columns.findings`,
  `panel.hideLowConfidence`, `timeline.openTrace`).
- **Tests**: co-located `*.test.ts(x)` next to the file under test; server
  integration tests are additionally suffixed `*.it.test.ts` (required, not
  just a convention — see `server/AGENTS.md` Gotchas: CI/local test splits
  depend on this exact suffix).

## Do not touch

- Auto-applying migrations — never wire `pnpm db:migrate` into the server
  app's own process boot (`pnpm dev`/`pnpm start`) or CI. It's a manual
  step, always, even right after pulling schema changes (see Conventions).
  `scripts/dev.sh` calling it as one explicit, user-invoked bootstrap step
  is the one intentional exception — that's not the app auto-migrating
  itself, it's a human running a setup script.
- `server/clones/**` — git-ignored runtime data (cloned target repos for
  repo-intel indexing). It may itself contain unrelated nested repos with
  their own `CLAUDE.md`/config (e.g. `server/clones/<user>/<repo>/CLAUDE.md`)
  — those belong to an *indexed target repo*, not this project. Never edit
  or treat them as project config.
- `server/package.json`'s `test` script (`vitest run`) is **not** what CI
  runs — it would run every `*.it.test.ts` file too, which needs Docker. CI
  (`server-unit.yml`/`server-integration.yml`) invokes
  `pnpm exec vitest run --exclude '**/*.it.test.ts'` and
  `pnpm exec vitest run .it.test` as two separate jobs instead (see
  `server/AGENTS.md`/`TESTING.md`) — this is a `server`-specific split, not
  a repo-wide pattern (client/reviewer-core's CI does just run their plain
  `test` script).
- Lock files (`client/pnpm-lock.yaml`, `server/pnpm-lock.yaml`,
  `reviewer-core/package-lock.json`, `e2e/package-lock.json`,
  `mcp-server/package-lock.json`, root `skills-lock.json`) — generated
  artifacts; don't hand-edit them. Let the package manager
  (`pnpm install`/`npm install`) regenerate the 5 per-package ones.
  `skills-lock.json` tracks externally-sourced skills (GitHub) listed
  in `.claude/skills/README.md`'s catalog — no in-repo regeneration command
  is known; don't hand-edit its hashes.
- Never run `docker compose down -v` against the dev stack — `-v` deletes the
  `devdigest_pgdata` volume, wiping every real imported repo and review.

## Gotchas

- Empty-looking UI sections, unused DB tables, and unimplemented routes
  (Skills, Memory, Eval pipeline, multi-agent review, CI export, …) are
  intentional scaffolding for future course lessons (L01–L08) — not bugs to
  fix or dead code to remove.
- Only Postgres is Dockerized — if the API/web won't start, check `pnpm dev`
  output in `server/`/`client/`, not `docker compose logs`.
- Port `5432` already in use → another Postgres is running; stop it or
  remap the host port in `docker-compose.yml`.
- `vector` type errors mean migrations didn't run against the Dockerized DB
  (pgvector is enabled by migration `0000`) — run `pnpm db:migrate`.

## Reference

- `README.md` — read first, always: architecture, package table, full quick
  start, troubleshooting.
- `TESTING.md` — read before writing or running any test, in any package.
- `docs/agent-prompts/README.md` — read before creating or editing an agent
  system prompt.
- `server/AGENTS.md`, `client/AGENTS.md`, `reviewer-core/AGENTS.md`,
  `e2e/AGENTS.md`, `mcp-server/AGENTS.md` (+ each package's own `README.md`)
  — read before working inside that package.
- `e2e/specs/*.flow.json` — read before adding or changing an e2e flow.
- `.claude/rules/` — always-applied project rules (distinct from
  `.claude/skills/`, which loads on-demand); currently empty. Read it before
  any task — once a rule file exists there, it is authoritative over every
  `AGENTS.md` in this repo and must never be overridden here.
- Each package's `docs/` (deeper design notes) and `specs/` (formal specs
  written before implementation) — read when relevant to the change; see
  each package's own AGENTS.md Reference section for the specific files
  (`server/docs/architecture.md`, `server/specs/review-flow.md`,
  `client/docs/ui-architecture.md`, `client/specs/pages.md`,
  `reviewer-core/docs/pipeline.md`, `reviewer-core/specs/review-engine.md`,
  `e2e/docs/harness.md`, `e2e/specs/*.flow.json`).

These files are the source of truth. If this file ever disagrees with them,
they win — update this file rather than working around it.
