# INSIGHTS.md

## Codebase Patterns

- **2026-10-20** — `groundFindings` exempts findings whose `kind` is one of
  `secret_leak`/`lethal_trifecta`/`phantom`/`hook` from the line-range
  intersection check entirely — they only need their `file` present in the
  diff, not a matching hunk range. Regular diff-findings are dropped unless
  `[start_line, end_line]` intersects a real hunk. Evidence:
  `reviewer-core/src/grounding.ts:16,59-70`.
- **2026-10-20** — `reviewPullRequest`'s `"auto"` strategy only switches to
  map-reduce when the diff is BOTH over the line threshold AND multi-file
  (`diff.files.length > 1`); a single huge file, however large, always stays
  single-pass. Evidence: `reviewer-core/src/review/run.ts:115-121`
  (`selectMode`).
- **2026-10-20** — Multi-chunk `costUsd` accumulation null-poisons: if any
  one chunk's cost is unknown (`res.costUsd == null`, e.g. an unpriced
  model), the entire review's `costUsd` becomes `null`, not just that
  chunk's contribution left out of the sum. Evidence:
  `reviewer-core/src/review/run.ts:184`.
- **2026-10-22** — `StructuredRequest.timeoutMs` is declared on the shared
  interface but never read by `OpenRouterProvider.completeStructured` — only
  the constructor-level `OpenRouterProviderOptions.timeoutMs` (default
  `90_000`ms, set once in `server/src/platform/container.ts`'s `buildLlm`)
  actually bounds the underlying HTTP call. Passing `timeoutMs` on an
  individual `completeStructured` request silently does nothing; a caller
  that needs a tighter per-call bound (e.g. a cheap classification call that
  should fail fast) must wrap the call in its own `Promise.race` against a
  timer instead. Evidence: `reviewer-core/src/llm/openrouter.ts:59-84`
  (no `req.timeoutMs` read anywhere in the method),
  `server/src/vendor/shared/adapters.ts:62` (the unused field).
- **2026-10-22** — `prompt.ts`'s `INJECTION_GUARD` constant already listed
  "derived intent/scope" among the untrusted-content kinds it covers before
  any Intent Layer code existed in the prompt assembly — the prompt-injection
  hardening was written anticipating this feature, not retrofitted for it.
  Evidence: `reviewer-core/src/prompt.ts:16-28`.
