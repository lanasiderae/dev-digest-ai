# server/specs

Formal specs (API contracts, migration plans, feature specs) for server work
that benefits from a written spec before implementation.

- [`review-flow.md`](review-flow.md) — the review-run contract: trigger →
  background execution → persistence/trace/events → cost derivation →
  cancellation.
