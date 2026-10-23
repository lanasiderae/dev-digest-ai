import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const { createCompletion } = vi.hoisted(() => ({ createCompletion: vi.fn() }));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: createCompletion } };
  },
}));

import { OpenRouterProvider } from '../src/llm/openrouter.js';

afterEach(() => createCompletion.mockReset());

describe('OpenRouterProvider structured output errors', () => {
  it('includes schema paths without exposing the rejected model output', async () => {
    const raw = JSON.stringify({
      summary: 'test summary',
      review_focus: [{ file: 'src/private.ts', line: 0, reason: 'bad line' }],
    });
    createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: raw } }],
      usage: { prompt_tokens: 10, completion_tokens: 5 },
    });

    const provider = new OpenRouterProvider('test-key');
    const request = {
      model: 'test/model',
      schema: z.object({
        summary: z.string(),
        review_focus: z.array(z.object({ file: z.string(), line: z.number().int().positive(), reason: z.string() })),
      }),
      schemaName: 'PrBriefGeneration',
      messages: [{ role: 'user' as const, content: 'test' }],
      maxRetries: 0,
    };

    const error = await provider.completeStructured(request).catch((caught: unknown) => caught as Error);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/review_focus\.0\.line/);
    expect((error as Error).message).not.toContain('src/private.ts');
    expect(createCompletion).toHaveBeenCalledTimes(1);
  });
});
