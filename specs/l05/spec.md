# L05 feature specification

- Status: **Draft — awaiting clarification and explicit approval.**
- Author: `spec-creator` subagent; generated from the assignment and inspected fork evidence.
- Baseline: `lanasiderae/dev-digest-ai`, `l04/mcp`, commit `da33d6d126e5fd9e23f75f769753c0207115356d`.
- Target branch: `l05/specs`; `main` is not the baseline.
- Scope: SDD workflow, Project Context Folder, PR Brief, and the additional Onboarding Generator assignment. Inclusion of onboarding in this delivery remains a clarification below.
- This document defines behavior; it is not an implementation plan or evidence that the features already work.

## Approval checklist and stage order

Before approval, review goals/non-goals, the six clarification categories, source provenance, missing-data semantics, numeric token budgets and their counting method, and every `[NEEDS CLARIFICATION]` marker. Do not pass an unresolved draft to `implementation-planner`.

Required sequence: workflow foundation → approved specification → AC-linked plan → cross-model plan review → commit specification and reviewed plan → Project Context Folder → PR Brief → Onboarding Generator if included → tests and architecture review → final read-only `plan-verifier` → manually invoked retrospective and delivery evidence. Stage commits must remain traceable. Approval of this specification is not approval of a future plan.

## Clarification record

| Category | Confirmed requirement / inspected evidence | Unresolved decision |
|---|---|---|
| 1. Goals, users, scope | Repository reviewers need selected Markdown rules and a PR overview. Additional assignment requests a five-section tour for an unfamiliar repository. | C1: include onboarding in this delivery or a subsequent L05 delivery? |
| 2. Behavior and interaction | Selection is manual; agent Context tab and skill section are required. Brief generation/regeneration is user initiated. `/onboarding` already adds repositories. | C2: approve explicit reviewer selection for brief context? C3: approve repository-qualified selections? |
| 3. Data and provenance | Existing index is reused. Attachments store paths, not contents. Brief JSON must include PR SHA. Existing prompt supports untrusted `specs` chunks. | C3: attachment repository/version policy; C4: scope of configurable roots. |
| 4. Failure and edge cases | Missing Intent/Blast must not block a brief; degraded data differs from a healthy empty map. Tour needs deterministic fallback for index/model failure. | C5: approve safe document limits and missing-document handling? C6: approve zero-call tour for unavailable/partial index? |
| 5. Constraints and budget | No extra context-attachment LLM call; one structured brief call and one narrative tour call on eligible generation. Models are selected through feature settings. | C7: approve token caps, counting method, truncation, output allowance and initial workflow resource limits? |
| 6. Verification and delivery | AC → task → test → commit; real cross-model family review; open PR and demo video. | Cross-model provider availability, paid-call budget, and user approval of draft remain pending; do not fabricate evidence. |

### Proposed decisions awaiting approval

These are reviewable proposals, not accepted requirements:

- C1: include all three product features, with Project Context Folder delivered first.
- C2: choose a reviewer explicitly when generating a brief; use its agent attachments plus enabled skill attachments. Do not silently infer the last reviewer.
- C3: store each attachment as repository identity plus normalized repository-relative path; resolve only selections for the reviewed repository. Read the current managed clone snapshot, record that revision/content digest in trace, and identify it separately from PR head SHA. No cross-repository content inclusion.
- C4: configure search roots at workspace scope, defaulting to `**/{specs,docs,insights}/**/*.md`; no arbitrary host paths.
- C5: bound individual documents at 256 KiB, discovery at 1,000 results, and attached context at 6,000 tokens. Skip unsafe/unreadable/missing documents with visible reasons; truncate eligible documents deterministically, never silently. These limits are proposals, not repository facts.
- C6: if index facts are absent, disabled, failed, partial, or unavailable because of a large/incomplete clone, generate a deterministic five-section tour with accurate limited status and zero model calls. A complete eligible snapshot uses one model attempt.
- C7: cap the full assembled brief and tour input messages at 8,000 tokens each, including instructions and delimiters; reserve a separate 2,000-token output allowance. Count with the configured tokenizer and identify its encoding; if an exact model tokenizer is unavailable, label counts as estimates and use a documented conservative preflight limit rather than claiming model-exact tokens. Initial workflow maximum: two concurrent subagents; run focused hermetic tests first, one deterministic end-to-end smoke per product journey at final verification; expand on failures. Check actual available budget before selecting models or running paid demos.

## Goals and non-goals

