# L05 cross-model plan review

Status: **REVISION_NEEDED — plan not approved; no product implementation started.**

- Plan author: Codex implementation-planner, GPT model family. The exact deployed model variant is not exposed by the subagent result.
- Reviewer: Anthropic `claude-sonnet-5`, verified from the CLI's returned `modelUsage`, not only the reviewer's self-description. Families differ.
- Scope: approved specification and proposed plan only; no source inspection, tools or MCP access.
- CLI receipt: [plan-review-receipt.json](plan-review-receipt.json). Reported list-price cost estimate **$0.405565**, elapsed **310.109 seconds**; receipt includes an auxiliary Haiku usage entry. This is not product-generation evidence or an invoice.
- Both input document hashes are saved in the receipt. The reviewed plan is the version saved in commit `8d0452a`.

## Coordinator notes for the next session

1. Record the author/reviewer identities above in the plan to address B1. The actual cross-family identity is now established; the review did not have this author metadata when evaluating it.
2. Reconcile inline task AC references with the traceability table mechanically, checking shorthand/ranges. Verify each allegation: the claimed omission of task 14 from `13–15` is a reviewer error because that range includes 14. Do not apply findings blindly.
3. Replace vague ordering constraints with named dependencies/file ownership; retain the approved Context-first delivery requirement and the shared two-worker limit.
4. Distinguish cached generation provenance from the reviewer selected for the next regeneration, with AC-derived tests.
5. Confirm source signatures at the baseline and record citations. Code facts asserted by the plan were not independently inspected by this reviewer.
6. Keep preliminary versus final verifier evidence clearly labeled. Save dispositions, revise the plan, and obtain separate user plan approval before product code.

No corrections to the plan have been applied yet. No further model review has been launched.

## Original reviewer output

# Plan Review — L05 Context/Brief/Onboarding

**Scope of this review:** Limited strictly to the two supplied documents (`specs/2026-10-22-l05-context-brief-onboarding.md` and `docs/sdd/l05/plan.md`). No repository, source code, commit history, or runtime state was inspected — all signature claims, file-layout claims, and "existing behavior" claims in the plan are taken as asserted, not verified. I did not execute anything.

**Reviewer identity disclosure (relevant to SDD-AC-04):** Per my runtime context I am Sonnet 5 (Anthropic/Claude family). The plan does not record which model/family produced it. This matters directly — see Finding B1 below.

---

## A. AC coverage

I cross-checked all 49 AC-IDs (SDD 1–10, CTX 1–9, BRIEF 1–20, ONBOARD 1–10) against both the inline `TASK-xx [AC-IDs]` brackets in Steps and the final Traceability table.

- **No AC is completely unowned.** Every AC-ID appears in at least one task bracket and in the Traceability table.
- **However, the two listings disagree with each other in several places** (see Finding A1). This isn't a coverage gap in outcome, but it is a mismatch inside the plan itself, and it undermines confidence in the "AC-ID for every task" precision SDD-AC-03 requires and that the final verifier (SDD-AC-07) must reconcile.

### Finding A1 — Traceability table drifts from inline task AC brackets (MAJOR)
Examples (not exhaustive):
- TASK-03's own bracket is `[CTX-AC-01/04/07/08, BRIEF-AC-02/12]` (includes CTX-AC-04 and implicitly the "ordered union" logic relevant to CTX-AC-05, described in TASK-03's body text), but the Traceability table row for **CTX-AC-04** lists only `02,04,05` and the row for **CTX-AC-05** lists only `03,04,06` — inconsistent inclusion of Task 03 across the two rows despite TASK-03 text explicitly performing the "ordered union" resolver work.
- TASK-14's bracket is `[SDD-AC-08, CTX-AC-09, BRIEF-AC-07–09/14, ONBOARD-AC-04/09/10]` (includes **ONBOARD-AC-09**), but the Traceability table row for **ONBOARD-AC-09** lists `01,13–15` — omitting Task 14.
- The Traceability table row for **ONBOARD-AC-10** lists Task **15**, but TASK-15's own bracket is `[SDD-AC-07, BRIEF-AC-07/14, ONBOARD-AC-09]` — it does **not** mention ONBOARD-AC-10 at all.

