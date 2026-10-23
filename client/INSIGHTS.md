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
- **2026-10-23** — `RunTraceDrawer`'s existing `PromptBlock` sub-component
  already defaults `open` to `false` and renders `{text || "—"}` verbatim
  inside a `<pre>` — i.e. it already is a "collapsed-by-default, reveal-exact-
  text-on-expand" component, not something specific to the Prompt assembly
  section. Passing it a new `label`/`color` reused it as-is for L05's literal
  `project context attached specs` expandable section, satisfying that AC's
  "collapsed by default" and "verbatim, no re-wrapping" requirements for free
  (plus copy/fullscreen for free). Prefer reusing it over writing a bespoke
  collapsible whenever a new trace sub-section needs the same shape. Evidence:
  `client/src/app/repos/[repoId]/pulls/[number]/_components/RunTraceDrawer/_components/ProjectContextSection/ProjectContextSection.tsx`.

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

- **2026-10-22** — L05 TASK-02 added `agents.project_context`/`skills.project_context`
  jsonb DB columns and the standalone `project-context.ts` contract, but
  deliberately left `contracts/knowledge.ts`'s `Agent`/`Skill` Zod objects
  untouched (CRUD threading is TASK-04's job, not yet landed as of this
  entry) — so `agent.project_context`/`skill.project_context` do NOT exist on
  those types yet even though the DB column does. A consumer that needs to
  read/write the field before TASK-04 lands should widen locally with an
  intersection type (`Agent & { project_context?: ProjectContextSelectionList }`)
  rather than editing the shared vendored contract out of turn — the field
  will be unioned into the "real" `Agent`/`Skill` contract and a `Pick`-based
  patch type once CRUD threading is actually implemented, at which point this
  local widening should be deleted, not layered on top of a formal field.
  Evidence: `client/src/lib/hooks/project-context.ts` (`WithProjectContext<T>`,
  `readProjectContext`), `client/src/lib/hooks/agents.ts`'s
  `UpdateAgentInput.patch` and the identical note in
  `client/src/lib/hooks/skills.ts`'s `UpdateSkillInput.patch`.
- **2026-10-22** — There is a pre-existing, UNRELATED "Project Context" feature
  already in the codebase: `lib/hooks/core.ts`'s `useContextFiles`/
  `useReindexContext` (repo-intel's code-chunk embedding/indexing pipeline,
  `SpecFile`/`IndexStatus` types) and `messages/en/context.json` (currently
  unconsumed — no `useTranslations("context")` call anywhere). L05's Project
  Context Folder feature (manual Markdown-document selection,
  `contracts/project-context.ts`) is a completely different feature that
  happens to share the English name. Do not reuse `context.json` or
  `useContextFiles` for L05 work — the new feature's shared selector uses its
  own `messages/en/project-context.json` namespace and
  `lib/hooks/project-context.ts`. Evidence:
  `client/src/vendor/shared/contracts/project-context.ts`'s own doc comment
  already calls this out; `client/messages/en/context.json`.
- **2026-10-22** — When a document-selection UI supports server-side search
  filtering, detecting "a previously selected document no longer exists"
  needs an UNFILTERED discovery query, not the search-filtered one — a
  selected document that simply doesn't match the current search text would
  otherwise look identically "missing" to one that's actually gone. Running
  both an unfiltered and a filtered query against the same React Query cache
  costs nothing extra when the search box is empty (identical query key,
  deduped automatically) and only adds a real second request while the user
  is actively typing a search term. Evidence:
  `client/src/components/project-context/ProjectContextSelector/ProjectContextSelector.tsx`
  (`baseline`/`filtered` discovery queries).

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
- **2026-10-23** — RTL's `getByText`/`queryByText` apply a default normalizer
  that collapses whitespace (including newlines) on the RENDERED text before
  comparing, but do not normalize a multiline string passed in as the
  matcher — so asserting a `<pre>` block renders a multiline string
  byte-for-byte (e.g. "reveal this trace snapshot verbatim, no re-wrapping")
  can never pass via `getByText(multilineString)`: the matcher still has
  literal `\n`, the normalized rendered text has those collapsed to spaces.
  Use `container.querySelector("pre")?.textContent` and `toBe(exactString)`
  instead, bypassing the normalizer entirely. Distinct from the existing
  `getByDisplayValue`-on-multiline-textarea entry above — this is the same
  family of gotcha but a different RTL query (`getByText`) and a different
  element (`<pre>`, not `<textarea>`). Evidence:
  `client/src/app/repos/[repoId]/pulls/[number]/_components/RunTraceDrawer/_components/ProjectContextSection/ProjectContextSection.test.tsx`
  ("collapses the attached-specs section by default and reveals the exact
  text, unmodified, on expand").

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
