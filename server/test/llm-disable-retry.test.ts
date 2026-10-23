/**
 * `OpenAIProvider` — `disableTransportRetry` wiring end-to-end (L05, TASK-04),
 * against the real `LLMProvider` adapter rather than just the `withRetryUnless`
 * mechanism (see `resilience-disable-retry.test.ts` for that hermetic proof).
 * The `openai` SDK itself is mocked at the module boundary — no real network
 * call, same "never real network calls or keys in unit tests" rule as
 * `src/adapters/mocks.ts`.
 *
 * Covers:
 *  - disableTransportRetry: exactly ONE underlying `create()` call, clean
 *    failure (not a silent retry) — BRIEF-AC-09/ONBOARD-AC-04's "one
 *    attempt" requirement at the provider level.
 *  - flag unset: today's retry-on-429 behavior is UNCHANGED (review calls).
 *  - failure usage labeling: "unknown" when no response was ever received,
 *    vs. the real accumulated tokens when an earlier attempt did respond.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';

const createMock = vi.fn();

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: createMock } };
    models = { list: vi.fn() };
    embeddings = { create: vi.fn() };
  },
}));

// Imported AFTER the mock registration above (vi.mock is hoisted by vitest).
import { OpenAIProvider } from '../src/adapters/llm/openai.js';
import { ExternalServiceError } from '../src/platform/errors.js';

const SCHEMA = z.object({ ok: z.boolean() });
const BASE_REQUEST = {
  model: 'gpt-4.1',
  schema: SCHEMA,
  schemaName: 'Test',
  messages: [{ role: 'user' as const, content: 'hi' }],
};

function upstreamError(status: number) {
  return Object.assign(new Error(`upstream ${status}`), { status });
}

function okResponse(data: unknown, tokensIn: number, tokensOut: number) {
  return {
    choices: [{ message: { content: JSON.stringify(data) } }],
    usage: { prompt_tokens: tokensIn, completion_tokens: tokensOut },
  };
}

beforeEach(() => {
  createMock.mockReset();
});

describe('OpenAIProvider.completeStructured — disableTransportRetry', () => {
  it('makes exactly one underlying create() call and fails cleanly when the flag is set', async () => {
    createMock.mockRejectedValue(upstreamError(429));
    const provider = new OpenAIProvider('test-key');

    await expect(
      provider.completeStructured({ ...BASE_REQUEST, disableTransportRetry: true }),
    ).rejects.toThrow(ExternalServiceError);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('labels failure usage "unknown" when no response was ever received', async () => {
    createMock.mockRejectedValue(upstreamError(429));
    const provider = new OpenAIProvider('test-key');

    await expect(
      provider.completeStructured({ ...BASE_REQUEST, disableTransportRetry: true }),
    ).rejects.toMatchObject({ details: { usage: 'unknown' } });
  });

  it('preserves real accumulated usage on failure when an earlier attempt DID respond', async () => {
    // First attempt returns a response that fails schema validation (missing
    // `ok`), a second (reprompt) attempt then fails transport entirely with a
    // NON-retryable error (no `.status`) so withRetry's own default retrying
    // doesn't consume extra mock calls — isolates this test to the "usage
    // accumulated so far is preserved on failure" property.
    createMock
      .mockResolvedValueOnce(okResponse({ not_ok_field: true }, 11, 7))
      .mockRejectedValueOnce(new Error('non-retryable transport failure'));
    const provider = new OpenAIProvider('test-key');

    await expect(provider.completeStructured(BASE_REQUEST)).rejects.toMatchObject({
      details: { usage: { tokensIn: 11, tokensOut: 7 } },
    });
  });

  it('flag unset: still retries on a 429 the same way review calls do today', async () => {
    createMock
      .mockRejectedValueOnce(upstreamError(429))
      .mockResolvedValueOnce(okResponse({ ok: true }, 5, 3));
    const provider = new OpenAIProvider('test-key');

    const result = await provider.completeStructured(BASE_REQUEST);
    expect(result.data).toEqual({ ok: true });
    // One failed transport attempt + one successful retried attempt.
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});

describe('OpenAIProvider.complete — disableTransportRetry', () => {
  it('makes exactly one underlying create() call and fails when the flag is set', async () => {
    createMock.mockRejectedValue(upstreamError(429));
    const provider = new OpenAIProvider('test-key');

    await expect(
      provider.complete({
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: 'hi' }],
        disableTransportRetry: true,
      }),
    ).rejects.toThrow();
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it('flag unset: retries on a 429 the same way review calls do today', async () => {
    createMock
      .mockRejectedValueOnce(upstreamError(429))
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'hello' } }],
        usage: { prompt_tokens: 2, completion_tokens: 1 },
      });
    const provider = new OpenAIProvider('test-key');

    const result = await provider.complete({
      model: 'gpt-4.1',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(result.text).toBe('hello');
    expect(createMock).toHaveBeenCalledTimes(2);
  });
});
