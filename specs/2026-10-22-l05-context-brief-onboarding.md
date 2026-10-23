# L05 feature specification

- Status: **APPROVED**.
- Approval evidence: in the 2026-10-22 session, the user explicitly answered “yes” to approval of the C2, C4 and C7 recommendations. This approves this specification, not a future implementation plan or code.
- Author: `spec-creator` subagent; generated from the assignment and inspected fork evidence.
- Baseline: `lanasiderae/dev-digest-ai`, `l04/mcp`, commit `da33d6d126e5fd9e23f75f769753c0207115356d`.
- Target branch: `l05/specs`; `main` is not the baseline.
- Scope: SDD workflow, Project Context Folder, PR Brief, and the additional Onboarding Generator assignment.
- This document defines behavior; it is not an implementation plan or evidence that the features already work.

## Approval checklist and stage order

Goals/non-goals, the six clarification categories, source provenance, missing-data semantics and numeric token budgets are resolved in this approved specification. There are no outstanding product clarification markers; it may be passed to the separately invoked `implementation-planner`.

Required sequence: workflow foundation → approved specification → separately invoked implementation planner → AC-linked plan → cross-model plan review → commit specification and reviewed plan → manually invoked execution-only `run-plan` → Project Context Folder → PR Brief → Onboarding Generator → architecture review, fixes and documentation → final read-only `plan-verifier` → manually invoked retrospective and delivery evidence. An early verifier checkpoint is optional and does not replace final verification. Stage commits must remain traceable. Approval of this specification is not approval of a future plan.

The planner asks once whether execution should use a single agent or multiple agents and resolves technical ambiguities; it does not create or edit the specification. `run-plan` does not invoke specification creation or planning. For this slice, the implementer writes AC-derived tests; a dedicated test-writer phase is skipped, not validation. Architecture reviewer and final verifier use Sonnet in Claude Code. Repository-wide checks are consolidated by the root coordinator rather than repeated independently by each subagent. The user has requested splitting current work where possible; this execution preference is separate from specification approval.

## Consolidated decisions

- Keep document selection manual and repository-scoped; project-document previews are view-only in this slice. No document editor or attachment-versioning feature is added.
- Store attachment paths in metadata. Keep the full actual text sent to the model separately as a run-trace snapshot, not as attachment storage.
- Skip unavailable selected documents and record each reason. Reuse existing skill `agent_count` for agents-per-skill usage instead of adding another counter.
- Show document token totals, not “chunks”; count actual selected document text with injection wrappers. The expandable trace label is literally `project context attached specs` and reveals the full snapshot text actually sent.
- Specification writes are restricted by agent instructions, not a tool hook. The spec creator may use bounded research delegation and read relevant `INSIGHTS.md` files only. Blocking questions come first; nonblocking assumptions or recommendations stay inline.
- Specification and implementation planning remain separate manual stages. Retrospective is manual-only, defaults to current-context evidence, and may use deep disk-log mode when requested; it reports in chat and appends a short ledger entry.

## Clarification record

| Category | Confirmed requirement / inspected evidence | Unresolved decision |
|---|---|---|
| 1. Goals, users, scope | Assignment includes all three product features; Project Context Folder comes first. | Resolved; specification approved. |
| 2. Behavior and interaction | Optional explicit reviewer selection supplies attached context; a safe PR-linked specification is unioned and deduplicated. No selected reviewer does not block generation. | C2 approved; show “Reviewer context not selected.” when absent. |
| 3. Data and provenance | `repoId` plus relative path prevents cross-repository ambiguity; the synced default-branch snapshot remains distinct from PR head. | C4 approved: workspace roots; per-repository overrides deferred. |
| 4. Failure and edge cases | Whole-document dropping preserves complete rules; zero-call skeletons expose unavailable index data; failed regeneration preserves generated cache. | Resolved in approved behavior below. |
| 5. Constraints and budget | Agreed numeric limits bound document reads, attachments and model input while allowing a complete five-section tour. | C7 approved: hard whole-input enforcement and documented tokenizer policy. |
| 6. Verification and delivery | AC → task → test → commit; real cross-model family review; open PR and demo video. | Future plan approval, cross-model provider availability and paid-call budget are not established by specification approval. |

