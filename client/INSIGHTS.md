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
- **2026-10-22** — Correction/extension to the entry directly above: Smart Diff
  added a THIRD independent client-side reimplementation of the same "latest
  review per agent, `kind='review'` only" rule —
  `DiffTab/helpers.ts`'s `latestFindingsByPath` — needed to render inline
  findings in the diff viewer. The server side stayed single-implementation
  (the new `/pulls/:id/smart-diff` handler reuses the existing
  `latestReviewPerAgent` helper rather than reimplementing it), but client-side
  there are now two independent copies of the same agent-dedup logic
  (`FindingsPopover/helpers.ts` and `DiffTab/helpers.ts`) with no type-level
  check that they agree. A shared client helper, mirroring the server's
  reusable one, would remove this. Evidence:
  `client/src/app/repos/[repoId]/pulls/[number]/_components/DiffTab/helpers.ts`
  (`latestFindingsByPath`).
- **2026-10-22** — A shared cross-route component (`client/src/components/diff-viewer/`)
  needs a render-prop to show a route-owned presentational component, since
  importing it directly would violate `frontend-ui-architecture`'s
  no-cross-route-`_components`-import rule. `DiffFindingApi.renderFinding:
  (f) => ReactNode` follows the exact same shape as the pre-existing
  `DiffCommentApi.onSubmit` for GitHub comments — the general pattern for
  letting a shared `components/` piece delegate rendering to a route's own
  component. Evidence: `client/src/components/diff-viewer/findings.ts`
  (`DiffFindingApi`), `client/src/components/diff-viewer/comments.ts`
  (`DiffCommentApi`).

## Tool & Library Notes

- **2026-10-22** — `agent-browser scroll`/`scrollintoview` act on the page's
  default scrolling element, but the PR detail route's scrollable region is
  an inner `<main>` (the `AppShell` layout), not `window`/`body` — so
  `agent-browser scroll down <px>` is a silent no-op there (no error,
  screenshot just doesn't move) and `scrollintoview "text=..."` also did
  nothing useful. What worked: `agent-browser eval
  "document.querySelector('main').scrollTop = N"`, or better,
  `element.scrollIntoView({block:'center'})` done via `eval` in one call (a
  separate `eval` to compute an element's offset, then a second `eval` to
  set `scrollTop`, raced against in-flight layout shifts from the page's own
  data loading and landed on stale coordinates). Evidence: observed verifying
  `BlastRadiusCard`'s new "Prior PRs touching these files" footer against
  the real `lanasiderae/dev-digest-ai` PR #5, where `main`'s
  `scrollHeight` was ~7000px against a ~950px `clientHeight`.

- **2026-10-21** — RTL's `getByDisplayValue` is unreliable for a controlled
  `<textarea>` whose value contains a newline in this setup (it reported
  "unable to find" even though the textarea visibly held the exact text) —
  use `container.querySelector('textarea')` + `expect(...).toHaveValue(...)`
  instead of `getByDisplayValue` whenever the value is multiline. Evidence:
  `client/src/app/skills/[id]/_components/SkillDetailPanel/SkillDetailPanel.test.tsx`
  (the working `container.querySelector("textarea")` form, after
  `getByDisplayValue("# Rule\nFlag secrets.")` failed to find the same
  element).
- **2026-10-22** — jsdom doesn't implement `Element.prototype.scrollIntoView`
  (calling it throws `"... scrollIntoView is not a function"`) — several
  "jump to X" affordances (`FileCard`, `RoleGroup`'s findings-badge cycling,
  `ReviewRunAccordion`) call it unconditionally, so any test exercising that
  path crashes unless stubbed. A global no-op stub was added to
  `client/src/test/setup.ts` (mirroring the existing `ResizeObserver` stub),
  which is what lets a test actually assert which element got scrolled into
  view. Evidence: `client/src/test/setup.ts`,
  `client/src/app/repos/[repoId]/pulls/[number]/_components/DiffTab/_components/RoleGroup/RoleGroup.test.tsx`.

## Recurring Errors & Fixes

- **2026-10-22** — A flex row with a long unbounded-width text child (e.g. a
  file path) silently pushes trailing siblings (a count label, a chevron)
  off the visible edge of the page instead of wrapping or ellipsizing, even
  with `overflow: hidden` + `textOverflow: "ellipsis"` + `whiteSpace: "nowrap"`
  set on that child — a flex item's default `min-width: auto` means it won't
  shrink below its content's intrinsic width, so the ellipsis CSS never
  engages. Fix: also set `minWidth: 0` (plus `flex: 1`) on that child. RTL/
  jsdom tests never catch this — jsdom doesn't do layout, so `getByText`
  still finds the pushed-off-screen content; it only showed up testing in a
  real browser against a PR with long paths (`agent-browser`, 97-symbol PR).
  Evidence: `client/src/app/repos/[repoId]/pulls/[number]/_components/OverviewTab/_components/BlastRadiusCard/styles.ts`
  (`symbolFile`).
- **2026-10-21** — A component test fails with `Error: invariant expected
  app router to be mounted` the moment the component under test (or a child
  it renders) calls `next/navigation`'s `useRouter()` — add
  `vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(),
  replace: vi.fn() }) }))` to that test file. Easy to miss when copying a
  sibling component's test as a template if the sibling happens not to call
  `useRouter` (e.g. `ConfigTab` doesn't, but a new tab added alongside it
  that links elsewhere will). Evidence:
  `client/src/app/agents/[id]/_components/AgentEditor/_components/SkillsTab/SkillsTab.test.tsx`.
