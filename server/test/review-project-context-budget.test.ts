/**
 * L05/TASK-06 (C5/C7) — pure budget-sizing unit tests for
 * `resolveProjectContextBudgetTokens`. Fully hermetic: no container, no DB,
 * no git — see `test/review-executor-project-context.test.ts` for the
 * orchestration-level (budget-drop, injection-guard parity) evidence built
 * on top of this function.
 */
import { describe, it, expect } from 'vitest';
import type { ModelInfo } from '@devdigest/shared';
import { resolveProjectContextBudgetTokens } from '../src/modules/reviews/pipeline/project-context.js';

function model(contextLength?: number | null): ModelInfo {
  return { id: 'm', provider: 'openai', contextLength: contextLength ?? undefined };
}

describe('resolveProjectContextBudgetTokens', () => {
  it('is 20% of a known context window', () => {
    expect(resolveProjectContextBudgetTokens(model(128_000))).toBe(25_600);
  });

  it('clamps a small known window up to the 4,000-token floor', () => {
    expect(resolveProjectContextBudgetTokens(model(8_000))).toBe(4_000);
  });

  it('clamps a huge known window down to the 32,000-token ceiling', () => {
    expect(resolveProjectContextBudgetTokens(model(1_000_000))).toBe(32_000);
  });

  it('falls back to 16,000 (not 4,000) when the model/window is entirely unknown', () => {
    expect(resolveProjectContextBudgetTokens(undefined)).toBe(16_000);
    expect(resolveProjectContextBudgetTokens(null)).toBe(16_000);
  });

  it('falls back to 16,000 when modelInfo is known but reports no contextLength', () => {
    expect(resolveProjectContextBudgetTokens(model(null))).toBe(16_000);
    expect(resolveProjectContextBudgetTokens(model(0))).toBe(16_000);
  });
});