### Approved decisions

These policies are approved requirements, not claims of existing runtime behavior.

- C1 (scope resolved): include all three product features, with Project Context Folder first.
- C2: generation accepts optional explicit reviewer/context selection. Union that reviewer's direct documents and enabled safe skill documents with any explicit safe PR-linked specification, preserving order and deduplicating. Without a selected reviewer, generation still works and explicitly shows “Reviewer context not selected.” Never infer the last reviewer.
- C3: store `repoId` plus normalized relative path. Resolve only selections for the reviewed repository, ordered direct-agent first, then enabled safe skills in configured order; first occurrence wins. Read the synced default-branch managed clone, record actual revision/digests separately from PR head, and prevent cross-repository inclusion.
- C4: configure discovery roots at workspace scope, defaulting to `**/{specs,docs,insights}/**/*.md`, confined to the imported repository; no host paths. Discover nested matching directories. Per-repository overrides are deferred.
- C5: 256 KiB per document, 2,000 discovered documents and 100 attachments per agent/skill. Attached-block budget is 20% of the selected model context window, clamped to 4,000–32,000 tokens, falling back to 16,000 when unknown. Include headings/delimiters in block counts. Drop whole documents from the end until the block fits; do not truncate documents into misleading rule fragments. Show omission reasons and deterministic order.
- C6: without an eligible index, return a deterministic five-section skeleton with accurate limited status and zero model calls. Eligible generation makes one attempt, no retry. On model failure, return truthful fallback status while preserving any previously generated cached tour. Concurrent generation for the same resource returns 409 with a useful message.
- C7: brief full-input cap 8,000 tokens, output allowance 1,500; tour full-input cap 24,000 tokens, output allowance 8,000. The larger tour allowance accommodates five structured sections and reduces JSON truncation risk; it is a cap, not a usage target. Count all assembled messages with the configured tokenizer, identify encoding/estimate status, and fail before the call if mandatory input cannot fit. Initial workflow maximum: two concurrent subagents, focused hermetic checks first, one deterministic e2e smoke per final product journey, expanding on failures; confirm actual available budget before model selection or paid demos.

## Goals and non-goals

Goals: preserve L04 behavior while making reviews aware of selected project rules; provide a cached, grounded PR Brief; provide an evidence-based repository tour; make the development workflow traceable from requirements to commits and measured cost.

Non-goals: automatic PR-to-document selection, arbitrary host-file uploads, a new AST/index pipeline, model-generated code facts, replacing the review grounding gate, changing MCP tool inventory, applying migrations on application boot, implementing later-course eval/memory/multi-agent product scaffolding, or replacing the existing add-repository onboarding screen.

## Evidence and provenance

Inspected guidance: root `README.md` and `TESTING.md`; package `AGENTS.md`/README and architecture, review-flow, prompt, engine, and page documentation; `.claude/agents/spec-creator.md`; current `brief.ts` contract and agent registry. `.claude/rules/README.md` states that rules are currently empty. Read relevant package insights when needed, without loading unrelated insight collections.

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

No live DevDigest MCP state was queried: those tools are not exposed in this Codex session. No paid model call, live review, user budget measurement, or product verification is claimed by this specification.

## Workflow behavior and acceptance criteria

Priorities: P1 = required assignment behavior; P2 = recommended brief evidence/quality; P3 = optional brief enhancements. Workflow and context/onboarding obligations without an explicit assignment tier are treated as required (P1).

