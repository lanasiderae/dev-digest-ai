import type { BlastCaller, FindingRecord } from '@devdigest/shared';

/** Pure response-shaping helpers — turn a full API payload into the concise
 *  shape a tool actually returns, never a raw API dump. No I/O, no grouping
 *  logic of its own: every tool using these feeds them an already-grouped
 *  server payload. */

export const MAX_FINDINGS_PER_REVIEW = 30;
export const MAX_CALLERS_PER_SYMBOL_OUT = 20;
export const MAX_LIST_HINT = 20;

export interface ConciseFinding {
  severity: FindingRecord['severity'];
  category: FindingRecord['category'];
  file: string;
  line: number;
  title: string;
  confidence: number;
  status: 'open' | 'accepted' | 'dismissed';
}

export function conciseFinding(f: FindingRecord): ConciseFinding {
  return {
    severity: f.severity,
    category: f.category,
    file: f.file,
    line: f.start_line,
    title: f.title,
    confidence: f.confidence,
    status: f.accepted_at ? 'accepted' : f.dismissed_at ? 'dismissed' : 'open',
  };
}

/** "path/to/file.ts:42 (callerName)" — the caller label the blast-radius tool
 *  surfaces per symbol. */
export function callerLabel(c: BlastCaller): string {
  return `${c.file}:${c.line} (${c.name})`;
}

export interface Truncated<T> {
  items: T[];
  truncated: boolean;
  total: number;
}

export function truncate<T>(list: T[], max: number): Truncated<T> {
  return { items: list.slice(0, max), truncated: list.length > max, total: list.length };
}
