/**
 * resilience primitives: timeouts on every external call + retry with
 * exponential backoff on transient failures (rate-limit / 5xx).
 */

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`Operation timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

export async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  if (!ms || ms <= 0) return p;
  let handle: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    handle = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    clearTimeout(handle!);
  }
}

export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  /** Decide whether an error is retryable (rate-limit / 5xx by default). */
  isRetryable?: (err: unknown) => boolean;
  onRetry?: (attempt: number, err: unknown) => void;
}

function defaultIsRetryable(err: unknown): boolean {
  const status =
    (err as { status?: number })?.status ??
    (err as { statusCode?: number })?.statusCode ??
    (err as { response?: { status?: number } })?.response?.status;
  if (typeof status === 'number') return status === 429 || status >= 500;
  // network-ish errors
  const code = (err as { code?: string })?.code;
  return code === 'ECONNRESET' || code === 'ETIMEDOUT' || code === 'ENOTFOUND';
}

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions = {}): Promise<T> {
  const retries = opts.retries ?? 3;
  const base = opts.baseDelayMs ?? 250;
  const max = opts.maxDelayMs ?? 8000;
  const isRetryable = opts.isRetryable ?? defaultIsRetryable;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !isRetryable(err)) break;
      opts.onRetry?.(attempt + 1, err);
      const delay = Math.min(max, base * 2 ** attempt) + Math.random() * base;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/**
 * `withRetry`, except when `disabled` is true: runs `fn` through `withRetry`
 * called with `{ retries: 0 }` — ONE underlying attempt, no 429/5xx backoff —
 * instead of the normal default retry count. Used by the LLM adapters'
 * `complete`/`completeStructured` for `CompletionRequest`/`StructuredRequest`'s
 * `disableTransportRetry` flag (L05 one-attempt brief/tour generation); every
 * other caller of `withRetry` (review calls, `listModels`, embeddings) is
 * unaffected — they keep calling `withRetry` directly with no options, same
 * as before this flag existed.
 */
export function withRetryUnless<T>(disabled: boolean | undefined, fn: () => Promise<T>): Promise<T> {
  return withRetry(fn, disabled ? { retries: 0 } : undefined);
}