Goals: preserve L04 behavior while making reviews aware of selected project rules; provide a cached, grounded PR Brief; provide an evidence-based repository tour; make the development workflow traceable from requirements to commits and measured cost.

Non-goals: automatic PR-to-document selection, arbitrary host-file uploads, a new AST/index pipeline, model-generated code facts, replacing the review grounding gate, changing MCP tool inventory, applying migrations on application boot, implementing later-course eval/memory/multi-agent product scaffolding, or replacing the existing add-repository onboarding screen.

## Evidence and provenance

Inspected guidance: root `README.md` and `TESTING.md`; package `AGENTS.md`/README and architecture, review-flow, prompt, engine, and page documentation; `.claude/agents/spec-creator.md`; current `brief.ts` contract and agent registry. `.claude/rules/README.md` states that rules are currently empty.

The parent research inventory identifies these integration points; implementation planning must verify exact signatures and current state before changes:

| Fact source | Provenance and boundary |
|---|---|
| Intent | `pr_intent`, `getIntent(prId)` in reviews repository; reuse saved value, no new Intent call during brief generation. |
| Blast Radius | Existing blast domain/API; reuse calculated summary, caller and changed-symbol files, and degradation metadata. No new AST/import-graph build. |
| PR facts | Saved metadata, description, linked issue, head SHA, changed-file paths/additions/deletions and Smart Diff roles. Raw diff hunks are excluded from brief input. |
| Project documents | Managed repository clone plus explicitly selected metadata paths. `evidenceFiles` is not attachment storage. Persisted metadata lacks this feature today. |
| Review prompt/trace | `reviewer-core` already supports `specs[]`, untrusted delimiters and injection guard; server `run-executor` currently reports an empty `specs_read`. Server resolves file I/O; pure engine remains free of filesystem/database access. |
| Contracts/cache | Both vendored `brief.ts` copies must agree. Current `PrBrief` requires Intent/Blast; missing-source representation needs an explicit compatible extension. Existing `pr_brief` and onboarding JSON storage are available. |
| Model settings | Existing `risk_brief` and `onboarding` feature model settings; resolve dynamically. |
| Tour facts | Existing `repoIntel.getTopFilesByRank`, `getCriticalPaths`, `getRepoMap`, `getIndexState`; ranked persisted index is the source, not a new graph traversal/index build. |
| Existing onboarding | `/onboarding` adds repositories. Preserve that flow and provide an accessible repository-scoped tour entry. Existing onboarding prompt sections do not match the required five sections and cannot be reused unchanged. |

No live DevDigest MCP state was queried: those tools are not exposed in this Codex session. No paid model call, live review, user budget measurement, or product verification is claimed by this draft.

## Workflow behavior and acceptance criteria

Priorities: P1 = required assignment behavior; P2 = recommended brief evidence/quality; P3 = optional brief enhancements. Workflow and context/onboarding obligations without an explicit assignment tier are treated as required (P1).

| AC-ID | Priority | EARS requirement | Verification evidence |
|---|---|---|---|
| SDD-AC-01 | P1 | WHEN requirements are submitted, `spec-creator` SHALL cover all six clarification categories, produce a feature specification with unique EARS AC IDs, and mark unresolved requirements `[NEEDS CLARIFICATION]` rather than inventing decisions. | Agent configuration, generated spec and approval record. |
| SDD-AC-02 | P1 | WHEN `spec-creator` uses tools, it SHALL be allowed only read-only DevDigest MCP state tools and writes to the required specification file under `specs/`; writes outside that file and review-triggering tools SHALL be denied by enforced tool policy. | Allowed-read, allowed-write, denied traversal/symlink/write and denied mutation-tool checks in Claude Code; distinguish Codex policy from Claude hook enforcement. |
| SDD-AC-03 | P1 | WHEN an approved specification is planned, `implementation-planner` SHALL replace `planner`, define how/order rather than clarify requirements, and reference an AC-ID for every task. | Agent registry/config and generated plan. |
| SDD-AC-04 | P1 | WHEN a plan is ready, a reviewer from a different model family SHALL review it before implementation, and the findings and actual model/provider identity SHALL be saved. | Review note; no claim of cross-model review if unavailable. |
| SDD-AC-05 | P2 | BEFORE implementation code begins, the generated approved spec and reviewed plan SHALL be committed. | Git history and approval evidence. |
| SDD-AC-06 | P1 | WHEN an approved plan executes, `run-plan` SHALL preserve task/AC scope, delegate non-trivial tests from the specification, and collect implementation and architectural review evidence. | Stage artifacts, test report and architecture findings. |
| SDD-AC-07 | P1 | WHEN implementation and reviews finish, the final read-only `plan-verifier` SHALL report AC → task → test → commit coverage and every unresolved/cannot-verify item before merge. | Final verifier report in PR; no writes by verifier. |
| SDD-AC-08 | P1 | BEFORE a long workflow or paid demonstration, the operator SHALL record available budget or its unavailability, choose adequate model cost, and set concurrency/validation limits without disabling all validation. | Run preflight note with actual model identities and limits. |
| SDD-AC-09 | P1 | WHEN manually invoked after a complete pipeline, `workflow-retro` SHALL inspect parent and nested-agent usage, including disk logs in deep mode, and report tokens, cache reads, tool calls, duration and concurrency with concrete improvements. | Retrospective with source coverage and unknown values explicitly identified. |
| SDD-AC-10 | P1 | WHEN a retrospective completes, it SHALL append a concise comparable run summary to `docs/retros/ledger.md` without double-counting child usage or inventing unavailable cost. | Ledger entry and calculation/source references. |

