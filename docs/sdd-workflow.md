# Spec-driven development workflow

This document records the current workflow decisions. Earlier conversation
requests and approvals are not evidence that a current specification or plan
has been approved.

## Responsibilities and artifacts

| Stage | Responsibility | Output |
|---|---|---|
| Manual `spec-creator` | Define what and why; analyze supplied designs, edge cases, module interactions and UX gaps | English `YYYY-MM-DD-feature.md` specification with EARS ACs |
| Human specification review | Resolve blocking questions and explicitly approve the current artifact | Approval evidence |
| Manual `implementation-planner` | Define how/order, technical tradeoffs and AC-linked tasks; confirm single-agent or multi-agent mode once | Implementation plan |
| Cross-model plan review | Review with a different model family; record actual identity and findings | Review note and approved plan |
| `run-plan` | Execute approved tasks, author AC-derived tests, run focused checks and bounded architecture/fix iterations | Code, tests, implementation and review evidence |
| Root validation | Run required package tests, typecheck, lint and audit once after code stabilizes | Actual command results |
| Final `plan-verifier` | Read-only coverage check after fixes and documentation | AC → task → test → commit report |
| Manual `workflow-retro` | Analyze the run and recommend improvements | Chat summary and ledger entry |

Specifications and reviewed plans are committed before product implementation.
`run-plan` never launches specification creation or implementation planning.
Supplementary prompts and design material can clarify the approved plan; a
material scope change returns to the manual specification/planning stages.

## Specification rules

Single-package specifications belong in that package's `specs/`. Top-level
`specs/` contains only cross-module specifications. Preserve established AC
numbering when revising an artifact. Specifications may include contracts,
workflow diagrams and service communication flows, while implementation task
lists belong in plans.

The author asks blocking questions first, records nonblocking recommendations
inline, and uses `[NEEDS CLARIFICATION]` rather than guessing. Only relevant
module guidance and insights are loaded. Research may be delegated within the
shared concurrency budget; no recursive research fan-out. Supplied designs
are evidence, and unseen loading, error, empty or interaction states must not
be represented as already specified.

Specification writes are limited by prompt instructions to the owning
specification directory. There is no filesystem-enforcement hook. Read-only
MCP tools remain available; triggering a review is outside the author's role.

## Execution and cost

Architecture Reviewer and Plan Verifier use Sonnet. A separate Test Writer is
available but skipped in the current workflow; implementers still write and
run meaningful tests. Workers run focused checks. The root performs the full
required validation once after code stabilizes, repeating only checks affected
by subsequent fixes. A maximum of three architecture/fix rounds prevents an
unbounded loop; unresolved findings are reported when the limit is reached.

An optional early verifier checkpoint can catch missing task coverage, but
does not replace the final read-only report. The verifier independently
inspects source/tests and recorded validation evidence rather than rerunning
every package suite by default.

Check available model budget before a long run, share the concurrency limit
across nested agents, and report missing usage data honestly. Multiple agents
may work in parallel when their file ownership and dependencies permit it.

## Review responsibilities

`architecture-reviewer` inspects architectural boundaries and returns cited
findings. `pr-self-review` is a **repository-local skill**, defined at
`.claude/skills/pr-self-review/SKILL.md`, not a built-in product feature. It
dispatches the repository's skills against changed files and gates publishing
on new critical conformance violations. Neither replaces tests, specification
verification or a dedicated security review.

## Manual retrospective

`workflow-retro` never runs automatically. It defaults to evidence in the
current conversation; `deep` mode explicitly reads selected run and child logs.
The result is displayed in chat and appended to `docs/retro/ledger.md`.

Record tokens/cache reads, tool calls, agent count/order, model identity,
duration, concurrency and costs when supported by evidence. Distinguish
requested agent launches from agents that actually started. Do not sum parent
cost totals with child totals unless their coverage is known to be disjoint.
Also record duplicated context, easy/difficult tasks, missed requirements,
fix-loop counts and concrete recommendations. Unknown values remain unknown.

The collector does not create ledger entries or inspect other sessions by
itself. There is no completed-run ledger entry until a retrospective is
explicitly requested and real evidence is available.

## Project Context decisions

The initial slice is view-only. Users manually choose documents for agents
and skills. Attachment metadata stores paths, not document bodies, and does
not introduce attachment versioning. Missing documents are skipped with a
recorded reason. Existing agent counts on skills are reused for usage display.

The UI uses **tokens total**, including the actual prompt block's wrappers.
Prompt Assembly exposes **project context attached specs**, with the full text
actually sent for that run. That immutable trace snapshot is distinct from
path-only attachment metadata.

The L05 feature specification was explicitly approved after resolving its
remaining decisions. That approval covers the specification; the separately
generated implementation plan still requires review and approval.