**Correction:** Before committing the plan, run a single reconciliation pass generating the Traceability table mechanically from the task brackets (or vice versa) so the two are byte-consistent. This is cheap to fix now and expensive to discover during final verification (SDD-AC-07), where a mismatched matrix would itself read as an "unresolved/cannot-verify" item.

---

## B. Blocking findings

### B1 — Cross-model-family review identity is unverifiable from the plan (BLOCKING for SDD-AC-04 closure)
SDD-AC-04 requires that "a reviewer from a different model family" review the plan, and that "the findings **and actual model/provider identity**" be saved. TASK-01's evidence requirement is "Obtain different-family plan review and record findings/provider/model; do not claim same-family review qualifies."

The plan document contains no record of which model/provider authored it. I am performing this review as a Claude-family model (Sonnet 5). If the plan was also produced by a Claude-family agent (plausible, since the spec states "Architecture reviewer and final verifier use Sonnet in Claude Code" and the whole workflow is Claude-Code-centric), **this review does not satisfy SDD-AC-04**, and the coordinator must not record it as the required cross-family review.

**Correction (TASK-01):** Before closing the gate, explicitly record (a) the implementation-planner's model/provider identity, and (b) the reviewer's model/provider identity, and confirm they differ. If they do not differ, a genuinely different-family review must still be obtained — this review alone cannot be cited as satisfying SDD-AC-04. This is not a defect in the plan's content, but it is a blocker for treating the plan as "reviewed" in the SDD-AC-04 sense.

---

## C. Major findings

### C1 — Unjustified serialization against the two-worker/parallelism goal (MAJOR)
Several Dependencies fields carry prose conditions not reflected in the formal dependency numbers, and at least one appears to lack technical justification:

- **TASK-07** ("Persisted facts/rank" — touches only `repo-intel/{service,repository,types}.ts`) states: "Dependencies: 02; **Context backend must stabilize first**." TASK-07's files do not overlap with Context's module files (`project-context/*`, `reviews/run-executor`, `trace-builder`). No shared-file or single-owner collision is identified that would require Context (03/04/06) to fully land before repo-intel facade work starts.
- **TASK-09** ("Dependencies: 02/08; **Context UI complete first**") and **TASK-10** ("Dependencies: 04/07/08 **stable conventions**") similarly gate on soft, unquantified conditions ("complete first," "stable conventions") rather than named shared artifacts.

The spec explicitly records: "The user has requested splitting current work where possible; this execution preference is separate from specification approval." Unjustified serialization works against that stated preference and against the plan's own "at most two active workers" capacity design, without a stated technical reason.

**Correction:** For each soft dependency, either (a) name the specific shared file/contract that forces the ordering (e.g., "container registration file X is edited by both Context and Tour work, so single-owner sequencing is required"), and fold that into the formal Dependencies list, or (b) relax the dependency so TASK-07 can start once TASK-02 contracts land, in parallel with TASK-03–06, and similarly reconsider TASK-09/TASK-10.

---

## D. Minor findings

### D1 — GET-time reviewer-identity hydration could desync UI state (MINOR, unsafe assumption)
TASK-08: "GET without agent_id hydrates the cached generation's explicit reviewer identity by default, so selected-reviewer reload remains valid." This is consistent with C2's "never infer the last reviewer" when read narrowly as *provenance display for a cached result*, not as *inference for a new generation decision* (POST explicitly handles `agent_id:null` correctly per the plan). However, the plan does not say whether this hydrated identity also drives the Brief UI's "currently selected reviewer" control, which could silently diverge from whatever reviewer the user has active elsewhere (e.g., Context tab selection).

**Correction (TASK-08/09):** Add an explicit AC-derived test (tie to BRIEF-AC-02/12) confirming that cached-provenance display and "currently selected reviewer for next regeneration" are rendered as distinct UI states, so a stale cached identity cannot be mistaken for the live selection.

### D2 — Unverified signature/internals assumptions (MINOR)
TASK-07 asserts specific current signatures: "`getTopFilesByRank()` returns paths and `getFileRank()` returns percentiles." TASK-04 asserts: "Current tokenizer exposes only `count(text)`, uses `cl100k_base`, silently falls back to a heuristic." Per the spec's own evidence table, "implementation planning must verify exact signatures and current state before changes." Since no source inspection was available to this reviewer either, these claims are unverifiable from the documents alone.

