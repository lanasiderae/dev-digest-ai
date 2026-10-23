## Development Plan: L05 Project Context, PR Brief and Onboarding

### Scope

**Status: AWAITING CROSS-MODEL REVIEW AND MANUAL PLAN APPROVAL.** Implement the approved [specification](../../../specs/2026-10-22-l05-context-brief-onboarding.md), committed at `062ae53`, in stages: confirm SDD foundation → Project Context → PR Brief → Onboarding → review/fixes → delivery evidence → final verifier. No product code begins before reviewed-plan approval and commit. Specification approval is distinct from plan approval and paid-demo authorization.

The user selected multi-agent execution. Maximum two concurrent worker subagents. Workers own disjoint paths; contracts, schema, migrations and module/container registration have one owner. Dedicated test-writer is skipped; implementers write focused AC-derived tests. Existing workflow setup is evidence to verify, not work to repeat.

### Modules affected

- **server:** safe project-document discovery/metadata, review prompt/trace, brief/tour generation and persistence, narrow persisted-index reads, tokenizer metadata and scoped provider retries.
- **client:** agent/skill context selection, trace snapshot inspection, brief/navigation, repository tour and workspace discovery settings.
- **reviewer-core:** reuse pure `specs[]`, untrusted renderer and guard; add only compatible pure rendering/counting seams where needed.
- **e2e:** deterministic context, cached brief/navigation and tour journeys; never paid generation.
- **Root workflow/docs:** reviewed plan, preflight, evidence, architecture review and final verifier report.
- **mcp-server:** no product changes; existing five-tool inventory remains unchanged.

### Architectural constraints

- `server/AGENTS.md`, `server/docs/architecture.md`: static plugins; route → service → repository; adapters behind container; schema-first request/response validation. SQL belongs in repositories.
- `server/specs/review-flow.md`, `server/INSIGHTS.md`: preserve run persistence order and `RunLogger` signature. Existing server tests live under `server/test/`; DB tests require `.it.test.ts`.
- Generate schema migration with `pnpm db:generate`, apply manually with `pnpm db:migrate`; never migrate on application boot or CI boot. Do not edit managed clone contents or destroy dev volumes.
- `client/AGENTS.md`, `client/docs/ui-architecture.md`: hooks over `api.ts`, thin pages, colocated PascalCase component folders/barrel/styles/tests, English message keys.
- Both vendored contract copies change together under one owner. Avoid unrelated drift repairs.
- `reviewer-core/AGENTS.md`, `reviewer-core/specs/review-engine.md`: no filesystem/database I/O; preserve grounding and injection guard.
- `repo-intel/README.md`: consume persisted index only; new callers must not invoke legacy missing-index code-scanning fallback.
- Current tokenizer exposes only `count(text)`, uses `cl100k_base`, silently falls back to a heuristic. Add estimate/encoding metadata; separate estimated input from provider-reported usage.
- Reuse existing `pr_brief` and `onboarding` JSON tables. Metadata columns need a generated migration; attachment bodies belong only in separate run snapshots.
- Skill routing comes from `.claude/skills/pr-self-review/SKILL.md`. Use the user-authorized `l04/mcp` baseline when reviewing changes.

### Steps

1. **TASK-01 [SDD-AC-01–10, BRIEF-AC-07/14/20, ONBOARD-AC-09] — Gate, reviewed artifacts and ownership.** Owner: coordinator. Dependencies: none. Files: existing `.claude/agents/*`, run-plan/workflow-retro skills, `docs/sdd-workflow.md`, approved specification; `docs/sdd/l05/{plan.md,plan-review.md,preflight.md,continuation-prompt.md}`. Confirm existing workflow behavior and tests; record actual quota or unavailable, actual model identities and concurrency. Obtain different-family plan review and record findings/provider/model; do not claim same-family review qualifies. Revise plan, obtain distinct manual approval, then commit reviewed plan before product code. Keep Codex co-author trailers. Governing: workflow role boundaries/root instructions. Evidence: review/approval and pre-code SHAs. Retrospective remains manually invoked, not an automatic tail.

