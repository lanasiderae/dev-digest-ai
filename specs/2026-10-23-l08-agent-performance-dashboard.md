# L08 feature specification — Agent Performance Dashboard

- Status: **DRAFT — operator-authored, pending user approval.** The session
  operator (Claude Code) was explicitly instructed to complete this
  assignment end-to-end without further questions ("I won't be able to
  answer questions"). Per `specs/README.md`, a draft is approved only with
  explicit user approval; no such approval exists yet for this document. It
  is carried forward as the working baseline so planning/implementation can
  proceed, but should be reviewed and explicitly approved (or amended) by
  the user before being treated as final.
- Author: session operator, generated from the L08 assignment brief
  ("DevDigest AI Marketplace — Implementation, Release & Homework", Part 5 —
  Optional Assignment: Agent Performance Dashboard) and inspected repo
  state.
- Baseline: `lanasiderae/dev-digest-ai`, `l05/specs`, commit `a719a29`.
- Target branch: `l08/final`; `main` is not the baseline.
- Scope: **only Part 5** of the L08 assignment brief — the global Agent
  Performance Dashboard inside DevDigest itself. Parts 1–4 (an independent
  `dev-digest-ai-marketplace` GitHub repository, four Claude Code plugins, a
  GitHub Pages catalog, a cost experiment, and a tag/release/rollback
  lifecycle) are **out of scope for this specification** — they describe a
  separate repository with its own release process, not a DevDigest code
  change. That work is tracked instead as a local, unpushed scaffold plus a
  student-facing task sequence (see `docs/sdd/l08/marketplace-task-sequence.md`),
  since creating/pushing a real external GitHub repository, cutting tags,
  and recording a demo video are actions this session will not take
  unilaterally on the user's behalf.
- This document defines behavior; it is not an implementation plan or
  evidence that the feature already works.

## Why this scope split

The assignment brief bundles two unrelated deliverables under "L08": (1) an
external plugin marketplace repository with its own release lifecycle, and
(2) an optional DevDigest feature, the Agent Performance Dashboard. The
reference prior-art branch inspected for approach (`L08-agent-performance`,
a public fork's PR #10) likewise only implements the dashboard inside the
product repo — no marketplace repository changes accompany it there either,
which is expected: the marketplace is explicitly a *different* repository
per the brief's own "Create a Separate Repository" section. That branch was
consulted only for which product surfaces it touched (new `agent-stats`
server module, a `StatsTab` on the per-agent editor, a global
`agent-performance` page) to corroborate this spec's own reading of the
brief and this repo's existing scaffolding — not copied from; this
specification and its implementation are authored independently against
this repository's own schema, contracts, and conventions.

## Evidence and provenance (existing scaffolding found)

This repository already carries **unwired scaffolding for exactly this
feature**, committed ahead of this lesson per the repo's stated practice
("DB schema intentionally contains every table for the whole course";
contracts "EXTEND with new files" ahead of the lesson that wires them):

| Artifact | Location | State |
|---|---|---|
| `AgentStats` contract (`GET /agents/:id/stats`) | `*/src/vendor/shared/contracts/observability.ts` | Defined (L07 — A5), zero server/client references outside the contract file itself |
| `AgentPerf` / `AgentPerfRow` / `PerfCostSegment` contracts (`GET /agents/performance`) | `*/src/vendor/shared/contracts/productionize.ts` | Defined (L08 — A6), zero references outside the contract file |
| `agent_runs` table (`durationMs`, `tokensIn`, `tokensOut`, `model`, `status`, `agentId`, `ranAt`, `findingsCount`) | `server/src/db/schema/runs.ts` | Populated by existing review-run flow; no stats reader exists yet |
| `findings` table (`acceptedAt`, `dismissedAt`, `severity`) | `server/src/db/schema/reviews.ts` | Populated by existing review flow; accept/dismiss already recorded |
| `computeRunCost(estimate, run)` pure helper | `server/src/modules/reviews/helpers.ts` | Existing pattern for deriving cost from `tokensIn/tokensOut/model` via `container.priceBook.estimate` at read time — cost is **not** persisted per run |
| `ReviewRepository` (owns `agent_runs` access) | `server/src/modules/reviews/repository.ts` + `repository/run.repo.ts` | Only transactional read/write paths exist (running-run lookups, insert/update); no aggregate/date-range query exists yet |
| No per-agent "Stats" UI tab | `client/src/app/agents/[id]/_components/AgentEditor/` | Tabs today: Config, Skills, Context — **no Stats tab**, contradicting the brief's premise ("existing Stats tab ... already provides per-agent metrics") |
| No global nav entry | `client/src/vendor/ui/nav` (or equivalent sidebar component) | No "Agent Performance" item under Global |

Consequence: the brief's premise that a per-agent Stats tab already exists
is **false in this repository's current state** (confirmed also by the
reference branch inspected, which built both a `StatsTab` and the global
dashboard together). This specification therefore covers both: a per-agent
Stats tab (wiring `AgentStats`) and the global Agent Performance Dashboard
(wiring `AgentPerf`), since the dashboard's own acceptance criteria require
reusing "the same APIs and aggregation rules as the existing Stats tab" —
rules that must first exist to be reused.

No live DevDigest MCP state was queried for this specification beyond what
is listed above. No model/LLM call is proposed by this feature — it is a
read-only aggregation over already-stored `agent_runs`/`findings` rows.

## Goals and non-goals

Goals:
- Surface per-agent run/cost/duration/accept-rate stats (wiring the
  existing `AgentStats` contract) on a new Stats tab in the Agent Editor.
- Surface a global, cross-agent performance dashboard (wiring the existing
  `AgentPerf` contract) reachable from the Global sidebar, matching the
  acceptance criteria in Part 5 of the brief and the supplied reference
  screenshot (summary tiles, per-agent table, cost breakdown by agent and
  by model, date-range filter).
- Both surfaces read only already-persisted `agent_runs`/`findings` rows;
  neither triggers a review run or an LLM call, on load, sort, or
  row-expand.

Non-goals (per the brief's own scoping and this repo's gotchas about
unimplemented scaffolding):
- Parts 1–4 of the brief (the external marketplace repository, its four
  plugins, GitHub Pages catalog, cost-baseline experiment, and tag/release/
  rollback lifecycle) — tracked separately, outside this spec.
- `PluginBundle`/`PluginExportRequest`/`InstalledPlugin` (plugin export/
  import) and `Digest`/`DigestSettings` (Weekly Digest) contracts in
  `productionize.ts` — adjacent L08 scaffolding, not requested by Part 5,
  left unwired.
- Billing reconciliation against a real provider invoice — `total_cost_usd`
  remains a DevDigest **estimate** (via `PriceBook`), as it already is
  everywhere else in the product (multi-agent run costs, review costs).
  Surfaced explicitly as an estimate, not implied to be reconciled billing
  data.
- Any new DB table or migration — `agent_runs`/`findings`/`agents` already
  carry everything required; this is a read/aggregation feature only.

## Acceptance criteria

Priorities: P1 = required per the brief's Part 5 criteria; P2 = supporting
behavior needed for P1 to be truthful (empty/error states, denominators).

| AC-ID | Priority | EARS requirement | Verification evidence |
|---|---|---|---|
| APD-AC-01 | P1 | WHEN an authenticated workspace member requests `GET /agents/:id/stats` for an agent with ≥1 run in range, the server SHALL return `AgentStats` with `runs`, `findings_total`, `accepted`, `dismissed`, `pending`, `accept_rate` (accepted / (accepted+dismissed), null if denominator is 0), `avg_findings_per_run`, `total_cost_usd`/`avg_cost_usd` (derived via `computeRunCost`+`PriceBook`, null when any input is missing), `avg_latency_ms`, `findings_by_severity`, and an oldest→newest `trend`. | Route/service/repository code; unit + `.it.test.ts` coverage with seeded runs/findings. |
| APD-AC-02 | P1 | WHEN `GET /agents/:id/stats` is requested for an agent with zero runs, the server SHALL return a valid `AgentStats` with `runs: 0` and every rate/avg field `null` (never a fabricated `0`/`NaN`), not a 404. | Unit test asserting the zero-run shape. |
| APD-AC-03 | P1 | WHEN the Agent Editor's Stats tab is open, it SHALL render the above fields with an explicit date-range control (1 day / 30 days / custom), and SHALL NOT issue any review-run or LLM-call request on mount, range change, or re-render. | Component test asserting no mutating/LLM fetch is made; manual check via `run` skill. |
| APD-AC-04 | P1 | WHEN an authenticated workspace member requests `GET /agents/performance` with a date range, the server SHALL return `AgentPerf` with a `summary` (`runs`, `total_cost_usd`, `avg_accept_rate`, `most_active_agent` by run count in range), one `AgentPerfRow` per agent with ≥1 run in range, and `cost_by_agent`/`cost_by_model` segment arrays whose sums reconcile with `summary.total_cost_usd` (within floating-point tolerance). | Route/service/repository code; `.it.test.ts` asserting reconciliation. |
| APD-AC-05 | P1 | WHEN no agent has any run in the selected range, `GET /agents/performance` SHALL return `AgentPerf` with `summary.runs: 0`, `agents: []`, and empty cost-breakdown arrays — distinct from a loading or error state, never a fabricated non-zero summary. | Unit test; client empty-state test. |
| APD-AC-06 | P1 | WHEN the global "Agent Performance" page is open, it SHALL be reachable from a new Global-section sidebar entry, SHALL render summary tiles, a sortable-by-run-count-and-accept-rate agent table (with each row's `View` navigating to that agent's own Stats tab), and two cost-breakdown donuts (by agent, by model), matching the supplied reference screenshot's layout (tiles → table → breakdown). | Component tests; manual screenshot comparison via `run` skill. |
| APD-AC-07 | P1 | WHEN the dashboard is reloaded, a row is sorted, or a row is expanded, the client SHALL NOT trigger any review-run or LLM-call endpoint — only the read-only stats endpoint(s). | Component test asserting the mock API client records no such call. |
| APD-AC-08 | P2 | WHEN an agent in the performance table has fewer than a documented minimum number of accept/dismiss decisions, its `accept_rate` SHALL still be computed but the row SHALL be visually/explicitly marked as low-sample, and sorting by accept rate SHALL exclude or clearly segregate such rows rather than silently ranking an unreliable rate. | Component test for the low-sample marker; helper unit test for the sort partition. |
| APD-AC-09 | P2 | WHEN the dashboard or Stats tab is loading or errors, the client SHALL show an explicit loading/error state and SHALL NOT render any metric as `0`/`$0.00`/`—%` that implies a real zero. | Component tests for loading and error states. |
| APD-AC-10 | P2 | WHEN a custom date range is selected, both the Stats tab and the dashboard SHALL display the resolved range and the count of runs it matched (the denominator used for rates), so the number behind "accept rate" is never opaque. | Component test asserting the denominator is rendered. |

## Data and aggregation rules (reused by both surfaces, per the brief's own requirement)

- **Range resolution**: `1 day` = last 24h from request time; `30 days` =
  last 30×24h; `custom` = caller-supplied inclusive `[from, to]` ISO
  timestamps. Both endpoints accept the same three range shapes so "reuse
  the same aggregation rules" (brief, Part 5) is enforced by sharing one
  range-resolution helper, not by convention alone.
- **Run universe**: only `agent_runs` rows with `status = 'done'` count
  toward cost/latency/trend aggregates (matching `computeRunCost`'s own
  `status !== 'done' → null` rule); `failed`/`running` rows still count
  toward `runs` so the denominator shown is honest about what was attempted,
  but are excluded from cost/latency averages (averaging a null is
  meaningless, not zero).
- **Accept rate denominator**: `accepted + dismissed` findings only
  (`kind: 'finding'`, scoped to the agent's runs in range). `pending`
  findings are reported but never counted in the rate's denominator or
  numerator — matches `AgentStats`/`AgentPerfRow`'s own
  `accepted`/`dismissed`/`pending` split.
- **Cost**: computed per run via the existing `computeRunCost` helper and
  `container.priceBook.estimate`, then summed/averaged — never persisted,
  never implied to be reconciled provider billing. Both `total_cost_usd`
  and per-row costs are explicitly DevDigest estimates.
- **Most-active agent**: the agent with the highest `runs` count within the
  selected range; ties broken by most recent `last_run_at`.

## Open items carried into planning (not blocking, to be resolved by the
implementation plan using existing codebase conventions)

- Exact low-sample threshold for APD-AC-08 (a fixed minimum decision count,
  e.g. 5, documented as a named constant rather than a magic number).
- Whether the new aggregation queries live on `ReviewRepository` (current
  owner of `agent_runs`/`findings` access, consistent with
  `history/service.ts`'s and `blast/service.ts`'s existing cross-module
  read pattern) or a new `AgentStatsRepository` reading through it — an
  onion-architecture placement decision for the plan/implementer, not a
  product-behavior decision.