**Correction:** Treat these as assumptions-to-confirm at the start of TASK-04/TASK-07, not settled facts; add a short verification note to each task's evidence list (e.g., "confirmed actual signature at commit X") so the final verifier can distinguish "planned" from "confirmed."

### D3 — Dual "final verifier" pass ordering (MINOR, informational)
Spec's required stage order places "final read-only plan-verifier → manually invoked retrospective and delivery evidence" after architecture review/fixes, yet the required PR video must show "...spec/plan/verifier," which needs *some* verifier output to exist before the video can be recorded. The plan resolves this reasonably (TASK-14 explicitly allows a labeled "preliminary" verifier pass before TASK-15's true final pass, with a refresh obligation if evidence changes). No correction required beyond ensuring the PR/README evidence links unambiguously identify TASK-15's output as the authoritative "final" verification, not the preliminary one — the plan already says this; just confirm it's enforced at delivery time.

---

## E. What checks out cleanly (no corrective action needed)

To keep the blocking/major items in context — these were specifically checked and found consistent between spec and plan:
- All C5 numeric caps (256 KiB/doc, 2,000 documents, 100 attachments) and C7 token budgets (8,000/1,500 brief; 24,000/8,000 tour; 20% window clamped 4,000–32,000, 16,000-unknown fallback) are carried through plan tasks without drift.
- One-attempt/no-retry semantics (TASK-04's explicit handling of `StructuredRequest.maxRetries` vs. transport/SDK-level retries) correctly distinguishes schema-reprompt suppression from hidden billable retries — this is a stronger safeguard than the spec text alone demands and is a good catch.
- Cache-preservation-on-failure, head/context staleness fingerprinting, and 409 concurrency handling (advisory lock released in `finally`, no open transaction across the model call) match C6/C3/BRIEF-AC-12/ONBOARD-AC-08 requirements.
- Non-goals are respected: no MCP inventory change, no boot-time migrations, no AST/index rebuild, existing `/onboarding` preserved, reviewer-core purity preserved.
- Grounding/validation semantics (reject invalid risk/focus paths before persistence, no raw diff hunks, injection-guard preservation) match spec exactly.
- The Git tree/blob-by-object-ID design in TASK-03 is a justified (not over-engineered) response to a real TOCTOU risk in symlink/path containment, with an explicit bar for any filesystem alternative.

---

## Verdict: **REVISION_NEEDED**

Required before this plan can be treated as approved/committed:
1. **(Blocking)** Resolve B1 — record plan-author and reviewer model/provider identities explicitly and confirm genuine cross-family review before citing any review (including this one) as satisfying SDD-AC-04.
2. **(Major)** Resolve A1 — reconcile the Traceability table against the inline per-task AC brackets so they match exactly.
3. **(Major)** Resolve C1 — justify or relax the soft "must stabilize/complete first" dependencies (TASK-07, TASK-09, TASK-10) with named shared artifacts, or restore the parallelism the user requested.

Minor items D1–D3 should be addressed but do not block plan approval on their own.

This review does not approve or implement anything on the user's behalf; it is input for the user's own manual plan-approval decision.

---

## Disposition record (applied 2026-10-22, by `implementation-planner`, coordinator-persisted)

The plan was revised in response to this review. The revised plan is `docs/sdd/l05/plan.md` (not yet re-reviewed or approved). This record is the "finding dispositions" evidence required before further plan approval.

- **B1 (blocking — model-family identity): APPLIED.** Added an explicit "Plan-author / reviewer identity" paragraph to the plan's Scope section recording plan author = Codex implementation-planner (GPT family, exact variant not exposed) and reviewer = Anthropic `claude-sonnet-5` (confirmed via this review's own `plan-review-receipt.json` `modelUsage` field, not self-description). States the families differ and this satisfies SDD-AC-04, and explicitly flags the receipt's auxiliary `claude-haiku-4-5-20251001` entry as CLI-side auxiliary usage, not a second reviewer.