2. **TASK-02 [CTX-AC-01/04/06–08, BRIEF-AC-02/03/09–12, ONBOARD-AC-01/04–08] — Contract/storage freeze.** Owner: backend worker, sole contract/schema owner. Dependencies: 01. Files: both vendored `contracts/{brief,trace}.ts`, existing agent/skill/settings contracts and exports; new mirrored `project-context.ts`, `onboarding.ts`; `server/src/db/schema/{agents,skills}.ts`, generated migrations. Define ordered `ProjectContextSelection {repo_id, paths}`, discovery/preview, omission reasons, snapshot and token metadata. Add default-empty metadata storing paths only, maximum 100 attachments per agent/skill; preserve existing configuration version semantics without new attachment versions. Workspace settings own `project_context.roots`. Extend PrBrief summary/focus, positive lines, nullable Intent/Blast, existing Risks/history, explicit source states and generation provenance. Cache envelope stores head SHA/context fingerprint/stale reasons. Tour has exactly five keyed sections, evidence references, reading order, status/reason, omissions, attempts/tokens/cost. Required nullable values distinguish unavailable data. Governing: zod, drizzle-orm-patterns, postgresql-table-design, typescript-expert. Evidence: parity/compatibility tests and generated migration review.

3. **TASK-03 [CTX-AC-01/04/07/08, BRIEF-AC-02/12] — Safe discovery/resolution.** Owner: backend. Dependencies: 02. Files: new `server/src/modules/project-context/{routes,service,helpers,constants}.ts`, registration/container, settings service/repository, `server/test/project-context-*.test.ts`. Propose `GET /repos/:id/project-context?search=...` → bounded path/type/size/token estimates/revision/truncation; `GET /repos/:id/project-context/document?path=...` → view-only text/provenance. Existing settings endpoint owns workspace roots. Check workspace repository ownership before clone access; default nested glob `**/{specs,docs,insights}/**/*.md`; no host paths. Reject traversal/absolute paths/symlinks and bound enumeration/read size. Prefer a narrow container-injected Git tree/blob reader pinned to a resolved clone commit: validate tree entry modes and reject symlink entries, then read bounded blobs by object ID without filesystem path traversal. This avoids parent-directory TOCTOU; final-file O_NOFOLLOW alone is insufficient. An alternative filesystem implementation must prove equivalent ancestor containment and race safety. Record the pinned revision, distinct from PR head. Enforce 256 KiB/document, 2,000 results, deterministic order. Shared resolver unions direct-agent then enabled safe skills in order, deduplicates first occurrence, excludes other repositories. Explicit PR-linked spec must be eligible same-repository path/source URL; never arbitrary URL fetch. Governing: onion-architecture, fastify-best-practices, security, zod. Evidence: nested/custom roots, foreign workspace/repo, traversal/symlink/race, missing/oversize/truncation and ordered-union tests.

4. **TASK-04 [CTX-AC-04/05/08, BRIEF-AC-09/10, ONBOARD-AC-04/07] — CRUD, tokenizer policy and one-attempt controls.** Owner: backend. Dependencies: 02/03. Files: existing agent/skill services/repositories/helpers; tokenizer adapter, OpenAI/Anthropic/OpenRouter adapters, relevant shared LLM definitions, focused server tests. Thread selections through CRUD and ownership validation. Expose encoding/heuristic estimate metadata compatibly with `count()`. Count complete assembled messages including escaped wrappers/headings and documented overhead. Use model metadata for context capacity, approved 16,000 fallback when unknown. `StructuredRequest.maxRetries: 0` prevents schema reprompts but not current `withRetry`/SDK transport retries: introduce narrow per-request control disabling both for brief/tour, preserving normal review retry defaults. Preserve available failure usage and label missing usage unknown. Governing: onion-architecture, drizzle-orm-patterns, zod, typescript-expert. Evidence: metadata-only reload, wrapper/fallback count boundaries, one underlying transport attempt on failure and unchanged review retries.

