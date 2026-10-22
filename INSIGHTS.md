# INSIGHTS.md

Notes from reviewing this repo's `AGENTS.md` documentation set. Not
authoritative project docs — see root `AGENTS.md` and `.claude/rules/` for
that; this is a working log of findings and open decisions.

## What Doesn't Work

- **2026-10-20** — `git ls-files -v`'s tag letter alone is NOT a reliable
  skip-worktree indicator: `H` is the standard "cached" tag shown for every
  normal tracked file (always capital, regardless of skip-worktree state)
  — the real skip-worktree indicator is a capital `S`. Misreading `H` as
  "skip-worktree" led to an incorrect root `AGENTS.md` claim (repeated
  across `client`/`server`/`reviewer-core`/`e2e` `AGENTS.md` and
  `TESTING.md`) that every package's `package.json` was skip-worktree, and
  a whole tooling decision built on it (avoiding real `package.json`
  `"lint"` scripts in favor of undocumented `npx eslint .` + "install
  locally, won't persist" caveats). Verify skip-worktree properly:
  `git update-index --skip-worktree <file>` then `git ls-files -v <file>`
  → `S`; `--no-skip-worktree` → back to `H`. None of this repo's
  `package.json` files or `skills-lock.json` actually have the bit set.
- **2026-10-21** — `file:line` anchors for the entry above, since it only
  cited commands: the corrected state (real committed `lint` scripts, no
  `npx eslint .` caveat) is documented at `server/AGENTS.md:20-21`,
  `client/AGENTS.md:13`, `reviewer-core/AGENTS.md:15-16`, and
  `e2e/AGENTS.md:16-17`; the scripts themselves are each package's
  `package.json` `"lint": "eslint ."`.

## Codebase Patterns

- **2026-09-29** — `server/src/vendor/shared` (`@devdigest/shared`) has no
  `package.json`; it's plain `.ts` hand-copied into `client/src/vendor/shared`,
  not a real shared package → treat root `README.md`'s "one schema, every
  package" framing as aspirational, not enforced — a contract change must be
  applied to both copies by hand, and `client/AGENTS.md` already warns about
  this. `diff -rq server/src/vendor/shared client/src/vendor/shared` shows 5
  files already differ. Evidence: `server/src/vendor/shared/`,
  `client/src/vendor/shared/`.
- **2026-09-29** — Neither root `AGENTS.md`'s `## Commands` section nor
  `TESTING.md`'s "Running locally" steps mention `./scripts/e2e.sh` — both
  only describe running e2e against the manually-started dev stack
  (`./scripts/dev.sh` + `cd e2e && npm test`). `e2e/AGENTS.md` marks
  `./scripts/e2e.sh` (isolated Postgres/ports, doesn't touch the dev DB) as
  the *recommended* way to run e2e; a session following only root-level docs
  would default to the non-hermetic path and risk the exact
  multiple-imported-repos pitfall `e2e/AGENTS.md`'s Gotchas section warns
  about. Evidence: `scripts/e2e.sh`, `e2e/AGENTS.md` Commands section,
  `TESTING.md:71-75`.
- **2026-09-29** — A "remove X, keep Y infra" commit can leave a fully-wired
  computation path dangling with no persistence/UI consumer — a different
  shape of course scaffolding than root `AGENTS.md`'s Gotchas note about
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
- **2026-10-20** — Precise evidence for the `server/src/vendor/shared` vs.
  `client/src/vendor/shared` divergence entry (2026-09-29, first entry in
  this section): as of this date the 5
  differing files are `adapters.ts`, `contracts/eval-ci.ts`,
  `contracts/knowledge.ts`, `contracts/productionize.ts`, and
  `contracts/trace.ts` (`diff -rq server/src/vendor/shared
  client/src/vendor/shared`). `contracts/findings.ts` and
  `contracts/platform.ts` were kept byte-identical by hand this session
  (`client/src/vendor/shared/contracts/findings.ts`,
  `server/src/vendor/shared/contracts/findings.ts`,
  `client/src/vendor/shared/contracts/platform.ts`,
  `server/src/vendor/shared/contracts/platform.ts`), confirming the "apply
  by hand" rule above is followed in practice, not just documented.
- **2026-10-21** — `file:line` anchors for the two entries above, which
  cited whole files/directories only: the aspirational "one schema, every
  package" framing is `README.md:47` (the architecture diagram edge) and
  `README.md:18` (the package table); the rule that actually holds —
  hand-sync, no shared package — is `client/AGENTS.md:25-27`, enforced as a
  do-not-touch at `client/AGENTS.md:34-36`. Confirmed again this session:
  adding `PrFindingsByAgent` to `PrMeta` required the identical edit in both
  `server/src/vendor/shared/contracts/platform.ts:167-174` and
  `client/src/vendor/shared/contracts/platform.ts:167-174` (`cp` + `diff`
  to verify byte-parity, since nothing in CI checks it).
- **2026-10-20** — Precise evidence for the `scripts/e2e.sh` not-mentioned
  entry (2026-09-29, second entry in this section): `scripts/e2e.sh` is 166
  lines (the whole file is the
  hermetic-runner script, no single-line anchor); the "recommended" framing
  is `e2e/AGENTS.md:10-11`.
- **2026-10-21** — `.claude/skills/` has two distinct creation patterns, not
  one: external-best-practice architecture skills
  (`frontend-ui-architecture`, `onion-architecture`) follow an undocumented
  `research_notes/` → `reports/` → `SKILL.md`+`README.md`+`examples.md`
  triad, while internal process/meta skills that orchestrate other skills
  or capture session state (`engineering-insights`, `pr-self-review`) skip
  that triad entirely — single `SKILL.md`, no external topic to cite.
  Deciding which pattern applies to a new skill request matters before
  writing it. Evidence: `.claude/skills/engineering-insights/SKILL.md`
  (single-file, no `README.md`/`examples.md`) vs.
  `.claude/skills/onion-architecture/` (full triad plus
  `research_notes/Onion Architecture/` and `reports/`).
- **2026-10-21** — Correction to the entry directly above: "single
  `SKILL.md`, no external topic to cite" overstates it for
  `pr-self-review` specifically — on request it was given the same
  `SKILL.md`+`README.md`+`examples.md` *file set* as
  `onion-architecture`/`frontend-ui-architecture` (`README.md` documents
  it has no `## Sources` table and is internally grounded instead;
  `examples.md` is a worked dispatch walkthrough, not before/after code
  snippets). The real dividing line between the two skill-creation
  patterns is narrower than "file count": it's specifically whether
  `research_notes/`+`reports/` exist upstream of the skill (external
  research to cite) — not whether `README.md`/`examples.md` exist at all.
  `engineering-insights` still has neither extra file; `pr-self-review`
  has both but still has no `research_notes/`/`reports/`. Evidence:
  `.claude/skills/pr-self-review/README.md`,
  `.claude/skills/pr-self-review/examples.md`.
