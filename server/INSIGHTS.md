# INSIGHTS.md

## Open Questions

- **2026-09-29** — `client/CLAUDE.md` documents its `pnpm-workspace.yaml` as
  just a `pnpm.allowBuilds` allowlist (not a real workspace); `server/`'s
  `pnpm-workspace.yaml` has the same pattern (`allowBuilds` for
  `cpu-features`, `esbuild`, `protobufjs`, `ssh2`) but `server/CLAUDE.md`'s
  Gotchas section has no equivalent note → should `server/CLAUDE.md` gain the
  same clarifying line, so the file isn't mistaken for stray monorepo config?
  Evidence: `server/pnpm-workspace.yaml`, `client/CLAUDE.md` Gotchas section.

## Codebase Patterns

- **2026-09-29** — Not every GET route's response is Zod-validated despite
  `server/CLAUDE.md`'s "schema-first... one definition drives both request
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
