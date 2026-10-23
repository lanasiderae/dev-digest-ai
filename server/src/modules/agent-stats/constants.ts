/**
 * L08 — Agent Performance Dashboard (APD). Range-window + low-sample
 * constants shared by both routes (`GET /agents/:id/stats`,
 * `GET /agents/performance`) via `helpers.ts`'s `resolveRange`.
 */

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;
export const THIRTY_DAYS_MS = 30 * ONE_DAY_MS;

/**
 * Minimum `accepted + dismissed` decisions before an agent's `accept_rate`
 * is trusted enough to sort/rank on at face value (APD-AC-08). The contract
 * fields stay `number | null` below this threshold — the server still
 * COMPUTES and returns `accept_rate`, it never excludes it — it is the
 * CLIENT (`PerformanceTable`) that marks a row low-sample and segregates it
 * when sorting by accept rate.
 *
 * Not read by any computation in this module today (the low-sample decision
 * is entirely client-side); it is documented here as the single canonical
 * value so the client's own copy (duplicated by hand, same as
 * `src/vendor/shared` itself — there is no shared non-contract value channel
 * between the two packages) has one source of truth to match.
 */
export const MIN_DECISIONS_FOR_RATE = 5;