| AC-ID | Priority | EARS requirement | Verification evidence |
|---|---|---|---|
| SDD-AC-01 | P1 | WHEN requirements or supplied designs are submitted, `spec-creator` SHALL cover all six clarification categories, analyze missing elements, edge cases, module interactions and UX recommendations, ask blocking questions first, and produce unique EARS AC IDs with unresolved requirements marked `[NEEDS CLARIFICATION]`. | Agent configuration, design analysis, generated spec and approval record. |
| SDD-AC-02 | P1 | WHEN `spec-creator` operates, its prompt SHALL restrict product-system access to read-only DevDigest MCP tools and writes to the required specification file; allow bounded read-only research delegation; select package-local versus top-level cross-module specification placement; and prohibit product, plan and unrelated file changes without adding an enforcement hook. | Agent instructions and observed artifact scope; explicitly a prompt restriction, not a permission guarantee. |
| SDD-AC-03 | P1 | WHEN separately invoked with an approved specification, `implementation-planner` SHALL replace `planner`, ask execution mode once and resolve technical ambiguities, define how/order with an AC-ID for every task, and leave specification files unchanged. | Agent registry/config, mode decision and generated plan. |
| SDD-AC-04 | P1 | WHEN a plan is ready, a reviewer from a different model family SHALL review it before implementation, and the findings and actual model/provider identity SHALL be saved. | Review note; no claim of cross-model review if unavailable. |
| SDD-AC-05 | P2 | BEFORE implementation code begins, the generated approved spec and reviewed plan SHALL be committed. | Git history and approval evidence. |
| SDD-AC-06 | P1 | WHEN manually invoked with an approved plan, execution-only `run-plan` SHALL preserve task/AC scope without invoking spec creation or planning, use implementer-authored AC-derived tests for this slice, and collect architectural review evidence with consolidated required validation. | Stage artifacts, test report and architecture findings; no dedicated test-writer phase required. |
| SDD-AC-07 | P1 | WHEN all implementation, review fixes and documentation finish, the final read-only Sonnet `plan-verifier` SHALL report AC → task → test → commit coverage and every unresolved/cannot-verify item before merge; an optional early checkpoint SHALL not replace this final pass. | Final verifier report in PR; no writes by verifier. |
| SDD-AC-08 | P1 | BEFORE a long workflow or paid demonstration, the operator SHALL record available budget or its unavailability, choose adequate model cost, and set concurrency/validation limits without disabling all validation. | Run preflight note with actual model identities and limits. |
| SDD-AC-09 | P1 | WHEN manually invoked after a pipeline, `workflow-retro` SHALL use current-context evidence by default, optionally inspect disk logs in deep mode, and report parent/nested usage, tokens, cache reads, tool calls, duration and concurrency with concrete improvements in chat. | Retrospective with source coverage and unknown values explicitly identified; no automatic invocation. |
| SDD-AC-10 | P1 | WHEN a retrospective completes, it SHALL append a concise comparable run summary to `docs/retro/ledger.md` without double-counting child usage or inventing unavailable cost. | Ledger entry and calculation/source references from a manually invoked retrospective. |

## Feature 1 — Project Context Folder

### User story and behavior

As a reviewer author, I select repository Markdown rules for an agent or skill, preview them, and see which documents actually reached a review. Selection is manual. Direct-agent selections come first, followed by enabled safe skills in configured order, with first-occurrence deduplication scoped to the reviewed repository.

### Contracts and observable outputs

Discovery exposes repository-relative path and document type (`specs`, `docs`, `insights`, or configured-root type), with search and view-only safe text preview. Metadata stores `repoId` and selected paths, not document bodies; no new attachment-versioning feature is introduced. Existing skill `agent_count` supplies agents-per-skill usage. Runtime trace exposes `specs_read`, included document list, per-document/total token usage including injection wrappers, synced default-branch revision and omission reasons. The expandable `project context attached specs` section shows the full document snapshot text actually sent, stored separately from attachment metadata. Use token totals rather than chunk counts; label estimated versus actual values.

### Failure, security and model budget

Documents are untrusted repository data. Only Markdown under configured repository roots is eligible; reject absolute paths, traversal, unsafe symlink escapes and cross-repository reads. Use existing delimiter escaping and injection guard under `## Project context`; document claims never disable structural safety or grounding. Selection/loading makes no model call. Preserve normal review call strategy; do not promise every review itself uses one call.

Approved C5 caps apply. Retain deterministic ordering/deduplication and whole-document dropping; never truncate an attached rule document. Warn on stale/missing/unsafe selections without pretending they were read. Reading the synced default-branch clone does not imply it matches PR head; trace records actual provenance.

