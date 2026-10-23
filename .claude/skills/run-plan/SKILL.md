---
name: run-plan
description: Execute an approved AC-linked specification and implementation plan through independent implementation, tests, reviews and final traceability verification.
---

Read the approved spec and plan paths supplied by the user (L05 defaults:
`specs/l05/spec.md`, `specs/l05/plan.md`). Before implementation:

- Confirm approval evidence, no unresolved clarification markers, unique AC IDs,
  and every task linked to an AC. Return requirements gaps to spec-creator.
- Require a saved cross-model plan review from a different model family. Record
  actual reviewer identity and findings; if unavailable, report the missing gate
  instead of labeling a same-family review cross-model.
- Commit spec and plan before product implementation; record the commit SHA.
  Preserve the user's fork and requested base branch, not an assumed main.
- Check actual available budget/dashboard or ask if unavailable. Do not invent
  quota or prices. Default to one worker at a time and a capable less expensive
  model (Sonnet for these Claude agents); reserve expensive overrides for a
  demonstrated need. Load only skills routed to current tasks.

Execute bounded tasks with implementer. Have test-writer independently derive
non-trivial cases from ACs and the plan; do not have implementer author its own
permission/business-flow coverage. Save implementation and test reports with
AC/task/file/command evidence. Run package-required tests, typecheck, lint and
audit; initially keep e2e to affected journeys and record what was omitted.
Never disable all validation or auto-apply migrations.

Run architecture-reviewer and applicable security review, address findings,
then doc-writer. Run read-only plan-verifier **last**, supplying spec, plan,
base/head, commit history, tests and reviews. Save its AC → task → test → commit
report; do not claim complete with unresolved rows. Include reports in the PR.

After a completed pipeline, remind the user to manually invoke workflow-retro.
Do not fabricate execution, cost, approval, or demo evidence. Recording a demo
or publishing a PR requires the relevant authorization and real artifacts.