## Feature 1 — Project Context Folder

### User story and behavior

As a reviewer author, I select repository Markdown rules for an agent or skill, preview them, and see which documents actually reached a review. Selection is manual. Enabled skill selections and agent selections form a deduplicated context set under the proposed C2/C3 policy.

### Contracts and observable outputs

Discovery exposes repository-relative path and document type (`specs`, `docs`, `insights`, or configured-root type), with search and safe text preview. Metadata stores selected paths plus the proposed repository qualifier, not document bodies. Runtime trace exposes `specs_read`, included document list, per-document/total token usage, source revision and omission/truncation reasons. Token counters label estimated versus actual values.

### Failure, security and model budget

Documents are untrusted repository data. Only Markdown under configured repository roots is eligible; reject absolute paths, traversal, unsafe symlink escapes and cross-repository reads. Use existing delimiter escaping and injection guard under `## Project context`; document claims never disable structural safety or grounding. Selection/loading makes no model call. Preserve normal review call strategy; do not promise every review itself uses one call.

Proposed C5 caps require approval. Retain deterministic ordering and deduplication. Warn on stale/missing/unsafe selections without pretending they were read. Reading clone content does not imply it matches PR head; trace records actual provenance.

| AC-ID | Priority | EARS requirement | Verification evidence |
|---|---|---|---|
| CTX-AC-01 | P1 | WHEN documents are discovered, the system SHALL recursively list `.md` files matching configurable roots, defaulting to `**/{specs,docs,insights}/**/*.md`. | Nested/default/custom-root discovery tests. |
| CTX-AC-02 | P1 | WHEN an agent Context tab is opened, it SHALL show manual selection checkboxes, paths, types, search and preview. | Component tests and real UI check. |
| CTX-AC-03 | P1 | WHEN a skill is edited, it SHALL offer a matching Project context to use selection section. | Skill interaction and persistence test. |
| CTX-AC-04 | P1 | WHEN selections are saved and reloaded, metadata SHALL preserve paths rather than document contents, with approved repository scope. | API/storage and reload tests. |
| CTX-AC-05 | P1 | WHEN a review starts, the server SHALL resolve eligible selected documents from the agent and enabled skills, deduplicate them, and provide guarded untrusted `## Project context` without an extra model call. | Captured prompt, injection/deduplication and model-count tests. |
| CTX-AC-06 | P1 | WHEN document loading finishes, trace SHALL show `specs_read`, the actual included document list and token usage, and any omitted/truncated documents with reasons. | Trace contract/persistence/UI tests. |
| CTX-AC-07 | P1 | IF a path escapes approved roots, targets another repository, or resolves through an unsafe symlink, THEN content SHALL not be read or previewed. | Permission-boundary tests. |
| CTX-AC-08 | P1 | IF selected documents are unavailable or exceed approved bounds, THEN the review SHALL continue with an explicit partial-context warning and truthful trace. | Missing/oversize/budget boundary tests. |
| CTX-AC-09 | P1 | WHEN a review receives an attached specification forbidding direct `api/` imports of `db/` and a diff violating that rule, it SHALL identify the violation with the specific attached document reference while retaining grounded diff citations. | Deterministic prompt/output seam test plus recorded real-model demonstration; fixture alone is not proof of model compliance. |

