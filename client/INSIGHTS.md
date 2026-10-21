# INSIGHTS.md

## What Doesn't Work

- **2026-09-29** — Don't format LLM run cost with a flat `.toFixed(2)`: the
  original `formatCost` (`usd == null ? "n/a" : \`$${usd.toFixed(2)}\``,
  removed in commit `d45ab0d`) rounds any sub-cent cost — routine for cheap
  per-call LLM pricing (e.g. $0.0013) — down to `$0.00`, indistinguishable
  from "free" or "no data". Use a precision tier instead: `< $0.01` → 4
  decimals, else 2. See `client/src/lib/format-cost.ts`.
- **2026-10-20** — Precise evidence for the entry above: the current tiered
  implementation is `client/src/lib/format-cost.ts:6-11`.

## Codebase Patterns

- **2026-09-29** — This UI uses two visually-similar-but-distinct dash glyphs
  for "empty" states in the same row: en dash `–` (U+2013) for "no data" (e.g.
  `formatCost(null)`) vs em dash `—` (U+2014) for other "n/a" fallbacks (e.g.
  `PRRow.tsx`'s unreviewed-score cell). `screen.getByText("—")` in a test will
  silently miss the en-dash one and vice versa — check which glyph the
  specific component actually renders before asserting on it. Evidence:
  `client/src/lib/format-cost.ts`,
  `client/src/app/repos/[repoId]/pulls/_components/PRRow/PRRow.tsx`.
- **2026-10-20** — Precise evidence for the entry above: the en dash is
  `client/src/lib/format-cost.ts:7`; the em dash is
  `client/src/app/repos/[repoId]/pulls/_components/PRRow/PRRow.tsx:55`.
- **2026-10-21** — The PR list's Findings column shows a count the SERVER
  computed (`findings_by_severity`) next to a popover the CLIENT derives from
  a different endpoint (`usePrReviews`), so the "which reviews count" rule is
  duplicated on both sides and nothing type-checks that they agree. Both must
  take each AGENT's latest review, not the PR's latest: the client copy is
  `FindingsPopover/helpers.ts:18` (`latestReviewPerAgent`), the server's is
  `server/src/modules/pulls/status.ts:34-70`. Changing either one alone makes
  the badge numbers and the popover list disagree on screen with no test
  failure to catch it — each side has its own unit coverage of the same rule
  instead. Evidence:
  `client/src/app/repos/[repoId]/pulls/_components/FindingsPopover/FindingsPopover.tsx:102`,
  `client/src/app/repos/[repoId]/pulls/_components/FindingsCell/FindingsCell.tsx:27`.
