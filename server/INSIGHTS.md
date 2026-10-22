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
