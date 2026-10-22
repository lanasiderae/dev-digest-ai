# Frontend UI Architecture Skill — Sources

This skill (current version: **1.2.0**, see `SKILL.md` frontmatter) was built from a four-part research pass covering: component folder structure, component design/composition patterns, business-logic/state layering, and constants/utils/naming conventions — synthesized into one report and cross-checked against this repo's own `client/AGENTS.md` and `client/docs/ui-architecture.md`.

The skill content is split, mirroring this repo's `onion-architecture` skill's `rules/` convention rather than one monolithic file: `rules/layout.md` (the structural picture — folder structure, Next.js primitives, pages vs. page-specific vs. shared components, component file-vs-folder threshold) and `rules/conventions.md` (the checkable rules — where business logic lives, constants/utils/types placement, naming, decision checklist). `SKILL.md` itself is a lean index pointing at both, plus `examples.md`.

Every claim in `rules/*.md` and `examples.md` traces back to one of the sources below. Where a source is secondary (an aggregator or community blog corroborating, rather than originating, a claim) it's noted as such.

## How this skill was scoped

- **In scope**: where code physically lives (folder/file structure), the colocate-vs-centralize decision, hook-vs-util placement, business-logic/data-access layering, naming conventions for files and exports.
- **Explicitly out of scope** (to avoid duplicating sibling skills in this repo):
  - Component-internal design, state-management rules, hooks misuse, performance → `react-best-practices`
  - Next.js routing conventions, Server/Client data-fetching mechanics, metadata, bundling → `next-best-practices`

## Sources

