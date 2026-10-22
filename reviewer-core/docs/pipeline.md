# reviewer-core pipeline architecture

How `diff → prompt → LLM → grounded findings` is actually built. Deeper than
`reviewer-core/README.md` (a map) and `reviewer-core/AGENTS.md` (a short
agent brief) — this explains the *why* behind the pipeline's shape.

## The entry point is pure

`reviewPullRequest` (`src/review/run.ts`) is the whole engine's public
surface: given a `ReviewInput` (system prompt, model, diff, an injected
`LLMProvider`, plus optional skills/memory/specs/callers/repoMap context),
it returns a `ReviewOutcome` — grounded `Review`, grounding summary, dropped
findings, token/cost totals, and the `PromptAssembly` for the trace. It does
**no I/O of its own** beyond the injected `LLMProvider` call — no DB,
GitHub, filesystem, or memory retrieval. That's deliberate: both the
server (`modules/reviews/run-executor.ts`) and the CI runner call the exact
same function, so review behavior can't silently drift between the two
callers. Skill bodies, memory items, and spec chunks are passed in as
already-resolved strings — this package never resolves an `AgentManifest`
skill slug to a body itself; the caller does that (DB lookup in the studio,
filesystem in the runner).

## Four stages

```
assemblePrompt → llm.completeStructured(Review schema) → reduceReviews → groundFindings
```

1. **`assemblePrompt`** (`src/prompt.ts`) builds the `ChatMessage[]` and
   assembles every content block (task line, PR description, skills,
   memory, repo skeleton, project-context specs, callers-of-changed-symbols,
   the diff itself) into one user message, in a fixed section order. Every
   block that originates **outside** the trusted system prompt — diff, PR
   description, specs, repo map, callers — is wrapped via `wrapUntrusted()`
   in a `<untrusted source="...">` delimiter (which also neutralizes any
   attempt to close the delimiter early inside the content itself), and the
   system message gets a fixed `INJECTION_GUARD` suffix appended on every
   call. This is the **one shared, trusted defense** — see
   `reviewer-core/specs/review-engine.md` for its exact guarantee and why it
   lives here rather than being pattern-matched downstream.
2. **Single-pass vs. map-reduce** (`selectMode` in `src/review/run.ts`): the
   `"auto"` strategy (the default) only switches to map-reduce when the
   diff is **both** over `DEFAULT_MAP_THRESHOLD_LINES` (400) **and**
   multi-file — a single huge file always stays single-pass regardless of
   size (see `reviewer-core/INSIGHTS.md`). Map-reduce runs one
   `completeStructured` call per changed file (`sliceDiff` in
   `src/review/reduce.ts` extracts that file's diff hunk), each validated
   against the shared `Review` Zod schema with a bounded reprompt-on-failure
   retry budget (`DEFAULT_REVIEW_MAX_RETRIES`).
3. **`reduceReviews`** (`src/review/reduce.ts`) merges N per-chunk partial
   `Review`s into one: findings concatenated, the **worst** verdict wins
   (`request_changes` > `comment` > `approve`), score is the **mean** of the
   partials' scores (this mean is provisional — the real score is
   recomputed after grounding, see below), summaries joined.
4. **`groundFindings`** (`src/grounding.ts`) — the shared citation-grounding
   gate, run exactly once after the reduce step regardless of which mode
   ran. See `reviewer-core/specs/review-engine.md` for its exact pass/fail
   rule; this is the mandatory mechanical gate, not an optional check.

After grounding, `reviewPullRequest` recomputes the final `score` from
`scoreFromFindings(ground.kept)` — **never** the model's self-reported
score, and never the pre-grounding findings set. `scoreFromFindings`
(`src/review/reduce.ts`) is a fixed deterministic penalty table (CRITICAL
−35, WARNING −12, SUGGESTION −3, floored at 0) chosen so the displayed
number always tracks what the UI actually shows beneath it — a cheap
model's wildly inconsistent self-reported score can never appear on screen.

## Cost accumulates per LLM call, and can null-poison

`tokensIn`/`tokensOut`/`costUsd` accumulate across every chunk call in the
loop (`src/review/run.ts`). `costUsd` starts at `0` and is summed
chunk-by-chunk, but **the moment any one chunk's `res.costUsd` is `null`**
(an unpriced model), the running total itself becomes `null` for the rest
of the review — not just that chunk's contribution left out (see
`reviewer-core/INSIGHTS.md`). A multi-chunk map-reduce review is therefore
"all-or-nothing" on cost, by design: a partial sum would misrepresent what
the review actually cost.

## Progress events, not just a final result

`ReviewInput.onEvent` is called throughout the run (`'info'`/`'tool'`/
`'result'` kinds) — one per chunk start, one per chunk result, one for the
reduce step, one per grounding-dropped finding, one for the final grounding
summary. The server's `RunLogger` (`platform/run-logger.ts`, outside this
package) fans these into the live SSE stream and the persisted `RunTrace`
document; this package itself has no persistence or streaming concept, it
just calls the callback synchronously as each step completes.

## Cancellation is a thrown error, not a flag

`ReviewInput.checkCancelled` is called before each (expensive) chunk's LLM
call; the caller supplies a function that **throws** to abort mid-run (the
server throws its own `RunCancelledError` from `run-executor.ts`). This
package stays agnostic to what "cancelled" means to its caller — it only
needs something synchronous it can call as a checkpoint.