5. **TASK-05 [CTX-AC-02/03/04/08] — Agent/skill selectors.** Owner: frontend. Dependencies: 02; integration waits 03/04. Files: existing AgentEditor, new colocated ContextTab, SkillDetailPanel, shared `client/src/components/project-context/ProjectContextSelector/`, `lib/hooks/project-context.ts`, existing CRUD/settings hooks, settings panel/messages. Show repository selection, checkboxes, path/type, search, plain-text preview, tokens total, limits/omissions. Same selector serves agent Context tab and skill Project context to use. Preserve `agent_count`, save/reload and selections when switching tabs/repositories. Expose workspace roots. Governing: frontend-ui-architecture (two real consumers justify shared component), react-best-practices, next-best-practices, react-testing-library. Evidence: interaction/search/preview/reload/caps/used-by tests.

6. **TASK-06 [CTX-AC-05/06/08/09] — Review context/trace.** Owner: backend for executor/core, frontend for trace UI after handoff. Dependencies: 03/04. Files: reviews/run-executor and pipeline helpers, platform/trace-builder, pure reviewer-core prompt/types only if needed, RunTraceDrawer prompt components. Resolve once per agent; context budget 20% model window clamped 4,000–32,000 or 16,000 unknown. Drop complete documents from tail; report every omission. Count via exact shared guarded specs renderer to ensure snapshot parity. Preserve injection guard, grounding and existing review call strategy. Store `specs_read`, included path/digest/revision/token information and actual sent text separately from metadata; failed/cancelled traces retain known context truthfully. Expandable label literally `project context attached specs`. Governing: onion-architecture, zod, core purity/guard rules and frontend skills. Evidence: no extra model call, hostile delimiters, safe skills, prompt/snapshot parity and missing/oversize/budget tests; rule-violation seam plus later real-model evidence.

7. **TASK-07 [BRIEF-AC-02/04/09/10/12, ONBOARD-AC-02/03/05/07] — Persisted facts/rank.** Owner: backend. Dependencies: 02; Context backend must stabilize first. Files: repo-intel/{service,repository,types}.ts, narrow blast service/helpers if necessary, focused server tests. Add bounded persisted-only facade retrieval, preserving eligibility/degradation reasons without refresh, AST or fallback scanning. Reuse blast grouping/limits. Existing `getTopFilesByRank()` returns paths and `getFileRank()` returns percentiles: expose narrow raw stored rank/hotness facade API rather than pretending these signatures provide them. Sort `rank × (1 + hotness)`, path tie-break; disclose absent hotness. Reuse persisted map/critical paths only on eligible index. Governing: onion-architecture, drizzle-orm-patterns. Evidence: no parser/refresh invocation, incomplete states, bounded DB reads, tie/missing-hotness tests.

