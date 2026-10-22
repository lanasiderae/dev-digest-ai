# INSIGHTS.md

## What Works

- **2026-10-22** — To reuse a create-form modal across two different entry
  points with different prefilled content (e.g. a blank "+ Add Skill" create
  vs. the Conventions page's "Create skill from accepted candidates"), add
  one optional `initial` prop that seeds the form's `useState` initializers
  and gets passed through on submit, rather than building a second modal
  component or forking the form logic. The modal defaults to today's blank
  behavior when `initial` is omitted, so the original call site needs no
  changes. Evidence: `client/src/app/skills/_components/SkillsListView/_components/CreateSkillModal/CreateSkillModal.tsx`
  (`initial?: { name?, description?, type?, body?, source?, evidenceFiles? }`),
  used blank from `SkillsListView.tsx` and prefilled from
  `client/src/app/repos/[repoId]/conventions/_components/ConventionsView/ConventionsView.tsx`.

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

## Tool & Library Notes

- **2026-10-21** — RTL's `getByDisplayValue` is unreliable for a controlled
  `<textarea>` whose value contains a newline in this setup (it reported
  "unable to find" even though the textarea visibly held the exact text) —
  use `container.querySelector('textarea')` + `expect(...).toHaveValue(...)`
  instead of `getByDisplayValue` whenever the value is multiline. Evidence:
  `client/src/app/skills/[id]/_components/SkillDetailPanel/SkillDetailPanel.test.tsx`
  (the working `container.querySelector("textarea")` form, after
  `getByDisplayValue("# Rule\nFlag secrets.")` failed to find the same
  element).

## Recurring Errors & Fixes

- **2026-10-21** — A component test fails with `Error: invariant expected
  app router to be mounted` the moment the component under test (or a child
  it renders) calls `next/navigation`'s `useRouter()` — add
  `vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(),
  replace: vi.fn() }) }))` to that test file. Easy to miss when copying a
  sibling component's test as a template if the sibling happens not to call
  `useRouter` (e.g. `ConfigTab` doesn't, but a new tab added alongside it
  that links elsewhere will). Evidence:
  `client/src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab/SkillsTab.test.tsx`.
