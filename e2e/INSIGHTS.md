# INSIGHTS.md

## Codebase Patterns

- **2026-10-20** — The runner's only custom assertion is
  `step.assert?.stdoutIncludes`; the real verification of page state comes
  from the `agent-browser` commands themselves (`wait --text`/`wait --url`
  exiting non-zero on timeout, per the module's own docstring). A flow step
  that doesn't end in an explicit `wait` after a navigating action has no
  actual proof the page reached the expected state — a "successful" click
  just means the CLI command didn't error. Evidence: `e2e/run.ts:7-9,73`.
- **2026-10-20** — Flows run in lexical filename order
  (`readdirSync(...).filter(...).sort()`), and a step failure only `break`s
  that flow's own remaining steps — it does NOT abort the whole run;
  subsequent flow files still execute. This ordering is load-bearing, not
  cosmetic: the existing Gotchas note in `e2e/AGENTS.md` that flows
  `02`/`04`/`05` assume the seeded repo is the first/only one depends on
  earlier flows having already run in this same lexical order. Evidence:
  `e2e/run.ts:54-56,76,88`.

## Recurring Errors & Fixes

- **2026-10-22** — `04-pr-findings.flow.json` waited for literal text
  `"2 findings"` in the PR detail accordion header, but no component on
  that page ever renders a combined count string — `ReviewRunAccordion`/
  `VerdictBanner`/`FindingsPanel` only render `SeverityBadge` (icon +
  per-severity label like "Critical" + a bare count number), and the
  `Agent runs` tab badge is also just a bare number. The step had never
  passed in CI (checked full `e2e-web.yml` run history: 2 runs, both
  failed here) — it wasn't a timing flake, the assertion text never
  existed. Fixed by asserting the seeded WARNING finding's title
  ("N+1 query in user list endpoint") instead, which both components
  genuinely render verbatim and together with the existing CRITICAL title
  check proves both of the run's 2 seeded findings are visible. When a
  `wait --text` step times out, check what the component actually renders
  before assuming it's CI flakiness — grep every component in the render
  path for the literal string first. Evidence:
  `client/src/vendor/ui/primitives/Badge.tsx` (`SeverityBadge`),
  `client/src/vendor/ui/kit/Tabs.tsx`, `server/src/db/seed.ts:156-172`
  (the 2 seeded findings' exact titles).
