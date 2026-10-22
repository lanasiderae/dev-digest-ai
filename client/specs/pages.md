# Spec: route map + what data each page needs

A behavior contract for what each route renders and which API data it
depends on — not a design discussion (see `client/docs/ui-architecture.md`
for that). Keep this in sync when a route's data dependency changes.

| Route | View | Data it needs |
|---|---|---|
| `/` | `HomePage` (`src/app/page.tsx`) | `useRepos()` — redirects to the first repo's `/repos/:id/pulls`, or to `/onboarding` if the list is empty once loaded. |
| `/onboarding` | `AddRepoView` | None on load; posts a repo URL to add one. |
| `/repos/:repoId/pulls` | `PullsPage` (PR list) | `usePulls(repoId)` — see `server/src/modules/pulls/routes.ts`'s `GET /repos/:id/pulls` contract. The three review-derived columns each have their own scope: `score` is the single latest review's, `findings_by_severity`/`findings_by_agent` sum each AGENT's latest review, and `cost` sums every successful run ever — see `server/specs/review-flow.md`. |
| `/repos/:repoId/pulls/:number` | `PRDetailPage` | Resolves `:number` → the PR's internal uuid via the (cached) `usePulls(repoId)` list first (every other PR API is keyed by that uuid, not the GitHub number), then `usePullDetail(prId)`, `usePrReviews(prId)`, `usePrActiveRuns(prId)`, `usePrRuns(prId)`. Tab state (`?tab=`) and the trace drawer (`?trace=`) both live in the URL query string. |
| `/agents` | `AgentsListView` | `useAgents()`. |
| `/agents/:id` | Agent editor | `useAgents()` (left list) + `useAgent(id)` (detail); tab state in `?tab=` (`config` or `skills`). The Skills tab additionally uses `useSkills()` + `useAgentSkills(id)`/`useSetAgentSkills()`. |
| `/skills` | `SkillsListView` | `useSkills()`. |
| `/skills/:id` | Skill detail/editor | `useSkills()` (left list) + `useSkill(id)` (detail); version history via `useSkillVersions(id)` (`GET /skills/:id/versions`), not fetched on this page today. |
| `/settings/:section` | `SettingsView` | Section-specific; see `_components/SettingsView` for the panel-to-section mapping. |

## Contracts that span routes

- **PR number vs. PR id**: the URL uses GitHub's PR `number` (human-facing,
  stable per repo), but `GET /pulls/:id`, `/pulls/:id/reviews`,
  `/pulls/:id/runs`, etc. are all keyed by the row's internal `uuid`. Every
  page under `/repos/:repoId/pulls/:number` must resolve that uuid via the
  pulls list before fetching anything else — there is no
  `GET /repos/:repoId/pulls/number/:number` shortcut endpoint.
- **Repo context**: `repo-context.tsx`'s `RepoProvider` tracks the "active"
  repo (URL path segment → `localStorage` → first repo from the API, in
  that priority order) for the app shell's nav/breadcrumbs — a page doesn't
  need to re-derive this itself, it reads `useActiveRepo()`.
- **Unreviewed vs. zero-cost/zero-findings**: every list/detail field that
  can be "not yet reviewed" (`score`, `cost`, `findings_by_severity`) uses
  `null`/absent-then-defaulted, never a literal `0`-equivalent — a page
  must render "no data" (a dash, an empty cell) distinctly from "reviewed
  and clean", per root `INSIGHTS.md`'s dash-glyph note and
  `client/INSIGHTS.md`.
