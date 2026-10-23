# Prompt to continue in Claude Code

Continue this project in:
`/Users/lanamoroz/Desktop/agentic_ai/dev-digest-ai`

Use the existing branch `l05/specs`, based on `l04/mcp` at `da33d6d`.
Preserve current work and inspect Git status before editing. Read root
AGENTS.md, `.claude/rules/`, and relevant package guidance first. Load only
related documentation, insights and skills.

## Current state

The L05 SDD workflow setup is implemented and committed. The specification
`specs/2026-10-22-l05-context-brief-onboarding.md` is explicitly approved;
C2, C4 and C7 are resolved. Do not reopen those decisions without a new issue.
The specification has 49 stable AC IDs.

The implementation-planner generated `docs/sdd/l05/plan.md`; it is **not yet
approved**. A real cross-family review has completed and returned
**REVISION_NEEDED**. Read:

1. `docs/sdd/l05/plan-review.md` — original findings and coordinator notes.
2. `docs/sdd/l05/plan-review-receipt.json` — actual model identity, document
   hashes, usage and CLI-reported cost estimate.
3. `docs/sdd/l05/preflight.md` and `docs/sdd-workflow.md` — execution limits.

The original plan was authored by a Codex GPT-family agent and reviewed by
Anthropic `claude-sonnet-5`. The review is complete: do not launch a duplicate
pending-review process. It inspected documents only, not source code. No product
features have been implemented and no product-model demos have run.

## Immediate next work

Use implementation-planner to revise the plan, without changing approved
requirements or starting product code:

- Record actual plan-author/reviewer families to resolve the identity finding.
- Reconcile every task's inline AC references against the 49-row matrix.
  Check shorthand and ranges; one reviewer allegation incorrectly treats
  `13–15` as excluding 14.
- Replace vague sequencing with named dependencies and shared-file ownership,
  allowing independent work while preserving Context-first delivery.
- Distinguish cached reviewer provenance from the user's reviewer selection
  for the next generation; specify tests for both states.
- Confirm relevant source signatures and record evidence.
- Clearly separate preliminary and final verifier reports.

Save finding dispositions. Present the revised concrete plan and ask for the
user's separate plan approval. Commit the reviewed/approved artifacts before
any product implementation. Never represent specification approval as plan
approval or silently mark the review READY.

## Implementation after plan approval

Implement Project Context first, then PR Brief, then Onboarding Generator,
following the approved specification and execution-only `run-plan` skill.
The user requested splitting independent work where possible. Share a maximum
of two worker subagents across nested work; assign disjoint file ownership.
One worker owns shared contracts, schema/migrations and module registration.
Architecture Reviewer and final Plan Verifier use Sonnet. Skip the dedicated
Test Writer for this slice; implementers still write meaningful AC-based tests.

Approved product choices:

- Manual, repository-specific document selection for agents and enabled safe
  skills; view-only previews, no attachment versioning. Metadata stores paths;
  the trace stores the exact document snapshot sent to the model.
- Brief reviewer selection is optional. Union its documents with enabled skill
  documents and a safe explicitly linked PR specification. With no reviewer,
  generate from available facts and display “Reviewer context not selected.”
- Workspace-configured roots default to
  `**/{specs,docs,insights}/**/*.md` inside imported repositories.
- Caps: 256 KiB/document, 2,000 discovered documents, 100 attachments per
  agent/skill. Context budget is 20% of model window, clamped 4k–32k tokens,
  fallback16k. Brief: 8k input/1.5k output; tour: 24k input/8k output.
- Drop whole documents from the tail with recorded reasons. Reject essential
  input overflow before calling a model. Preserve injection guards, grounding,
  index reuse, single-attempt generation and truthful fallback/caching behavior.

Workers run focused checks. Run required affected-package tests/typecheck/lint/
audit once after stabilization, plus bounded e2e/manual UI checks; repeat only
checks invalidated by fixes. Preserve package-manager choices, mirror vendored
contracts, generate migrations and apply them only as an explicit manual step.
Never modify runtime clones or wipe database volumes.

Finish with bounded architecture/fix iterations, documentation and final
read-only AC → task → test → commit verification. Record real demos and the
required video; open the PR against `l04/mcp`. Never invent test, model-cost,
approval or video evidence. `workflow-retro` is manual-only; its ledger is
`docs/retro/ledger.md`.

Keep stage commits separate. Credit the assistant actually contributing each
commit; existing Codex work already has `Co-authored-by: Codex
<noreply@openai.com>`. Preserve implementation details when updating PR text.
