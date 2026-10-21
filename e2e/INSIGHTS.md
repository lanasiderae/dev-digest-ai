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
  cosmetic: the existing Gotchas note in `e2e/CLAUDE.md` that flows
  `02`/`04`/`05` assume the seeded repo is the first/only one depends on
  earlier flows having already run in this same lexical order. Evidence:
  `e2e/run.ts:54-56,76,88`.
