# e2e/docs

Deeper design notes for the e2e suite that don't belong in `e2e/README.md`
(stays a how-to-run guide) or `e2e/AGENTS.md` (stays a short agent brief).
Not to be confused with `e2e/specs/` — that folder holds the executable
`*.flow.json` flow specs, not documentation.

- [`harness.md`](harness.md) — how the flow runner actually works: why
  `wait --text`/`wait --url` are the real assertions, the shared browser
  session, and why flow filename order is load-bearing.
