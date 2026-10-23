# L08 implementation plan — Agent Performance Dashboard

- Spec: `specs/2026-10-23-l08-agent-performance-dashboard.md` (DRAFT — see
  that file's Status note on approval).
- Author: session operator (acting as planner; `implementation-planner`'s
  usual clarification step is skipped because no user is available this
  session — every open item from the spec is resolved below with a stated
  rationale instead of being left for a blocking question).
- Execution mode: single agent (`implementer`), sequential tasks — the
  surface area (one new server module + two client surfaces reusing
  existing contracts/components) doesn't warrant a split.

## Resolved open items (from spec's "Open items carried into planning")

1. **Low-sample threshold (APD-AC-08)**: `MIN_DECISIONS_FOR_RATE = 5`
   (accepted+dismissed). Below this, `accept_rate` is still computed and
   returned (contract fields are `number | null`, not "excluded"), but the
   client marks the row/tile as low-sample and the performance table's
   "sort by accept rate" partitions low-sample rows to the bottom rather
   than interleaving an unreliable rate among reliable ones.
2. **Repository placement**: a new `getAgentStatsRaw` method on the
   existing `ReviewRepository` (`server/src/modules/reviews/repository.ts`,
   likely delegating to a new `repository/stats.repo.ts` file alongside the
   existing `run.repo.ts`, following that module's established
   decomposition). `ReviewRepository` already owns `agent_runs` and
   `findings` access (`run.repo.ts`); the new `agent-stats` module reads
   through `container.reviewRepo`, the same cross-module pattern
   `history/service.ts` and `blast/service.ts` already use — **not** new
   direct `t.agentRuns`/`t.findings` access from the new module (onion-
   architecture: routes.ts → service.ts → repository.ts inward only, and a
   new module must not reach into another module's tables directly).

## Server

### New module: `server/src/modules/agent-stats/`

File roles follow this repo's fixed vocabulary (CLAUDE.md "Server module
files"):

- `constants.ts` — `MIN_DECISIONS_FOR_RATE`, range-window constants
  (`ONE_DAY_MS`, `THIRTY_DAYS_MS`).
- `helpers.ts` — pure functions, unit-testable without a DB:
  - `resolveRange(input: { preset?: '1d' | '30d'; from?: string; to?: string }, now: () => Date): { from: Date; to: Date }`
    — the single range-resolution rule both endpoints call (spec's "Data
    and aggregation rules").
  - `toAgentStats(agentId, agentName, rawRuns, rawFindings, estimate): AgentStats`
    and `toAgentPerf(rawByAgent, estimate): AgentPerf` — pure DTO builders
    from repository rows + a `computeRunCost`-shaped estimator, so the
    accept-rate/cost/trend math is unit-testable without Postgres. Reuse
    `computeRunCost` from `../reviews/helpers.js` rather than
    reimplementing it (import across modules is fine for a pure, stateless
    helper function — same as other modules already do for pure utilities;
    it is not a repository/DB access).
- `service.ts` — `AgentStatsService`:
  - `getAgentStats(workspaceId, agentId, rangeInput)` → `AgentStats`.
    404s via `NotFoundError` if the agent doesn't exist in the workspace
    (reuse `container.agentsRepo.getById`, already workspace-scoped).
    Zero-run case still returns a valid `AgentStats` (`runs: 0`, every
    rate/avg `null`) — **not** a 404 (AC-02).
  - `getAgentPerformance(workspaceId, rangeInput)` → `AgentPerf`. Empty
    case (`AC-05`) returns `{ summary: { runs: 0, total_cost_usd: null,
    avg_accept_rate: null, most_active_agent: null }, agents: [],
    cost_by_agent: [], cost_by_model: [] }`.
  - Both call `container.reviewRepo.getAgentStatsRaw(workspaceId, { agentId?, from, to })`
    and `container.priceBook.estimate` (injected via `container`, same as
    `reviews/service.ts` already does), then the pure `helpers.ts` DTO
    builders.
- `repository.ts` — thin: in this module, just re-exports/narrows the
  `ReviewRepository`-returned raw rows' TS shape if needed; no new DB
  access lives here (see "Resolved open items" #2) — if the implementer
  judges a dedicated file unnecessary because everything routes through
  `container.reviewRepo`, it's fine to omit `repository.ts` from this
  module and note why in `server/INSIGHTS.md`, rather than add a
  file for the sake of the vocabulary.
- `routes.ts`:
  - `GET /agents/:id/stats` — query params `range` (`1d`/`30d`) or
    `from`/`to`; schema-validated via a Zod contract (new `AgentStatsQuery`
    colocated in this route file or added to `observability.ts` if the
    spec agents consider it contract-level — implementer's call, consistent
    with how `review-api.ts` already mixes request/response schemas).
    Returns `AgentStats`.
  - `GET /agents/performance` — same query shape (no `:id`, workspace-wide).
    Returns `AgentPerf`.
  - Both registered through `getContext(app.container, req)` for
    `workspaceId`, matching every other route in this repo.

### `server/src/modules/reviews/repository.ts` (+ new `repository/stats.repo.ts`)

- Add `getAgentStatsRaw(workspaceId, { agentId?: string; from: Date; to: Date })`
  returning, per agent in scope, the raw rows needed for the pure DTO
  builders: `{ agentId, agentName, runs: RunRow[], findings: FindingRow[] }[]`
  (or an equivalently shaped aggregate — implementer's call on whether to
  aggregate in SQL via `drizzle-orm`'s `sql`/`count`/`avg` or in JS over
  fetched rows; given expected row volumes in this course project, JS
  aggregation over a workspace/range-scoped fetch is acceptable and keeps
  the cost-estimation step, which cannot run in SQL, simple — do not
  prematurely optimize into raw SQL aggregation).
- Join `agent_runs` → `agents` (for `agent_name`) and `agent_runs` → `reviews` → `findings` (for accept/dismiss/severity counts), scoped by `workspaceId` and the resolved `[from, to]` window on `ranAt`.

### `server/src/modules/index.ts`

- Add `agentStats from './agent-stats/routes.js'` import + registry entry.

## Client

### Per-agent Stats tab

- `client/src/app/agents/[id]/_components/AgentEditor/_components/StatsTab/`
  (component-folder convention: `StatsTab.tsx`, `index.ts`, `styles.ts`,
  `constants.ts`, `StatsTab.test.tsx`).
- Add `{ key: "stats", labelKey: "editor.tabs.stats", icon: "Activity" }`
  to `AgentEditor/constants.ts`'s `TABS`, update that file's stale
  "Evals/Stats/CI remain future-lesson scaffolding" comment to drop
  "Stats" (Evals/CI remain scaffolding; Stats is now live).
  `AgentEditor.tsx` wires `<StatsTab key={agent.id} agent={agent} />`
  alongside the existing tabs.
- New hook `useAgentStats(agentId, range)` in `client/src/lib/hooks/agent-stats.ts`
  (TanStack Query, mirrors `useAgent` in `hooks/agents.ts`) calling
  `GET /agents/:id/stats`.
- A small shared `StatsRangePicker` (1 day / 30 days / custom) in
  `client/src/components/agent-stats/StatsRangePicker/` (non-component-
  folder helper `useStatsRange.ts` colocated, per naming conventions) —
  reused by both the Stats tab and the global dashboard so "same
  aggregation rules" is visibly true in the UI too, not just the API.
- Render: summary numbers, `findings_by_severity`, and a trend sparkline
  via the existing `client/src/vendor/ui/charts/LineChart.tsx` (reuse, do
  not build a new chart primitive).

### Global Agent Performance Dashboard

- Route: `client/src/app/agent-performance/page.tsx` (thin, per
  `client/CLAUDE.md` convention) rendering
  `_components/AgentPerformanceView/AgentPerformanceView.tsx`.
- `AgentPerformanceView` composes three sub-components under its own
  `_components/`, matching the reference screenshot's layout top-to-bottom:
  - `SummaryTiles` — Total Runs, Total Cost, Avg Accept Rate, Most-Active
    Agent (each tile shows the range's run-count denominator per AC-10,
    e.g. "61% · 87 decisions").
  - `PerformanceTable` — columns Agent / Runs / Avg Cost / Avg Duration /
    Accept Rate (sortable, low-sample rows segregated per the resolved
    threshold) / Last Run / View (link to that agent's `?tab=stats`).
  - `CostBreakdown` — two `Donut` (`vendor/ui/charts/Donut.tsx`) instances,
    "By agent" and "By model", fed directly from `cost_by_agent`/
    `cost_by_model` so reconciliation with `summary.total_cost_usd` is
    structural (same response, no separate computation).
- `useAgentPerformance(range)` hook in the same `hooks/agent-stats.ts` file,
  calling `GET /agents/performance`.
- Loading / empty-dashboard / error states as distinct render branches
  (AC-09) — no component renders a bare `0`/`$0.00` while loading or
  erroring.
- New Global sidebar section in `client/src/vendor/ui/nav.ts`: add a
  `"GLOBAL"` `NavGroup` with one item (`agent-performance`, icon
  `"Activity"` or closest existing `IconName`, href `/agent-performance`,
  `gKey: "f"` — `p/o/a/s/c` are taken; picks a free, mnemonic-ish key, or
  implementer may omit `gKey` if no good one is free, that's not a product
  requirement). Do **not** add stub entries for Memory/Multi-Agent
  Review/CI Runs — those remain unimplemented scaffolding (out of this
  spec's scope) and adding dead nav links for them would misrepresent
  what's built.
- i18n: new `client/messages/en/agentPerformance.json` namespace (plus
  any new keys the Stats tab needs added to the existing `agents`
  namespace file) — no hardcoded strings in JSX, per `client/CLAUDE.md`.

## Validation (phase 4, both packages)

- `cd server && pnpm exec vitest run --exclude '**/*.it.test.ts' && pnpm typecheck && pnpm lint`
- `cd server && pnpm exec vitest run .it.test` (needs Docker; covers the
  new `agent-stats.it.test.ts` seeding real `agent_runs`/`findings` rows
  and asserting AC-01/02/04/05 reconciliation)
- `cd client && pnpm test && pnpm typecheck && pnpm lint`
- Manual UI check via the `run` skill: start the stack, open
  `/agent-performance` and an agent's Stats tab, compare against
  `/Users/lanamoroz/Desktop/Screenshot 2026-10-23 at 3.02.28 AM.png`.
- `architecture-reviewer` pass (onion-architecture boundary on the new
  module + the `reviewRepo` cross-module read).
- `plan-verifier` pass against this plan + the spec's AC table.

## Explicitly out of scope for `implementer`

- Parts 1–4 of the L08 assignment brief (external marketplace repo).
- `PluginBundle`/`Digest` contracts in `productionize.ts` — untouched.
- Any DB migration — no schema change is needed.
