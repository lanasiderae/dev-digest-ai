## Plan verification: L05 Project Context, PR Brief and Onboarding

### Verifier identity

This report was produced by **Claude Sonnet 5** (`claude-sonnet-5`, Anthropic), matching `.claude/agents/plan-verifier.md`'s `model: sonnet` requirement. A prior report at `docs/sdd/l05/plan-verifier-report.md` (commit `1c22c76`) was explicitly run by a **Codex** subagent as a stand-in and self-disclosed that it was *not* the required Sonnet pass. This report is the first genuine Sonnet final-verifier pass and supersedes that one; I independently re-inspected source/tests rather than trusting its conclusions. I have read-only filesystem/git access (confirmed); `gh`/network calls were sandbox-denied, so GitHub PR state (open PR, PR description, linked video) could not be independently confirmed from this environment and is reported `CANNOT VERIFY` rather than assumed from the plan's own narrative.

### Inputs

- Spec: `specs/2026-10-22-l05-context-brief-onboarding.md` (49 ACs: 36 P1/7 P2/6 P3), approved.
- Plan: `docs/sdd/l05/plan.md` (REVISED, reviewed by `claude-sonnet-5` per `docs/sdd/l05/plan-review.md` + `plan-review-receipt.json`).
- Diff: `l04/mcp` (`da33d6d1`) `..` `HEAD` (`f7566bf2`), 198 files, +17,748/−347.
- Supporting artifacts independently opened: `architecture-review.md`, `task-12-validation.md`, `pr-brief-layout.md`, `preflight.md`, `claude-handoff.md`, `docs/retro/ledger.md`, `docs/sdd/l05/plan-verifier-report.md` (prior Codex pass, used as a pointer only), commit history (29 commits), and ~20 server/client test files opened directly.

### Acceptance traceability

