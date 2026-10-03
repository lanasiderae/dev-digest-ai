# INSIGHTS.md

Notes from reviewing this repo's `CLAUDE.md` documentation set. Not
authoritative project docs — see root `CLAUDE.md` and `.claude/rules/` for
that; this is a working log of findings and open decisions.

## Codebase Patterns

- **2026-09-29** — `server/src/vendor/shared` (`@devdigest/shared`) has no
  `package.json`; it's plain `.ts` hand-copied into `client/src/vendor/shared`,
  not a real shared package → treat root `README.md`'s "one schema, every
  package" framing as aspirational, not enforced — a contract change must be
  applied to both copies by hand, and `client/CLAUDE.md` already warns about
  this. `diff -rq server/src/vendor/shared client/src/vendor/shared` shows 5
  files already differ. Evidence: `server/src/vendor/shared/`,
  `client/src/vendor/shared/`.
- **2026-09-29** — Neither root `CLAUDE.md`'s `## Commands` section nor
  `TESTING.md`'s "Running locally" steps mention `./scripts/e2e.sh` — both
  only describe running e2e against the manually-started dev stack
  (`./scripts/dev.sh` + `cd e2e && npm test`). `e2e/CLAUDE.md` marks
  `./scripts/e2e.sh` (isolated Postgres/ports, doesn't touch the dev DB) as
  the *recommended* way to run e2e; a session following only root-level docs
  would default to the non-hermetic path and risk the exact
  multiple-imported-repos pitfall `e2e/CLAUDE.md`'s Gotchas section warns
  about. Evidence: `scripts/e2e.sh`, `e2e/CLAUDE.md` Commands section,
  `TESTING.md:71-75`.
- **2026-09-29** — A "remove X, keep Y infra" commit can leave a fully-wired
  computation path dangling with no persistence/UI consumer — a different
  shape of course scaffolding than root `CLAUDE.md`'s Gotchas note about
  never-implemented empty routes/tables. Commit `d45ab0d` ("remove per-PR/run
  cost, keep model pricing") deleted `agent_runs.cost_usd` and every UI/contract
  cost field while deliberately keeping `PriceBook`/`estimateCost` and
  `reviewPullRequest`'s `outcome.costUsd` — the LLM cost was computed
  end-to-end on every run but silently dropped in `run-executor.ts` before
  persistence. When a provider field, estimator, or aggregator looks fully
  built but nothing downstream reads it, check `git log` for a targeted
  removal commit before assuming it's unfinished — other L01–L08 lessons
  likely follow the same pattern. Evidence: `git show d45ab0d`,
  `reviewer-core/src/review/run.ts:110,216`.
