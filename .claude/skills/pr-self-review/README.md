# PR Self Review — Sources & Scoping

**Type:** Workflow (Skill Dispatcher). Unlike `onion-architecture` and
`frontend-ui-architecture`, this skill wasn't built from an external
research pass — there's no third-party "PR self-review best practice" to
cite. It's a dispatcher over knowledge this repo already has: the other
entries in `.claude/skills/`. Its correctness depends on staying current
with that catalog, not on any external source.

## No external sources

This skill has no `## Sources` table because it makes no claims of its
own about Fastify, React, Postgres, security, etc. Every substantive rule
it applies is owned by the skill it dispatched to; if one of those rules
turns out to be wrong, the fix belongs in that skill, not here.

## Project-specific grounding (what this skill actually depends on)

- `.claude/skills/README.md` — the catalog this skill matches files
  against. If a skill is added, removed, or rescoped there, the
  `SKILL.md` matching table must be updated in the same change — they
  will drift otherwise, since nothing enforces the link automatically.
- Every matched skill's own `SKILL.md` (and anything it points to —
  `rules/*.md`, `examples.md`) — this skill never re-derives a rule, it
  reads and applies the owning skill's current text each time.
- Root `CLAUDE.md` — the package boundaries (`server/`, `client/`,
  `reviewer-core/`, `e2e/`) and naming conventions the matching table's
  path patterns are grounded in.
- `onion-architecture`'s and `frontend-ui-architecture`'s own
  CRITICAL/HIGH/MEDIUM severity levels — reused verbatim rather than
  inventing a fourth vocabulary; see `SKILL.md`'s "Severity normalization".
- Root `INSIGHTS.md` (Codebase Patterns, 2026-10-21) — documents that this
  skill is deliberately a single-file, no-triad build, as a process/meta
  skill rather than an externally-researched one. Read that entry before
  assuming every skill here needs `research_notes/`/`reports/`.

## How this skill was scoped

- **In scope**: deciding which cataloged skill applies to which changed
  file, running that skill's rules, normalizing severity, and gating the
  PR on CRITICAL findings.
- **Explicitly out of scope** (to avoid duplicating sibling tools):
  - General correctness/reuse/efficiency bugs with no tie to this repo's
    skill catalog → `/code-review`.
  - A standalone OWASP pass independent of which files changed →
    `/security-review`.
  - Any domain rule itself (what counts as a layering violation, an unsafe
    query, an insecure endpoint, …) → the owning skill in the catalog,
    never this file. This skill only decides *whether* that skill applies
    and *whether its output blocks the PR*.

## Maintenance note

Because this skill's value is entirely in staying synced with the catalog,
re-check its matching table whenever `.claude/skills/README.md`'s catalog
changes — a new skill with no row here will silently never be dispatched,
and a removed skill left in the table will dispatch to nothing.