| AC-ID | Priority | EARS requirement | Verification evidence |
|---|---|---|---|
| CTX-AC-01 | P1 | WHEN documents are discovered, the system SHALL recursively list `.md` files matching configurable roots, defaulting to `**/{specs,docs,insights}/**/*.md`. | Nested/default/custom-root discovery tests. |
| CTX-AC-02 | P1 | WHEN an agent Context tab is opened, it SHALL show manual selection checkboxes, paths, types, search and view-only preview without editing repository documents. | Component tests and real UI check. |
| CTX-AC-03 | P1 | WHEN a skill is edited, it SHALL offer a matching Project context to use section and reuse existing `agent_count` for agents-per-skill usage. | Skill interaction, existing-count and persistence test. |
| CTX-AC-04 | P1 | WHEN selections are saved and reloaded, metadata SHALL preserve paths rather than document contents, with approved repository scope and without adding attachment versioning. | API/storage and reload tests; trace snapshots verified separately. |
| CTX-AC-05 | P1 | WHEN a review starts, the server SHALL resolve eligible selected documents from the agent and enabled skills, deduplicate them, and provide guarded untrusted `## Project context` without an extra model call. | Captured prompt, injection/deduplication and model-count tests. |
| CTX-AC-06 | P1 | WHEN document loading finishes, trace SHALL show `specs_read`, included document list, token totals counting actual text and injection wrappers, omissions with reasons, and an expandable `project context attached specs` section containing the full snapshot text actually sent. | Trace contract/persistence/UI and prompt-snapshot parity tests. |
| CTX-AC-07 | P1 | IF a path escapes approved roots, targets another repository, or resolves through an unsafe symlink, THEN content SHALL not be read or previewed. | Permission-boundary tests. |
| CTX-AC-08 | P1 | IF selected documents are unavailable or exceed approved bounds, THEN the review SHALL continue with an explicit partial-context warning and truthful trace. | Missing/oversize/budget boundary tests. |
| CTX-AC-09 | P1 | WHEN a review receives an attached specification forbidding direct `api/` imports of `db/` and a diff violating that rule, it SHALL identify the violation with the specific attached document reference while retaining grounded diff citations. | Deterministic prompt/output seam test plus recorded real-model demonstration; fixture alone is not proof of model compliance. |

## Feature 2 — PR Brief

### User story and behavior

As a reviewer, I open Overview, optionally select reviewer context, generate a brief using eligible attached documents and any explicit safe PR-linked specification, examine summary/risks/priorities beside available Intent/Blast, navigate to a relevant diff file, reload a cached result and explicitly regenerate it. Without a reviewer selection, the brief still generates and shows “Reviewer context not selected.”

### Contracts and provenance

Extend both `PrBrief` copies with `summary` and `review_focus: Array<{file: string; line: number; reason: string}>`. Preserve existing `Risk` shape (`kind`, `title`, `explanation`, `severity`, `file_refs`) and `history`. Make unavailable Intent/Blast distinguishable from healthy empty data. Add observable source availability/degradation and generation provenance without manufacturing an Intent or Blast result.

`GET /pulls/:id/brief` reads cache only; `POST /pulls/:id/brief` generates. Store PR head SHA inside `pr_brief.json`; include approved context identity and actual source revision/digests under C2/C3, including any PR-body Spec reference. A changed head/context identifies stale cache. Never overwrite a valid cache with failed/unvalidated generation or return a result generated for a superseded head as current. Reject concurrent generation for the same PR with an actionable 409 response.

Ground every risk path and focus path against the union of current PR files and available Blast changed-symbol/caller files. Do not infer permitted paths from model text. Focus line numbers must be positive integers; exact line navigation should use existing diff metadata, without feeding hunks to the model. A permitted downstream file absent from the PR diff is not a fabricated path.

### Model input budget and failure behavior

Resolve `resolveFeatureModel(container, workspaceId, 'risk_brief')`; use one `llm.completeStructured({model, schema, schemaName, messages})` attempt producing `{summary, risks: [], review_focus: []}`. No repair model call, retry, Intent generation, document summarization or secondary model call in this operation. Validate the contract and reject invalid references rather than persisting invented paths. Model/provider adapters must not hide additional billable retries.