## Feature 2 — PR Brief

### User story and behavior

As a reviewer, I open Overview, choose the approved reviewer context, generate a brief, examine summary/risks/priorities beside available Intent/Blast, navigate to a relevant diff file, reload a cached result and explicitly regenerate it.

### Contracts and provenance

Extend both `PrBrief` copies with `summary` and `review_focus: Array<{file: string; line: number; reason: string}>`. Preserve existing `Risk` shape (`kind`, `title`, `explanation`, `severity`, `file_refs`) and `history`. Make unavailable Intent/Blast distinguishable from healthy empty data. Add observable source availability/degradation and generation provenance without manufacturing an Intent or Blast result.

`GET /pulls/:id/brief` reads cache only; `POST /pulls/:id/brief` generates. Store PR head SHA inside `pr_brief.json`; include reviewer/context selection fingerprint and actual source revision/digests under proposed C2/C3. A changed head/context identifies stale cache. Never overwrite a valid cache with failed/unvalidated generation or return a result generated for a superseded head as current.

Ground every risk path and focus path against the union of current PR files and available Blast changed-symbol/caller files. Do not infer permitted paths from model text. Focus line numbers must be positive integers; exact line navigation should use existing diff metadata, without feeding hunks to the model. A permitted downstream file absent from the PR diff is not a fabricated path.

### Model input budget and failure behavior

Resolve `resolveFeatureModel(container, workspaceId, 'risk_brief')`; use one `llm.completeStructured({model, schema, schemaName, messages})` attempt producing `{summary, risks: [], review_focus: []}`. No repair model call, retry, Intent generation, document summarization or secondary model call in this operation. Validate the contract and reject invalid references rather than persisting invented paths. Model/provider adapters must not hide additional billable retries.

Proposed C7 cap: 8,000 input tokens, separately 2,000 output tokens. Deterministic priority: source status/head/file allowlist and instructions; compact diff statistics/roles and available Intent/Blast; bounded PR/issue text; selected document excerpts within remaining budget. Report omissions. If mandatory input cannot fit, fail before a model call with an actionable message; do not silently lose grounding facts. Raw diff hunks and source code are never included.

Missing Intent/Blast/issue/context is recorded and does not block generation using remaining facts. On model failure, preserve cache and show failure. PR-derived descriptions, issue text, index facts and documents remain delimiter-wrapped untrusted data with the guard preserved. Concurrent regeneration/head-change behavior must not corrupt or mislabel cache.

