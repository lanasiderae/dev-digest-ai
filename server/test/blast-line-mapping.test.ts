import { describe, expect, it } from 'vitest';
import { mapOldLineToNewLine } from '../src/modules/blast/helpers.js';
import type { DiffHunk } from '@devdigest/shared';

/** Build a DiffHunk fixture without repeating `file`/`newLineNumbers`, which
 *  `mapOldLineToNewLine` never reads. */
function hunk(oldStart: number, oldLines: number, newStart: number, newLines: number): DiffHunk {
  return { file: 'f.ts', oldStart, oldLines, newStart, newLines, newLineNumbers: [] };
}

describe('mapOldLineToNewLine', () => {
  it('returns the line unchanged when there are no hunks', () => {
    expect(mapOldLineToNewLine([], 42)).toBe(42);
  });

  it('leaves a line before any hunk untouched', () => {
    expect(mapOldLineToNewLine([hunk(20, 2, 20, 5)], 10)).toBe(10);
  });

  it('shifts a line after an insertion forward by the inserted count', () => {
    // 3 lines inserted after old line 5.
    const hunks = [hunk(5, 0, 6, 3)];
    expect(mapOldLineToNewLine(hunks, 6)).toBe(9);
  });

  it('leaves the insertion anchor line itself unshifted', () => {
    const hunks = [hunk(5, 0, 6, 3)];
    expect(mapOldLineToNewLine(hunks, 5)).toBe(5);
  });

  it('shifts a line after a deletion backward by the removed count', () => {
    // old lines 10-12 deleted outright.
    const hunks = [hunk(10, 3, 10, 0)];
    expect(mapOldLineToNewLine(hunks, 13)).toBe(10);
  });

  it('clamps a line inside a replaced block into the new range', () => {
    // 2 old lines (20-21) replaced by 5 new lines (20-24).
    const hunks = [hunk(20, 2, 20, 5)];
    expect(mapOldLineToNewLine(hunks, 20)).toBe(20);
    expect(mapOldLineToNewLine(hunks, 21)).toBe(21);
  });

  it('shifts a line after a replacement by the net line delta', () => {
    const hunks = [hunk(20, 2, 20, 5)]; // +3 net
    expect(mapOldLineToNewLine(hunks, 22)).toBe(25);
  });

  it('accumulates offsets across multiple hunks regardless of input order', () => {
    const insertion = hunk(5, 0, 6, 3); // +3 after line 5
    const deletion = hunk(10, 3, 10, 0); // -3 at lines 10-12
    // Net effect on a line after both: +3 - 3 = 0.
    expect(mapOldLineToNewLine([deletion, insertion], 15)).toBe(15);
  });
});