- **A1 (major — traceability drift): APPLIED, with one finding explicitly REJECTED.** Ran a full mechanical cross-check of all 49 AC-IDs' inline task brackets against their Traceability table rows. Fixed three table rows (added Task 03 to CTX-AC-04; Task 05 to CTX-AC-08; Task 08 to BRIEF-AC-03) and five task brackets (TASK-01 dropped SDD-AC-09/10 and BRIEF-AC-20; TASK-07 dropped BRIEF-AC-09; TASK-12 dropped CTX-AC-09; TASK-15 added BRIEF-AC-08 and ONBOARD-AC-10). Added an explicit "Traceability convention" paragraph to the plan distinguishing "bracket = touches/depends-on" from "table row = primary evidence" so broad-range foundational/review tasks (02, 12, 13) legitimately appearing in more brackets than rows is not re-flagged as drift. **Rejected:** this review's own claim (coordinator note above) that the ONBOARD-AC-09 row `01,13–15` omits Task 14 — the range `13–15` already includes 13, 14 and 15. No plan change was made for that specific allegation; it is recorded here as a reviewer error, not applied.

- **C1 (major — unjustified serialization): APPLIED.** Verified actual file sets against the live repo. No file-level collision exists between TASK-07 (`repo-intel/*` only) and Context's files — relaxed TASK-07's dependency from "02; Context backend must stabilize first" to "02" only. No file-level collision exists between TASK-09 (`OverviewTab`/`PrBriefCard`/brief hooks/messages) and TASK-05 (`AgentEditor`/`ProjectContextSelector`/settings messages) — relaxed TASK-09's dependency from "02/08; Context UI complete first" to "02/08" only. TASK-10 does have a real but narrow shared artifact (`server/src/modules/index.ts`, edited by TASK-03/08/10 as one import + one entry each) — kept TASK-10's functional dependency on 04/07/08 but replaced the vague "stable conventions" clause with this named-file, single-line-edit sequencing note instead of full-task-completion gating. Updated the plan's Verification-scope dependency-order prose to match all three relaxations.

- **D1 (minor — cached vs. live reviewer identity): APPLIED.** Added explicit AC-derived test requirements to TASK-08 (API/response-shape test keeping cached-provenance and live-selector fields distinct) and TASK-09 (UI test asserting the two render as visibly distinct elements even when they currently show the same name).

- **D2 (minor — unverified signatures): APPLIED, with one correction to the claim verified.** Read the actual baseline code and confirmed `server/src/adapters/tokenizer/index.ts` (`Tokenizer.count` is the only member; `cl100k_base`; sticky fallback to `approxTokens` on load/encode failure — matches the plan's prior assertion exactly). Confirmed `server/src/modules/repo-intel/service.ts`'s `getFileRank` → `Promise<FileRankRow[]>` (`{path, percentile}`) and `getTopFilesByRank` → `Promise<string[]>` (paths only) — also independently re-verified by the coordinator directly against the source, not just taken from the subagent's report. Additionally discovered (not previously stated in the plan) that the indexer's underlying `IndexerFileRankRow` does store raw `rank`/`hotness`, and that `hotness` is currently hardcoded to `0` for every row across all three pipeline paths (`rank.ts`, `full.ts`, `incremental.ts`) — this was independently confirmed via `grep` and added as a citation to the plan's Architectural constraints and referenced inline in TASK-04/TASK-07.

- **D3 (minor, informational — preliminary vs. final verifier): APPLIED.** Tightened TASK-14's wording to require the "preliminary" label appear visibly in the video/PR text itself, not just in planning notes, and tightened TASK-15's wording to state explicitly that its report is the only output citable as "final" for delivery-evidence purposes.

No product code was touched while producing this revision.

## User plan approval (2026-10-22)

The user approved this revised plan with the instruction: "forget about codex. we dont have token to run it now. approved." Recorded disposition:

- **Codex re-engagement:** dropped. The user has no budget to run Codex again right now. This revision's B1–D3 fixes were produced by a Claude-family `implementation-planner` subagent, not Codex — see the plan's Scope section, "This revision's own authorship" note.
- **Cross-family re-review of this revision:** explicitly waived by the user, not performed. The revision is therefore same-family with its own fixer (Claude reviewing/revising Claude-produced changes); it does not carry a second genuine cross-family pass. Only the *original* draft's cross-family review (Codex-authored, Claude-reviewed) stands as the SDD-AC-04 evidence.
- **Plan approval:** granted. This satisfies the manual reviewed-plan-approval gate required before `run-plan` execution for this revision; no further approval loop is needed to proceed.

Both artifacts (`plan.md`, this file) are to be committed as the next stage commit before any product code, per the workflow's commit-before-implementation rule.
