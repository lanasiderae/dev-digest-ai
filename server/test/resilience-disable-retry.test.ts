/**
 * `withRetryUnless` (L05, TASK-04) — the mechanism behind
 * `StructuredRequest`/`CompletionRequest.disableTransportRetry`: exactly one
 * underlying attempt and a clean failure when disabled, vs. today's
 * unchanged default-retry behavior when it isn't set. This is the hermetic,
 * fast proof of the mechanism itself; `llm-disable-retry.test.ts` proves the
 * same property wired through a real `LLMProvider` (OpenAI).
 */
import { describe, it, expect, vi } from 'vitest';
import { withRetry, withRetryUnless } from '../src/platform/resilience.js';

function retryableError(status: number) {
  return Object.assign(new Error(`upstream ${status}`), { status });
}

describe('withRetryUnless', () => {
  it('disabled=true: calls fn exactly once and rejects cleanly on a retryable error', async () => {
    const fn = vi.fn().mockRejectedValue(retryableError(429));
    await expect(withRetryUnless(true, fn)).rejects.toThrow('upstream 429');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('disabled=false: retries a retryable error using withRetry\'s normal defaults', async () => {
    const fn = vi.fn().mockRejectedValueOnce(retryableError(429)).mockResolvedValue('ok');
    const result = await withRetryUnless(false, fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('disabled=undefined (unset flag): same default-retry behavior as plain withRetry', async () => {
    const fn = vi.fn().mockRejectedValueOnce(retryableError(503)).mockResolvedValue('ok');
    const result = await withRetryUnless(undefined, fn);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('a non-retryable error is never retried either way', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('boom'));
    await expect(withRetryUnless(false, fn)).rejects.toThrow('boom');
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('withRetry baseline (unchanged — review calls keep retrying on 429/5xx)', () => {
  it('retries up to the default count on a persistent retryable error', async () => {
    const fn = vi.fn().mockRejectedValue(retryableError(500));
    await expect(withRetry(fn, { baseDelayMs: 1, maxDelayMs: 1 })).rejects.toThrow('upstream 500');
    // default retries = 3 → 4 total attempts (initial + 3 retries).
    expect(fn).toHaveBeenCalledTimes(4);
  });
});
