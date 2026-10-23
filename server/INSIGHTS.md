# INSIGHTS.md

## Open Questions

- **2026-09-29** — `client/AGENTS.md` documents its `pnpm-workspace.yaml` as
  just a `pnpm.allowBuilds` allowlist (not a real workspace); `server/`'s
  `pnpm-workspace.yaml` has the same pattern (`allowBuilds` for
  `cpu-features`, `esbuild`, `protobufjs`, `ssh2`) but `server/AGENTS.md`'s
  Gotchas section has no equivalent note → should `server/AGENTS.md` gain the
  same clarifying line, so the file isn't mistaken for stray monorepo config?
  Evidence: `server/pnpm-workspace.yaml`, `client/AGENTS.md` Gotchas section.
- **2026-10-20** — Precise evidence for the entry above:
  `server/pnpm-workspace.yaml:1-5` (the `allowBuilds` list); the existing
  clarifying note is `client/AGENTS.md:41-43`.
- **2026-10-22** — `server/src/adapters/mocks.ts`'s `MockLLMOptions.structuredBySchema`
  doc comment anticipates a "conventions 2-step dialogue: 'ConventionFileSelection'
  then 'ConventionExtraction'" — but no code anywhere implements a
  `ConventionFileSelection` call (confirmed: that string appears nowhere else
  in the repo). The conventions module built in this session uses
  **code-based** sample selection (config files + `repoIntel.getConventionSamples`,
  no LLM) and a **single** structured-output call named `'ConventionExtraction'`,
  per the course's own explicit spec for the feature. Worth resolving: should
  that mock comment be updated/removed so it stops implying a 2-step design,
  or was a 2-step flow actually intended for a later lesson? Evidence:
  `server/src/adapters/mocks.ts` (`MockLLMOptions.structuredBySchema` doc
  comment), `server/src/modules/conventions/service.ts`,
  `server/src/modules/conventions/constants.ts` (`EXTRACTION_SCHEMA_NAME`).

## Codebase Patterns

- **2026-09-29** — Not every GET route's response is Zod-validated despite
  `server/AGENTS.md`'s "schema-first... one definition drives both request
  validation and response serialization" convention: `/repos/:id/pulls`,
  `/pulls/:id/runs`, `/pulls/:id/reviews`, and `/runs/:id/trace` only declare
  `schema: { params: IdParams }` — no `response` schema — so their handlers'
  return values are type-checked against `PrMeta`/`RunSummary`/`ReviewDto`/
  `RunTrace` but never runtime-validated by Fastify. Mutating/adding a field
  on these routes needs no route-schema change, but also gets no
  serialization safety net if the handler's shape drifts from the contract.
  Evidence: `server/src/modules/pulls/routes.ts:26`,
  `server/src/modules/reviews/routes.ts:101,121,129`.
- **2026-09-29** — `RunTrace` (the persisted `run_traces.trace` JSONB doc) has
  no top-level `status` field — only `agent_runs` rows do. To tell a settled
  run's trace from a failed/cancelled one when only the trace is in hand, the
  codebase signals it via `tokens_in: 0, tokens_out: 0` (the sentinel
  `run-executor.ts`'s failure path persists) rather than an explicit status;
  any future code reading a trace and needing "did this run finish" must
  check that 0/0 pair, not look for a status field. Evidence:
  `server/src/modules/reviews/run-executor.ts` (`traceFromBuffer`),
  `server/src/vendor/shared/contracts/trace.ts` (`RunTrace`/`RunStats`).
- **2026-10-20** — Precise evidence for the entry above: the sentinel is set
  at `server/src/modules/reviews/run-executor.ts:426` (inside
  `traceFromBuffer`, defined at line 410); `RunTrace`/`RunStats` are
  `server/src/vendor/shared/contracts/trace.ts:72` and `:61` respectively.
- **2026-10-20** — Every `server/src/modules/<name>/` folder (all 8:
  `agents`, `polling`, `pulls`, `repo-intel`, `repos`, `reviews`,
  `settings`, `workspace`) uses the same fixed file-role vocabulary —
  `routes.ts` (Fastify plugin entry), `service.ts` (orchestration),
  `repository.ts` (DB access), `helpers.ts`/`constants.ts` as needed. A new
  module should follow this same file set rather than inventing new role
  names. Evidence: `ls server/src/modules/*/` across all 8 folders.
- **2026-10-21** — `file:line` anchors for the entry above, which cited only
  an `ls`: the registry that fixes the module set is
  `server/src/modules/index.ts:24-33`, with the "ADD A MODULE" procedure
  (and why registration is static, not autoloaded) at
  `server/src/modules/index.ts:15-18`; the same vocabulary is stated as a
  repo-wide naming convention at `AGENTS.md:99-103`.
- **2026-10-21** — `GET /repos/:id/pulls` derives its three review columns
  from ONE newest-first `reviews` query but applies three different "which
  reviews count" rules, which is easy to break by reusing the wrong map:
  `score` = the PR's single latest review; `findings_by_severity` /
  `findings_by_agent` = each AGENT's latest review, summed (via
  `latestReviewPerAgent`); `cost` = every successful run ever, superseded
  re-runs included. Adding a column here means deciding which of the three
  scopes it belongs to — the rationale per column is spec'd rather than left
  to the code. Evidence: `server/src/modules/pulls/routes.ts:115` (the one
  shared query), `:135` (score), `:144` (cost), `:182` (per-agent findings),
  `server/src/modules/pulls/status.ts:34-70` (`latestReviewPerAgent`),
  `server/specs/review-flow.md:85-103`.
