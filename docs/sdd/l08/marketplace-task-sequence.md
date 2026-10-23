# L08 student task sequence — DevDigest AI Marketplace

A step-by-step runbook for the L08 assignment ("DevDigest AI Marketplace —
Implementation, Release & Homework"). It assumes you're starting from this
repo's `l08/final` branch (based on `l05/specs`).

**What's already done for you, and why the rest isn't:** a local,
unpushed scaffold of the marketplace repository (four plugins, docs,
catalog site, build script) has been generated at
`../dev-digest-ai-marketplace` — a sibling directory to this repo — by
extracting and generalizing this repo's own `.claude/agents/` and
`.claude/skills/`. It has **not** been pushed anywhere: creating a real
GitHub repository, pushing tags, installing a plugin into a second real
project, spending real API budget on the cost experiment, and recording a
demo video are all actions that commit real external resources (a GitHub
repo under your account, API spend, your own time on camera) or are simply
not possible for an agent to do on your behalf (clicking "record" on your
screen). Those steps are yours to run — each one below gives you the exact
command. Everything that *could* be done locally and safely (file
extraction, manifest generation, schema validation, dry-run tagging, local
build/preview) has already been run against the scaffold — see
`../dev-digest-ai-marketplace`'s own commit and the agent reports folded
into this branch's work for what passed.

The optional Part 5 (global Agent Performance Dashboard) is implemented
directly on this branch (`l08/final`) inside DevDigest itself — see
`specs/2026-10-23-l08-agent-performance-dashboard.md` and
`docs/sdd/l08/plan.md`. It does not depend on anything below.

---

**Schema note (verified against the installed CLI, `claude --version` →
`2.1.274`):** the assignment brief's example `plugin.json` shows
`dependencies` as an array of `{"name": ..., "version": ...}` objects. The
installed CLI's `claude plugin validate` actually requires `dependencies`
to be an array of `"name@range"` strings (e.g.
`["engineering-paved-path@^1.0.0"]`) — the object shape is rejected with
`dependencies: Invalid input`. The scaffold already uses the
string-array form, confirmed by `claude plugin validate` passing on all
four plugins. If a future CLI version changes this back, re-validate before
trusting this note.

## Part 1 — Stand up the real marketplace repository

1. Review the scaffold: `cd ../dev-digest-ai-marketplace && git log --oneline`
   and read `README.md`, `CONTRIBUTING.md`, `docs/PLUGIN-GUIDELINES.md` to
   confirm the plugin boundaries make sense to you before publishing them.
2. Create the empty GitHub repository (your account, not an org you don't
   control unless the assignment specifies one):
   ```
   gh repo create <your-username>/dev-digest-ai-marketplace --public --source=. --remote=origin
   ```
   Run this **from inside** `../dev-digest-ai-marketplace`. `--public` is
   required for GitHub Pages on a free plan; use `--private` only if your
   Pages plan supports it.
3. Push: `git push -u origin main`.
4. Add branch protection / required review: GitHub repo Settings → Rules →
   New branch ruleset on `main`, require a pull request and require review
   from code owners (this is what makes `CODEOWNERS`, already in the
   scaffold, actually enforce anything).
5. Enable GitHub Pages: Settings → Pages → Source: GitHub Actions (the
   scaffold's `.github/workflows/pages.yml` deploys `site/dist` there on
   merge to `main` — confirm the first run succeeds after your first push).

## Part 2 — Validate before anyone else touches it

1. `claude plugin validate .` and `claude plugin validate ./plugins/<name>`
   for each of the four plugins — already run once locally during
   scaffolding; re-run after any edits you make.
2. `cd site && npm ci && npm run build && npm run preview` — open the
   printed local URL and click through search, a plugin detail page, and
   an artifact (skill/agent) detail page. Confirm the install command shown
   matches `/plugin install <plugin>@dev-digest-ai-marketplace`.
3. Load the plugins directly from working directories to smoke-test them
   before any release exists:
   ```
   claude \
     --plugin-dir ./plugins/engineering-paved-path \
     --plugin-dir ./plugins/research-tools \
     --plugin-dir ./plugins/architecture-review \
     --plugin-dir ./plugins/sdd-engineering
   ```
   In that session, manually exercise the behavioral checks listed in the
   assignment's section 8 (spec-creator clarifies before writing,
   implementation-planner uses an existing spec rather than inventing one,
   run-plan delegates to implementer, architecture-reviewer is the one
   invoked at the review gate, plan-verifier checks ACs, workflow-retro only
   runs when asked, namespaced skills load without warnings, an unrelated
   request doesn't trigger the SDD workflow). Keep brief notes — you'll want
   them for the demo video and as your behavioral-evaluation evidence.

## Part 3 — Cost baseline experiment

**Do this before any optimization**, and only once you've decided how many
runs and how much budget you're willing to spend — this is real metered API
usage.

1. Pick the fixed SDD scenario (a small feature spec + plan request) and
   the small eval dataset — both referenced in
   `../dev-digest-ai-marketplace/plugins/sdd-engineering/evals/`.
2. Run the scenario **N times** (pick N — 5 is a reasonable default) against
   `sdd-engineering` at its current commit, same model each time. Record,
   per run: input/output/cache tokens, API call count, tool call count,
   wall-clock latency, cost (from your provider's actual usage, not an
   estimate if you have billing API access), and whether the eval dataset's
   acceptance criteria passed.
3. Fill in `../dev-digest-ai-marketplace/docs/COST-BASELINE.md`'s baseline
   table with the real numbers (median cost, median latency, pass rate,
   critical failures, cost per *successful* workflow — successful runs
   only in that last denominator).
4. Apply **one** optimization (recommended: strip duplicated instructions
   out of the agent prompts you generalized, since the skills they
   reference already carry the detail — don't also change model or routing
   in the same pass, or you can't attribute the delta).
5. Re-run the same N scenarios, same model, same eval dataset. Fill in the
   "after" columns.
6. Apply the quality gate from the assignment: do existing evals still
   pass, are there no new critical false negatives, did cost or latency
   measurably drop, is cost-per-successful-workflow recorded both before
   and after? If the delta is within noise, write that down plainly instead
   of claiming a win — `docs/COST-BASELINE.md` has a line for it.

## Part 4 — Release `sdd-engineering@1.0.0`

Dependencies first, consumer last — from inside each plugin's own
directory in `../dev-digest-ai-marketplace`:

```
cd plugins/engineering-paved-path && claude plugin tag --dry-run && claude plugin tag --push
cd ../research-tools            && claude plugin tag --dry-run && claude plugin tag --push
cd ../architecture-review       && claude plugin tag --dry-run && claude plugin tag --push
cd ../sdd-engineering            && claude plugin tag --dry-run && claude plugin tag --push
```

Before each `--push`, re-read that plugin's `CHANGELOG.md`, confirm the
commit SHA you're tagging is the one that passed `validate.yml` in CI (push
to a branch and open a PR first if you haven't already — tagging an
unreviewed local commit defeats the point of `CODEOWNERS`), and confirm
`manifest.json` version and `dependencies[].version` ranges match what you
intend to publish.

## Part 5 — Install `sdd-engineering` in a second, real project

Pick an existing repo you own that has **no** local copy of any SDD agent
or skill already (so traces unambiguously show the plugin's components ran,
not a pre-existing local copy).

```
claude plugin marketplace add <your-username>/dev-digest-ai-marketplace --scope project
claude plugin install sdd-engineering@dev-digest-ai-marketplace --scope project
claude plugin list --json   # confirm no dependency-unsatisfied / range-conflict / no-matching-tag
```

Start a new session (or `/reload-plugins`) in that project, then walk the
11-point cross-project verification list in the assignment brief's section
11 (spec-creator available, spec lands at the documented path,
implementation-planner uses it, run-plan invokes implementer, researcher
available, architecture-reviewer + plan-verifier both work, workflow-retro
is manual-only, traces show plugin version/dependencies,
references/examples/scripts survive install,
`workflow-retro/scripts/analyze_journals.py` resolves via
`${CLAUDE_SKILL_DIR}`, and the plugin doesn't silently override that
project's own instructions). Capture a PR or commit in that project showing
the plugin-driven SDD workflow ran — that's your "target project link"
deliverable.

## Part 6 — Update to `1.1.0`

In `../dev-digest-ai-marketplace/plugins/sdd-engineering`:

1. Edit `agents/spec-creator.md`: add the rule that a specification cannot
   be finalized until every mandatory requirement has an acceptance
   criterion.
2. Add an eval case under `evals/` exercising exactly that rule (e.g. a
   spec draft missing one AC should get blocked from finalizing).
3. Update `CHANGELOG.md`, bump `plugin.json` to `1.1.0`.
4. Run both the existing and the new eval: `claude plugin eval
   ./plugins/sdd-engineering`.
5. `claude plugin tag --dry-run && claude plugin tag --push` → tag
   `sdd-engineering--v1.1.0`.

In the target project from Part 5:

```
claude plugin marketplace update dev-digest-ai-marketplace
claude plugin update sdd-engineering@dev-digest-ai-marketplace --scope project
```

Reload/new session; confirm telemetry shows `1.1.0` and that a spec with a
requirement missing its AC can no longer be finalized.

## Part 7 — Rehearse rollback to `1.0.0`

1. In the marketplace repo, create a `stable` channel pinned to the
   `sdd-engineering--v1.0.0` commit SHA (a second marketplace entry or a
   dedicated ref — document exactly which mechanism you used in
   `docs/RELEASES.md`, since "channel" isn't a single fixed CLI concept).
2. In the target project: remove/disable the current marketplace
   registration, then
   `claude plugin marketplace add <your-username>/dev-digest-ai-marketplace@stable --scope project`
   (or the equivalent your channel mechanism requires) and
   `claude plugin install sdd-engineering@dev-digest-ai-marketplace --scope project`.
3. Reload, confirm the active version is `1.0.0` via `claude plugin list --json`.
4. Run one smoke eval case from `sdd-engineering/evals/` and confirm it
   passes.
5. Write down the exact commands you ran (copy them into
   `docs/RELEASES.md`'s rollback section verbatim — don't paraphrase, the
   assignment wants this reproducible).
6. Note whether the plugin modified any external state (files it created
   in the target project, e.g. specs/plans) and how that would be restored
   separately if needed — plugin rollback only reverts the plugin version,
   not files it already wrote.
7. Only after all of the above is verified, restore the `latest` channel
   in the target project.

## Part 8 — Submission package

- Demo video: marketplace repo + Pages catalog UI → install
  `sdd-engineering@1.0.0` in the target project → one verified SDD workflow
  run end to end → update to `1.1.0` → rollback to `1.0.0` through the
  `stable` channel. Keep it one continuous recording so the version
  transitions are visibly real, not cut together.
- Links to gather: the marketplace repo, its GitHub Pages URL, the target
  project's PR/commit from Part 5, and
  `../dev-digest-ai-marketplace/docs/COST-BASELINE.md` (committed with real
  numbers from Part 3).
- Optional Part 5 (Agent Performance Dashboard) is a **separate PR** against
  this repo (`dev-digest-ai`), per the assignment — don't bundle it into the
  marketplace submission.
