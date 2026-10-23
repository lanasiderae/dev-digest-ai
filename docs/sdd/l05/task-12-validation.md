# TASK-12 — Deterministic smoke fixtures

Added opt-in temporary Git/DB fixtures and three browser journeys:

- Context: discover, preview, select, save, reload and inspect the full static trace snapshot (CTX-AC-02/04/06).
- Brief: empty-cache Generate button, cached summary/risks/missing sources, file:line navigation and reload (BRIEF-AC-01–06/13).
- Tour: five cached sections, reload, distinct incomplete-index skeleton and original add-repository screen (ONBOARD-AC-01/05/08).

Fixtures are contract-validated. The dedicated test API supplies no secrets and rejects review/brief/tour generation. Caches, section narratives and the historical trace are synthetic; they prove rendering and navigation, not actual generation, model cost or rule detection. Context selection mutates only the isolated seeded agent. Normal seeds and real imported data are untouched.

Browser execution exposed and fixed two integration defects: the agent route omitted `context` from its allowed tabs, and runtime shared-barrel imports failed Next.js resolution. Runtime constants now use direct extensionless contract imports; contracts remain unchanged.

## Validation

- Final hermetic browser suite: **10/10 flows passed**, including the empty-cache assertion. The isolated test API uses the existing `nodeEnv=test` rate-limit exemption; the expanded navigation suite otherwise exhausted the interactive 120-request/minute limit. Production rate limits are unchanged.
- Server unit suite: 403 tests passed across 47 files.
- Client suite: 232 tests passed across 40 files; focused ContextTab rerun: 3 passed.
- Server, client and e2e typechecks passed. Server/client/e2e lint: no errors (11 existing server warnings, 8 client warnings).
- E2E dependency audit: 0 vulnerabilities. Server audit: 72 (6 low, 27 moderate, 33 high, 6 critical); client: 59 (7 low, 27 moderate, 18 high, 7 critical). No dependency changes were made.
- `bash -n scripts/e2e.sh` and `git diff --check` passed.

## Remaining evidence

This is TASK-12 evidence, not the final plan-verifier report. Generation/refresh, skill selection and guard/budget behavior retain their service/component tests; these browser flows deliberately make no paid calls. Exact diff query parameters and seeded target content are checked; exact viewport centering and visual layout still need demo/manual inspection. Architecture review, live grounded-rule/tour/brief demos, video/open PR and final AC → task → test → commit verification remain for TASK-13–15. Retrospective stays manual only.
