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
- **2026-10-22** — L05/TASK-04 added `project_context` to the server's
  `Agent`/`Skill` DTOs in `vendor/shared/contracts/knowledge.ts` and
  `disableTransportRetry` to `CompletionRequest`/`StructuredRequest` in
  `vendor/shared/adapters.ts`, but did NOT mirror either change into
  `client/src/vendor/shared/*` — this task ran under an explicit "backend-only,
  never touch `client/**`" constraint (a separate frontend worker was
  concurrently active on `client/**` in the same checkout) that overrode the
  usual "both vendored copies change together" convention. The client copies
  of both files were already non-byte-identical to the server's before this
  session (confirmed: client's `knowledge.ts` omits `AgentVersionConfig`/
  `AgentVersion` entirely per this file's 2026-10-22 entry below, and client's
  `adapters.ts` omits `sessionId`/`commitFiles`/`sync`/etc.), so this is a
  widening of an existing gap, not a new kind of drift — but it still needs a
  follow-up hand-edit to `client/src/vendor/shared/contracts/knowledge.ts`
  (add `project_context: ProjectContextSelectionList` to its `Agent`/`Skill`)
  before any client code (e.g. TASK-05's `ProjectContextSelector`) can read
  that field with a type-checked contract. `adapters.ts`'s
  `disableTransportRetry` has no client consumer in this slice (TASK-08/10 are
  server-only callers), so mirroring it is lower-urgency but still owed for
  parity. Evidence: `server/src/vendor/shared/contracts/knowledge.ts` vs.
  `client/src/vendor/shared/contracts/knowledge.ts` (diff after this session),
  same pair for `adapters.ts`.
- **2026-10-23** — L05/TASK-08 added `BriefReadQuery`/`BriefReadResponse`/
  `BriefGenerateRequest` route contracts to the SERVER copy of
  `vendor/shared/contracts/brief.ts` only, under the same backend-only
  "never touch `client/**`" constraint as the TASK-04 entry above (a
  concurrent frontend worker owned `client/**` in the same checkout) — but
  unlike that entry, `brief.ts` was previously one of the files
  `test/vendor-contracts-parity.test.ts` keeps strictly byte-identical (see
  this file's "The two vendored `knowledge.ts` copies are NOT byte-identical,
  unlike `brief.ts`/`trace.ts`/`platform.ts`/`index.ts`" entry below), so this
  is a NEW parity gap, not a widening of an existing one. Confirmed:
  `pnpm exec vitest run --exclude '**/*.it.test.ts'` goes from all-green to
  exactly one failing assertion, in `vendor-contracts-parity.test.ts`, for
  `brief.ts`'s diff. Needs a follow-up hand-edit mirroring the same three
  exports into `client/src/vendor/shared/contracts/brief.ts` (TASK-09's brief
  UI/hooks need them type-checked) before that test is green again. Evidence:
  `server/src/vendor/shared/contracts/brief.ts` ("Route contracts (TASK-08)"
  section) vs. the unchanged client copy; `server/test/vendor-contracts-parity.test.ts`.

## Codebase Patterns

- **2026-10-22** — No shared "does this workspace own repo id X" helper existed
  anywhere in the codebase before L05/TASK-04 — `repo-intel/repository.ts`'s
  `getRepoBasics(repoId)` is deliberately tenant-agnostic (its own comment says
  so), and `project-context/repository.ts`'s `getOwnedRepo` is scoped to that
  one module. Agent/skill CRUD needed to validate a `project_context`
  selection's `repo_id` against workspace ownership, so TASK-04 added
  `RepoRepository.listOwnedIds(workspaceId, repoIds): Promise<Set<string>>`
  (bulk `inArray` check, same shape as `agentSkillCounts`/`skillAgentCounts`)
  and exposed it as `container.reposRepo`, following the exact
  `agentsRepo`/`skillsRepo`/`reviewRepo` lazy-getter precedent. Any future
  module needing the same "workspace owns repo X" check should reuse this
  rather than adding a fourth near-duplicate query. Evidence:
  `server/src/modules/repos/repository.ts` (`listOwnedIds`),
  `server/src/platform/container.ts` (`reposRepo` getter),
  `server/src/modules/agents/service.ts`/`modules/skills/service.ts`
  (`assertProjectContextReposOwned`).
- **2026-10-22** — Agents' and skills' `project_context` field participates in
  their version-bump rule DIFFERENTLY, by design, matching each module's
  pre-existing versioning semantics: agents' `isConfigChange` bumps
  `agent_versions` on any genuine `project_context` content change (same
  bucket as `provider`/`model`/`strategy`, compared via a `JSON.stringify`
  equality check — `projectContextEqual` — so resubmitting an
  object-identity-different-but-content-same array doesn't spuriously bump
  it); skills' `isBodyChange` never looks at `project_context` at all, since
  `skill_versions` is deliberately body-only (per its own doc comment, editing
  name/description/type/enabled already doesn't version a skill, and
  `project_context` joins that same unversioned bucket). Don't assume the two
  modules' "does this field bump the version" rule is symmetric when adding a
  new field to either. Evidence: `server/src/modules/agents/helpers.ts`
  (`isConfigChange`, `projectContextEqual`), `server/src/modules/skills/helpers.ts`
  (`isBodyChange`'s doc comment), `server/test/agents-helpers-project-context.test.ts`,
  `server/test/skills-project-context.test.ts`.
- **2026-10-22** — `pull_requests` has no dedicated merge-timestamp column —
  `status` ('open'/'merged'/'closed') IS the GitHub merge state (confirmed
  by `pulls/status.ts:89`'s `ghStatus === 'merged'` check), and `updated_at`
  is the closest available timestamp to "when it merged", not an exact one.
  A feature needing "when was this PR merged" (e.g. the new
  `history`/`getPriorPrsWithFileOverlap` feature) must fall back through
  `updatedAt ?? openedAt ?? null` rather than assuming a real merge
  timestamp exists. Evidence: `server/src/db/schema/pulls.ts:5-34` (no
  `mergedAt` field), `server/src/modules/history/helpers.ts`
  (`toPrHistoryItem`'s fallback chain).

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

- **2026-10-22** — Blast Radius's caller-dedup must be scoped PER changed-symbol
  group (`viaSymbol`), not globally across `result.callers`: the same
  `file|symbol|line` caller location can legitimately appear under two
  different changed symbols when one function calls both of them (e.g. a
  caller invoking both `symA` and `symB` from the same line of its own body).
  A dedup key of just `file|symbol|line` silently drops that caller from the
  second group; the key must include `viaSymbol` as its first segment.
  Evidence: `server/src/modules/blast/helpers.ts:44` (the four-part key),
  `server/test/blast-grouping.test.ts` ("a caller row reaching two different
  changed symbols from the same file/symbol/line survives in both groups").

- **2026-10-22** — The two vendored `vendor/shared/contracts/knowledge.ts`
  copies are NOT byte-identical, unlike `brief.ts`/`trace.ts`/`platform.ts`/
  `index.ts` (which this session kept byte-identical copies for): the client's
  copy omits `AgentVersionConfig`/`AgentVersion` entirely and has a narrower
  `provider` enum comment / different `ci_fail_on` wording, because the
  client UI never replays an agent's versioned config snapshot. A future edit
  to `Agent`/`Skill`/`AgentVersionConfig` in `knowledge.ts` must be mirrored
  field-by-field by hand into the client copy, not via `cp`, unlike the four
  files above where a straight copy is correct. Evidence: `diff
  server/src/vendor/shared/contracts/knowledge.ts
  client/src/vendor/shared/contracts/knowledge.ts` (lines 227–251 of the
  server copy, `AgentVersionConfig`/`AgentVersion`, absent from client's).
- **2026-10-22** — Adding a new `.notNull().default(...)` jsonb column to
  `agents`/`skills` and then also adding the matching *required* field to the
  public `Agent`/`Skill` Zod DTOs in `knowledge.ts` immediately breaks
  `tsc --noEmit` in `modules/agents/helpers.ts` (`toAgentDto`) and
  `modules/skills/helpers.ts` (`toSkillDto`) — their pure row→DTO mapper
  literals now miss the new required property, even though those files
  contain no business logic and aren't routes. A schema-freeze task that adds
  a DB column should land the column plus a standalone Zod type for the new
  value (e.g. an exported `FooSelectionList`) and stop there; wiring it into
  the public `Agent`/`Skill` DTO (and fixing the two mapper functions) belongs
  to whichever task actually implements the CRUD/mapping, not the schema task
  — otherwise a "contracts/schema only" task silently expands into editing
  service-layer files. Evidence: `tsc --noEmit -p tsconfig.json` error
  `TS2741: Property 'project_context' is missing in type` at
  `src/modules/agents/helpers.ts:13` and `src/modules/skills/helpers.ts:12`
  when `Agent.project_context`/`Skill.project_context` were added, resolved
  by reverting those two DTO fields and keeping only the DB columns +
  `ProjectContextSelectionList` (`contracts/project-context.ts`).

- **2026-10-22** — The repo-intel indexer pipelines (`pipeline/full.ts:262`,
  `pipeline/incremental.ts:251`) already write a `hotnessAvailable: false`
  key into `repo_index_state.stats` (JSONB) on every run — but
  `RepoIntelRepository.tryGetIndexState` only ever projects `stats.durationMs`
  and `stats.reason` out of that blob; every other key (including
  `hotnessAvailable`) is silently dropped before it reaches the stable
  `IndexState` shape. A caller needing `hotnessAvailable` (or any other
  pipeline-written stat) must read `repo_index_state.stats` directly rather
  than assuming `getIndexState()`/`tryGetIndexState()` exposes it — added a
  narrow `getIndexStateStats(repoId)` repository method for this rather than
  widening `IndexState` (which has many existing callers). Evidence:
  `server/src/modules/repo-intel/repository.ts` (`tryGetIndexState`'s
  `stats.durationMs`/`stats.reason` projection vs. the new
  `getIndexStateStats`), `server/src/modules/repo-intel/pipeline/full.ts:262`,
  `server/src/modules/repo-intel/pipeline/incremental.ts:251`.
- **2026-10-22** — `server/tsconfig.json`'s `include: ["src/**/*.ts"]` means
  `pnpm typecheck` (`tsc --noEmit -p tsconfig.json`) never type-checks
  anything under `server/test/`, and `vitest run` doesn't type-check either
  (esbuild strips types without checking) — so a `*.it.test.ts` file whose
  stub class does `implements SomeInterface` (e.g. `test/blast.it.test.ts`'s
  `StubRepoIntel implements RepoIntel`) can silently fall out of sync with
  that interface after a non-test-file change adds a new required method:
  neither `pnpm typecheck` nor `pnpm exec vitest run` catches the missing
  method, confirmed by running `tsc --noEmit` directly against the file
  (`error TS2420: Class 'StubRepoIntel' incorrectly implements interface
  'RepoIntel'. Property '<new method>' is missing`) after adding
  `RepoIntel.getRankedFilesWithHotness` without touching the stub. Anyone
  adding a method to a facade interface (`RepoIntel`, or similarly-shaped
  ones) must manually `grep -rln "implements <Interface>"` across `test/`
  too, not just `src/`, since the toolchain won't flag the gap. Evidence:
  `server/tsconfig.json` (`include`), `server/test/blast.it.test.ts`
  (`StubRepoIntel`).

- **2026-10-22** — A narrow adapter interface that only ONE server module needs
  (not shared with `reviewer-core`/client the way `GitClient`/`LLMProvider` in
  `vendor/shared/adapters.ts` are) belongs beside its own adapter file, not in
  `vendor/shared/adapters.ts` — `adapters/tokenizer/index.ts`'s `Tokenizer`
  interface already does this (confirmed by grep: it's defined there, not in
  `vendor/shared`), and the new project-context `GitTreeReader`/`GitTreeEntry`
  (`adapters/git/tree-reader.ts`) followed the same precedent rather than
  adding to the mirrored-to-client `vendor/shared/adapters.ts` file (which
  would have required a byte-identical client-copy edit for an interface the
  client never calls). Check whether an interface is cross-package before
  picking its home. Evidence: `server/src/adapters/tokenizer/index.ts`
  (`export interface Tokenizer`), `server/src/adapters/git/tree-reader.ts`.
- **2026-10-22** — `GitClient.readFile` (`adapters/git/simple-git.ts`) validates
  an untrusted path with `resolve()` + `realpath()` against the clone root
  BEFORE reading — safe in the common case, but it's a check-then-use over a
  MUTABLE working-tree directory (a concurrent `git reset --hard`/fetch, or a
  symlink swap, could in principle change what the path resolves to between
  the check and the `fs.readFile`). For a feature that reads untrusted
  repo-relative paths more adversarially (L05's Project Context Folder), the
  new `GitTreeReader` (`adapters/git/tree-reader.ts`) instead resolves content
  by content-addressed git OBJECT ID (`git ls-tree -r -l -z <pinned-commit>`
  → exact-string match in memory → `git cat-file -s`/`-p <oid>`) — no
  filesystem path is ever joined/resolved against user input, so there is no
  parent-directory TOCTOU window at all, not just a narrowed one. Reach for
  this pattern (not `readFile`) for any future untrusted-path read that needs
  a stronger guarantee than "safe in the common case". Evidence:
  `server/src/adapters/git/tree-reader.ts`'s doc comment,
  `server/src/adapters/git/tree-reader.test.ts`'s "immune to a TOCTOU swap of
  the working-tree file after listing" test (swaps the committed file for a
  symlink to `/etc/hosts` AFTER `listTree()`, then shows `readBlob` still
  returns the original committed content).

- **2026-10-23** — L05/TASK-06 needed `run-executor.ts` (reviews module) to resolve
  project-context documents, which required BOTH `AgentsService`-shaped union
  logic AND `ProjectContextService`'s git-object read path — a genuine
  cross-module (`project-context/service.ts`) call from `reviews/`. No
  container getter exists for either service (only repositories —
  `agentsRepo`/`reposRepo`/`skillsRepo`/`reviewRepo` — are container-exposed
  singletons); the only existing precedent for "construct a service inline
  inside another module's orchestration code" is `run-executor.ts`'s own
  `new IntentService(this.container, this.repo)` call, which is INTRA-module
  (`reviews/pipeline/intent.ts`). TASK-06 extended that same inline-construction
  pattern across a module boundary (`new ProjectContextService(this.container)`
  inside `reviews/run-executor.ts`) rather than adding a container getter
  (container/module registration is TASK-02's sole-owner territory per the
  plan) — and avoided needing `AgentsService` at all by inlining the pure
  `resolveProjectContextPaths` helper directly against `agent.projectContext`
  (already on the `AgentRow` the executor already has) and the SAME
  `agents.linkedSkills()` call `resolveAgentSkills` already makes (added a
  `projectContext: ProjectContextSelectionList[]` field to `ResolvedSkills`
  rather than querying twice). Flagged for the architecture reviewer: this is
  the first cross-module `service.ts`-class construction in this codebase: a
  container-getter shouldn't be added for it without touching the
  TASK-02-owned container file, but it's worth that reviewer explicitly
  deciding whether it crosses onion-architecture's "other services via the
  container" guidance enough to need one. Evidence:
  `server/src/modules/reviews/run-executor.ts` (`buildProjectContext`,
  `resolveAgentSkills`), `server/src/modules/project-context/service.ts`
  (`resolveDocuments`).
- **2026-10-23** — The approved spec's C5 budget rule ("Attached-block budget
  is 20% of the selected model context window, clamped to 4,000–32,000
  tokens, falling back to 16,000 when unknown") is ambiguous about WHICH
  number the 16,000 fallback actually produces: naively composing it as
  `clamp(0.2 * resolveContextWindowTokens(modelInfo), 4000, 32000)` — i.e.
  piping the tokenizer adapter's own existing 16,000 "unknown window"
  fallback through the SAME 20%/clamp formula used for a known window — gives
  `0.2 * 16000 = 3200`, which the 4,000 floor then clamps UP to **4,000**,
  never actually producing the literal 16,000 the spec names. Implemented
  instead as: apply the 20%/clamp formula only when `modelInfo.contextLength`
  is a real known positive number; when it is not, use
  `resolveContextWindowTokens`'s 16,000 fallback directly AS the budget,
  bypassing the clamp formula entirely. Any other caller composing
  `resolveContextWindowTokens` with a budget-sizing clamp should check this
  same trap before assuming "pipe the window through the usual formula" is
  correct. Evidence: `server/src/modules/reviews/pipeline/project-context.ts`
  (`resolveProjectContextBudgetTokens`'s doc comment),
  `server/test/review-project-context-budget.test.ts` ("falls back to 16,000
  (not 4,000) when the model/window is entirely unknown").
- **2026-10-23** — L05/TASK-08's PR Brief budget is a FIXED 8,000-token input
  cap (C7), unlike TASK-06's review-time attached-block budget (20% of the
  model's context window, clamped 4k-32k, via
  `resolveProjectContextBudgetTokens`) — the two must not share a budget
  NUMBER function. The underlying drop-whole-documents-from-the-tail
  ALGORITHM (`buildProjectContextAttachment`/`emptyProjectContextAttachment`,
  `reviews/pipeline/project-context.ts`) IS generic (`budgetTokens` is a
  plain parameter, no model-window logic baked in), so `brief/service.ts`
  reuses it directly, computing its own `budgetTokens` as
  `BRIEF_INPUT_TOKEN_CAP` minus the mandatory (never-dropped) section's token
  count, rather than forking the function. A future feature with its own
  fixed/different budget rule should reuse `buildProjectContextAttachment`
  the same way, not copy it. Evidence: `server/src/modules/brief/service.ts`
  (`generate`'s budget section), `server/src/modules/brief/constants.ts`
  (`BRIEF_INPUT_TOKEN_CAP = 8_000`).
- **2026-10-23** — L05/TASK-08 is the first code in this repo using a
  Postgres session-scoped advisory lock (`pg_try_advisory_lock`/
  `pg_advisory_unlock`, confirmed via `grep -rn advisory server/src` — no
  prior hits). A session-scoped lock's acquire/release pair MUST run on the
  SAME physical connection; a plain Drizzle `db.execute(...)` over the
  pooled `postgres-js` client does NOT guarantee that (each call can land on
  a different pooled connection, silently turning the unlock into a no-op
  that never releases the real lock). Fixed by exposing the RAW
  `postgres-js` client (distinct from the Drizzle-wrapped `db`) as
  `ContainerOverrides.rawSql`/`Container.rawSql`, wired from `buildApp()`'s
  own `createDb()` handle, and using `rawSql.reserve()` (postgres-js's
  dedicated-connection API, NOT a DB transaction — reserving pins a
  connection without starting a transaction, which matters because the plan
  forbids holding a transaction open across the slow model call) for the
  lock's lifetime, released via `conn.release()` in a `finally`. A test that
  builds its own `db` (most `.it.test.ts` files) must separately pass
  `overrides.rawSql` (e.g. `pg.handle.sql`) to exercise the real lock, not
  just the real `db`. Separately: `postgres-js` has no `bigint`
  query-parameter binding at all (confirmed via `tsc`: `Argument of type
  'bigint' is not assignable to parameter of type 'ParameterOrFragment<never>'`)
  — a `bigint` lock key must be sent as a string with a server-side
  `::bigint` cast (`` sql`select pg_try_advisory_lock(${key}::bigint)` ``),
  not interpolated directly. Evidence: `server/src/platform/container.ts`
  (`ContainerOverrides.rawSql`, `Container.rawSql`), `server/src/app.ts`
  (wiring from `handle.sql`), `server/src/modules/brief/service.ts`
  (`withGenerationLock`), `server/src/modules/brief/helpers.ts`
  (`advisoryLockKeyForPr`), `server/test/brief-lock.test.ts` (hermetic proof
  via a fake global-flag `rawSql`), `server/test/brief.it.test.ts` (same
  behavior against real Postgres — ran and passed in this session; Docker
  was actually available in this environment).
- **2026-10-23** — `ReviewRunExecutor` (`reviews/run-executor.ts`) had NO
  hermetic (non-`.it.test.ts`) test coverage before this session — confirmed
  by `grep -rln "ReviewRunExecutor" server/test server/src` returning only
  `.it.test.ts` files and the production code itself — because its
  constructor takes a real `ReviewRepository`/`Container['agentsRepo']`
  previously assumed to need a live Postgres. A private orchestration method
  that only touches `container.{db,git,gitTreeReader,tokenizer}` and
  `agents.linkedSkills()` (not the full `executeRuns`/`runOneAgent` DB-write
  path) CAN be unit-tested without Docker: construct the executor with a
  plain object implementing just `{linkedSkills}` cast to
  `Container['agentsRepo']`, a minimal chainable `{select: () => ({from: () =>
  ({where: async () => [row]})})}` stub standing in for the ONE Drizzle query
  `ProjectContextRepository.getOwnedRepo` runs through `container.db`, and
  `MockGitClient`/`MockGitTreeReader` from `adapters/mocks.ts` — then call the
  private method via `executor as unknown as {theMethod: ...}`, the same
  private-method-cast convention `project-context-service.test.ts` already
  uses for `.repo`/`.getRoots` overrides. Evidence:
  `server/test/review-executor-project-context.test.ts` (`makeExecutor`).

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
- **2026-10-22** — `git ls-tree`'s TYPE column for a symlink entry is `blob`,
  not a distinct "symlink" type — only the separate MODE column (`120000`)
  tells you it's a symlink; a symlink's "content" (readable via `cat-file -p`
  on its oid, same as any other blob) is the link-target text, not file data.
  Any code branching on `ls-tree` output to decide "is this readable document
  content" must check `mode === '120000'` first and treat it as its own
  case — checking `type === 'blob'` alone will treat a symlink exactly like a
  real file. Evidence: `server/src/adapters/git/tree-reader.ts`
  (`parseLsTreeLongLine`'s `mode === MODE_SYMLINK` check, which must run
  before the `type === 'blob'` branch), `server/src/adapters/git/tree-reader.test.ts`
  ("reports a symlink entry by kind, distinct from a real blob").

## What Works

- **2026-10-22** — A `new Service(container)`-style class whose method calls a
  free function (not a container adapter) for one of its dependencies — e.g.
  `settings/feature-models.ts`'s `getProjectContextRoots(container,
  workspaceId)` — can still be made hermetically testable without a
  chainable-Drizzle mock: wrap the call in an instance property
  (`private getRoots = (workspaceId) => getProjectContextRoots(this.container,
  workspaceId)`) instead of calling the import directly inside the method body,
  then override that property post-construction in tests
  (`(service as unknown as {getRoots: Fn}).getRoots = async () => [...]`) —
  the exact same technique `test/repo-intel-resync.test.ts` already uses for
  `.repo`, extended to a plain function dependency instead of a class one.
  Avoids needing to fake `container.db.select().from().where()` chains just to
  unit-test a method that reads one settings key. Evidence:
  `server/src/modules/project-context/service.ts` (`private getRoots`),
  `server/test/project-context-service.test.ts` (the `getRoots` override in
  `makeService`).
- **2026-10-22** — Extending `Tokenizer.count()` with encoding-aware metadata
  (`'cl100k_base'` vs `'heuristic'`) without touching `count()`'s own frozen
  signature: added a wider sibling interface `TokenizerWithEstimate extends
  Tokenizer { estimate(text): TokenEstimate }`, implemented by
  `TiktokenTokenizer` (whose `count()` now just delegates to
  `estimate().tokens`, so there's exactly one try/catch/sticky-`broken` code
  path, not two), plus a free function `estimateWithEncoding(tokenizer, text)`
  that duck-checks for `.estimate` and falls back to `{tokens: count(),
  encoding: 'heuristic'}` for an opaque/mock tokenizer. This was necessary
  because `test/repo-intel-rank-map.test.ts`'s `charTokenizer: Tokenizer = {
  count: (t) => t.length }` is a literal object satisfying exactly the narrow
  interface — adding a new REQUIRED method to `Tokenizer` itself would have
  broken that fixture's type (even though `server/test/` isn't covered by
  `pnpm typecheck`, per this file's existing `tsconfig.json include` gotcha).
  Evidence: `server/src/adapters/tokenizer/index.ts` (`TokenizerWithEstimate`,
  `estimateWithEncoding`), `server/test/tokenizer-estimate.test.ts`.

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
- **2026-10-22** — `waitForPrRuns` only polled `agent_runs.status`, but
  `ReviewRunExecutor` persists a terminal `status` and the run's
  `run_traces` document as two sequential, non-transactional awaits
  (status first — `specs/review-flow.md` documents this as steps 3 then 4
  deliberately, so don't "fix" it by reordering production code). A caller
  can observe the terminal status before the trace row exists; the window
  is normally sub-millisecond so it rarely loses, but widened enough on a
  CI runner to fail `review-run-skills.it.test.ts` with "Cannot read
  properties of undefined (reading 'skills')" on `trace.prompt_assembly`,
  right after the identical server code passed on the prior CI run.
  `reviews.it.test.ts` has the same `waitForPrRuns` → `GET /runs/:id/trace`
  pattern and carries the same latent risk. Fixed by making
  `waitForPrRuns` also poll `run_traces` for each terminal run id before
  returning. Evidence: `server/src/modules/reviews/run-executor.ts:300-345`
  (`completeAgentRun` before `saveRunTrace`, same order in the `failAll`
  and catch branches), `server/test/helpers/runs.ts` (`tracesExist`).
- **2026-10-22** — Before L05/TASK-04, `AnthropicProvider`/`OpenAIProvider`'s
  `completeStructured` reprompt loop had no `try/catch` around the per-attempt
  API call — a transport failure on attempt 2+ (after attempt 1 already
  returned a response that merely failed schema validation, accumulating real
  `tokensIn`/`tokensOut`) propagated the RAW SDK error straight out of
  `completeStructured`, silently dropping that already-accumulated usage with
  no way for a caller to log it. Fixed by wrapping each attempt's API call in
  its own `try/catch` that rethrows an `ExternalServiceError` carrying
  `{ usage: usageKnown ? { tokensIn, tokensOut } : 'unknown' }` — `usageKnown`
  flips true only after at least one attempt actually received a response, so
  a failure before any response is honestly labeled `'unknown'` rather than
  `{tokensIn: 0, tokensOut: 0}` (which would read as a confirmed free call —
  same "never guess a cost/usage number" principle `PriceBook.estimate`
  already follows for pricing, per `server/docs/architecture.md`). Any other
  multi-attempt LLM call site added later should check for this same
  swallowed-usage-on-transport-failure shape. Evidence:
  `server/src/adapters/llm/openai.ts`/`anthropic.ts` (`completeStructured`'s
  per-attempt `try/catch`), `server/test/llm-disable-retry.test.ts` ("preserves
  real accumulated usage on failure when an earlier attempt DID respond",
  "labels failure usage 'unknown' when no response was ever received").