| AC-ID | Priority | EARS requirement | Verification evidence |
|---|---|---|---|
| BRIEF-AC-01 | P1 | WHEN Overview has no cached brief, it SHALL show a PR Brief section and Generate brief button. | Component test and browser demo. |
| BRIEF-AC-02 | P1 | WHEN generation succeeds, Overview SHALL display summary, Risk areas and ordered Review focus alongside available Intent/Blast and identify missing or degraded sources. | Complete/missing/degraded source tests and demo. |
| BRIEF-AC-03 | P1 | WHEN risks/focus are displayed, every risk SHALL have a title and related file and every focus item SHALL show file:line and reason. | Contract/render tests. |
| BRIEF-AC-04 | P1 | IF model output references a file absent from both the PR and available Blast map, THEN the response SHALL be rejected before persistence. | Grounding rejection test and unchanged-cache check. |
| BRIEF-AC-05 | P1 | WHEN a focus item belonging to the PR is clicked, the UI SHALL open Files changed with `?tab=diff` and select its file. | Browser navigation check. |
| BRIEF-AC-06 | P1 | WHEN the page reloads, a valid cached brief SHALL load without generation; WHEN refresh is requested, a new brief SHALL be generated and persisted. | API/cache/model-count and browser checks. |
| BRIEF-AC-07 | P1 | WHEN the feature is submitted, its generated specification and AC-linked plan SHALL be present in the open PR. | Agent authorship artifacts and PR files. |
| BRIEF-AC-08 | P1 | WHEN the feature is submitted, the open PR SHALL include implementation details and a 1–3 minute demo covering the required user journey. | PR/video link; do not mark complete before recording. |
| BRIEF-AC-09 | P2 | WHEN eligible brief generation runs, it SHALL make exactly one structured model attempt using dynamically resolved `risk_brief`, with recorded call count/usage. | Stub call-count/model-selection test and live logs. |
| BRIEF-AC-10 | P2 | WHEN brief input is assembled, it SHALL remain within the approved token budget and contain precomputed facts rather than raw diff hunks. | Captured input, tokenizer boundary and exclusion tests. |
| BRIEF-AC-11 | P2 | WHEN brief output is returned or cached, it SHALL be contract validated and both vendored contracts SHALL define matching summary/review_focus fields. | Parity and response-validation tests. |
| BRIEF-AC-12 | P2 | WHEN current PR head SHA or approved context identity differs from cached provenance, the UI/API SHALL identify the brief as stale or explicitly regenerate it. | Head/context-change cache tests. |
| BRIEF-AC-13 | P2 | WHEN a focus item identifies a line available in the PR diff, navigation SHALL scroll to that exact line. | Browser line-anchor check. |
| BRIEF-AC-14 | P2 | WHEN final verification is published, its report SHALL contain no unresolved required requirements, and the PR SHALL identify the cross-model reviewer and findings. | Verifier report and review note in PR. |
| BRIEF-AC-15 | P3 | WHERE a latest verdict/score exists, Overview SHALL offer `VerdictBanner` using actual review values. | Reviewed/unreviewed render check. |
| BRIEF-AC-16 | P3 | WHERE expandable risks are provided, expanding a risk SHALL reveal its explanation and clicking its path SHALL navigate to the file. | Interaction check. |
| BRIEF-AC-17 | P3 | IF a grounded downstream file is absent from the PR diff, THEN the UI SHALL state “File not in this PR’s diff” instead of claiming a diff location. | Downstream-only navigation check. |
| BRIEF-AC-18 | P3 | WHILE brief generation is running, the UI SHALL display a loading skeleton. | Pending-state render check. |
| BRIEF-AC-19 | P3 | WHEN brief labels render, they SHALL use `client/messages/en/brief.json` translation keys. | Translation/label review. |
| BRIEF-AC-20 | P3 | WHERE retrospective results are included in the PR, they SHALL provide actual cost/source coverage and concrete workflow improvements. | Linked retrospective and ledger. |

## Feature 3 — Onboarding Generator

### User story, sections and provenance

As a developer unfamiliar with an imported open-source repository, I generate a guided tour containing exactly five top-level sections: architecture overview; critical execution paths; local setup instructions; recommended file reading order; suggested first tasks. Preserve `/onboarding` add-repository behavior; expose an accessible repository-scoped generation/read flow. Proposed C1 inclusion and C6 failure policy await approval.

Reuse saved `repoIntel.*` facts and ranked files/import graph information; rank reading order using persisted rank/PageRank with available hotness, for example `rank × (1 + hotness)`, with deterministic tie-breaking and truthful indication when hotness is absent. No AST/graph rebuild or fresh ranking model. Setup commands come from available repository documentation/manifests and are suggestions, never executed. Only evidence-backed paths appear; missing setup facts are “unavailable,” not invented commands.

### Contract, input budget and failures

Store five structured sections plus repository/index revision, status, evidence paths, ordered reading path and call/token/cost metadata in existing onboarding JSON storage. Resolve the `onboarding` feature model setting. For a complete eligible index, make one structured narrative model attempt. Validate section count/shape and paths before caching. On unavailable index, use C6's proposed zero-call deterministic five-section skeleton; on model/validation failure after one attempt, use the skeleton and truthful failure status. Never label fallback as a successful generated narrative.

Proposed C7 input limit: 8,000 tokens including instructions/delimiters, separate 2,000-token output allowance. Prioritize index status/revision and permitted file references, compact repository map and critical paths, ranked reading files, then bounded setup documentation. Large repositories are bounded using existing ranked index retrieval; no whole-repository prompt or recursive code parsing. Incomplete clone and partial index must remain visible. Record model-reported usage/cost; unknown price remains unknown, not zero. Guard all repo-derived data against injection.

