# L05 workflow preflight

- Git base: `l04/mcp`, commit `da33d6d126e5fd9e23f75f769753c0207115356d`.
- Working branch: `l05/specs`.
- Specification: `specs/2026-10-22-l05-context-brief-onboarding.md`, explicitly approved by the user's current-session “yes” to C2, C4 and C7.
- Execution mode: split independent work across agents where possible, as requested. Shared limit: at most two active worker subagents; nested researchers share that limit.
- Specification author, implementation planner and execution are separate stages. No product implementation begins before the plan is reviewed, approved and committed.
- Planning is performed by the Codex implementation-planner role. Cross-family review is assigned to Claude Sonnet, with no tools, MCP access or source writes. Record the actual returned model identity and review outcome after execution.
- The installed Claude CLI reports authenticated access. Remaining subscription quota is not exposed by the auth-status command and is unknown. Bound the planned review with `--max-budget-usd 2`; this is an execution cap, not a claim about remaining balance or actual cost.
- No paid product-model demonstrations are authorized by this preflight alone. Record their separate approval and actual calls/usage when performed.
- Dedicated test-writer is skipped for this slice. Implementers derive meaningful tests from ACs and run focused checks; the root runs required tests/typecheck/lint/audit once for affected packages after stabilization, then repeats only checks invalidated by fixes.
- Bound initial end-to-end validation to affected deterministic journeys; preserve manual UI verification and report omitted/skipped checks. No automatic migrations or destructive resets.
- Architecture review and fix rounds are bounded to three. The final read-only verifier runs after fixes and documentation and checks AC → task → test → commit.
- Retrospective remains manual-only. No ledger entry or complete-run cost is claimed at this stage.
