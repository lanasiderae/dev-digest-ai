# L05 architecture review

Reviewed 2026-10-23: `da33d6d126e5fd9e23f75f769753c0207115356d..ba44b2e`.

Reviewers: two read-only Codex session agents, split between backend and frontend, with coordinator verification. The exact session model variant is unavailable. Sonnet was not used: automatic approval review rejected the external Claude CLI invocation because it would disclose private source/documentation without explicit destination approval. No external review was executed.

Applied `.claude/agents/architecture-reviewer.md`, onion-architecture, fastify-best-practices, frontend-ui-architecture and next-best-practices. This report covers architectural boundaries, not specification completion, and supplies no overall readiness verdict.

## Findings

**No verified new in-scope architecture violations.**

Backend inspection covered project-context, brief and onboarding-tour routes/services/repositories/helpers; agent/skill CRUD changes; review context/run-executor integration; persisted repo-intel additions; provider/tokenizer/resilience changes; composition-root/container wiring; and the test-only e2e entrypoints.

- New routes use schema-first validation and delegate orchestration to services.
- New repositories do not import outward into services or routes.
- Document I/O remains in server adapters. `reviewer-core/src` is unchanged.
- Services' PostgreSQL lock operations were examined at `server/src/modules/brief/service.ts:377` and `server/src/modules/onboarding-tour/service.ts:439`. A shared lock adapter could reduce coupling, but the governing rules permit container adapter calls from services and do not explicitly prohibit this pattern. It is not classified as a violation or a demonstrated concurrency defect.

Frontend inspection covered agent/skill context editing, the shared selector, brief card and hooks, Overview/diff navigation, trace snapshot presentation, onboarding page/View/Panel/hooks and navigation.

- API access stays in hooks; no new cross-route private-component imports were found.
- The shared selector has two real route consumers. The onboarding page is thin, with client interactions behind client boundaries.
- Runtime contract imports use direct extensionless modules following TASK-12's browser fix.
- Changed brief/onboarding/platform/project-context/trace contracts and the shared barrel match between server and client. Common new Agent/Skill context fields and retry flags agree. Other adapters/knowledge differences existed before this slice and are excluded from findings.

## Live integration addendum

After the committed-scope review, the user reported the dev browser requesting the stopped test API on port 3101 while the dev API was healthy on 3001. Both Next processes had shared `client/.next`, allowing test assets with a different public API URL to replace dev assets.

Fixed in `client/next.config.mjs`: `distDir: process.env.E2E_FIXTURES === "1" ? ".next-e2e" : ".next"`. The generated test directory is ignored; TypeScript includes both generated type directories. The frontend reviewer independently inspected the fix and found no new boundary issue. Restarting the dev frontend restored service; the user confirmed it works. Running the hermetic suite beside the dev app then passed **10/10 flows**.

## Not reviewed

Security/injection, SQL and concurrency correctness, model-call budgets/grounding, cache validity, React hook behavior/performance, test adequacy, visual layout and AC/delivery closure require their respective reviews or demonstrations. No tests were run by the read-only reviewers. Existing TASK-12 validation is recorded separately in `task-12-validation.md`. This is not the final plan-verifier report.
