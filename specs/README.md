# Cross-module feature specifications

This top-level directory contains only specifications spanning multiple packages or modules. A specification limited to one package/module belongs in that package's `specs/` directory instead.

Use dated English filenames: `YYYY-MM-DD-feature-name.md`. The L05 cross-module specification is [2026-10-22-l05-context-brief-onboarding.md](2026-10-22-l05-context-brief-onboarding.md). The L08 (Agent Performance Dashboard) specification is [2026-10-23-l08-agent-performance-dashboard.md](2026-10-23-l08-agent-performance-dashboard.md).

Specifications define goals, behavior, contracts, acceptance criteria and verification evidence. Detailed implementation tasks belong in separately generated plans. A draft is approved only with explicit user approval of that draft; quoted conversation history is not approval.

Keep existing AC identifiers stable when moving or refining a specification, so plans, tests, commits and final verification remain traceable. Add new identifiers only for mandatory behavior not already covered; do not renumber existing criteria merely to change wording or location.
