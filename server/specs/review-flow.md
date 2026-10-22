# Spec: the review-run contract

The full cycle for one "run review" action — PR import must already have
happened (see `modules/pulls/routes.ts`). This is a **behavior contract**
(what must stay true), not a design discussion — see `server/docs/
architecture.md` for the latter.

## Trigger

`POST /pulls/:id/review`, body `{ agentId }` (one agent) or `{ all: true }`
(every enabled agent for the workspace), rate-limited to 10/min per route
(`modules/reviews/routes.ts`). Review triggering is **manual only** — no
code path auto-triggers a review on PR import or poll (`POST
/repos/:id/poll` explicitly returns `reviewTriggered: false`, see root
`AGENTS.md`/`INSIGHTS.md`).

## Contract: the response returns before the review finishes

`ReviewService.runReview` (`modules/reviews/service.ts`):

1. Resolves the PR + repo, 404s if either is missing.
2. For **each** target agent, creates an `agent_runs` row up front
   (`status` starts implicitly "running") and returns its id as `run_id`
   immediately — this is what lets the client start listening on
   `GET /runs/:id/events` (SSE) before the run has produced anything.
3. Fires `ReviewRunExecutor.executeRuns(...)` **without awaiting it**
   (`void ...executeRuns(...).catch(...)`) — the HTTP response returns with
   `{ runs: [{run_id, agent_id, agent_name}], reviews: [] }` (`reviews` is
   always empty in this response; the client refetches
   `GET /pulls/:id/reviews` once SSE reports the run done).

A partial failure in one agent's run must not abort the others — each
target agent is executed and persisted independently.

## Contract: one pipeline run, per agent

`ReviewRunExecutor.executeRuns` (`modules/reviews/run-executor.ts`), per
queued agent:

1. **Diff + intent loaded once**, shared across every queued agent for this
   PR (not re-fetched per agent) — `diff-loader.ts`'s `loadDiff`. A pre-work
   failure here (e.g. diff load) fails **every** queued run for this PR, not
   just one.
2. **`reviewPullRequest(...)`** (`@devdigest/reviewer-core`, the pure engine
   — see `reviewer-core/specs/review-engine.md`) does prompt assembly → LLM
   call(s) → merge → the citation-grounding gate, returning grounded
   findings and a recomputed score.
3. **Persist**: one `reviews` row (`kind: 'review'`) + its surviving
   `findings` rows, linked to the `agent_runs` row via `reviews.run_id`.
   `agent_runs` itself is completed with `status: 'done'`,
   `tokens_in`/`tokens_out`, `findings_count`, `blockers` (CRITICAL,
   non-dismissed — the CI-gate-relevant count), and `score`.
4. **Trace**: the whole run (prompt assembly, every LLM call, the grounding
   gate's kept/dropped decisions, every streamed event) is written as
   **one** `run_traces.trace` JSONB document (`RunTrace`), not an
   event-sourced log — `GET /runs/:id/trace` serves this document directly.
   A `RunTrace` has no top-level `status` field; a failed/cancelled run's
   trace is distinguished by the sentinel `tokens_in: 0, tokens_out: 0` (see
   `server/INSIGHTS.md`).
5. **Events**: every step above also streams a `RunEvent` over
   `container.runBus` (the in-memory SSE bus, keyed by `run_id`) as it
   happens — `GET /runs/:id/events` is replay-first (buffers already-emitted
   events so a client that subscribes slightly late still sees the full
   sequence) and completes the stream when the run finishes.

## Contract: cost is derived, never stored as a flat field

No table stores a `cost_usd` column (deliberately removed in commit
`d45ab0d` — see root `INSIGHTS.md`). Every surface that shows a cost
computes it on read from `{model, tokensIn, tokensOut, status}` via
`computeRunCost` (`modules/reviews/helpers.ts`), which itself calls
`container.priceBook.estimate(...)`:

- `computeRunCost` returns `null` — never `0` — when the run isn't
  `status: 'done'`, or its model/token counts are missing, or the model is
  unpriced. A "no data" cost must never be displayed as "free".
- `GET /repos/:id/pulls`' list `cost` field is the **sum** of
  `computeRunCost` over every successful run behind every review ever run
  on that PR (not just the latest — see `server/AGENTS.md`/root
  `INSIGHTS.md`'s commit-d45ab0d note); a PR with no successful run returns
  `cost: null`.
- `GET /pulls/:id/reviews` and the Trace drawer's Stats both compute cost
  per-run the same way, just without summing across runs.

## Contract: each PR-list review column has its own scope

`GET /repos/:id/pulls` derives three columns from the same
newest-first `reviews` query, and they deliberately disagree about which
reviews count:

- **`score`** — the single latest review for the PR, whichever agent
  produced it. A score is one agent's verdict on the whole diff, so summing
  or averaging several would invent a number no agent produced.
- **`findings_by_severity` / `findings_by_agent`** — each AGENT's own latest
  review, summed (`latestReviewPerAgent` in `modules/pulls/status.ts`).
  Findings are additive facts about the code, so a PR reviewed by three
  agents must report all three agents' open findings; taking only the PR's
  latest review would silently drop every other agent's. A re-run still
  supersedes that same agent's earlier review, so nothing double-counts
  across one review's own history. Reviews with a null `agent_id`
  (unattributed runs) collapse into one bucket.
- **`cost`** — every successful run behind every review ever run on the PR,
  including superseded re-runs (see above): the money was spent either way.

## Contract: the grounding gate is structural, not advisory

`REPO_INTEL_ENABLED`, the grounding gate, and the prompt-injection guard are
safety/quality mechanisms, not optional flags (`server/AGENTS.md`). A
finding that fails grounding is **dropped**, not flagged-but-kept — the
`dropped` list exists only for the trace/logs ("never go silent" — see
`reviewer-core/specs/review-engine.md` for the exact grounding rule). Score
is always recomputed from the **grounded** (post-gate) findings, never the
model's self-reported score.

## Cancellation

`ReviewService.cancelRun(runId)` does two things, not one: it signals the
live runner via `container.runBus.cancel(runId)` (works if the background
execution is still running in this process) **and** marks the DB row
cancelled directly (works even for an orphaned run, e.g. the process that
started it died — signalling alone would do nothing to a run with no live
runner listening). Both paths complete the SSE bus for that run.

## What this spec does not cover

- How `reviewPullRequest` itself assembles the prompt or runs the grounding
  gate — see `reviewer-core/specs/review-engine.md`.
- Finding accept/dismiss (`POST /findings/:id/(accept|dismiss)`) — see
  `modules/reviews/findings.ts`; out of scope for this run-flow contract.
