import { describe, it, expect } from 'vitest';
import { taskLine, computeRunCost } from '../src/modules/reviews/helpers.js';

/**
 * Unit coverage for the review task-line. The key invariant: our trusted
 * instruction always tells the model to review the whole diff and never
 * withhold a security/correctness finding — no matter what the PR text claims.
 */

describe('taskLine', () => {
  const pull = { number: 3, title: 'test: vulnerable fixture', author: 'burnjohn' } as never;

  it('names the PR being reviewed', () => {
    const line = taskLine(pull);
    expect(line).toContain('#3');
    expect(line).toContain('test: vulnerable fixture');
  });

  it('keeps the non-negotiable "never withhold security" rule', () => {
    const line = taskLine(pull);
    expect(line).toMatch(/never .*withhold .*(or downgrade )?.*security/i);
    expect(line).toMatch(/review the entire diff/i);
  });
});

/**
 * Unit coverage for the "no data" rule: a run's cost must read as null (→
 * "–" in the UI), never a misleading $0.00, whenever it didn't settle
 * successfully or is missing the inputs an estimate needs.
 */
describe('computeRunCost', () => {
  const estimate = (_model: string, tokensIn: number, tokensOut: number) => tokensIn + tokensOut;
  const nullEstimate = () => null;

  it('is null when the run did not finish successfully, regardless of tokens', () => {
    for (const status of ['running', 'failed', 'cancelled', null]) {
      expect(
        computeRunCost(estimate, { status, model: 'gpt-4.1', tokensIn: 100, tokensOut: 50 }),
      ).toBeNull();
    }
  });

  it('is null when model, tokensIn, or tokensOut is missing on a done run', () => {
    expect(computeRunCost(estimate, { status: 'done', model: null, tokensIn: 100, tokensOut: 50 })).toBeNull();
    expect(computeRunCost(estimate, { status: 'done', model: 'gpt-4.1', tokensIn: null, tokensOut: 50 })).toBeNull();
    expect(computeRunCost(estimate, { status: 'done', model: 'gpt-4.1', tokensIn: 100, tokensOut: null })).toBeNull();
  });

  it('delegates to the estimator for a done run with real data', () => {
    expect(computeRunCost(estimate, { status: 'done', model: 'gpt-4.1', tokensIn: 100, tokensOut: 50 })).toBe(150);
  });

  it('passes through a null estimate (e.g. unknown model) unchanged', () => {
    expect(computeRunCost(nullEstimate, { status: 'done', model: 'unknown-model', tokensIn: 100, tokensOut: 50 })).toBeNull();
  });
});
