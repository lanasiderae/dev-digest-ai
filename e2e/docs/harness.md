# e2e harness architecture

How the flow-based runner actually works. Deeper than `e2e/README.md` (a
how-to-run guide) and `e2e/AGENTS.md` (a short agent brief). Not to be
confused with `e2e/specs/` — that folder holds the executable `*.flow.json`
flow specs themselves (the "what"); this explains the runner that executes
them (the "how").

## `agent-browser` is a CLI, not a test framework

`agent-browser` is a native CDP (Chrome DevTools Protocol) browser-automation
CLI — it has no concept of a "test" or an "assertion", just commands
(`open`, `click`, `wait`, `find`, `screenshot`, …) that exit `0` on success
or non-zero on failure/timeout. `run.ts` defines the thin convention on top:
a **flow** (`specs/*.flow.json`) is an ordered list of `agent-browser`
invocations, and a flow fails at the first step whose command exits
non-zero.

## The real assertions are `wait --text` / `wait --url`

`run.ts`'s own custom assertion surface is exactly one thing:
`step.assert?.stdoutIncludes`, a substring check on a step's stdout. That is
**not** where most verification happens. The actual proof that a page
reached the expected state comes from `agent-browser`'s own `wait --text`
(poll until text appears) and `wait --url` (poll until the URL matches)
commands — each one exits non-zero if its condition never holds within the
timeout, which is what fails the step (see `e2e/INSIGHTS.md`). A flow step
that performs a navigating action (`click`, `open`, …) without a following
`wait` has **no actual proof** the page reached the expected state — a
"successful" click only means the CLI command itself didn't error, not that
anything meaningful happened afterward. When writing a new flow step,
always follow a state-changing action with an explicit `wait`.

## One shared browser session across all flows

All flows in a run share **one** browser session — the `agent-browser`
daemon keeps the page alive between invocations rather than each command
opening a fresh browser. `main()` tears the session down once at the very
end (`ab(["close"])`, in a `finally`, regardless of outcome), not after each
flow. This is why flows that depend on earlier navigation state (see below)
work at all, and also why a flow must not assume it's starting from a blank
page — it inherits whatever state the previous flow left the browser in.

## Flow order is load-bearing, and failures are scoped per-flow

Flows run in **lexical filename order**
(`readdirSync(specsDir).filter(isFlowFile).sort()`), which is exactly why
they're numbered (`01-`, `02-`, …). A step failure only `break`s that one
flow's remaining steps — it does **not** abort the whole run; every
subsequent flow file still executes (see `e2e/INSIGHTS.md`). This ordering
is load-bearing, not cosmetic: flows `02`/`04`/`05` assume the seeded demo
repo (`acme/payments-api`) is the first/only repo in the list (per
`e2e/AGENTS.md`'s Gotchas), which only holds if nothing earlier in the
lexical sequence added another repo. Running a single flow file in
isolation, or against a dev DB with other imported repos, can fail for
reasons that have nothing to do with the flow itself — prefer the hermetic
runner (`./scripts/e2e.sh`), which starts from an empty, freshly-seeded
Postgres every run, specifically to make this ordering assumption safe.

## Determinism: no AI `chat` command, ever

Locators in a flow are deterministic only — `--url`, `--text`,
`find role|text|label` — never `agent-browser`'s AI-driven `chat` command,
which would break the no-LLM/no-API-key/determinism guarantee this whole
suite exists to provide (`e2e/AGENTS.md` Conventions). Flows target isolated
seeded data; L05's context journey saves attachment paths on the seeded agent.
Nothing in `e2e/specs/` should trigger a real model call. The opt-in fixture
API entrypoint blocks generation and supplies no secrets.

## Failure artifacts

On a step failure, the runner best-effort captures a screenshot to
`e2e/test-results/<flow-id>-fail.png` before moving on (git-ignored locally,
uploaded as a CI artifact by `e2e-web.yml` — see `e2e/AGENTS.md` Gotchas).
The screenshot capture itself is wrapped in `.catch(() => {})` — a failed
screenshot attempt must never mask the original step failure it was trying
to document.
