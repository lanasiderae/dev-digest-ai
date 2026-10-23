import { describe, expect, it } from 'vitest';
import { BlastRadius } from '@devdigest/shared';
import { buildBlastSummary, toBlastRadius } from '../src/modules/blast/helpers.js';
import type { BlastResult } from '../src/modules/repo-intel/types.js';

describe('toBlastRadius', () => {
  it('groups callers by viaSymbol, preserving first-appearance (rank-desc) order', () => {
    const result: BlastResult = {
      changedSymbols: [
        { file: 'a.ts', name: 'rateLimit', kind: 'function' },
        { file: 'a.ts', name: 'helper', kind: 'function' },
      ],
      callers: [
        { file: 'b.ts', symbol: 'publicRouter', viaSymbol: 'helper', line: 5, rank: 2 },
        { file: 'c.ts', symbol: 'worker', viaSymbol: 'rateLimit', line: 10, rank: 9 },
      ],
      impactedEndpoints: [],
    };
    const blast = toBlastRadius(result);
    expect(blast.downstream.map((d) => d.symbol)).toEqual(['helper', 'rateLimit']);
  });

  it('keeps callers in incoming order within a group and dedupes on file|symbol|line', () => {
    const result: BlastResult = {
      changedSymbols: [{ file: 'a.ts', name: 'rateLimit', kind: 'function' }],
      callers: [
        { file: 'b.ts', symbol: 'first', viaSymbol: 'rateLimit', line: 1, rank: 0 },
        { file: 'c.ts', symbol: 'second', viaSymbol: 'rateLimit', line: 2, rank: 0 },
        { file: 'b.ts', symbol: 'first', viaSymbol: 'rateLimit', line: 1, rank: 0 }, // dup
      ],
      impactedEndpoints: [],
    };
    const blast = toBlastRadius(result);
    expect(blast.downstream[0]!.callers).toEqual([
      { name: 'first', file: 'b.ts', line: 1 },
      { name: 'second', file: 'c.ts', line: 2 },
    ]);
  });

  it('attributes endpoints/crons only from that group\'s own caller files, never the flat impactedEndpoints', () => {
    const result: BlastResult = {
      changedSymbols: [
        { file: 'a.ts', name: 'symA', kind: 'function' },
        { file: 'a.ts', name: 'symB', kind: 'function' },
      ],
      callers: [
        { file: 'routes-a.ts', symbol: 'callerA', viaSymbol: 'symA', line: 1, rank: 0 },
        { file: 'routes-b.ts', symbol: 'callerB', viaSymbol: 'symB', line: 1, rank: 0 },
      ],
      impactedEndpoints: ['GET /x', 'GET /y'],
      factsByFile: {
        'routes-a.ts': { endpoints: ['GET /x'], crons: [] },
        'routes-b.ts': { endpoints: ['GET /y'], crons: ['nightly'] },
      },
    };
    const blast = toBlastRadius(result);
    const symA = blast.downstream.find((d) => d.symbol === 'symA')!;
    const symB = blast.downstream.find((d) => d.symbol === 'symB')!;
    expect(symA.endpoints_affected).toEqual(['GET /x']);
    expect(symA.crons_affected).toEqual([]);
    expect(symB.endpoints_affected).toEqual(['GET /y']);
    expect(symB.crons_affected).toEqual(['nightly']);
  });

  it('factsByFile undefined -> every group endpoints/crons are [] (never leaks flat impactedEndpoints)', () => {
    const result: BlastResult = {
      changedSymbols: [{ file: 'a.ts', name: 'symA', kind: 'function' }],
      callers: [{ file: 'routes-a.ts', symbol: 'callerA', viaSymbol: 'symA', line: 1, rank: 0 }],
      impactedEndpoints: ['GET /x'],
      // factsByFile intentionally absent (ripgrep/degraded path)
    };
    const blast = toBlastRadius(result);
    expect(blast.downstream[0]!.endpoints_affected).toEqual([]);
    expect(blast.downstream[0]!.crons_affected).toEqual([]);
  });

  it('a changed symbol with zero callers appears in changed_symbols but not downstream', () => {
    const result: BlastResult = {
      changedSymbols: [
        { file: 'a.ts', name: 'symA', kind: 'function' },
        { file: 'a.ts', name: 'orphan', kind: 'function' },
      ],
      callers: [{ file: 'b.ts', symbol: 'caller', viaSymbol: 'symA', line: 1, rank: 0 }],
      impactedEndpoints: [],
    };
    const blast = toBlastRadius(result);
    expect(blast.changed_symbols.map((s) => s.name)).toEqual(['symA', 'orphan']);
    expect(blast.downstream.map((d) => d.symbol)).toEqual(['symA']);
  });

  it('a symbol\'s own declaration file never appears among its callers (upstream invariant, not repaired here)', () => {
    const result: BlastResult = {
      changedSymbols: [{ file: 'a.ts', name: 'symA', kind: 'function' }],
      callers: [{ file: 'b.ts', symbol: 'caller', viaSymbol: 'symA', line: 1, rank: 0 }],
      impactedEndpoints: [],
    };
    const blast = toBlastRadius(result);
    expect(blast.downstream[0]!.callers.every((c) => c.file !== 'a.ts')).toBe(true);
  });

  it('a caller row reaching two different changed symbols from the same file/symbol/line survives in both groups', () => {
    const result: BlastResult = {
      changedSymbols: [
        { file: 'a.ts', name: 'symA', kind: 'function' },
        { file: 'a.ts', name: 'symB', kind: 'function' },
      ],
      callers: [
        { file: 'b.ts', symbol: 'caller', viaSymbol: 'symA', line: 1, rank: 0 },
        { file: 'b.ts', symbol: 'caller', viaSymbol: 'symB', line: 1, rank: 0 },
      ],
      impactedEndpoints: [],
    };
    const blast = toBlastRadius(result);
    const symA = blast.downstream.find((d) => d.symbol === 'symA')!;
    const symB = blast.downstream.find((d) => d.symbol === 'symB')!;
    expect(symA.callers).toEqual([{ name: 'caller', file: 'b.ts', line: 1 }]);
    expect(symB.callers).toEqual([{ name: 'caller', file: 'b.ts', line: 1 }]);
  });

  it('summary counts reflect the deduped downstream payload, not the raw (pre-dedup) caller rows', () => {
    const result: BlastResult = {
      changedSymbols: [{ file: 'a.ts', name: 'symA', kind: 'function' }],
      callers: [
        { file: 'b.ts', symbol: 'caller', viaSymbol: 'symA', line: 1, rank: 0 },
        { file: 'b.ts', symbol: 'caller', viaSymbol: 'symA', line: 1, rank: 0 }, // dup, dropped
      ],
      impactedEndpoints: [],
    };
    const blast = toBlastRadius(result);
    expect(blast.downstream[0]!.callers).toHaveLength(1);
    expect(blast.summary).toBe('1 changed symbol · 1 caller in 1 file');
  });

  it('the output parses against the BlastRadius contract', () => {
    const result: BlastResult = {
      changedSymbols: [{ file: 'a.ts', name: 'symA', kind: 'function' }],
      callers: [{ file: 'b.ts', symbol: 'caller', viaSymbol: 'symA', line: 1, rank: 0 }],
      impactedEndpoints: [],
    };
    expect(() => BlastRadius.parse(toBlastRadius(result))).not.toThrow();
  });
});

describe('buildBlastSummary', () => {
  it('formats the multi-count case with singular/plural per term', () => {
    expect(
      buildBlastSummary({ symbols: 3, callers: 7, files: 5, endpoints: 2, crons: 1 }),
    ).toBe('3 changed symbols · 7 callers in 5 files · 2 endpoints · 1 cron');
  });

  it('formats singular forms', () => {
    expect(
      buildBlastSummary({ symbols: 1, callers: 1, files: 1, endpoints: 0, crons: 0 }),
    ).toBe('1 changed symbol · 1 caller in 1 file');
  });

  it('is explicit when there are changed symbols but no downstream callers', () => {
    expect(
      buildBlastSummary({ symbols: 3, callers: 0, files: 0, endpoints: 0, crons: 0 }),
    ).toBe('No downstream callers found for 3 changed symbols.');
  });

  it('is explicit when no changed symbols were detected at all', () => {
    expect(
      buildBlastSummary({ symbols: 0, callers: 0, files: 0, endpoints: 0, crons: 0 }),
    ).toBe("No changed symbols detected in this PR's diff.");
  });
});
