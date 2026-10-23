/**
 * tokenizer adapter — token counter for the repo-map budget search (T3), and
 * (L05/TASK-04) encoding/estimate metadata for the Project Context Folder,
 * PR Brief and Onboarding Tour's token-budget enforcement (CTX-AC-08,
 * BRIEF-AC-10, ONBOARD-AC-07).
 *
 * The repo-map renderer (pipeline/repo-map.ts) binary-searches the largest set
 * of symbols that fits a token budget; that loop calls `count()` ≤ ~13 times.
 *
 * Default impl: js-tiktoken `cl100k_base` (pure-JS, no natives). The encoder is
 * lazy-initialised (loading the BPE ranks is the heavy part) and any failure
 * falls back to the `ceil(chars / 4)` heuristic — the renderer must never throw.
 *
 * Scope: in-process, under modules/repo-intel (budget search, via `count()`)
 * and the L05 features above (via `estimate()`/`estimateWithEncoding()`).
 * Swappable in tests via a mock counter (ContainerOverrides.tokenizer).
 */
import type { ModelInfo } from '@devdigest/shared';
import { getEncoding, type Tiktoken } from 'js-tiktoken';

/**
 * `count()`'s signature/behaviour is frozen — `pipeline/repo-map.ts`'s
 * `renderRepoMap` and every test-fixture tokenizer (plain `{ count: ... }`
 * object literals, e.g. `test/repo-intel-rank-map.test.ts`'s `charTokenizer`)
 * depend on exactly this shape. Metadata (step 3 below) is added alongside
 * it, never by widening this interface or `count()`'s return type.
 */
export interface Tokenizer {
  count(text: string): number;
}

/** Heuristic fallback used before/instead of a real encoder. */
export function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/** Which encoding actually produced a token estimate — lets a caller show
 *  "exact" vs. "estimated" rather than presenting a heuristic guess as a
 *  precise count (CTX-AC-08/BRIEF-AC-10/ONBOARD-AC-07). */
export type TokenEncoding = 'cl100k_base' | 'heuristic';

export interface TokenEstimate {
  tokens: number;
  encoding: TokenEncoding;
}

/**
 * A `Tokenizer` that can also report which encoding produced its last
 * estimate. Deliberately a SEPARATE, wider interface rather than an addition
 * to `Tokenizer` itself (see that interface's doc comment) — `TiktokenTokenizer`
 * implements both; a plain mock tokenizer implementing only `Tokenizer` is
 * still valid everywhere `Tokenizer` is accepted, and `estimateWithEncoding`
 * below degrades it to `'heuristic'` (the only honest answer when the actual
 * encoding used is unknown).
 */
export interface TokenizerWithEstimate extends Tokenizer {
  estimate(text: string): TokenEstimate;
}

function hasEstimate(t: Tokenizer): t is TokenizerWithEstimate {
  return typeof (t as Partial<TokenizerWithEstimate>).estimate === 'function';
}

/**
 * `estimate()` when the tokenizer supports it (encoding-aware), else a plain
 * `count()` labeled `'heuristic'` — the safe default for an opaque/mock
 * `Tokenizer` whose actual encoding can't be determined from the outside.
 */
export function estimateWithEncoding(tokenizer: Tokenizer, text: string): TokenEstimate {
  if (hasEstimate(tokenizer)) return tokenizer.estimate(text);
  return { tokens: tokenizer.count(text), encoding: 'heuristic' };
}

export class TiktokenTokenizer implements TokenizerWithEstimate {
  private enc?: Tiktoken;
  private broken = false;

  count(text: string): number {
    return this.estimate(text).tokens;
  }

  /** Same work as `count()`, plus which encoding produced it — ONE pass (no
   *  double encode attempt): `count()` delegates to this rather than
   *  duplicating the try/catch/sticky-fallback logic. */
  estimate(text: string): TokenEstimate {
    if (this.broken) return { tokens: approxTokens(text), encoding: 'heuristic' };
    try {
      this.enc ??= getEncoding('cl100k_base');
      return { tokens: this.enc.encode(text).length, encoding: 'cl100k_base' };
    } catch {
      // BPE load failed once — don't retry per call; stick to the heuristic.
      this.broken = true;
      return { tokens: approxTokens(text), encoding: 'heuristic' };
    }
  }
}

/**
 * Approved fallback context-window size (C5/C7) when a model's real window
 * isn't known — e.g. a provider that doesn't expose `contextLength` via
 * `listModels()` (see `platform/container.ts`'s `LLMProvider.listModels`),
 * or no model metadata available yet at the call site.
 */
export const DEFAULT_CONTEXT_WINDOW_TOKENS = 16_000;

/**
 * Resolve a model's context-window size for token-budget math (CTX-AC-08's
 * attached-block budget, BRIEF-AC-10/ONBOARD-AC-07's input caps): the live
 * adapter-reported `ModelInfo.contextLength` when known and positive, else
 * the approved 16,000-token fallback. Pure — callers look up `ModelInfo` via
 * `container.llm(provider).listModels()` (or their own cached copy) and pass
 * the result in; this function makes no adapter call itself.
 */
export function resolveContextWindowTokens(modelInfo: ModelInfo | null | undefined): number {
  const len = modelInfo?.contextLength;
  return typeof len === 'number' && len > 0 ? len : DEFAULT_CONTEXT_WINDOW_TOKENS;
}
