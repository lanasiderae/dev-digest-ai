# Plan verification: L05 Project Context, PR Brief and Onboarding

## Inputs

Approved specification: `specs/2026-10-22-l05-context-brief-onboarding.md`; plan: `docs/sdd/l05/plan.md`; diff: `l04/mcp..32f014d416c2fd493098cc349df064d1477d89cd`. Reviewed the task-12 validation, architecture review, plan review, commit history, tests and recorded command output. Worktree was clean at the reviewed commit.

## Acceptance traceability

| AC | Task | Evidence and status |
|---|---:|---|
| SDD-AC-01 | 01 | Agent/spec artifacts exist; six categories and EARS criteria in approved spec. **DONE** |
| SDD-AC-02 | 01 | Prompt-level MCP/write limits in `spec-creator.md`; scoped artifacts. **DONE** |
| SDD-AC-03 | 01 | Renamed planner, registry and AC-linked plan. **DONE** |
| SDD-AC-04 | 01 | `plan-review.md` and receipt record cross-family reviewer/findings before implementation. **DONE** |
| SDD-AC-05 | 01 | Spec and reviewed plan commits precede product code. **DONE** |
| SDD-AC-06 | 01,13 | Execution-only `run-plan` and AC-derived tests exist; consolidated validations recorded. **DONE** |
| SDD-AC-07 | 15 | Required final verifier is Sonnet and final report in PR; this audit is Codex, with no final report persisted at review time. **PARTIAL** |
| SDD-AC-08 | 01,14 | Preflight records budget unavailability and model/validation limits; paid demo preflight not evidenced. **PARTIAL** |
| SDD-AC-09 | 16 | Manual retrospective not run. **CANNOT VERIFY** |
| SDD-AC-10 | 16 | No manual retrospective or ledger entry. **CANNOT VERIFY** |
| CTX-AC-01 | 02,03 | Nested/default/custom discovery tests: `server/test/project-context-helpers.test.ts:16-61`. **DONE** |
| CTX-AC-02 | 05,12 | Context tab/component tests and smoke flow exist; actual UI check not evidenced. **PARTIAL** |
| CTX-AC-03 | 05,12 | Skill context UI and persistence/count tests exist. **DONE** |
| CTX-AC-04 | 02–05 | Metadata-only storage/reload and repository scope tests exist. **DONE** |
| CTX-AC-05 | 03,04,06 | Ordered union, deduplication, guard and no-extra-call tests: `review-executor-project-context.test.ts:138`. **DONE** |
| CTX-AC-06 | 02,06,12 | Trace snapshot/prompt parity test: `review-executor-project-context.test.ts:272`; UI tests exist. **DONE** |
| CTX-AC-07 | 03 | Absolute/traversal/cross-repository path and symlink safeguards/tests exist. **DONE** |
| CTX-AC-08 | 03–06 | Missing/oversize/whole-document budget tests: `review-executor-project-context.test.ts:202-233`. **DONE** |
| CTX-AC-09 | 06,14 | Deterministic seam exists; required real-model rule-violation demonstration absent. **PARTIAL** |
| BRIEF-AC-01 | 08,09,12 | Empty-cache Generate test: `PrBriefCard.test.tsx:122`; smoke flow covers cached state. **DONE** |
| BRIEF-AC-02 | 08,09 | Mocked success/missing-source UI tests exist; live generation failed schema validation. **PARTIAL** |
| BRIEF-AC-03 | 02,08,09 | Risk/focus contract and render tests exist: `PrBriefCard.test.tsx:177`. **DONE** |
| BRIEF-AC-04 | 08 | Grounding rejection and cache preservation: `brief-generate.test.ts:239`. **DONE** |
| BRIEF-AC-05 | 09,12 | File navigation test and deterministic browser flow exist. **DONE** |
| BRIEF-AC-06 | 08,09,12 | Cache reload/zero calls/refresh tests: `brief-read.test.ts:99-115`, `PrBriefCard.test.tsx:207`. **DONE** |
| BRIEF-AC-07 | 01,14,15 | Spec and plan are present in the open PR. **DONE** |
| BRIEF-AC-08 | 14,15 | PR description exists; required 1–3 minute demo video is absent. **PARTIAL** |
| BRIEF-AC-09 | 04,08,14 | One-call/dynamic model tests exist (`brief-generate.test.ts:204`); successful live usage/log evidence absent. **PARTIAL** |
| BRIEF-AC-10 | 04,08 | Budget/no-raw-hunks tests: `brief-generate.test.ts:204-221`. **DONE** |
| BRIEF-AC-11 | 02,08 | Vendored contract parity and validation tests exist. **DONE** |
| BRIEF-AC-12 | 03,08,09 | Head/context stale and race tests: `brief-generate.test.ts:282`. **DONE** |
| BRIEF-AC-13 | 09,12 | URL/file/line query tests exist; exact rendered viewport scroll was not manually verified. **PARTIAL** |
| BRIEF-AC-14 | 01,14,15 | Cross-model plan review is documented; required final Sonnet verifier report absent. **PARTIAL** |
| BRIEF-AC-15 | 09 | Verdict banner uses actual available review data; UI tests cover reviewed/unreviewed state. **DONE** |
| BRIEF-AC-16 | 09 | Risk expansion/path navigation test: `PrBriefCard.test.tsx:177`. **DONE** |
| BRIEF-AC-17 | 09 | Downstream-only “not in diff” behavior tested at `PrBriefCard.test.tsx:177`. **DONE** |
| BRIEF-AC-18 | 09 | Pending skeleton test at `PrBriefCard.test.tsx:122`. **DONE** |
| BRIEF-AC-19 | 09 | Brief translation keys are used; translation file is present. **DONE** |
| BRIEF-AC-20 | 16 | Retrospective is conditional and was not manually invoked. **CANNOT VERIFY** |
| ONBOARD-AC-01 | 02,10,11,14 | Five-section generation/UI tests exist; unfamiliar-repo live demo absent. **PARTIAL** |
| ONBOARD-AC-02 | 07,10 | Persisted repo-intel facts used; no reindex path in tour generation. **DONE** |
| ONBOARD-AC-03 | 07,10 | Rank/hotness and tie/missing-data tests exist. **DONE** |
| ONBOARD-AC-04 | 04,10,14 | One-attempt mock test: `onboarding-tour-generate.test.ts:240`; live usage/cost unverified. **PARTIAL** |
| ONBOARD-AC-05 | 07,10 | Incomplete-index zero-call skeleton tests: `onboarding-tour-generate.test.ts:189`. **DONE** |
| ONBOARD-AC-06 | 10,11 | Failure fallback/cache-preservation tests: `onboarding-tour-generate.test.ts:267-307`. **DONE** |
| ONBOARD-AC-07 | 04,07,10 | Budget/omission tests: `onboarding-tour-generate.test.ts:319`. **DONE** |
| ONBOARD-AC-08 | 10–12 | Cache/reload/concurrency and existing add-repo smoke coverage recorded. **DONE** |
| ONBOARD-AC-09 | 01,13–15 | Stage commits exist; final verifier and live delivery evidence remain incomplete. **PARTIAL** |
| ONBOARD-AC-10 | 14,15 | Unfamiliar-repo demonstration and actual calls/cost evidence absent. **CANNOT VERIFY** |

