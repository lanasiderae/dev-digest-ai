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
| [`researcher`](./researcher.md) | Investigate a specific question (internal repo or external web) and report findings | `Read, Grep, Glob, Bash, WebFetch, WebSearch, AskUserQuestion` | sonnet | none | a scoped question | a structured findings report (Conclusions / Evidence / References / Could not find) |
| [`planner`](./planner.md) | Turn a feature/fix request into a Development Plan before any code is written | `Read, Grep, Glob, Bash, AskUserQuestion` | opus | all 13 domain skills (see below) | the request, module `AGENTS.md`/`INSIGHTS.md`, `pr-self-review`'s file→skill matching table | a Development Plan (markdown, fixed headings); assigns test steps to `implementer` (trivial) or `test-writer` (non-trivial) |
| [`implementer`](./implementer.md) | Execute an approved Development Plan across `client/`/`server/`, self-verify mechanically | `Read, Write, Edit, Grep, Glob, Bash, Skill` | sonnet | all 13 domain skills (see below) | a Development Plan | code changes + an Implementation Report (files↔plan-step mapping, test evidence, deviations, flags for review) |
| [`test-writer`](./test-writer.md) | Write UI/backend tests for non-trivial cases (business logic, integration flows, permission rules), sourced from the plan, not the implementation | `Read, Write, Edit, Grep, Glob, Bash, Skill` | sonnet | `react-testing-library`, `frontend-ui-architecture`, `onion-architecture`, `fastify-best-practices`, `typescript-expert`, `engineering-insights` | a Development Plan (or a standalone "add tests for X" request) | test files only + a Test report |
| [`architecture-reviewer`](./architecture-reviewer.md) | Read-only: check architectural boundaries (server onion/Fastify edge, reviewer-core purity, client placement/RSC) | `Read, Grep, Glob, Bash, ReportFindings` | opus | `onion-architecture`, `fastify-best-practices`, `frontend-ui-architecture`, `next-best-practices` | a diff or path set | evidence-backed findings (`ReportFindings`, or a fixed-heading markdown fallback) — no verdict |
| [`plan-verifier`](./plan-verifier.md) | Read-only: verify a completed change against a Development Plan, closed-list only | `Read, Grep, Glob, Bash, AskUserQuestion` | sonnet | none | a Development Plan + the diff/Implementation Report | a Plan verification report (`DONE/PARTIAL/MISSING/CANNOT VERIFY` per item, `COMPLETE`/`INCOMPLETE`) |
| [`brainstorm`](./brainstorm.md) | Optional, before `planner`: generate and compare 2-4 genuinely different approaches to a feature/fix/design question | `Read, Grep, Glob, Bash, AskUserQuestion` | opus | none | the problem statement, module `AGENTS.md`/`INSIGHTS.md`, `pr-self-review`'s file→skill matching table | an options comparison (Problem / Assumptions / Options / Comparison / Recommendation / Open questions) — no code, no plan, no decision |
| [`security-reviewer`](./security-reviewer.md) | Read-only: security review of a diff or path set (injection, authZ, secrets, SSRF, deps, LLM/prompt-injection risks) | `Read, Grep, Glob, Bash, ReportFindings` | opus | `security`, `zod`, `fastify-best-practices` | a diff (optionally inline in `<untrusted_diff>`) or path set | evidence-backed findings (`ReportFindings`, or a fixed-heading markdown fallback) — no verdict |
| [`doc-writer`](./doc-writer.md) | Convert an implemented feature or a plan into documentation + diagrams, filed in the right `docs/`/`specs/` location | `Read, Write, Edit, Grep, Glob, Bash` | sonnet | `mermaid-diagram` | a Development Plan or an implemented feature | doc files under the owning package's `docs/`/`specs/` + a Documentation report |

**Preloaded skills (planner and implementer, identical set):** `onion-architecture`,
`fastify-best-practices`, `drizzle-orm-patterns`, `postgresql-table-design`,
`zod`, `frontend-ui-architecture`, `next-best-practices`, `react-best-practices`,
`react-testing-library`, `typescript-expert`, `security`,
`engineering-insights`, `mermaid-diagram`. The other agents each preload
only what their narrower role needs (see their own rows above).
Deliberately excluded everywhere: `pr-self-review` — it's the manual-only
review gate (`disable-model-invocation: true`); none of the nine agents runs
its own skill-conformance grading (see "Pipeline" below).

## Pipeline

```
request → [brainstorm, optional] → human picks option → planner → Development Plan
        → implementer (+ test-writer for non-trivial tests)
        → code + Implementation Report (+ Test report)
        → plan-verifier → architecture-reviewer → security-reviewer
        → doc-writer → PR
```

- **`brainstorm`** is optional and sits *before* `planner`: it widens the
  solution space (2-4 different approaches, same criteria for each, one
  recommendation), a human picks an option, and `planner` narrows that
  option into a Development Plan. It has no `Write`/`Edit`, emits no code or
  step lists, and routes architecture/security judgments and external-fact
  questions to "Open questions" for `architecture-reviewer` /
  `security-reviewer` / `researcher`.
- **`planner`** has no `Write`/`Edit` — it cannot touch code, only produce the
  plan as its returned message. Persisting it to a file (e.g. under
  `server/specs/` or `client/specs/`) is the caller's choice, not the agent's.
  It also decides, per step, whether a needed test is trivial enough for
  `implementer` to write inline or must be its own step owned by
  `test-writer` (business logic, integration flows, permission rules —
  same-session code+test authorship is a documented trust risk).
- **`implementer`** consumes the plan as given input (pasted or by path) and
  treats it as the scope boundary — it does not re-plan.
- **`test-writer`** sources non-trivial test cases from the plan's stated
  requirements/edge cases, not from reading the implementation it's testing.
  It never touches non-test source.
- **`plan-verifier`** checks `implementer`'s (and `test-writer`'s) work
  against the plan only — closed-list, three-state per item, never a general
  code-quality pass.
- **`architecture-reviewer`** is read-only and evidence-required (`file:line`
  citations, dedup, no verdict) across server, reviewer-core, and client
  boundaries. It formalizes and extends `pr-self-review`'s
  backend-architecture checks without editing that skill.
- **`doc-writer`** runs after a feature is implemented, or to convert a plan
  into a spec doc. It never edits code, `AGENTS.md`/`INSIGHTS.md`, or the
  DB-synced `docs/agent-prompts/**`.
- **`security-reviewer`** is the security counterpart of
  `architecture-reviewer`: read-only, `file:line` + quoted-evidence findings,
  dedup, no verdict. It treats the reviewed diff as untrusted data (this repo
  reviews other people's PRs and handles cloned repos), has no write or
  network capability, and reports injection attempts as findings.
  `/pr-self-review` remains the manual local gate that owns the overall
  verdict; none of the nine agents runs that skill's verdict step — a
  plan/implement/verify/review cycle ends at `doc-writer`'s report, not at a
  merge-ready verdict.

## Adding a new agent

Update the table and pipeline diagram above, and add a per-agent section in
this file if it encodes non-obvious rules — don't just drop a new `.md` file
in silently.