8. **TASK-08 [BRIEF-AC-01–04/06/09–12] — Brief backend.** Owner: backend. Dependencies: 03/04/06/07; Context stage checks pass first. Files: new brief/{routes,service,repository,helpers,constants}.ts, registration/container, new brief system prompt, `server/test/brief-*.test.ts`, `brief.it.test.ts`. Propose GET `/pulls/:id/brief?agent_id=...` → `{brief:null|PrBrief, stale, stale_reasons}` with no generation; POST same path body `{agent_id?:uuid}` generates/regenerates. Optional reviewer stays workspace-scoped; never infer last reviewer. GET without agent_id hydrates the cached generation’s explicit reviewer identity by default, so selected-reviewer reload remains valid; an explicit selection query compares that identity. Persist selector identity in URL/cache provenance. POST accepts agent_id:null for an explicitly reviewer-free regeneration, retains the required no-reviewer label, and never silently substitutes another reviewer. Assemble saved Intent via reviewRepo.getIntent, persisted Blast summary/permitted paths, PR files/statistics, Smart Diff roles, description/issue and eligible documents. Explicitly identify missing/degraded/no-reviewer context. Preserve history without another narrative call. Resolve risk_brief dynamically; one structured/transport attempt, 1,500 output cap, whole input ≤8,000. Order mandatory instructions/status/head/allowlist → compact facts → bounded PR/issue → whole documents. Never include hunks/source code; guard all repo-derived data. Validate risk/focus paths against PR union available Blast changed-symbol/caller paths; nonempty risk refs and positive lines. Reject invalid results before saving. Fingerprint reviewer/safe-skill selections/order, PR-linked spec and actual document revision/digests. GET computes staleness without model calls; recheck head/context before persistence and reject superseded generation. Use a nonblocking DB-backed resource lock (e.g. dedicated connection advisory lock released in finally) so cross-process duplicate generation returns actionable 409; do not keep a general transaction open through the model call. Preserve old cache on every failure. Governing: onion-architecture, fastify-best-practices, drizzle-orm-patterns, security, zod, prompt guidance. Evidence: no-agent/missing-source, selected-reviewer cache reload without model call, explicit null reviewer regeneration, one-attempt/budget/no-hunks, invalid-path/cache preservation, head/context races, concurrent 409 and real DB round trip.

9. **TASK-09 [BRIEF-AC-01–03/05/06/12/13/15–19] — Brief UI/navigation.** Owner: frontend. Dependencies: 02/08; Context UI complete first. Files: OverviewTab/new PrBriefCard, `lib/hooks/brief.ts`, PR page/DiffTab/DiffViewer, `messages/en/brief.json`. Render Generate, optional reviewer, cached/stale, refresh, skeleton, summary, expandable risks/focus. Reuse Intent/Blast and real VerdictBanner values. Missing/degraded/no-reviewer labels explicit; failed regeneration retains cache. Navigate `?tab=diff&file=<encoded>&line=<positive>`, preserve other query parameters, select/expand target and scroll after rendering to stable side-aware line anchor. Hunks are local navigation metadata only. Downstream-only paths say File not in this PR’s diff; unavailable exact lines are explained rather than silently targeting another line. Risk links reuse navigation. Governing: frontend-ui-architecture, react-best-practices, next-best-practices, react-testing-library, security. Evidence: state/render/encoded-path tests and exact-line browser journey.

10. **TASK-10 [ONBOARD-AC-01–08] — Tour backend.** Owner: backend. Dependencies: 04/07/08 stable conventions. Files: new onboarding/{routes,service,repository,helpers,constants}.ts, existing onboarding.system.md, registration/container, `server/test/onboarding-*.test.ts`, `onboarding.it.test.ts`. GET `/repos/:id/onboarding` reads cache; POST generates `{tour,cached_tour_preserved}` with explicit fallback reason. Existing JSON table, workspace ownership, cross-process nonblocking repo lock and revision recheck. Collect bounded persisted map/critical paths/ranked files plus safe setup docs/manifests; reuse safe clone reader with dedicated setup-evidence allowlist, not context roots that exclude README/package files. Never execute setup commands. Eligible complete index: one configured onboarding structured attempt, ≤24,000 input/8,000 output. Mandatory overflow fails before call. Validate five sections and structured paths, rejecting narrative path claims that bypass evidence validation. Ineligible index: zero-call truthful five-section skeleton. Model/schema/grounding failure: one-attempt fallback, preserve previous generated cache, unknown usage/cost honestly. Governing: backend skills from 08 and prompt guidance. Evidence: five-section/grounding, unavailable setup, complete/partial/failed/large index, zero/one attempts, unknown cost, failed regeneration/revision races and DB persistence.

