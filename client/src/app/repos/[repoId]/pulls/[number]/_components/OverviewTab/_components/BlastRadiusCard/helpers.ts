import type { BlastRadius, ChangedSymbol, DownstreamImpact } from "@devdigest/shared";

/** One changed symbol paired with its downstream group, if any — the join
    `changed_symbols ∖ downstream` the card's per-symbol empty state needs.
    `downstream` is `null` (not omitted) for a symbol with zero callers; the
    card still renders that symbol's block, with the no-callers note instead
    of a caller list. */
export interface SymbolGroup {
  symbol: ChangedSymbol;
  downstream: DownstreamImpact | null;
}

export function groupSymbols(blast: BlastRadius): SymbolGroup[] {
  const bySymbolName = new Map(blast.downstream.map((d) => [d.symbol, d]));
  return blast.changed_symbols.map((symbol) => ({
    symbol,
    downstream: bySymbolName.get(symbol.name) ?? null,
  }));
}

/** "path/to/file.ts:42" — the caller label shown under each changed symbol. */
export function callerLabel(file: string, line: number): string {
  return `${file}:${line}`;
}

/** Stable identity for a changed symbol — used as both the React list key and
    the collapse-state map key, so the two stay in sync by construction. */
export function symbolKey(symbol: ChangedSymbol): string {
  return `${symbol.name}:${symbol.file}`;
}

export interface BlastCounts {
  symbols: number;
  callers: number;
  endpoints: number;
  crons: number;
}

/** Totals for the summary line — callers summed across groups; endpoints/crons
    deduped across groups (the same endpoint can be reachable from more than
    one changed symbol). */
export function totalCounts(blast: BlastRadius): BlastCounts {
  const endpoints = new Set<string>();
  const crons = new Set<string>();
  let callers = 0;
  for (const group of blast.downstream) {
    callers += group.callers.length;
    for (const e of group.endpoints_affected) endpoints.add(e);
    for (const c of group.crons_affected) crons.add(c);
  }
  return { symbols: blast.changed_symbols.length, callers, endpoints: endpoints.size, crons: crons.size };
}
