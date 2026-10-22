# INSIGHTS.md

## What Works

- **2026-10-22** — The MCP SDK's `InMemoryTransport.createLinkedPair()`
  (`@modelcontextprotocol/sdk/inMemory.js`) plus a real `Client` gives a full
  protocol-level test harness with zero spawned processes and zero real
  network: connect one transport to a `Client`, the other to the
  `McpServer` under test, and `client.listTools()`/`client.callTool()`
  exercise the actual registered tools, zod validation, and `isError`
  handling end to end. Combined with `createMcpServer({ config, fetchImpl })`'s
  injectable `fetchImpl`, this needs no real DevDigest API running. Evidence:
  `src/tools/tools-contract.test.ts`, `src/tools/read-only.test.ts`,
  `src/tools/get-blast-radius.test.ts`, `src/tools/run-agent-on-pr.test.ts`.

## Tool & Library Notes

- **2026-10-22** — `@modelcontextprotocol/sdk@1.x`'s `McpServer.registerTool`
  overload set blows up TypeScript's instantiation-depth limit (`TS2589:
  Type instantiation is excessively deep and possibly infinite`) on EVERY
  `registerTool` call, with no code change needed to trigger it, when
  `tsconfig.json`'s `paths` maps the bare `"zod"` specifier to an explicit
  `./node_modules/zod` path (as `reviewer-core/tsconfig.json`'s template
  does, to force a single zod type identity for its externally-located
  `@devdigest/shared` imports). Dropping the `"zod"`/`"zod/*"` path entries
  (keep only the `@devdigest/shared` alias) fixes it — the SDK resolves
  `zod` v3 correctly without forcing it. Passing a raw `z.object({...})`
  instance (vs. its `.shape`) as a tool's `inputSchema` is NOT the cause;
  isolated repros with both forms fail identically until the `"zod"` path
  mapping is removed, and both work fine without it. Evidence: minimal
  repro reduced to `server.registerTool('t', { inputSchema: { repo:
  z.string() } }, async (args) => ({ content: [] }))` still erroring with
  the mapping present, passing with it removed; fix applied at
  `mcp-server/tsconfig.json` (no `"zod"` entries).
- **2026-10-22** — Vitest/Vite does not read `tsconfig.json`'s `paths` on its
  own, so a test importing `@devdigest/shared` fails with "Failed to load
  url @devdigest/shared... Does the file exist?" even though `tsc` resolves
  it fine. Mirror the alias in `vitest.config.ts`'s `resolve.alias` (same
  fix `reviewer-core/vitest.config.ts` already uses for the identical
  reason). Evidence: `mcp-server/vitest.config.ts`
  (`resolve.alias['@devdigest/shared']`).

## Recurring Errors & Fixes

- **2026-10-22** — A hand-rolled fixture for a Zod contract whose fields are
  all `.nullable()` (not `.nullish()`) — e.g. `RunSummary` — must still
  include EVERY key, just with `null` values; omitting a key (not just
  leaving it `null`) fails `schema.safeParse` inside `api/client.ts`'s
  `createApi`, and that failure surfaces as a generic `ApiError` caught by
  the tool's catch-all, reading like an unrelated bug ("response did not
  match the expected shape") rather than "your test fixture is incomplete".
  Build fixtures from one "every field present, defaulted to `null`" helper
  function per contract instead of hand-rolling partial objects per test.
  Evidence: `src/tools/run-agent-on-pr.test.ts` (`runSummary(overrides)`
  helper), the `RunSummary` contract
  (`server/src/vendor/shared/contracts/trace.ts`).
- **2026-10-22** — `truncate()`'s already-computed `total` (the real,
  pre-truncation count) was destructured away at two call sites
  (`get-findings.ts`, `get-blast-radius.ts`), so `totals.findings` and a
  symbol's caller count silently understated whenever `findings_truncated`/
  `callers_truncated` was true. Destructure and surface `total` everywhere
  `truncate()` is used. Evidence: `src/tools/shape.ts`'s `truncate`,
  `src/tools/get-findings.ts` (`findings_total`), `src/tools/get-blast-radius.ts`
  (`callers_total`).

## Codebase Patterns

- **2026-10-22** — Repo/PR-derived free text a tool returns (finding titles,
  review summary/grounding, convention rule/evidence_path, blast caller
  labels) is reachable by a hostile PR or repository and crosses the MCP
  boundary straight into the calling agent's context. The review pipeline's
  own `wrapUntrusted`/`INJECTION_GUARD` (`reviewer-core/src/prompt.ts`)
  guards the *reviewer* model against this exact content, but that guard
  does not follow the text out through this boundary — a plain JSON string
  has no "data, not instructions" framing. Fix: reimplemented the same
  `<untrusted>...</untrusted>` delimiter LOCALLY (this package may depend
  only on `@devdigest/shared`, never on `reviewer-core`), applied once at
  the shared `shape.ts` helpers (`conciseFinding`, `callerLabel`) so every
  tool using them gets it for free, plus a one-line `security_notice` in
  each affected tool's response. Evidence: `src/untrusted.ts`,
  `src/tools/shape.ts`, `src/untrusted.test.ts`.
- **2026-10-22** — `readOnlyHint: true` on an MCP tool means "never calls a
  write/LLM endpoint", not "zero server-side effects". `get_findings`/
  `get_blast_radius` resolve a PR via `GET /repos/:id/pulls`, which syncs
  from GitHub and upserts PR rows server-side
  (`server/src/modules/pulls/routes.ts`) — a real, pre-existing side effect
  of that endpoint (the same one loading the PR list in the UI causes), not
  something this package added. Document the distinction explicitly
  wherever the hint is explained, rather than letting a reader assume it
  means fully inert. Evidence: `mcp-server/AGENTS.md` ("Do not touch"),
  `src/api/resolve.ts`'s docblock, `src/tools/read-only.test.ts`'s denylist
  comment.