11. **TASK-11 [ONBOARD-AC-01/05/06/08] — Tour UI.** Owner: frontend. Dependencies: 02/10. Files: `client/src/app/repos/[repoId]/onboarding/page.tsx`, colocated OnboardingTour, `lib/hooks/onboarding.ts`, repository navigation/messages. Render generate/refresh, five sections, links/reading order, status/revision, omissions/calls/tokens/cost and cache-preserved fallback. Accessible repo entry; existing `/onboarding` add-repository screen unchanged. Governing: frontend skills from 09. Evidence: generated/fallback/loading/error/cache tests and existing add-repo regression.

12. **TASK-12 [CTX-AC-02–06/09, BRIEF-AC-01–06/13, ONBOARD-AC-01/08] — Deterministic smoke fixtures.** Owner: coordinator or one integration worker. Dependencies: 06/09/11. Files: hermetic seed setup, new e2e flow JSONs (read existing flows first). Seed context metadata, cached brief/tour and trace snapshots without touching real imported data. One journey each: select/preview/reload/trace; cached brief/exact-line/reload; cached/fallback tour with add-repo preserved. Service seam tests verify generation; hermetic flows do not click paid generation. Governing: e2e/AGENTS.md, deterministic locators/no AI chat. Evidence: hermetic artifacts and manual visual checks.

13. **TASK-13 [SDD-AC-06, CTX-AC-01–09, BRIEF-AC-01–06/09–19, ONBOARD-AC-01–09] — Review/fix/check/docs.** Owner: coordinator; Sonnet architecture reviewer where available. Dependencies: 12. Files: touched sources/tests, docs/sdd/l05/{architecture-review.md,validation.md}, relevant package INSIGHTS via engineering-insights. Review layering, clone races, exact snapshots, attempts/budgets, grounding, cache concurrency and persisted-only facts; fix findings. Root runs touched-package checks once after stabilization, repeats only for changes/failures. Report audits/Docker skips honestly. Apply live pre-PR dispatch against authorized baseline and resolve blocking findings. Record reusable non-obvious insights. Governing: architecture skills, pr-self-review, engineering-insights. Evidence: findings/dispositions, validation and AC-linked stage commits.

14. **TASK-14 [SDD-AC-08, CTX-AC-09, BRIEF-AC-07–09/14, ONBOARD-AC-04/09/10] — Delivery evidence before final verification.** Owner: coordinator/user. Dependencies: 13; paid calls need actual budget authorization. Files: docs/sdd/l05/demo.md, actual media/log links and draft/open PR description. Demonstrate real attached-rule violation with grounded doc citation; unfamiliar repo five-section tour and actual call/cost; 1–3 minute brief video covering generate, risks/focus, diff line, reload without call, refresh and spec/plan. A preliminary verifier may supply the report shown in video; explicitly label it preliminary. Save all available live/video/PR evidence before final pass. Missing budget/video is reported incomplete, not assumed satisfied. PR names actual contributions/reviewer findings and preserves implementation detail. Governing: authorization/pre-PR gate. Evidence: accessible video/open-PR/log links. Do not merge or claim all required criteria complete while evidence is unavailable.

15. **TASK-15 [SDD-AC-07, BRIEF-AC-07/14, ONBOARD-AC-09] — Final read-only verifier.** Owner: Sonnet plan-verifier; coordinator persists returned report. Dependencies: all available implementation, fixes/docs, validation and TASK-14 evidence. Files: docs/sdd/l05/verification.md and PR link. Verify every AC → task → actual test/manual evidence → commit; distinguish optional deferred, conditional not-triggered, unavailable evidence and unresolved required items. Verifier writes nothing. If later fixes/media/PR evidence materially change coverage, refresh final verification. Missing required evidence prevents a completion claim, not an honest partial report. Record actual model availability. Governing: verifier read-only rules. Evidence: actual SHA matrix and explicit readiness verdict.