Approved C7 cap: 8,000 whole-input tokens, separately 1,500 output tokens. Deterministic priority: source status/head/file allowlist and instructions; compact diff statistics/roles and available Intent/Blast; bounded PR/issue text; whole selected documents within remaining budget. Drop whole documents from the tail and report omission reasons. If mandatory input cannot fit, fail before a model call with an actionable message. Raw diff hunks and source code are never included.

Missing Intent/Blast/issue/context is recorded and does not block generation using remaining facts. On model failure, preserve cache and show failure. PR-derived descriptions, issue text, index facts and documents remain delimiter-wrapped untrusted data with the guard preserved. Concurrent regeneration/head-change behavior must not corrupt or mislabel cache.

| AC-ID | Priority | EARS requirement | Verification evidence |
|---|---|---|---|
| BRIEF-AC-01 | P1 | WHEN Overview has no cached brief, it SHALL show a PR Brief section and Generate brief button. | Component test and browser demo. |
| BRIEF-AC-02 | P1 | WHEN generation succeeds, Overview SHALL display summary, Risk areas and ordered Review focus alongside available Intent/Blast and identify missing or degraded sources; IF no reviewer was selected, THEN generation SHALL still work and show “Reviewer context not selected.” | Complete/missing/degraded source and unselected-reviewer tests and demo. |
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

As a developer unfamiliar with an imported open-source repository, I generate a guided tour containing exactly five top-level sections: architecture overview; critical execution paths; local setup instructions; recommended file reading order; suggested first tasks. Preserve `/onboarding` add-repository behavior and expose the repository tour at `/repos/[id]/onboarding`.

Reuse saved `repoIntel.*` facts and ranked files/import graph information; rank reading order using persisted rank/PageRank with available hotness, for example `rank × (1 + hotness)`, with deterministic tie-breaking and truthful indication when hotness is absent. No AST/graph rebuild or fresh ranking model. Setup commands come from available repository documentation/manifests and are suggestions, never executed. Only evidence-backed paths appear; missing setup facts are “unavailable,” not invented commands.

### Contract, input budget and failures

Store five structured sections plus repository/index revision, status, evidence paths, ordered reading path and call/token/cost metadata in existing onboarding JSON storage. Resolve the `onboarding` feature model setting. For a complete eligible index, make one structured narrative model attempt. Validate section count/shape and paths before caching. Without an eligible index, use C6's zero-call deterministic five-section skeleton; on model/validation failure after one attempt, provide a skeleton and truthful failure status while preserving any previously generated tour in cache. Never label fallback as a successful generated narrative. Reject concurrent generation for the repository with an actionable 409 response.

Approved C7 budget: 24,000 whole-input tokens including instructions/delimiters, separate 8,000-token output allowance. Prioritize index status/revision and permitted file references, compact repository map and critical paths, ranked reading files, then bounded setup documentation. Enforce the whole-input cap before calling and fail before the model if essential input cannot fit. Large repositories are bounded using existing ranked index retrieval; no whole-repository prompt or recursive code parsing. Incomplete clone and partial index must remain visible. Record model-reported usage/cost; unknown price remains unknown, not zero. Guard all repo-derived data against injection.

