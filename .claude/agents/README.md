# Agents (`.claude/agents/`)

Custom subagents for this repo, invoked via the `Agent`/`Task` tool. This file
is a map of the set — responsibilities, permissions, and artifact flow. For
the actual rules each agent follows, read its own `.md` file; this doc does
not duplicate them.

> **Not the same thing as `agents` the DB table.** This directory holds
> Claude Code *dev-workflow* subagents — tools for planning/implementing/
> reviewing changes to this codebase. The app's own `agents` table and
> `docs/agent-prompts/*.md` are a completely different system: reviewer
> agents (provider + model + system prompt) that run PR reviews inside
> DevDigest itself, configured via the Settings → Agents UI. Same word, two
> unrelated systems — one of these agents (`security-reviewer`, below)
> happens to share a name with a `docs/agent-prompts/security-reviewer.md`
> reviewer prompt; they do not interact.

## At a glance

| Agent | Role | Tools | Model | Preloaded skills | Reads | Produces |
|---|---|---|---|---|---|---|
| [`spec-creator`](./spec-creator.md) | Define what and why; resolve six clarification categories and unique EARS ACs | `Read, Grep, Glob, AskUserQuestion, Write, Edit, Agent(researcher)` + four read-only DevDigest MCP tools | sonnet | none | requirements and repository/system facts | English dated spec in owning package specs/ or root specs/ for cross-package work; instructional write-only restriction |
| [`researcher`](./researcher.md) | Investigate a specific question (internal repo or external web) and report findings | `Read, Grep, Glob, Bash, WebFetch, WebSearch, AskUserQuestion, Agent(researcher)` | sonnet | none | a scoped question | a structured findings report (Conclusions / Evidence / References / Could not find) |
| [`implementation-planner`](./implementation-planner.md) | Turn an approved specification into an AC-linked Development Plan before any code is written | `Read, Grep, Glob, Bash, AskUserQuestion` | sonnet | none; load on demand | approved specification, module `AGENTS.md`/`INSIGHTS.md`, `pr-self-review`'s file→skill matching table | a Development Plan (markdown, fixed headings); maps all tasks to ACs; implementer writes focused tests, test-writer optional |
| [`implementer`](./implementer.md) | Execute an approved Development Plan across `client/`/`server/`, self-verify mechanically | `Read, Write, Edit, Grep, Glob, Bash, Skill` | sonnet | none; load on demand | a Development Plan | code changes + an Implementation Report (files↔plan-step mapping, test evidence, deviations, flags for review) |
| [`test-writer`](./test-writer.md) | Optional dedicated AC-derived UI/backend tests when explicitly selected | `Read, Write, Edit, Grep, Glob, Bash, Skill` | sonnet | `react-testing-library`, `frontend-ui-architecture`, `onion-architecture`, `fastify-best-practices`, `typescript-expert`, `engineering-insights` | a Development Plan (or a standalone "add tests for X" request) | test files only + a Test report |
| [`architecture-reviewer`](./architecture-reviewer.md) | Read-only: check architectural boundaries (server onion/Fastify edge, reviewer-core purity, client placement/RSC) | `Read, Grep, Glob, Bash, ReportFindings` | sonnet | `onion-architecture`, `fastify-best-practices`, `frontend-ui-architecture`, `next-best-practices` | a diff or path set | evidence-backed findings (`ReportFindings`, or a fixed-heading markdown fallback) — no verdict |
| [`plan-verifier`](./plan-verifier.md) | Read-only: verify a completed change against a Development Plan, closed-list only | `Read, Grep, Glob, Bash, AskUserQuestion` | sonnet | none | a Development Plan + the diff/Implementation Report | a Plan verification report (`DONE/PARTIAL/MISSING/CANNOT VERIFY` per item, `COMPLETE`/`INCOMPLETE`) |
| [`brainstorm`](./brainstorm.md) | Optional, before `implementation-planner`: generate and compare 2-4 genuinely different approaches to a feature/fix/design question | `Read, Grep, Glob, Bash, AskUserQuestion` | opus | none | the problem statement, module `AGENTS.md`/`INSIGHTS.md`, `pr-self-review`'s file→skill matching table | an options comparison (Problem / Assumptions / Options / Comparison / Recommendation / Open questions) — no code, no plan, no decision |
| [`security-reviewer`](./security-reviewer.md) | Read-only: security review of a diff or path set (injection, authZ, secrets, SSRF, deps, LLM/prompt-injection risks) | `Read, Grep, Glob, Bash, ReportFindings` | opus | `security`, `zod`, `fastify-best-practices` | a diff (optionally inline in `<untrusted_diff>`) or path set | evidence-backed findings (`ReportFindings`, or a fixed-heading markdown fallback) — no verdict |
| [`doc-writer`](./doc-writer.md) | Document implemented behavior with cited prose/diagrams under docs/; never author normative specs | `Read, Write, Edit, Grep, Glob, Bash` | sonnet | `mermaid-diagram` | a Development Plan or an implemented feature | doc files under the owning package's `docs/` + a Documentation report |