16. **TASK-16 [SDD-AC-09/10, BRIEF-AC-20] — Independent manually invoked retrospective.** Owner: coordinator, only after explicit manual invocation. Dependencies: completed pipeline/current available evidence; never automatically invoked by run-plan. Files: docs/retro/ledger.md and report link. Use current context by default or requested deep logs; include nested subagents without double-counting, actual tokens/cache/tools/duration/concurrency and unknown cost coverage. Recommend concrete changes and append comparable ledger entry. If not invoked, report conditional not-triggered, not falsely passed; optional PR cost report stays deferred. If invoked later, update evidence/final verifier as necessary. Governing: workflow-retro manual-only instructions.

### Skills the implementer will invoke

- onion-architecture: inward server layering, services orchestrate adapters, repositories own SQL.
- fastify-best-practices: validated routes/plugins/errors and inject tests.
- drizzle-orm-patterns/postgresql-table-design: generated migration, bounded queries and safe locks/cache writes.
- zod: mirrored boundary/model/cache schemas and inferred types.
- security: workspace authorization, paths/symlinks/races, safe preview and guarded facts.
- typescript-expert: cross-package tokenizer/provider/contract compatibility.
- frontend-ui-architecture/react-best-practices/next-best-practices: colocated components, thin pages, query ownership/navigation.
- react-testing-library: user-facing behavior tests.
- engineering-insights: related reusable findings after validation.
- pr-self-review: final live skill dispatch; this list does not replace its routing table.
- run-plan: execution only after committed approved plan; workflow-retro remains manual-only.

### Verification scope

Dependency/ownership order: approved artifacts → backend contracts/storage → backend Context API and frontend selectors in parallel → review/trace integration → Context checkpoint → backend brief and frontend brief handoff → backend tour and frontend tour handoff → integration/review/checks/docs → manual evidence → final verifier. At most two active workers; shared plumbing/fixtures have one owner.

Workers run focused named Vitest files only. Coordinator runs once after stabilization (separate audit results so a failing audit cannot hide subsequent checks):

```sh
cd server && pnpm exec vitest run --exclude '**/*.it.test.ts' && pnpm typecheck && pnpm lint && pnpm audit
cd client && pnpm test && pnpm typecheck && pnpm lint && pnpm audit
cd reviewer-core && npm test && npm run typecheck && npm run lint && npm audit
cd e2e && npm run typecheck && npm run lint && npm audit
```

Run actual new DB `.it.test.ts` paths with `pnpm exec vitest run <paths>` when Docker is available; record executed versus skipped. Run `./scripts/e2e.sh` for hermetic smoke evidence and real manual UI checks. Do not invent scripts or run unaffected mcp-server suites. Expand/repeat only for fixes/failures/unresolved risk. Mock evidence establishes orchestration, not real model compliance/cost. Budget, usage and prices unknown remain unknown.

### Explicitly out of scope

Automatic document selection, filesystem editing UI, attachment versioning, repository-specific discovery overrides, new AST/index pipelines, MCP inventory changes, broad review retry redesign, unrelated dependency upgrades and later-course scaffolding. Optional brief enhancements are included where supported: real verdict, risk expansion/navigation, downstream explanation, skeleton and translations. Retrospective/cost report only on manual invocation. No merge/completion claim before required delivery evidence.

### Traceability

