# client UI architecture

Server/Client Component boundaries and the data-fetching pattern. Deeper
than `client/README.md` (a route map) and `client/CLAUDE.md` (a short agent
brief) — this explains *why* the app is shaped this way.

## Server/Client Component boundary: almost everything is Client

This is a Next.js 15 App Router project, but it is **not** a typical
server-rendered-data app. The only real Server Component is the root
`src/app/layout.tsx` (an `async function`, no `"use client"`) — it resolves
the locale and messages via `next-intl/server`'s `getLocale()`/
`getMessages()` and injects a no-FOUC inline theme script, both of which
genuinely need to run server-side once per request. Every page below it —
even the ones whose own `page.tsx` has no `"use client"` directive, like
`src/app/agents/page.tsx` and `src/app/settings/[section]/page.tsx` — is a
trivial pass-through to a `"use client"` view component
(`_components/AgentsListView`, `_components/SettingsView`, …), so the
entire interactive tree below the root layout renders client-side.

**Why**: all real data (repos, PRs, reviews, findings, agents, settings)
lives behind the separate Fastify API (`:3001`), fetched client-side via
TanStack Query — not Next.js server-side data fetching (`fetch` in a Server
Component, route handlers as a BFF, etc.). There is no server-rendered
initial data to hydrate; a page's first paint is a loading skeleton that
resolves once the client-side query completes. Treat any future "should
this be a Server Component" question with that constraint in mind: a
component only benefits from being a Server Component here if it needs
something genuinely server-only (locale, cookies, env secrets) — not for
"performance" in the SSR-data sense, since there's no server-fetched data to
save a round trip on.

## Data access: TanStack Query hooks, never raw `fetch`

Every data read/write goes through a hook in `src/lib/hooks/*`
(`core.ts`, `agents.ts`, `reviews.ts`, `repo-intel.ts`, `trace.ts`, all
re-exported from `index.ts`), each wrapping `src/lib/api.ts`'s typed
`api.get`/`api.post`/… against `NEXT_PUBLIC_API_BASE` (default
`http://localhost:3001`). A component never calls `fetch` directly — see
`client/CLAUDE.md`'s Conventions. This is what lets component tests mock
`fetch` once at the boundary (`client/CLAUDE.md` Gotchas) rather than
mocking each component's own data access individually.

Two closely-related but distinct patterns live side by side in
`lib/hooks/reviews.ts`:

- **Polling** for state that changes server-side independent of this
  client — `usePrActiveRuns`/`usePrRuns` poll (`refetchInterval`) only while
  something is actually running, so they self-clear without the caller
  managing a subscription lifecycle.
- **SSE** for a single run's live event stream (`trace.ts`) — a true
  push channel, not polled, since `GET /runs/:id/events` is the
  replay-first SSE endpoint (see `server/specs/review-flow.md`).

Both exist because they solve different problems: the list of *which* runs
are active is a query that changes slowly enough to poll; the *content* of
one specific run's live log is a stream you'd otherwise have to poll far
too aggressively to feel real-time.

## Overlays: local component state, not a URL-driven pattern

The one page-level overlay in this app, `RunTraceDrawer`, is mounted via
local `useState` in its parent page (`[number]/page.tsx`), not a URL query
param — there's no project-wide "overlays live in the URL" convention to
follow for a new popover/drawer. A new transient overlay (e.g. the PR list's
`FindingsPopover`) should default to local state in whichever component
owns the trigger, the same way, rather than inventing a query-param scheme
for a single call site.

## Vendored, not installed: `@devdigest/ui` and `@devdigest/shared`

`src/vendor/ui` and `src/vendor/shared` are **copied** `.ts(x)` files, not
real npm packages (no `package.json` in `src/vendor/shared`) — despite the
package-style import names. `src/vendor/shared` in particular must be kept
byte-identical to `server/src/vendor/shared` **by hand**; there is no tool
that syncs them (see root `INSIGHTS.md` — 5 files were already found
drifted during this session, pre-existing and unrelated to any one
feature's change). Before changing a shared contract, change both copies in
the same edit, and diff them afterward.

## i18n: `next-intl`, message keys not hardcoded strings

New user-facing copy goes in `messages/<locale>/*.json` (currently only
`en/`), consumed via `useTranslations("<namespace>")` — never a hardcoded
string in JSX (`client/CLAUDE.md` Conventions). Message keys are nested
camelCase, namespaced by feature/section — see root `CLAUDE.md`'s Naming
conventions.
