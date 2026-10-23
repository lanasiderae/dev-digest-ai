# L05 continuation prompt

Continue work in `/Users/lanamoroz/Desktop/agentic_ai/dev-digest-ai` on branch
`l05/specs`, based on `l04/mcp` at `da33d6d`. Read root/package AGENTS guidance
and `.claude/rules/` before changing code.

Build the L05 assignment through the approved SDD workflow: Project Context
Folder first, PR Brief next, and Onboarding Generator. The full accepted
requirements and all 49 stable AC IDs are in
`specs/2026-10-22-l05-context-brief-onboarding.md`. Use that specification rather
than reconstructing requirements from chat history.

Current checkpoint:

- Workflow definitions and their retrospective collector are committed.
- Specification was approved by the user's current-session “yes” to C2/C4/C7;
  approval/preflight commit: `062ae53`.
- Implementation-planner generated `docs/sdd/l05/plan.md`; all 49 AC IDs are mapped exactly once.
- Cross-model review finished with REVISION_NEEDED. Read `docs/sdd/l05/plan-review.md` and its receipt; do not relaunch the completed review. Findings have not yet been applied. Distinct user approval of the revised plan remains required.
- No product implementation has started. Check Git and these artifacts for
  newer progress before resuming; this checkpoint may have been updated.

Approved choices: optional selected-reviewer documents plus enabled safe skill
documents, deduplicated and combined with a safe PR-linked specification;
generate without a reviewer and label “Reviewer context not selected.” Workspace
discovery roots default to `**/{specs,docs,insights}/**/*.md`, confined to the
imported repository. Limits: 256 KiB/document, 2,000 discovered documents,
100 attachments, context 20% of model window clamped 4k–32k/fallback16k;
brief8k input/1.5k output, tour24k input/8k output. Drop whole documents with
reasons; fail before calling a model when essential facts exceed input limits.

Split independent work where possible, with at most two worker subagents.
Spec creation and implementation planning are separate manual stages.
`run-plan` executes only reviewed, approved, committed artifacts. Skip a
dedicated test-writer for this slice; implementers write AC-derived tests and
focused checks. Root runs full affected-package validation once after code
stabilizes. Architecture Reviewer and final Plan Verifier use Sonnet in Claude;
the verifier runs after fixes and documentation. Preserve safety/grounding,
mirror shared contracts, generate migrations without auto-applying them, and
never modify runtime clones or wipe database volumes.

Keep stage commits separate, add `Co-authored-by: Codex <noreply@openai.com>`,
and preserve implementation details when updating a PR description. Run
workflow-retro only when explicitly invoked; its ledger is
`docs/retro/ledger.md`. Do not invent usage, test, approval or video evidence.

Next: address the saved review findings, reconcile the AC/task matrix and dependencies,
then present the revised plan for approval before product implementation.
