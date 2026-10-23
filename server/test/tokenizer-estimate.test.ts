/**
 * Tokenizer encoding/estimate metadata (L05, TASK-04) — `estimate()`/
 * `estimateWithEncoding()`/`resolveContextWindowTokens()` added ALONGSIDE
 * the frozen `Tokenizer.count()` surface (see `adapters/tokenizer/index.ts`'s
 * doc comments for why `count()` itself is never touched).
 *
 * Covers the wrapper/fallback boundary: a working `cl100k_base` encoder vs.
 * the sticky heuristic fallback once the encoder is marked broken, and the
 * context-window resolver's known/unknown boundary.
 */
import { describe, it, expect } from 'vitest';
import {
  TiktokenTokenizer,
  approxTokens,
  estimateWithEncoding,
  resolveContextWindowTokens,
  DEFAULT_CONTEXT_WINDOW_TOKENS,
  type Tokenizer,
} from '../src/adapters/tokenizer/index.js';

describe('TiktokenTokenizer.estimate', () => {
  it('reports cl100k_base when the real encoder is working', () => {
    const tok = new TiktokenTokenizer();
    const { tokens, encoding } = tok.estimate('hello world');
    expect(encoding).toBe('cl100k_base');
    expect(tokens).toBeGreaterThan(0);
  });

  it('count() and estimate().tokens agree for the same text', () => {
    const tok = new TiktokenTokenizer();
    const text = 'The quick brown fox jumps over the lazy dog.';
    expect(tok.count(text)).toBe(tok.estimate(text).tokens);
  });

  it('falls back to the heuristic once the encoder is marked broken, and stays sticky', () => {
    const tok = new TiktokenTokenizer();
    // Force the sticky `broken` flag the same way a real BPE-load failure
    // would, without touching count()'s own try/catch wiring.
    (tok as unknown as { broken: boolean }).broken = true;

    const text = 'some text of a certain length';
    const { tokens, encoding } = tok.estimate(text);
    expect(encoding).toBe('heuristic');
    expect(tokens).toBe(approxTokens(text));
    // Sticky: a second call still reports heuristic, no retry of the encoder.
    expect(tok.estimate(text).encoding).toBe('heuristic');
  });
});

describe('estimateWithEncoding', () => {
  it('delegates to a tokenizer that implements estimate()', () => {
    const tok = new TiktokenTokenizer();
    const result = estimateWithEncoding(tok, 'hello');
    expect(result).toEqual(tok.estimate('hello'));
  });

  it('labels a plain count()-only mock tokenizer as heuristic (unknown encoding)', () => {
    const plain: Tokenizer = { count: (text) => Math.ceil(text.length / 4) };
    const result = estimateWithEncoding(plain, 'some text');
    expect(result).toEqual({ tokens: plain.count('some text'), encoding: 'heuristic' });
  });
});

describe('resolveContextWindowTokens', () => {
  it('uses a known, positive contextLength from ModelInfo', () => {
    expect(
      resolveContextWindowTokens({
        id: 'gpt-4.1',
        provider: 'openai',
        contextLength: 128_000,
      }),
    ).toBe(128_000);
  });

  it('falls back to the approved 16,000-token default when contextLength is missing', () => {
    expect(resolveContextWindowTokens({ id: 'gpt-4.1', provider: 'openai' })).toBe(
      DEFAULT_CONTEXT_WINDOW_TOKENS,
    );
  });

  it('falls back when contextLength is null, zero, or negative', () => {
    expect(resolveContextWindowTokens({ id: 'm', provider: 'openai', contextLength: null })).toBe(
      DEFAULT_CONTEXT_WINDOW_TOKENS,
    );
    expect(resolveContextWindowTokens({ id: 'm', provider: 'openai', contextLength: 0 })).toBe(
      DEFAULT_CONTEXT_WINDOW_TOKENS,
    );
    expect(resolveContextWindowTokens({ id: 'm', provider: 'openai', contextLength: -1 })).toBe(
      DEFAULT_CONTEXT_WINDOW_TOKENS,
    );
  });

  it('falls back when modelInfo itself is null/undefined', () => {
    expect(resolveContextWindowTokens(null)).toBe(DEFAULT_CONTEXT_WINDOW_TOKENS);
    expect(resolveContextWindowTokens(undefined)).toBe(DEFAULT_CONTEXT_WINDOW_TOKENS);
  });
});
