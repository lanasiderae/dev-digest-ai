# INSIGHTS.md

## Codebase Patterns

- **2026-10-20** — `groundFindings` exempts findings whose `kind` is one of
  `secret_leak`/`lethal_trifecta`/`phantom`/`hook` from the line-range
  intersection check entirely — they only need their `file` present in the
  diff, not a matching hunk range. Regular diff-findings are dropped unless
  `[start_line, end_line]` intersects a real hunk. Evidence:
  `reviewer-core/src/grounding.ts:16,59-70`.
- **2026-10-20** — `reviewPullRequest`'s `"auto"` strategy only switches to
  map-reduce when the diff is BOTH over the line threshold AND multi-file
  (`diff.files.length > 1`); a single huge file, however large, always stays
  single-pass. Evidence: `reviewer-core/src/review/run.ts:115-121`
  (`selectMode`).
- **2026-10-20** — Multi-chunk `costUsd` accumulation null-poisons: if any
  one chunk's cost is unknown (`res.costUsd == null`, e.g. an unpriced
  model), the entire review's `costUsd` becomes `null`, not just that
  chunk's contribution left out of the sum. Evidence:
  `reviewer-core/src/review/run.ts:184`.
