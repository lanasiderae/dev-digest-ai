import type { LogLevel } from './config.js';

/**
 * stderr-only structured logger. stdout is owned end to end by the JSON-RPC
 * stdio transport — a stray write there would corrupt the protocol stream, so
 * every log line goes to `process.stderr`, never `console.*` (lint-enforced
 * via `no-console: error`).
 *
 * `LogFields` is deliberately flat (string | number | boolean | null, no
 * nested objects/arrays) so a response body or finding text cannot be passed
 * as a field without a TypeScript error — the mechanical guard against ever
 * logging review content.
 */
export type LogFields = Record<string, string | number | boolean | null>;

export interface Logger {
  error(msg: string, fields?: LogFields): void;
  warn(msg: string, fields?: LogFields): void;
  info(msg: string, fields?: LogFields): void;
  debug(msg: string, fields?: LogFields): void;
}

const LEVEL_RANK: Record<LogLevel, number> = { silent: 0, error: 1, warn: 2, info: 3, debug: 4 };

export function createLogger(level: LogLevel): Logger {
  const rank = LEVEL_RANK[level];
  function write(lineLevel: Exclude<LogLevel, 'silent'>, msg: string, fields?: LogFields): void {
    if (rank < LEVEL_RANK[lineLevel]) return;
    const line = JSON.stringify({ ts: new Date().toISOString(), level: lineLevel, msg, ...fields });
    process.stderr.write(line + '\n');
  }
  return {
    error: (msg, fields) => write('error', msg, fields),
    warn: (msg, fields) => write('warn', msg, fields),
    info: (msg, fields) => write('info', msg, fields),
    debug: (msg, fields) => write('debug', msg, fields),
  };
}