- **2026-10-20** — `server/package.json`'s committed `test` script is plain
  `vitest run` (no unit/integration split — it would need Docker for the
  `.it.test.ts` files too). That's why CI inlines the split directly
  (`pnpm exec vitest run --exclude '**/*.it.test.ts'` /
  `pnpm exec vitest run .it.test`) instead of calling a `test:unit`/
  `test:integration` script pair. This is a `server`-specific CI design
  choice, not a repo-wide pattern — `client.yml`/`reviewer-core.yml`'s CI
  jobs call the plain `test` script directly, no inlining needed. Evidence:
  `.github/workflows/server-unit.yml:99`,
  `.github/workflows/server-integration.yml:65`, vs.
  `.github/workflows/client.yml:49`,
  `.github/workflows/reviewer-core.yml:49`.
- **2026-10-22** — Root `CLAUDE.md`'s "Tests: co-located `*.test.ts(x)` next
  to the file under test" convention does NOT hold for `server/` in
  practice: every server test (unit and `.it.test.ts`) lives under
  `server/test/<feature>-<aspect>.test.ts`, never beside the module it
  covers — `find server/src/modules -name "*.test.ts"` returns nothing,
  while `server/test/` has ~28 files. `client/` and `reviewer-core/` DO
  colocate. A new server module's tests belong in `server/test/`, following
  that directory's `<feature>-<aspect>` naming, not next to
  `routes.ts`/`service.ts`. Evidence: `server/test/skills-crud.it.test.ts`,
  `server/test/repo-intel-resync.test.ts`,
  `server/test/conventions-extract.test.ts`.
- **2026-10-21** — `container.agentsRepo`-style DI overrides work for a
  single plain function too, not just a class adapter: `skillsUrlFetch`
  (SSRF-guarded URL fetch for skill import) is one function on
  `ContainerOverrides`, defaulting to the real implementation in a method on
  `Container`, with no adapter interface/class needed. This made it testable
  (integration tests inject a stub returning fixed content) without a real
  network/DNS round trip, for a feature with exactly one implementation and
  one call site — reach for this before building a full adapter class.
  Evidence: `server/src/platform/container.ts` (`ContainerOverrides.skillsUrlFetch`,
  `Container.skillsUrlFetch`), `server/src/modules/skills/service.ts`
  (`importFromUrl`), `server/test/skills-import.it.test.ts`.

- **2026-10-22** — `prIntent`/`prBrief` DB tables and `ReviewRepository.upsertIntent`/
  `getIntent` already existed, fully wired to the `Intent` zod contract, before
  any Intent Layer code was written for this session's L03 work — pre-built
  scaffolding for this exact lesson, migrated in `0000_init`, so persisting a
  derived intent needed zero new migration. The `review_intent` `FeatureModelId`
  likewise already resolved end-to-end via `settings/feature-models.ts`; it
  just defaulted to `openai/gpt-4.1` (not low-cost) until changed to
  `openrouter/deepseek-v4-flash`, matching the existing `onboarding` feature's
  pattern — a wrong default, not a missing feature. `run-executor.ts`'s own
  class docstring already said "Loads the diff + intent once" before intent
  loading was actually implemented — the same "docstring ahead of the code"
  pattern as the `d45ab0d` entry above, worth checking for elsewhere before
  assuming a described behavior is unbuilt. Evidence:
  `server/src/db/schema/reviews.ts:49-63`,
  `server/src/modules/reviews/repository.ts:137-143`,
  `server/src/modules/reviews/repository/pull.repo.ts:49-68`,
  `server/src/vendor/shared/contracts/platform.ts` (`FEATURE_MODELS`).
