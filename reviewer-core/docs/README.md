# reviewer-core/docs

Deeper design notes and decisions for the review engine that don't belong in
`reviewer-core/README.md` (stays a high-level pipeline map) or
`reviewer-core/CLAUDE.md` (stays a short agent brief).

- [`pipeline.md`](pipeline.md) — how `diff → prompt → LLM → grounded
  findings` is built: the pure entry point, the four pipeline stages,
  single-pass vs. map-reduce, and cost accumulation.
