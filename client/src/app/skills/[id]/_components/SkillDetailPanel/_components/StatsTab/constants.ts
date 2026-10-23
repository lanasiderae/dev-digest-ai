/**
 * Must match `MIN_DECISIONS_FOR_RATE` in
 * `server/src/modules/agent-stats/constants.ts` — duplicated by hand like
 * every other client/server value here (see `PerformanceTable/constants.ts`'s
 * own copy for the Agent dashboard's identical rule).
 */
export const MIN_DECISIONS_FOR_RATE = 5;
