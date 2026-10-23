import { z } from 'zod';

/**
 * Pure config loader — throws `ConfigError`, never calls `process.exit`.
 * Only `src/index.ts` (the entrypoint) is allowed to exit the process; every
 * other module stays testable by throwing instead.
 */
export class ConfigError extends Error {}

export type LogLevel = 'silent' | 'error' | 'warn' | 'info' | 'debug';
const LOG_LEVELS: readonly LogLevel[] = ['silent', 'error', 'warn', 'info', 'debug'];

export interface McpConfig {
  apiBase: string;
  runTimeoutMs: number;
  requestTimeoutMs: number;
  logLevel: LogLevel;
}

const TimeoutValue = z.coerce.number().int().positive();

const DEFAULT_API_BASE = 'http://127.0.0.1:3001';
const DEFAULT_RUN_TIMEOUT_MS = 300_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
const DEFAULT_LOG_LEVEL: LogLevel = 'info';

/**
 * Loopback-only by default. A non-loopback base is accepted only when it's
 * `https:` (encrypted in transit) or the caller explicitly opts in via
 * `DEVDIGEST_MCP_ALLOW_REMOTE_API` — this guards against a careless
 * `DEVDIGEST_API_BASE` pointing the server at an arbitrary host over plain
 * HTTP. The base must be a bare origin (no path/query/hash) so every tool's
 * `${apiBase}${path}` concatenation stays unambiguous.
 */
function parseApiBase(raw: string, allowRemote: boolean): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new ConfigError(`DEVDIGEST_API_BASE is not a valid URL: "${raw}"`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new ConfigError(`DEVDIGEST_API_BASE must be http: or https: — got "${url.protocol}"`);
  }
  if (url.pathname !== '/' && url.pathname !== '') {
    throw new ConfigError(`DEVDIGEST_API_BASE must be a bare origin with no path — got "${raw}"`);
  }
  if (url.search || url.hash) {
    throw new ConfigError(`DEVDIGEST_API_BASE must be a bare origin with no query/hash — got "${raw}"`);
  }

  const isLoopback = url.hostname === '127.0.0.1' || url.hostname === '::1' || url.hostname === 'localhost';
  if (!isLoopback && url.protocol !== 'https:' && !allowRemote) {
    throw new ConfigError(
      `DEVDIGEST_API_BASE ("${raw}") is a non-loopback, non-https origin. Set ` +
        `DEVDIGEST_MCP_ALLOW_REMOTE_API=true to explicitly allow this, or use ` +
        `an https:// base, or point at 127.0.0.1/localhost.`,
    );
  }
  return url.origin;
}

function parseTimeout(raw: string | undefined, fallback: number, varName: string): number {
  if (raw === undefined) return fallback;
  const result = TimeoutValue.safeParse(raw);
  if (!result.success) {
    throw new ConfigError(`${varName} must be a positive integer (ms) — got "${raw}"`);
  }
  return result.data;
}

function parseLogLevel(raw: string | undefined): LogLevel {
  if (raw === undefined) return DEFAULT_LOG_LEVEL;
  if (!(LOG_LEVELS as readonly string[]).includes(raw)) {
    throw new ConfigError(`DEVDIGEST_MCP_LOG_LEVEL must be one of ${LOG_LEVELS.join('|')} — got "${raw}"`);
  }
  return raw as LogLevel;
}

export function loadMcpConfig(env: NodeJS.ProcessEnv): McpConfig {
  const allowRemote = truthy(env.DEVDIGEST_MCP_ALLOW_REMOTE_API);
  const apiBase = parseApiBase(env.DEVDIGEST_API_BASE ?? DEFAULT_API_BASE, allowRemote);
  const runTimeoutMs = parseTimeout(env.DEVDIGEST_MCP_RUN_TIMEOUT_MS, DEFAULT_RUN_TIMEOUT_MS, 'DEVDIGEST_MCP_RUN_TIMEOUT_MS');
  const requestTimeoutMs = parseTimeout(
    env.DEVDIGEST_MCP_REQUEST_TIMEOUT_MS,
    DEFAULT_REQUEST_TIMEOUT_MS,
    'DEVDIGEST_MCP_REQUEST_TIMEOUT_MS',
  );
  const logLevel = parseLogLevel(env.DEVDIGEST_MCP_LOG_LEVEL);
  return { apiBase, runTimeoutMs, requestTimeoutMs, logLevel };
}

function truthy(v: string | undefined): boolean {
  return v != null && v !== '' && v !== '0' && v.toLowerCase() !== 'false';
}