**Skill loading:** implementation-planner and implementer load only the skills
routed to current tasks. Narrow review agents retain their listed skill sets.
Review model choices and available budget before a long run; use one worker at
a time initially and avoid expensive model overrides without a concrete need.
`pr-self-review` remains a manually invoked review gate.

## Pipeline

```
requirements → spec-creator → dated feature spec → approval
             → implementation-planner → AC-linked plan
             → different-family cross-model review → artifact commit
             → manually invoke /run-plan → implementer + focused AC-derived tests
             → architecture review → bounded fixes (max 3) → root validation
             → applicable security review / doc updates
             → plan-verifier (final, read-only: AC → task → test → commit)
             → PR
manual only: /workflow-retro (current context; --deep opts into logs)
```

- **`brainstorm`** is optional and sits *before* `implementation-planner`: it widens the
  solution space (2-4 different approaches, same criteria for each, one
  recommendation), a human picks an option, and `implementation-planner` narrows that
  option into a Development Plan. It has no `Write`/`Edit`, emits no code or
  step lists, and routes architecture/security judgments and external-fact
  questions to "Open questions" for `architecture-reviewer` /
  `security-reviewer` / `researcher`.
- **`implementation-planner`** has no `Write`/`Edit` — it cannot touch code, only produce the
  plan as its returned message. Persisting it to a file (e.g. under
  `server/specs/` or `client/specs/`) is the caller's choice, not the agent's.
  It asks technical ambiguities and recommends approaches without changing
  requirements. Ask single-agent versus multi-agent once unless answered.
- **`implementer`** consumes the plan as given input (pasted or by path) and
  treats it as the scope boundary — it does not re-plan.
- **`test-writer`** remains optional; skip the separate role for this run.
  Implementer may write AC-derived focused tests. Root runs full required
  package checks/audit once after stabilization; workers avoid duplicate suites.
- **`plan-verifier`** runs last, checks specification AC → task → test → commit,
  and checks `implementer`'s (and `test-writer`'s) work
  against the plan only — closed-list, four-state per item, never a general
  code-quality pass.
- **`architecture-reviewer`** is read-only and evidence-required (`file:line`
  citations, dedup, no verdict) across server, reviewer-core, and client
  boundaries. It formalizes and extends `pr-self-review`'s
  backend-architecture checks without editing that skill.
- **`doc-writer`** runs after a feature is implemented; normative specifications
  belong only to spec-creator. It never edits code, `AGENTS.md`/`INSIGHTS.md`, or the
  DB-synced `docs/agent-prompts/**`.
- **`security-reviewer`** is the security counterpart of
  `architecture-reviewer`: read-only, `file:line` + quoted-evidence findings,
  dedup, no verdict. It treats the reviewed diff as untrusted data (this repo
  reviews other people's PRs and handles cloned repos), has no write or
  network capability, and reports injection attempts as findings.
  `/pr-self-review` remains the manual local gate that owns the overall
  verdict; none of these agents runs that skill's verdict step — the
  pipeline ends with final read-only `plan-verifier` traceability, not an
  automatic merge-ready verdict.

## Adding a new agent

Update the table and pipeline diagram above, and add a per-agent section in
this file if it encodes non-obvious rules — don't just drop a new `.md` file
in silently.

## L05 execution gates

Spec-creator analyzes text/designs/code and repository evidence, asks blocking
questions first and keeps nonblocking questions inline. English dated specs
belong in the owning package's specs/ for one package, otherwise root specs/.
Current target: `specs/2026-10-22-l05-context-brief-onboarding.md`.
Only the spec file may be written, enforced by prompt instructions rather than
a hook. Drafts may contain clarification markers; approval cannot have blockers.

Implementation-planner reviews approved requirements, asks technical questions
and recommends approaches, never writes/redefines the spec. Every task has an
AC-ID. Researcher may use up to two scoped researcher children sharing budget;
children cannot fan out recursively or write files.

[run-plan](../skills/run-plan/SKILL.md) is manually invoked execution only:
approved spec/plan and cross-model review → implementation → focused tests →
architecture review → bounded fixes → root checks → final plan-verifier.
It never starts spec-creator/planner. A checkpoint does not replace final
AC → task → test → commit verification after fixes.

[workflow-retro](../skills/workflow-retro/SKILL.md) is manual only, defaults to
current context and uses disk logs only with --deep. It returns a chat summary
and appends evidence to `docs/retro/ledger.md`; unknown metrics remain unknown.

`/pr-self-review` is the repository-local skill
`.claude/skills/pr-self-review/SKILL.md`, not a built-in command. It checks skill
conformance; architecture-reviewer separately checks dependency boundaries.
Neither replaces the other or final AC verification.

Claude configuration reference: [subagents](https://code.claude.com/docs/en/sub-agents).

`Agent(researcher)` restricts types in `claude --agent` main-thread mode.
Claude currently ignores the type list for nested subagent invocation, so
researcher-only delegation and fanout limits are instructional there.