## Plan items

| Step | Status | Evidence |
|---:|---|---|
| 01 | DONE | Agent workflow and SDD artifacts committed. |
| 02 | DONE | Contracts/storage and tests present. |
| 03 | DONE | Project Context backend and tests present. |
| 04 | DONE | Prompt assembly, trace and budget tests present. |
| 05 | PARTIAL | UI/tests exist; real UI check not recorded. |
| 06 | DONE | Trace/prompt parity and integration tests present. |
| 07 | DONE | Repo-intel persisted facts/ranking tests present. |
| 08 | PARTIAL | Backend/tests exist, but actual generation fails schema validation. |
| 09 | PARTIAL | Brief UI/tests exist; live successful generation and exact line scroll unverified. |
| 10 | PARTIAL | Tour backend/tests exist; no live unfamiliar-repository demonstration. |
| 11 | DONE | Tour UI/tests and deterministic flow evidence exist. |
| 12 | DONE | Recorded deterministic browser smoke: 10/10 flows passed. |
| 13 | PARTIAL | Architecture report and package checks exist; live review/generation gaps remain. |
| 14 | PARTIAL | PR is open with description; required video and live demonstrations missing. |
| 15 | PARTIAL | This read-only audit is Codex, not required Sonnet; report not yet in PR. |
| 16 | CANNOT VERIFY | Manual-only retrospective was not invoked. |

## Stated edge cases / requirements

| Requirement | Status | Evidence |
|---|---|---|
| Missing/unsafe project documents are omitted truthfully | DONE | Helper and executor tests above. |
| Whole-document context budget and injection guard | DONE | Executor budget/prompt parity tests above. |
| Missing or degraded brief sources and unselected reviewer | PARTIAL | Mock tests pass; real generation currently fails. |
| Invalid brief paths do not overwrite cache | DONE | `brief-generate.test.ts:239-307`. |
| Brief cache head/context races and concurrent generation | DONE | Brief race/lock tests. |
| Onboarding incomplete index, fallback, budget and cache preservation | DONE | `onboarding-tour-generate.test.ts:189-357`. |
| Manual-only retrospective and ledger behavior | CANNOT VERIFY | No invocation or ledger evidence. |
| Cross-model and final verifier identity requirements | PARTIAL | Cross-family plan review recorded; final required Sonnet pass absent. |

## Changes outside plan scope

At the reviewed commit, the plan did not map these added delivery/support artifacts to a task file list: `docs/sdd/l05/claude-handoff.md`, `docs/sdd/l05/continuation-prompt.md`, `docs/sdd/l05/pr-brief-layout.md`, and `docs/sdd/l05/screenshots/pr-brief-overview.png`. `server/src/modules/reviews/constants.ts` also changes the Intent timeout to 60 seconds; this was a later response to observed timeout, but is not explicitly scoped as a planned change. Other changed paths map to the listed plan steps or are excluded `INSIGHTS.md` files.

## Verification-scope commands

Inspected recorded outputs rather than rerunning suites:

- Server unit lane: **403 tests / 47 files passed**; typecheck/lint passed (11 lint warnings).
- Client: **233 tests / 40 files passed**; typecheck/lint passed (8 lint warnings).
- Reviewer-core at the reviewed commit: **30 tests / 5 files passed**; typecheck/lint passed.
- E2E: **10/10 deterministic flows passed**.
- `git diff --check` passed.
- Server DB integration (`*.it.test.ts`) and reviewer-core audit output were not evidenced. E2E fixture explicitly skips paid brief generation. Recorded dependency audit notes existing server/client vulnerabilities.

## Result

**INCOMPLETE.** Successful real brief generation, required demo video, real context-rule and onboarding demonstrations, final Sonnet verifier report, and manual retrospective evidence are not complete or verified. The documented live PR Brief attempt failed with `OpenRouter structured output failed schema validation for PrBriefGeneration`. Four supplementary paths and the Intent timeout change are outside the plan’s explicit file mapping.

### Verifier identity and report status

This audit was performed by a read-only Codex subagent, not the Sonnet model configured in `.claude/agents/plan-verifier.md`. This report records that limitation and must not be represented as a Sonnet verification.
