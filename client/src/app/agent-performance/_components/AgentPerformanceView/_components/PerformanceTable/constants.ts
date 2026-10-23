/**
 * Must match `MIN_DECISIONS_FOR_RATE` in
 * `server/src/modules/agent-stats/constants.ts` — duplicated by hand, same
 * as `src/vendor/shared` itself, since there is no shared non-contract
 * value channel between the two packages.
 */
export const MIN_DECISIONS_FOR_RATE = 5;