| AC-ID | Priority | EARS requirement | Verification evidence |
|---|---|---|---|
| ONBOARD-AC-01 | P1 | WHEN an eligible repository tour is generated, it SHALL contain exactly the five specified sections and cite evidence-backed repository paths. | Structured-output and grounding tests; unfamiliar-repo demo. |
| ONBOARD-AC-02 | P1 | WHEN facts are assembled, they SHALL come from existing `repoIntel.*` index data and bounded setup evidence without rebuilding AST/import graph. | Adapter seam/no-reindex test and architecture review. |
| ONBOARD-AC-03 | P1 | WHEN reading order is produced, it SHALL use existing graph rank with available hotness and deterministic ordering. | Ranking tests with ties/missing hotness. |
| ONBOARD-AC-04 | P1 | WHEN complete eligible facts are available, generation SHALL make one structured narrative model attempt using the configured onboarding model and record calls/tokens/cost. | Mock call-count test and live cost evidence. |
| ONBOARD-AC-05 | P1 | IF the index/clone is unavailable or incomplete, THEN a deterministic five-section skeleton SHALL identify the actual reason without claiming complete repository knowledge, under approved C6 call policy. | Flag-off/failed/partial/large/no-data fixtures. |
| ONBOARD-AC-06 | P1 | IF the model or output validation fails, THEN the generator SHALL return a truthful deterministic five-section fallback without a second model call and preserve any previously generated cached tour. | Failure/invalid-path and failed-regeneration cache tests. |
| ONBOARD-AC-07 | P1 | WHEN a large repository is processed, generation SHALL respect the approved input token cap using bounded persisted facts and disclose omitted evidence. | Large-fact/budget tests. |
| ONBOARD-AC-08 | P1 | WHEN the tour is exposed at `/repos/[id]/onboarding`, the existing add-repository flow SHALL remain functional, the tour SHALL be reloadable with status/provenance, and concurrent generation SHALL return an actionable 409. | Existing-flow regression, concurrency and browser checks. |
| ONBOARD-AC-09 | P1 | WHEN onboarding is delivered, its specification, plan/review, code/tests, architecture review and final AC → task → test → commit report SHALL be separately traceable through stage commits. | Commit history and verifier matrix. |
| ONBOARD-AC-10 | P1 | WHEN onboarding is demonstrated on an unfamiliar open-source repository, the demonstration SHALL show its five sections and actual model-call count/cost, with unknown cost explicitly labeled. | Demo/log links; no fabricated usage. |

## Validation and delivery

This approved specification has **49 acceptance criteria: 36 P1, 7 P2, 6 P3**. A final verifier must reconcile implemented coverage before reporting completion. Optional enhancements do not block delivery; unresolved required criteria do.

Use specification-derived seam tests: prompt-level agent restrictions; document path containment; metadata/prompt/trace parity; brief source assembly, grounding, cache and navigation; tour ranking, structured call count and fallback. The implementer authors these AC-derived tests for this slice. The root coordinator runs affected-package test/typecheck/lint/audit commands from root guidance once after integrating changes, repeating only for new changes or failures. DB-backed tests keep `.it.test.ts`; record skipped Docker tests honestly. Run a real UI check for UI changes and a limited deterministic e2e journey; mocked tests do not establish live model behavior. Specification approval does not establish a paid-generation budget.

Final specification self-check: all six clarification categories are covered; goals/non-goals, contracts and user flows are explicit; relevant module interactions and supplied-design gaps are identified; safety, token budgets and failure NFRs are observable; trace snapshot requirements are testable; every AC has verification evidence. Detailed implementation choices belong in the separate plan. Approval is based on the user's current-session “yes,” not pasted historical approvals.

Required PR evidence: approved agent-generated dated English specification (`2026-10-22-l05-context-brief-onboarding.md`) and its separately generated AC-linked implementation plan committed before product code; actual cross-family review note; stage contributions; tests and audits with pre-existing vulnerabilities distinguished; final read-only verifier report; retrospective/ledger with honest metrics coverage; open PR implementation description; linked 1–3 minute PR Brief video. Video shows generate → summary/risks/focus and available/missing sources → diff navigation → reload without new call → refresh → spec/plan/verifier. Explain that precomputed facts keep source grounding and budgets controlled without sending raw diff hunks or rebuilding index facts. Context rule-violation and unfamiliar-repo tour demonstrations may be separate clips, with actual call/cost evidence.

## Approval and next-stage boundaries

C2, C4 and C7 are closed by the user's explicit approval on 2026-10-22. No product clarification remains outstanding. The implementation planner may now create the separate AC-linked plan.

The retrospective ledger is `docs/retro/ledger.md`. Add no entry until the retrospective is manually invoked and actual run evidence is available.

Future implementation-plan approval, paid-call budget and cross-model availability remain separate execution requirements; none is granted or claimed by this specification approval.