| URL | Title | Relevance |
|---|---|---|
| https://legacy.reactjs.org/docs/faq-structure.html | React Docs FAQ: File Structure | Official (legacy) React position: no opinion on structure, cap nesting at 3-4 levels |
| https://dev.to/pramod_boda/recommended-folder-structure-for-react-2025-48mc | Recommended Folder Structure for React 2025 | Secondary source describing react.dev's current colocation-first stance |
| https://nextjs.org/docs/app/getting-started/project-structure | Next.js Docs: Project structure and organization | Official Next.js colocation mechanics, private folders, route groups |
| https://dev.to/bridget_amana/understanding-route-visibility-and-colocation-in-nextjs-app-router-2bni | Understanding Route Visibility and Colocation in Next.js App Router | Community `_components` convention built on Next.js private folders |
| https://makerkit.dev/blog/tutorials/nextjs-app-router-project-structure | Next.js 16 App Router Project Structure | Corroborates `_components` colocation pattern in production use |
| https://kentcdodds.com/blog/colocation | Kent C. Dodds: Colocation | Foundational colocation principle applied to tests, styles, utils |
| https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md | bulletproof-react: project-structure.md | Feature-folder architecture, unidirectional dependency rule, shared config/utils/types layout |
| https://www.joshwcomeau.com/react/file-structure/ | Josh W. Comeau: Delightful React File/Directory Structure | Counter-position on type-based structure, component-folder threshold, barrel-file defense |
| https://dev.to/snoopydev/make-it-work-first-split-after-creating-components-without-pain-react-1l71 | Make It Work First, Split After | Community heuristic for single-file-to-split threshold |
| https://forum.freecodecamp.org/t/do-functional-components-need-their-own-separate-js-file/204316 | freeCodeCamp Forum: separate file threshold discussion | Supporting community discussion on file-splitting heuristic |
| https://medium.com/@deltaromeoyanki/mastering-react-folder-structures-your-ultimate-guide-to-scalable-and-maintainable-projects-5e200d630025 | Mastering React Folder Structures | Community synthesis matching bulletproof-react/Comeau component file set |
| https://github.com/gaearon/overreacted.io | gaearon/overreacted.io GitHub repo | Dan Abramov's own site structure, cited as incidental not prescriptive |
| https://reactuse.com/blog/barrel-files-tree-shaking/ | Barrel Files — Why index.ts Re-Exports Hurt Tree Shaking | Primary technical analysis with measured bundle-size/dev-performance regressions from barrels |
| https://dev.to/adioof/barrel-files-are-the-clean-code-habit-quietly-wrecking-your-bundle-1cn6 | Barrel files are the clean-code habit quietly wrecking your bundle | Corroborates anti-barrel consensus as mainstream, not fringe |
| https://codecompose.com/articles/why-i-prefer-barrel-files-in-2026/ | Why I Prefer Barrel Files in 2026 | Evidence the barrel-file debate remains unsettled (dissenting view, not fetched in full) |
| https://react.dev/learn/thinking-in-react | React docs: Thinking in React | Official component-decomposition and data-model-alignment guidance |
| https://react.dev/learn/passing-props-to-a-component | React docs: Passing Props to a Component | Official guidance on extracting components, children prop, prop-spread anti-pattern |
| https://legacy.reactjs.org/docs/composition-vs-inheritance.html | Composition vs Inheritance (legacy.reactjs.org) | Foundational containment/specialization composition patterns |
| https://www.patterns.dev/react/presentational-container-pattern/ | patterns.dev: Container/Presentational Pattern | Authoritative statement that Hooks have subsumed the container/presentational split |
| https://mirrorcodex.com/presentational-vs-container-components/ | Presentational vs Container: Still Relevant in 2025? | Secondary commentary corroborating pattern's decline |
| https://allinsightlab.com/container-vs-presentational-components-still-relevant-in-2025/ | Container Vs Presentational Components: Still Relevant In 2025? | Nuanced middle position on pattern's residual value in large apps |
| https://kentcdodds.com/blog/when-to-break-up-a-component-into-multiple-components | Kent C. Dodds: When to break up a component into multiple components | Primary named heuristic (7 triggers) for when to split a component |
| https://react.dev/learn/passing-data-deeply-with-context | React docs: Passing Data Deeply with Context | Official props → composition → context precedence for prop drilling |
| https://non-traditional.dev/how-to-avoid-prop-drilling-with-composition-6862cd4e253a | How to Avoid Prop Drilling with Composition | Independent elaboration of children/named-slot composition pattern |
| https://kentcdodds.com/blog/state-colocation-will-make-your-react-app-faster | Kent C. Dodds: State Colocation will make your React app faster | Canonical source for state colocation principle and escalation path |
| https://x.com/kentcdodds/status/1251654913366519809 | Kent C. Dodds on X | Secondary confirmation of Dodds's colocation-first state philosophy at scale |
| https://react.dev/learn/reusing-logic-with-custom-hooks | React docs: Reusing Logic with Custom Hooks | Official mechanical test for hook vs plain function, naming convention |
| https://github.com/alan2207/bulletproof-react/blob/master/docs/api-layer.md | bulletproof-react: api-layer.md | Three-layer API/business-logic architecture (contracts, fetcher, hook) |
| https://tkdodo.eu/blog/react-query-as-a-state-manager | TkDodo: React Query as a State Manager | Smart/dumb split deprecated; React Query as general async state manager |
| https://tkdodo.eu/blog/practical-react-query | TkDodo: Practical React Query | Server-state vs client-state definitions, anti-pattern warnings |
| https://nextjs.org/docs/app/getting-started/fetching-data | Next.js docs: Fetching Data | Official data-fetching patterns for Server and Client Components |
| https://woyable.com/en/posts/react-state-management-comparison | React State Management Comparison (2026) | Secondary industry source on 2026 default state-management stack and adoption figures |
| https://react.dev/learn/you-might-not-need-an-effect | React docs: You Might Not Need an Effect | Official derived-state anti-pattern and render-time computation rule |
| https://overreacted.io/writing-resilient-components/ | Dan Abramov: Writing Resilient Components | Controlled-vs-uncontrolled framing underlying derived-state guidance |
| https://tkdodo.eu/blog/react-query-and-forms | TkDodo: React Query and Forms | Sanctioned derived-state pattern combining server and client state in forms |
| https://nextjs.org/docs/app/getting-started/server-and-client-components | Next.js docs: Server and Client Components | Official rule for where business logic lives post-RSC |
| https://nextjs.org/docs/app/getting-started/mutating-data | Next.js docs: Mutating Data | Official Server Actions pattern for mutation logic and authorization |
| https://dev.to/ottoaria/nextjs-app-router-in-2026-the-complete-guide-for-full-stack-developers-5bjl | Next.js App Router in 2026 | Secondary commentary on Server Actions separating view/business logic |
| https://github.com/airbnb/javascript | Airbnb JavaScript Style Guide | Naming conventions for constants, components, variables |
| https://github.com/calcom/cal.com/blob/main/packages/lib/constants.ts | cal.com packages/lib/constants.ts | Production example of environment-constant conventions at scale |
| https://mattilehtinen.com/articles/dunghill-anti-pattern-why-utility-classes-and-modules-smell/ | Dunghill Anti-Pattern | Critique of generic catch-all utils/constants files |
| https://www.robinwieruch.de/react-folder-structure/ | Robin Wieruch: React Folder Structure Best Practices | Current community guidance on utils/types colocation and feature-owns-its-slice pattern |
| https://github.com/alan2207/bulletproof-react/blob/master/docs/project-standards.md | bulletproof-react: project-standards.md | ESLint-enforced kebab-case naming convention for non-component files |

## Project-specific grounding (not external sources, but load-bearing)

- `client/AGENTS.md` — this repo's existing data-hook and `_components/` colocation conventions, which the skill reinforces rather than overrides.
- `client/docs/ui-architecture.md` — why this client fetches everything through a client-side TanStack Query hook layer rather than Server-Component fetching; cited in `rules/conventions.md`'s business-logic section as a valid, consistent ownership model.
- Root `CLAUDE.md` — Naming conventions section; this skill's naming rules are written to match it exactly.
