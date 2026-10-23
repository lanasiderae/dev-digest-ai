# Blast Radius demo evidence

- `shared-helper.png`: user-provided PR #12 screenshot showing 2 symbols, 8 callers, and 27 endpoints. The user confirmed caller links open the correct source lines.
- `empty-map.png`: locally verified PR #13 Overview after adding “No changed code symbols.”
- `mcp-empty-map.png`: user-provided MCP result for PR #13, matching the healthy empty UI map (`degraded: false`). Captured before the new `empty_state` field was added.
- `incomplete-index.png`: locally verified seeded `acme/payments-api` PR #482. The real API returns `degraded: true`, `reason: no_data`; the UI displays “Index incomplete” and “No index data is available yet for this repo.” This is seeded data, not a live GitHub PR.

Latest checks: client tests/typecheck/lint passed (existing lint warnings); MCP 37 tests/typecheck/lint passed and audit found zero vulnerabilities. Client audit reports pre-existing vulnerabilities. No dependencies changed.

A 1–3 minute demo video is still required. Full five-tool Claude Code workflow, MCP Inspector, and token-audit measurements are not established by these screenshots.