| AC-ID | Priority | EARS requirement | Verification evidence |
|---|---|---|---|
| ONBOARD-AC-01 | P1 | WHEN an eligible repository tour is generated, it SHALL contain exactly the five specified sections and cite evidence-backed repository paths. | Structured-output and grounding tests; unfamiliar-repo demo. |
| ONBOARD-AC-02 | P1 | WHEN facts are assembled, they SHALL come from existing `repoIntel.*` index data and bounded setup evidence without rebuilding AST/import graph. | Adapter seam/no-reindex test and architecture review. |
| ONBOARD-AC-03 | P1 | WHEN reading order is produced, it SHALL use existing graph rank with available hotness and deterministic ordering. | Ranking tests with ties/missing hotness. |
| ONBOARD-AC-04 | P1 | WHEN complete eligible facts are available, generation SHALL make one structured narrative model attempt using the configured onboarding model and record calls/tokens/cost. | Mock call-count test and live cost evidence. |
| ONBOARD-AC-05 | P1 | IF the index/clone is unavailable or incomplete, THEN a deterministic five-section skeleton SHALL identify the actual reason without claiming complete repository knowledge, under approved C6 call policy. | Flag-off/failed/partial/large/no-data fixtures. |
| ONBOARD-AC-06 | P1 | IF the model or output validation fails, THEN the generator SHALL return a truthful deterministic five-section fallback without a second model call. | Failure/invalid-path tests. |
| ONBOARD-AC-07 | P1 | WHEN a large repository is processed, generation SHALL respect the approved input token cap using bounded persisted facts and disclose omitted evidence. | Large-fact/budget tests. |
| ONBOARD-AC-08 | P1 | WHEN the tour is exposed, the existing add-repository flow SHALL remain functional and the repository tour SHALL be accessible and reloadable with its status/provenance. | Existing-flow regression and browser check. |
| ONBOARD-AC-09 | P1 | WHEN onboarding is delivered, its specification, plan/review, code/tests, architecture review and final AC → task → test → commit report SHALL be separately traceable through stage commits. | Commit history and verifier matrix. |
| ONBOARD-AC-10 | P1 | WHEN onboarding is demonstrated on an unfamiliar open-source repository, the demonstration SHALL show its five sections and actual model-call count/cost, with unknown cost explicitly labeled. | Demo/log links; no fabricated usage. |

## Validation and delivery

This draft has **49 acceptance criteria: 36 P1, 7 P2, 6 P3**. A final verifier must reconcile actual approved scope and priority counts before reporting coverage. Optional enhancements are not approval blockers; unresolved required criteria are.

Use specification-derived seam tests: permission guards; discovery and path containment; metadata/prompt/trace; brief source assembly, grounding, cache and navigation; tour ranking, structured call count and fallback. Apply package test/typecheck/lint/audit commands from root guidance. DB-backed tests keep `.it.test.ts`; record skipped Docker tests honestly. Run a real UI check for UI changes and a limited deterministic e2e journey; mocked tests do not establish live model behavior. Do not run tests or paid generation merely to approve this documentation draft.

Required PR evidence: approved agent-generated `spec.md` and `plan.md` committed before product code; actual cross-family review note; stage contributions; tests and audits with pre-existing vulnerabilities distinguished; final read-only verifier report; retrospective/ledger with honest metrics coverage; open PR implementation description; linked 1–3 minute PR Brief video. Video shows generate → summary/risks/focus and available/missing sources → diff navigation → reload without new call → refresh → spec/plan/verifier. Explain that precomputed facts keep source grounding and budgets controlled without sending raw diff hunks or rebuilding index facts. Context rule-violation and unfamiliar-repo tour demonstrations may be separate clips, with actual call/cost evidence.

## Open clarifications

1. [NEEDS CLARIFICATION: C1 — include Onboarding Generator in this delivery, or specify a subsequent delivery while retaining its draft requirements here?]
2. [NEEDS CLARIFICATION: C2 — approve explicit reviewer selection for PR Brief and union of that agent's attachments with enabled skill attachments?]
3. [NEEDS CLARIFICATION: C3 — approve repository-qualified metadata paths, clone-snapshot reads with recorded revision/digests, no cross-repository inclusion, and cache invalidation on reviewer/context identity changes?]
4. [NEEDS CLARIFICATION: C4 — approve workspace-level configurable roots constrained to the imported repository, with the specified default glob?]
5. [NEEDS CLARIFICATION: C5 — approve 256 KiB/document, 1,000 discovery entries, 6,000 attached-context tokens and visible deterministic omission/truncation behavior?]
6. [NEEDS CLARIFICATION: C6 — approve a zero-model-call deterministic five-section tour for any missing/partial/failed/disabled index or incomplete clone, versus allowing one narrative call on partial facts?]
7. [NEEDS CLARIFICATION: C7 — approve 8,000 input tokens and 2,000 output tokens per brief/tour, the documented tokenizer/estimate policy, priority order and initial concurrency/e2e limits?]

No user approval, plan approval, execution budget or cross-model availability has been inferred. Resolve these markers and record user evidence before planning.