| AC-ID | Task ID | Planned test/evidence |
|---|---|---|
| SDD-AC-01 | 01 | Existing agent, six categories, generated approved spec |
| SDD-AC-02 | 01 | Read-only MCP/prompt write restriction and artifact scope |
| SDD-AC-03 | 01 | Renamed planner, generated plan and multi-agent choice |
| SDD-AC-04 | 01 | Actual cross-family identity/findings |
| SDD-AC-05 | 01 | Reviewed spec/plan commit before product code |
| SDD-AC-06 | 01,13 | Execution-only run-plan, AC tests/review/checks |
| SDD-AC-07 | 15 | Final read-only matrix after available evidence |
| SDD-AC-08 | 01,14 | Budget/model/concurrency and paid-demo preflight |
| SDD-AC-09 | 16 | Manually invoked retro; otherwise conditional not-triggered |
| SDD-AC-10 | 16 | Ledger/nested-cost accounting; conditional on invocation |
| CTX-AC-01 | 02,03 | Nested/custom bounded discovery |
| CTX-AC-02 | 05,12 | Agent select/search/preview UI/browser |
| CTX-AC-03 | 05,12 | Skill selection and existing agent_count |
| CTX-AC-04 | 02,04,05 | Metadata-only repository-scoped reload |
| CTX-AC-05 | 03,04,06 | Ordered union, guard, no extra call |
| CTX-AC-06 | 02,06,12 | specs_read/full snapshot/tokens/omissions/trace |
| CTX-AC-07 | 03 | Traversal/symlink/race/foreign workspace denial |
| CTX-AC-08 | 03,04,06 | Missing/oversize/count/budget partial warnings |
| CTX-AC-09 | 06,14 | Seam plus actual grounded rule-violation demo |
| BRIEF-AC-01 | 08,09,12 | Empty-cache Generate |
| BRIEF-AC-02 | 08,09 | Complete/missing/degraded/no-reviewer states |
| BRIEF-AC-03 | 02,09 | Risk refs/focus line/reason contracts/render |
| BRIEF-AC-04 | 08 | PR/Blast-union rejection/cache preservation |
| BRIEF-AC-05 | 09,12 | Encoded Files changed navigation |
| BRIEF-AC-06 | 08,09,12 | GET/reload zero calls; refresh persists |
| BRIEF-AC-07 | 01,14,15 | Generated spec/plan in open PR |
| BRIEF-AC-08 | 14,15 | Actual open PR/1–3 minute video |
| BRIEF-AC-09 | 04,08,14 | Dynamic model, one transport attempt/live usage |
| BRIEF-AC-10 | 04,08 | Full-message token cap/no hunks |
| BRIEF-AC-11 | 02,08 | Vendored parity/output/cache validation |
| BRIEF-AC-12 | 03,08,09 | Head/context stale/race tests |
| BRIEF-AC-13 | 09,12 | Exact-line browser anchor |
| BRIEF-AC-14 | 01,14,15 | Cross-model review and truthful final required closure |
| BRIEF-AC-15 | 09 | Real verdict/score and unreviewed state |
| BRIEF-AC-16 | 09 | Risk expansion/path navigation |
| BRIEF-AC-17 | 09 | Downstream-only unavailable-diff label |
| BRIEF-AC-18 | 09 | Pending skeleton |
| BRIEF-AC-19 | 09 | brief.json translations |
| BRIEF-AC-20 | 16 | Conditional manual retro, actual coverage/cost |
| ONBOARD-AC-01 | 02,10,11,14 | Five grounded sections/unfamiliar repo demo |
| ONBOARD-AC-02 | 07,10 | Persisted-only/no reindex seam |
| ONBOARD-AC-03 | 07,10 | Raw rank/hotness, ties/missing hotness |
| ONBOARD-AC-04 | 04,10,14 | Configured single attempt/actual or unknown usage |
| ONBOARD-AC-05 | 07,10,11 | Zero-call reasoned incomplete skeleton |
| ONBOARD-AC-06 | 10,11 | Model/validation fallback preserves cache |
| ONBOARD-AC-07 | 04,07,10 | Bounded facts/full input/omissions |
| ONBOARD-AC-08 | 10,11,12 | Reload/409/add-repo regression |
| ONBOARD-AC-09 | 01,13–15 | Stage commits/final actual evidence matrix |
| ONBOARD-AC-10 | 14,15 | Unfamiliar repo actual calls/cost demo |

### Specification blockers

None. Remaining execution gates: real cross-family review, separate manual reviewed-plan approval, pre-code artifact commit, actual paid-call budget/authorization, required final reviewer availability and real demo/video evidence. Conditional retrospective and optional deferrals are reported separately, never as proof all 49 criteria passed.