- **2026-10-22** — The `findings` table's `kind` column isn't only `'finding'`
  — `groundFindings` (reviewer-core) also produces `secret_leak`/
  `lethal_trifecta`/`phantom`/`hook` kinds exempt from line-range grounding
  (see `reviewer-core/INSIGHTS.md`'s matching entry). Smart Diff's
  `finding_lines` anchoring (`GET /pulls/:id/smart-diff`) explicitly filters
  to `kind='finding'` only — those other kinds don't anchor to one reliable
  line the way a diff finding does, so including them would put an arbitrary
  line number into the file-count badge. Any new finding `kind` added later
  should be checked against this filter too, not just against
  `groundFindings`. Evidence: `server/src/modules/pulls/routes.ts`
  (the smart-diff handler's `eq(t.findings.kind, 'finding')` filter).

## Tool & Library Notes

- **2026-10-21** — Fastify's instance-level `bodyLimit` (set in `Fastify({
  bodyLimit })`) does NOT automatically raise the ceiling for a route that
  needs a larger body (e.g. a file-upload endpoint) — set a per-route
  `bodyLimit` and/or `@fastify/multipart`'s own `limits.fileSize` on that
  route/plugin registration instead of raising the global default for every
  route. Evidence: `server/src/app.ts` (`bodyLimit: 1_048_576` on the
  Fastify instance), `server/src/modules/skills/routes.ts` (`@fastify/multipart`
  registered with its own `limits.fileSize`).
- **2026-10-21** — `yauzl` validates each entry's `fileName` itself (rejects
  zip-slip/absolute paths) during `eachEntry()` iteration, BEFORE any
  app-level path-safety check gets a chance to run — don't assume your own
  check is the first line of defense, and wrap whatever `eachEntry()` throws
  into your own error type so an unsafe archive maps to a clean 4xx instead
  of an uncaught 500. Evidence: `server/src/modules/skills/import/archive.ts`
  (`isPathSafe` is redundant-but-kept defense-in-depth; the actual rejection
  for a zip-slip fixture comes from yauzl itself — see the "rejects a
  zip-slip path" test in `server/test/skills-import-archive.test.ts`, which
  has to build its malicious fixture by patching raw bytes because `yazl`,
  yauzl's sibling writer, also refuses to write an unsafe path).
- **2026-10-21** — `yauzl`'s `eachEntry()` yields each zip entry's declared
  `uncompressedSize` and `externalFileAttributes` (Unix mode bits, only
  meaningful when `entry.versionMadeBy >>> 8 === 3`) from central-directory
  metadata BEFORE you call `openReadStreamPromise` — this is what makes
  "reject an oversized or executable entry without ever inflating it"
  possible (zip-bomb defense). Prefer the promise-based API
  (`yauzl.fromBufferPromise`, `zipfile.eachEntry()` as an async iterator,
  `zipfile.openReadStreamPromise`) over the callback API shown in most
  yauzl examples — much less boilerplate. Evidence:
  `server/src/modules/skills/import/archive.ts`.

## Recurring Errors & Fixes

- **2026-10-22** — A pre-work step that needs its progress visible in the
  Live Log UI must be passed `RunLogger` itself (signature
  `.info(msg, data?)`), not the plain pino request logger
  (`.info(obj, msg?)`) — the two have incompatible argument orders, and
  passing the wrong one compiles fine but the step's detail lines only ever
  reach server stdout, never the SSE-streamed panel the user actually
  watches. Caught by comparing the intent-derivation step's Live Log output
  against a reference screenshot that showed sub-step lines (token estimate,
  provider/model called) this session's first version never emitted.
  `IntentService`'s logger type was narrowed to `{ info: (msg: string, data?:
  unknown) => void }` so `run-executor.ts` can pass its real `RunLogger`
  directly; the one caller stuck with a pino logger (`service.ts`'s manual
  regenerate route) now wraps it in a one-line adapter closure to the same
  shape. Evidence: `server/src/modules/reviews/run-executor.ts` (`runLog`
  passed into `IntentService.ensure`), `server/src/modules/reviews/pipeline/intent.ts`
  (`IntentLogger`), `server/src/modules/reviews/service.ts` (`regenerateIntent`'s
  adapter).
- **2026-10-22** — Any new `.it.test.ts` that triggers `POST /pulls/:id/review`
  must mock `llm.openrouter` in its `appWith()`-style harness, not just
  whichever provider(s) its own review-agent fixture uses — the review
  pipeline's eager intent pre-work independently resolves
  `container.llm('openrouter')` (the `review_intent` feature's default
  provider) on every run. Missing that mock is silent and harmless on a
  machine with no `OPENROUTER_API_KEY` configured (fails fast with
  `ConfigError`, intent just comes back `unavailable_reason`), but on a dev
  machine that DOES have a real key configured (true for local dev, not CI)
  it makes the test hit the real network instead — observed turning one
  previously-~5s test file into ~41s and intermittently timing out
  `waitForPrRuns`'s 10s default budget before the run even reached its
  terminal status, so `GET /pulls/:id/reviews` came back empty and a
  downstream assertion threw `Cannot read properties of undefined`. Fix
  pattern: `openrouter: new MockLLMProvider('openai', { structuredBySchema:
  { PrIntent: <Intent fixture> } })` (the `'openai'` constructor id is
  cosmetic — only the override map's key, not the instance's own `.id`,
  determines which `container.llm(...)` call resolves to it).
  `MockLLMOptions.structuredBySchema` already existed for a different
  multi-call-fixture purpose (see the Open Questions entry above) and is
  reused here. Evidence: `server/test/reviews.it.test.ts`,
  `server/test/review-run-skills.it.test.ts`,
  `server/test/pulls-smart-diff.it.test.ts` (each file's `openrouter:`
  override line), `server/test/helpers/runs.ts` (`waitForPrRuns`'s 10s
  default `timeoutMs`).