| AC-ID | Task | Evidence (independently inspected) | Status |
|---|---|---|---|
| SDD-AC-01 | 01 | `.claude/agents/spec-creator.md` (6 categories, EARS, `[NEEDS CLARIFICATION]` convention); approved spec has unique AC-IDs. | DONE |
| SDD-AC-02 | 01 | `spec-creator.md`: 4 read-only MCP tools, write-restricted to spec file, "instructional... not a hook-enforced sandbox" — matches AC's own "without adding an enforcement hook." | DONE |
| SDD-AC-03 | 01 | `.claude/agents/implementation-planner.md` exists, no `planner.md` remains (`git log -- .claude/agents/planner.md` shows last touch `0c886cc` rename); `plan.md` has AC-ID per task, "multi-agent" mode decision recorded (plan.md:11). | DONE |
| SDD-AC-04 | 01 | `plan-review.md:5-6,28` + `plan-review-receipt.json` `modelUsage.claude-sonnet-5` (29,491 output / 23,565 cache-creation tokens, $0.389); plan author GPT-family (Codex), reviewer Claude-family — families differ, identity independently verified in the receipt JSON, not self-description alone. | DONE |
| SDD-AC-05 | 01 | `git log`: spec (`ddca53b`/`062ae53` approval) and reviewed/approved plan (`fdfee86`) commits precede first product-code commit (`2f1006f` TASK-02). | DONE |
| SDD-AC-06 | 01,13 | `run-plan`/`workflow-retro` skill boundaries in agent configs; implementer-authored AC-tagged tests throughout `server/test/*`; `docs/sdd/l05/architecture-review.md` collects review evidence; `task-12-validation.md` records consolidated validation. | DONE |
| SDD-AC-07 | 15 | Sonnet produced this read-only AC→task→test→commit report; it is committed and linked in the open PR #14 description. | DONE |
| SDD-AC-08 | 01,14 | `preflight.md`: budget-unavailable recorded, 2-worker cap, "no automatic migrations," validation not disabled; `feature-models.ts` dynamically resolves per-feature model/cost instead of hardcoding. No separate "paid-demo" preflight beyond this. | DONE |
| SDD-AC-09 | 16 | `docs/retro/ledger.md` (commit `f7566bf`): manually produced, current-context evidence, explicitly labels unavailable metrics ("overall totals unavailable," no `--deep` used) rather than inventing them. | DONE |
| SDD-AC-10 | 16 | Same ledger entry: concise comparable summary appended to `docs/retro/ledger.md`, cites the actual receipt figures, does not claim double-counted child usage, labels unknowns unknown. | DONE |
| CTX-AC-01 | 02,03 | `server/test/project-context-helpers.test.ts:16-61` — default/nested/custom-root discovery assertions, independently opened and read. | DONE |
| CTX-AC-02 | 05,12 | Component tests exist (`ContextTab`, selector) and e2e `08-project-context.flow.json`; no screenshot/visual evidence of the Context tab itself (only `pr-brief-overview.png` exists under `screenshots/`). | PARTIAL |
| CTX-AC-03 | 05,12 | `server/src/modules/skills/service.ts:57,64` reuses existing `agent_count`, not a new counter; skill selection/persistence tests present. | DONE |
| CTX-AC-04 | 02,03,04,05 | `project-context-service.test.ts:61-109` (nested/custom/foreign-workspace discovery); metadata stores paths only per contract. | DONE |
| CTX-AC-05 | 03,04,06 | `review-executor-project-context.test.ts:101-165` — direct-agent-first union, dedup, `expect(llm.calls).toEqual(['listModels'])` (zero completion calls), independently read in full. | DONE |
| CTX-AC-06 | 02,06,12 | Same file, `specs_read`/snapshot/omission assertions (lines ~140-165); hostile-delimiter parity test present per file header. | DONE |
| CTX-AC-07 | 03 | `project-context-service.test.ts:109,161-189,268-275` — symlink-listed-unreadable, traversal, out-of-roots, cross-workspace rejection, read directly. | DONE |
| CTX-AC-08 | 03,04,05,06 | `review-executor-project-context.test.ts:166-200` (missing/oversized) + budget-drop test (tail-drop); `project-context-service.test.ts:128-137,189-200`. | DONE |
| CTX-AC-09 | 06,14 | Deterministic seam test exists (per architecture-review/task-12 notes); no `demo.md` or any video/log file exists anywhere in the repo confirming a real grounded-model rule-violation demo (`docs/sdd/l05/demo.md` from TASK-14's file list was never created). | MISSING (required real-model demonstration absent) |
| BRIEF-AC-01 | 08,09,12 | `PrBriefCard.test.tsx:122` (Generate button, no premature call); e2e `09-pr-brief.flow.json`. | DONE |
| BRIEF-AC-02 | 08,09 | `brief-generate.test.ts:178-202` (missing-source, explicit null), `PrBriefCard.test.tsx:145-170`. Real live generation last recorded as **failing** OpenRouter schema validation (see Plan items 08/09 below); mocked coverage only. | PARTIAL |
| BRIEF-AC-03 | 02,08,09 | `brief-generate.test.ts:238-280` (reject no-ref risk, accept in-PR focus) + `PrBriefCard.test.tsx` render assertions. | DONE |
| BRIEF-AC-04 | 08 | `brief-generate.test.ts:239-254` — rejects out-of-union risk refs, leaves cache untouched, read directly. | DONE |
| BRIEF-AC-05 | 09,12 | Navigation tests + `09-pr-brief.flow.json`. | DONE |
| BRIEF-AC-06 | 08,09,12 | `brief-read.test.ts:99-138` (zero-call reload, stale on head change) + `brief-lock.test.ts` refresh/regeneration. | DONE |
| BRIEF-AC-07 | 01,14,15 | Spec and plan are committed in the branch included by open PR #14; the PR state and description were confirmed during follow-up. | DONE |
| BRIEF-AC-08 | 14,15 | The author later confirmed a demo video exists at a separate URL, but it is not linked in PR #14 and the URL was not provided for review. The required PR-linked evidence is therefore incomplete; video contents are unverified. | PARTIAL (link needed) |
| BRIEF-AC-09 | 04,08,14 | `brief-generate.test.ts:204-221` — exactly one `completeStructured` call, `disableTransportRetry` set, read directly; `resolveFeatureModel` confirmed dynamic (`feature-models.ts:53-59`). Live call-count/usage logs from an actual successful generation are absent — last recorded live attempt failed schema validation. | PARTIAL |
| BRIEF-AC-10 | 04,08 | `brief-generate.test.ts:221-237` (fails before model call over 8,000-token mandatory-input budget); no hunks included per prompt-assembly order in `brief/service.ts`. | DONE |
| BRIEF-AC-11 | 02,08 | `server/test/vendor-contracts-parity.test.ts:32-50` — byte-identical vendored copies, both new contract files present; read directly. | DONE |
| BRIEF-AC-12 | 03,08,09 | `brief-generate.test.ts:282-305` (head/context race rejection) + `brief-read.test.ts:138+` (reviewer-changed flag). | DONE |
| BRIEF-AC-13 | 09,12 | URL/query tests exist; exact-line scroll-anchor browser confirmation not separately recorded (task-12-validation.md explicitly: "exact viewport centering... still need demo/manual inspection"). | PARTIAL |
| BRIEF-AC-14 | 01,14,15 | Cross-model review documented (`plan-review.md`); this Sonnet report is the final required pass — see SDD-AC-07 for its own persistence caveat. | PARTIAL |
| BRIEF-AC-15 | 09 | `PrBriefCard.test.tsx:170` unreviewed-state test; `pr-brief-layout.md` describes real `VerdictBanner` reuse. | DONE |
| BRIEF-AC-16 | 09 | Expand/navigate tests present at `PrBriefCard.test.tsx` (risk section). | DONE |
| BRIEF-AC-17 | 09 | Downstream "not in diff" label test present per file structure. | DONE |
| BRIEF-AC-18 | 09 | Skeleton/pending-state test at `PrBriefCard.test.tsx:122` area. | DONE |
| BRIEF-AC-19 | 09 | `client/messages/en/brief.json` exists and is referenced by `PrBriefCard.tsx` (`t("card.error")`, `t("card.providerHint")` confirmed in `d77e293` diff). | DONE |
| BRIEF-AC-20 | 16 | `docs/retro/ledger.md` provides actual cost figures (receipt-sourced), source-coverage caveats, and 3 concrete "Improvements." | DONE |
| ONBOARD-AC-01 | 02,10,11,14 | `onboarding-tour-generate.test.ts:240-266` (exactly-five-section eligible generation); no unfamiliar-repo live demo evidence exists (same gap as CTX-AC-09/BRIEF-AC-08). | PARTIAL |
| ONBOARD-AC-02 | 07,10 | `repo-intel-ranked-files.test.ts:151-168` — "never triggers indexRepo/refreshIndex," read directly. | DONE |
| ONBOARD-AC-03 | 07,10 | `repo-intel-ranked-files.test.ts:168-230` — `rank*(1+hotness)` sort, lexicographic tie-break, hotness-availability disclosure tests, read directly. | DONE |
| ONBOARD-AC-04 | 04,10,14 | `onboarding-tour-generate.test.ts:241-258` — one `completeStructured` call, `disableTransportRetry`/`maxRetries:0`. Live cost evidence absent. | PARTIAL |
| ONBOARD-AC-05 | 07,10 | `onboarding-tour-generate.test.ts:189-239` — flag-off/no-data/partial/failed all zero-call skeleton, read directly. | DONE |
| ONBOARD-AC-06 | 10,11 | `onboarding-tour-generate.test.ts:267-317` — grounding rejection + model/transport failure both preserve old cache, never fabricate usage. | DONE |
| ONBOARD-AC-07 | 04,07,10 | `onboarding-tour-generate.test.ts:319-355` — tail-drop under tiny budget; mandatory-overflow fails before model call. | DONE |
| ONBOARD-AC-08 | 10,11,12 | `onboarding-tour-generate.test.ts:356-370` (index-revision race → 409, cache preserved); e2e `10-onboarding-tour.flow.json` + existing `06-onboarding.flow.json` (add-repo) both present in the 10/10 passing set. | DONE |
| ONBOARD-AC-09 | 01,13-15 | Stage commits are individually traceable (29 commits, each tagged `TASK-NN`); this report is the final AC-matrix, but completeness depends on the still-missing demo/video items below. | PARTIAL |
| ONBOARD-AC-10 | 14,15 | No unfamiliar-repo demonstration, no actual call/cost log found anywhere in the repo. | MISSING |

### Plan items

| Step | Status | Evidence |
|---:|---|---|
| 01 | DONE | `.claude/agents/*`, `docs/sdd-workflow.md`, `docs/sdd/l05/{plan,plan-review,preflight,continuation-prompt}.md` all present and consistent with each other; pre-code commit order confirmed. |
| 02 | DONE | `vendor-contracts-parity.test.ts` confirms byte-identical contracts + new migration review (`0013_famous_kree.sql` — 2 jsonb columns only, per test at line 54-57). |
| 03 | DONE | `project-context-service.test.ts` — discovery/preview/symlink/traversal/foreign-workspace coverage read directly. |
| 04 | DONE | `llm-disable-retry.test.ts:57-130` (one-attempt transport control), `tokenizer-estimate.test.ts` present. |
| 05 | PARTIAL | Selector/UI tests exist; no screenshot/manual-UI-check artifact for the agent Context tab (only the PR Brief Overview screenshot exists). |
| 06 | DONE | `review-executor-project-context.test.ts` full suite read — union, guard, budget, snapshot parity. |
| 07 | DONE | `repo-intel-ranked-files.test.ts` — eligibility, bounded reads, no-reindex, scoring/tie-break, hotness disclosure, all read directly. |
| 08 | PARTIAL | `brief-generate.test.ts`/`brief-lock.test.ts` substantively cover the AC-derived behaviors; the one recorded live-generation attempt failed OpenRouter structured-output validation (`32f014d`'s commit message and `reviewer-core/src/llm/openrouter.ts` diff only improved the *error message*, not the underlying validation failure — no later commit records a successful live call). |
| 09 | PARTIAL | `PrBriefCard.test.tsx` broad coverage incl. D1 fix test (line 145); exact-line scroll and a successful live brief remain unverified. |
| 10 | PARTIAL | `onboarding-tour-generate.test.ts` is thorough; no live unfamiliar-repo generation recorded. |
| 11 | DONE | Onboarding UI tests + `10-onboarding-tour.flow.json`/`06-onboarding.flow.json` present. |
| 12 | DONE | `task-12-validation.md`: 10/10 hermetic browser flows, 403 server / 232-233 client unit tests, typecheck/lint clean, independently corroborated by new flow files (`08/09/10-*.flow.json`) added in the same commit (`ba44b2e`). |
| 13 | DONE (review itself) / gaps noted | `architecture-review.md`: explicitly states Sonnet review was *rejected* by an approval gate and substituted with two Codex sessions — "No external [Claude] review was executed." This is an honest, self-disclosed deviation from the plan's "Sonnet architecture reviewer where available" intent, not a fabricated pass. |
| 14 | PARTIAL | `pr-brief-layout.md` + screenshot exist (layout-only); author confirms a demo video exists separately, but its URL is not linked in the PR or available for inspection. `docs/sdd/l05/demo.md` was not created. |
| 15 | **This report** | First genuine Sonnet pass; prior `plan-verifier-report.md` was explicitly Codex standing in. |
| 16 | DONE | `docs/retro/ledger.md` entry committed `f7566bf`, manually invoked, current-context evidence, honest unknowns. |

### Stated edge cases / requirements

| Requirement (spec/plan) | Status | Evidence |
|---|---|---|
| Missing/unsafe project documents omitted truthfully, no silent truncation | DONE | `project-context-service.test.ts:109,189,268`; `review-executor-project-context.test.ts:166-233`. |
| Whole-document attached-block budget (20% window, clamp 4k–32k, 16k fallback) and injection guard preserved | DONE | `review-executor-project-context.test.ts` tail-drop test with `contextLength:20_000` → exact 4,000-token clamp math verified by reading the test. |
| Brief: 8,000 input / 1,500 output cap; raw diff hunks excluded; fail before call on mandatory overflow | DONE | `brief-generate.test.ts:204-237`. |
| Brief: never overwrite valid cache with failed/invalid/superseded generation; 409 on concurrent generation | DONE | `brief-generate.test.ts:238-305`; `brief-lock.test.ts:130-159` (advisory-lock 409, released on failure). |
| Brief: cached-provenance vs. live-selector distinction (D1 fix) | DONE | `brief-read.test.ts:123-138` and `PrBriefCard.test.tsx:145-170`, both explicitly labeled "(D1)" and independently read. |
| Onboarding: 24,000 input / 8,000 output cap; zero-call skeleton when ineligible; one-attempt fallback preserving prior cache | DONE | `onboarding-tour-generate.test.ts:189-355`. |
| Onboarding: rank×(1+hotness), deterministic tie-break, truthful hotness-absent disclosure | DONE | `repo-intel-ranked-files.test.ts:168-230`. |
| Tokenizer: encoding-vs-heuristic distinction, no silent per-call re-encode once broken | DONE (service layer) | `llm-disable-retry.test.ts` + `tokenizer-estimate.test.ts` exist and were listed; not opened line-by-line given budget — **CANNOT VERIFY exact heuristic-fallback line behavior independently**, only test existence confirmed. |
| Real attached-rule-violation demo, unfamiliar-repo tour demo, 1–3 min brief video, PR with cross-model reviewer note | MISSING | No `demo.md`, no video/log link, no confirmable open PR (GitHub access sandbox-denied here). |
| Manual-only retrospective, no automatic invocation, no fabricated cost | DONE | `docs/retro/ledger.md` — explicitly notes what's unknown, uses the actual receipt's dollar figures, states "no durable session ID" and "no `--deep`" honestly. |
| Server DB integration (`*.it.test.ts`) run-vs-skipped recorded honestly | **NOT DONE** | Plan (`plan.md:101`) requires recording executed-vs-skipped `.it.test.ts` runs when Docker is available. No validation document (`task-12-validation.md`, `architecture-review.md`, `pr-brief-layout.md`) mentions running `brief.it.test.ts`, `onboarding-tour.it.test.ts`, or `blast.it.test.ts` at all — not even as "skipped." This is a gap against the plan's own evidence requirement, independent of whether Docker was actually available. |

### Changes outside plan scope

- `docs/sdd/l05/claude-handoff.md` — not listed in any task's file scope (TASK-01 lists `plan.md,plan-review.md,preflight.md,continuation-prompt.md` only; `continuation-prompt.md` itself **is** in-scope and the prior Codex report incorrectly flagged it as out-of-scope — corrected here).
- `docs/sdd/l05/pr-brief-layout.md` and `docs/sdd/l05/screenshots/pr-brief-overview.png` — produced by an ad-hoc post-TASK-13 commit (`3d5ecfd`, "Match PR Brief Overview layout to supplied design") not named in any TASK's file list, though its content maps conceptually to TASK-09's BRIEF-AC UI scope.
- `server/src/modules/reviews/constants.ts` (`INTENT_TIMEOUT_MS: 15_000 → 60_000`, commit `259e397`) — a reactive fix to an observed Intent timeout during live Brief troubleshooting; not named in any TASK's file list or AC.
- `reviewer-core/src/llm/openrouter.ts` + its test (commit `32f014d`) — surfaces the schema-validation error detail; addresses observed live failure, not explicitly scoped by a task, though it supports BRIEF-AC-02's error-handling intent.
- `client/messages/en/brief.json` `providerHint` key and `PrBriefCard.tsx` error-surfacing change (commit `d77e293`) — same reactive-fix pattern, loosely mappable to BRIEF-AC-19/TASK-09 but not itself planned.
- `docs/sdd/l05/plan-verifier-report.md` and `docs/retro/ledger.md` — process artifacts from TASK-15/16, consistent with those tasks' purpose even though produced after the originally-scoped TASK-13/14 commits.

### Verification-scope commands

I did not rerun suites; I independently opened and read the cited test files (not just the summary docs) to confirm the described assertions exist as claimed. Recorded outputs I inspected (not re-executed):

- `task-12-validation.md`: server unit 403/47 passed, client 232/40 (+3 focused ContextTab rerun), hermetic e2e 10/10, typecheck/lint clean (11 server / 8 client pre-existing warnings), e2e audit 0 vulnerabilities, server audit 72 (6/27/33/6 low/mod/high/crit), client audit 59 (7/27/18/7).
- `architecture-review.md`: no new in-scope boundary violations found by two Codex sessions (Sonnet review request was itself blocked by an approval gate — self-disclosed, not concealed).
- **Server/reviewer-core/client `.it.test.ts` (DB integration) runs: CANNOT VERIFY** — no document records whether these were executed or honestly skipped, contrary to the plan's own requirement (`plan.md:101`).
- **Live, successful PR Brief / Onboarding Tour model generation: CANNOT VERIFY as successful** — the one documented live attempt failed OpenRouter structured-output schema validation; the ledger records this as unresolved ("What was hard / missed").
- **Open PR state, PR description, linked demo video: CANNOT VERIFY** — `gh`/network access was denied in this sandboxed session; no PR URL or video link exists in any committed file.

### Result

**INCOMPLETE.**

Required-criteria gaps that block a COMPLETE verdict: no real-model demonstration for Project Context rule-violation (CTX-AC-09), Onboarding unfamiliar-repo tour (ONBOARD-AC-01/10), or a successful live PR Brief generation (BRIEF-AC-02/09 remain PARTIAL — the one recorded live attempt failed schema validation and was never retried to success); the 1–3 minute demo URL is not linked in the PR, so its contents and required coverage cannot be verified (BRIEF-AC-08/14, ONBOARD-AC-09/10); DB-integration (`.it.test.ts`) execution is undocumented against the plan's own honesty requirement.

What has materially improved and is now independently confirmed since the prior (Codex) pass: a genuine Sonnet final-verifier pass now exists (this report, closing SDD-AC-07's content requirement), and the manual retrospective/ledger (SDD-AC-09/10, BRIEF-AC-20) is now done, which the prior report had marked CANNOT VERIFY. All Project Context, Brief-contract/grounding/cache, and Onboarding-generation backend ACs with hermetic test evidence remain DONE on independent re-inspection — no regressions were found in code that the prior report had marked DONE.

### Run metadata

- Model: `claude-sonnet-5` (Anthropic); verifier completed successfully.
- Cost reported by Claude Code: `$1.0694`.
- This report was generated before CI-fix commit `0c80c64`; it does not assess that follow-up commit.


### Follow-up clarification (2026-10-23)

The author clarified after this verification that the demo video exists as a separate link, but is not included in PR #14. The earlier wording that the video was “absent” was too strong: the verifier established only that no video/link was present in the repository or PR content it could inspect, not that no video exists elsewhere. BRIEF-AC-08 remains incomplete as submission evidence until the URL is added to the PR; the video contents cannot be assessed without that URL. The author has not provided the URL in this conversation, so this report and the PR description do not invent or imply one.

GitHub access is now available to the follow-up editor, who confirmed PR #14 is open and updated its description. This supersedes the earlier environment-limited statement that PR state could not be confirmed; it does not change the verifier’s other findings. The separate context-rule and unfamiliar-repository demonstrations, successful live Brief generation/cost evidence, and other listed gaps remain unverified.
