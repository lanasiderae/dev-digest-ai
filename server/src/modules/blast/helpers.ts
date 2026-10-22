import type { BlastCaller, BlastRadius, DownstreamImpact } from '@devdigest/shared';
import type { BlastResult } from '../repo-intel/types.js';

/**
 * Pure Domain layer for the blast module — no Drizzle/Fastify/container types
 * in any signature, same shape as `pulls/helpers.ts`'s `buildSmartDiff`. This
 * is what keeps `server/test/blast-grouping.test.ts` a hermetic unit test.
 */

/**
 * Map the repo-intel facade's `BlastResult` into the wire-shape `BlastRadius`.
 *
 * `downstream` groups `result.callers` by `viaSymbol`. `tryPersistentBlast`
 * already sorts `callers` by `rank` DESC, so the most-important symbol leads
 * simply by preserving first-appearance order here — this function does no
 * re-sorting of its own. Within a group, callers keep their incoming order;
 * duplicates (same viaSymbol|file|symbol|line) are dropped — keyed on
 * viaSymbol too, since one call site can legitimately reach two different
 * changed symbols and both attributions must survive.
 *
 * A changed symbol with zero callers gets NO `downstream` entry — it still
 * appears in `changed_symbols`. Callers render `downstream` as "there is
 * something downstream"; the per-symbol empty state is derived client-side
 * from `changed_symbols` minus `downstream`.
 *
 * `endpoints_affected`/`crons_affected` per group are the union of
 * `result.factsByFile[f]` over THAT GROUP's own caller files only — never the
 * flat `result.impactedEndpoints`, which would assert an attribution
 * repo-intel never computed for the ripgrep/degraded path.
 */
export function toBlastRadius(result: BlastResult): BlastRadius {
  const changed_symbols = result.changedSymbols.map((s) => ({
    name: s.name,
    file: s.file,
    kind: s.kind,
  }));

  const order: string[] = [];
  const callersBySymbol = new Map<string, BlastCaller[]>();
  const filesBySymbol = new Map<string, Set<string>>();
  const seen = new Set<string>();

  for (const row of result.callers) {
    const key = `${row.viaSymbol}|${row.file}|${row.symbol}|${row.line}`;
    if (seen.has(key)) continue;
    seen.add(key);

    if (!callersBySymbol.has(row.viaSymbol)) {
      order.push(row.viaSymbol);
      callersBySymbol.set(row.viaSymbol, []);
      filesBySymbol.set(row.viaSymbol, new Set());
    }
    callersBySymbol.get(row.viaSymbol)!.push({ name: row.symbol, file: row.file, line: row.line });
    filesBySymbol.get(row.viaSymbol)!.add(row.file);
  }

  const downstream: DownstreamImpact[] = order.map((symbol) => {
    const callerFiles = filesBySymbol.get(symbol)!;
    const endpoints = new Set<string>();
    const crons = new Set<string>();
    if (result.factsByFile) {
      for (const file of callerFiles) {
        const facts = result.factsByFile[file];
        if (!facts) continue;
        for (const e of facts.endpoints) endpoints.add(e);
        for (const c of facts.crons) crons.add(c);
      }
    }
    return {
      symbol,
      callers: callersBySymbol.get(symbol)!,
      endpoints_affected: [...endpoints],
      crons_affected: [...crons],
    };
  });

  // Derived from `downstream` (post-dedup), not the raw `result.callers` —
  // the summary must count exactly what the grouped payload actually shows.
  const counts = {
    symbols: changed_symbols.length,
    callers: downstream.reduce((sum, d) => sum + d.callers.length, 0),
    files: new Set(downstream.flatMap((d) => d.callers.map((c) => c.file))).size,
    endpoints: new Set(downstream.flatMap((d) => d.endpoints_affected)).size,
    crons: new Set(downstream.flatMap((d) => d.crons_affected)).size,
  };

  return { changed_symbols, downstream, summary: buildBlastSummary(counts) };
}

/**
 * Deterministic one-line summary — no LLM, no `Date`, no randomness. Correct
 * singular/plural per term, zero-count terms omitted entirely, with an
 * explicit sentence for the two all-zero cases (no changed symbols at all vs.
 * changed symbols but nothing downstream).
 */
export function buildBlastSummary(counts: {
  symbols: number;
  callers: number;
  files: number;
  endpoints: number;
  crons: number;
}): string {
  if (counts.symbols === 0) return "No changed symbols detected in this PR's diff.";
  if (counts.callers === 0) {
    return `No downstream callers found for ${plural(counts.symbols, 'changed symbol')}.`;
  }

  const parts = [plural(counts.symbols, 'changed symbol')];
  parts.push(`${plural(counts.callers, 'caller')} in ${plural(counts.files, 'file')}`);
  if (counts.endpoints > 0) parts.push(plural(counts.endpoints, 'endpoint'));
  if (counts.crons > 0) parts.push(plural(counts.crons, 'cron'));
  return parts.join(' · ');
}

function plural(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? '' : 's'}`;
}
