---
name: run-plan
description: Execute an already approved specification and AC-linked plan with focused tests, architecture review, bounded fixes and final traceability verification; does not create specifications or plans.
disable-model-invocation: true
---

Execute only on manual invocation. Consume approved spec and plan paths; never
invoke spec-creator or implementation-planner from this skill. Supplemental
prompts or designs may explain approved scope, never expand it. Return scope
changes to the caller instead of silently redesigning requirements.

Confirm actual approval, unique AC IDs, no unresolved blockers, AC-linked tasks,
a saved different-family cross-model review, and spec/plan commit before product
code. Record actual reviewer/model identity and findings; unavailable evidence
stays unavailable. Preserve the user's fork and base branch.

Check available budget/dashboard; if inaccessible report unknown and keep work
bounded rather than inventing quota/prices. Respect the session's single-agent
or multi-agent decision; ask once only if unanswered. Start conservatively with
one worker and capable lower-cost models. Declared Claude roles use Sonnet for
implementation, architecture review and verification; expensive overrides need
a concrete reason. Load only relevant skills on demand.

Run implementation → focused AC-derived tests → architecture review → bounded
fix iterations (default maximum three) → final validation → plan-verifier last.
Implementer may write tests; separate test-writer is skipped for the current run
and remains optional. Capture AC/task/file/check evidence. An early read-only
verifier checkpoint is useful for complex stages but cannot replace final
verification after all fixes. Stop and report remaining findings after the fix
limit; do not claim completion or loop indefinitely.

Workers run focused relevant checks. After code stabilizes, root/orchestrator
runs each touched package's required tests/typecheck/lint/audit once, plus
bounded affected e2e/manual UI checks. Avoid duplicate whole-package runs; rerun
only when fixes invalidate their evidence. Never disable all validation or
apply migrations automatically. Run applicable security review and doc updates
before the final read-only plan-verifier. Save AC → task → test → commit evidence
and unresolved requirements; include the final report in the PR.

Workflow-retro is manual only and is not executed by this pipeline. Do not
fabricate execution, approval, cost or demo evidence.
