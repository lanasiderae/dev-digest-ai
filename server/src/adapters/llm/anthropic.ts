import Anthropic from '@anthropic-ai/sdk';
import type {
  LLMProvider,
  ModelInfo,
  CompletionRequest,
  CompletionResult,
  StructuredRequest,
  StructuredResult,
  ChatMessage,
} from '@devdigest/shared';
import { withRetry, withRetryUnless, withTimeout } from '../../platform/resilience.js';
import { toJsonSchema, parseWithRepair } from '../../platform/structured.js';
import { estimateCost } from './pricing.js';
import { ExternalServiceError } from '../../platform/errors.js';

const DEFAULT_TIMEOUT = 60_000;
const DEFAULT_MAX_TOKENS = 4096;

/** Anthropic has no embeddings API; embeddings come from the OpenAI Embedder. */
function splitSystem(messages: ChatMessage[]): {
  system: string;
  rest: Anthropic.MessageParam[];
} {
  const system = messages
    .filter((m) => m.role === 'system')
    .map((m) => m.content)
    .join('\n\n');
  const rest = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  return { system, rest };
}

/**
 * Anthropic LLMProvider.
 * - listModels: dynamic via GET /models.
 * - completeStructured: FORCED tool-use (single tool, input_schema = our JSON
 *   schema, tool_choice forces it), parse tool_use.input, Zod validate + reprompt.
 * - embed: NOT supported (throws) — use the OpenAI Embedder for vectors.
 */
export class AnthropicProvider implements LLMProvider {
  readonly id = 'anthropic' as const;
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async listModels(): Promise<ModelInfo[]> {
    return withRetry(async () => {
      // SDK 0.33 exposes models.list()
      const res = await this.client.models.list();
      return res.data.map((m) => ({
        id: m.id,
        provider: 'anthropic' as const,
        label: m.display_name,
      }));
    });
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    return withRetryUnless(req.disableTransportRetry, () =>
      withTimeout(this.doComplete(req), req.timeoutMs ?? DEFAULT_TIMEOUT),
    );
  }

  private async doComplete(req: CompletionRequest): Promise<CompletionResult> {
    const { system, rest } = splitSystem(req.messages);
    const res = await this.client.messages.create({
      model: req.model,
      system: system || undefined,
      messages: rest,
      max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
      temperature: req.temperature ?? 0.2,
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const tokensIn = res.usage.input_tokens;
    const tokensOut = res.usage.output_tokens;
    return {
      text,
      model: req.model,
      tokensIn,
      tokensOut,
      costUsd: estimateCost(req.model, tokensIn, tokensOut),
    };
  }

  async completeStructured<T>(req: StructuredRequest<T>): Promise<StructuredResult<T>> {
    const jsonSchema = toJsonSchema(req.schema, req.schemaName);
    const toolName = req.schemaName.replace(/[^a-zA-Z0-9_-]/g, '_');
    // disableTransportRetry forces exactly one attempt total — it overrides
    // maxRetries' own reprompt-on-error loop, not just the transport retry
    // below (see StructuredRequest.disableTransportRetry's doc comment).
    const maxRetries = req.disableTransportRetry ? 0 : (req.maxRetries ?? 2);
    const { system, rest } = splitSystem(req.messages);
    const messages: Anthropic.MessageParam[] = [...rest];
    let tokensIn = 0;
    let tokensOut = 0;
    // True once at least one attempt actually received a response — see
    // OpenAIProvider.completeStructured's identical comment.
    let usageKnown = false;
    let lastRaw = '';

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      let res;
      try {
        res = await withRetryUnless(req.disableTransportRetry, () =>
          withTimeout(
            this.client.messages.create({
              model: req.model,
              system: system || undefined,
              messages,
              max_tokens: req.maxTokens ?? DEFAULT_MAX_TOKENS,
              temperature: req.temperature ?? 0,
              tools: [
                {
                  name: toolName,
                  description: `Return the result as ${req.schemaName}.`,
                  input_schema: jsonSchema.schema as Anthropic.Tool.InputSchema,
                },
              ],
              tool_choice: { type: 'tool', name: toolName },
            }),
            req.timeoutMs ?? DEFAULT_TIMEOUT,
          ),
        );
      } catch (err) {
        throw new ExternalServiceError('Anthropic structured output request failed', {
          raw: lastRaw,
          usage: usageKnown ? { tokensIn, tokensOut } : 'unknown',
          cause: err instanceof Error ? err.message : String(err),
        });
      }
      tokensIn += res.usage.input_tokens;
      tokensOut += res.usage.output_tokens;
      usageKnown = true;

      const toolUse = res.content.find(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
      );
      lastRaw = toolUse ? JSON.stringify(toolUse.input) : '';

      const parsed = parseWithRepair(req.schema, lastRaw);
      if (parsed.ok) {
        return {
          data: parsed.data,
          model: req.model,
          tokensIn,
          tokensOut,
          costUsd: estimateCost(req.model, tokensIn, tokensOut),
          raw: lastRaw,
          attempts: attempt,
        };
      }
      messages.push({ role: 'assistant', content: res.content });
      messages.push({
        role: 'user',
        content: parsed.repromptMessage,
      });
    }

    throw new ExternalServiceError('Anthropic structured output failed schema validation', {
      raw: lastRaw,
      usage: usageKnown ? { tokensIn, tokensOut } : 'unknown',
    });
  }

  async embed(): Promise<number[][]> {
    throw new ExternalServiceError(
      'Anthropic does not provide embeddings; use the OpenAI Embedder.',
    );
  }
}
