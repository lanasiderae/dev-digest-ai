import type { Intent, PrIntentResponse, RepoRef } from '@devdigest/shared';
import type { Container } from '../../../platform/container.js';
import type { ReviewRepository, PullRow } from '../repository.js';
import { ConfigError } from '../../../platform/errors.js';
import { resolveFeatureModel } from '../../settings/feature-models.js';
import {
  INTENT_MAX_BULLETS,
  INTENT_MAX_BULLET_CHARS,
  INTENT_MAX_DESCRIPTION_CHARS,
  INTENT_MAX_FILE_PATHS,
  INTENT_MAX_HUNK_CONTEXTS,
  INTENT_MAX_HUNK_CONTEXT_CHARS,
  INTENT_MAX_ISSUE_BODY_CHARS,
  INTENT_MAX_ISSUE_TITLE_CHARS,
  INTENT_MAX_RETRIES,
  INTENT_MAX_SPEC_EXCERPT_CHARS,
  INTENT_MAX_STATEMENT_CHARS,
  INTENT_MAX_TITLE_CHARS,
  INTENT_TIMEOUT_MS,
} from '../constants.js';
import { extractIssueRef, extractTicketRefs, hunkContexts, sanitizeIntent } from './intent-signals.js';
import {
  INTENT_SCHEMA,
  INTENT_SCHEMA_NAME,
  SYSTEM_PROMPT,
  buildUserPrompt,
  type IntentLinkedIssueSignal,
  type IntentReferencedSpecSignal,
  type IntentSignals,
} from './intent-prompt.js';

/**
 * What the intent step logs through. Deliberately only `info` — an
 * unavailable/failed intent is a soft, expected outcome (AC11), never an
 * `error`-kind event, so it never surfaces as a run-failure toast. Matches
 * `RunLogger.info(msg, data?)`'s shape so `run-executor.ts` can pass its real
 * `RunLogger` directly (live UI + stdout mirror, no separate logger needed);
 * `service.ts`'s manual-regenerate path adapts the plain pino request logger
 * to this same shape.
 */
export type IntentLogger = { info: (msg: string, data?: unknown) => void };

export interface EnsureIntentOpts {
  /** Skip the "already stored and still fresh" short-circuit and derive a fresh one. */
  force?: boolean;
  /** Why this call happened — purely for the observability log (AC12). */
  trigger: 'eager' | 'manual' | 'lazy';
  log?: IntentLogger;
}

/**
 * The Intent Layer application service: derives (and persists) a PR's intent
 * via a low-cost structured LLM call over code-selected signals — never the
 * full diff body. Fails open on every error path: a provider/timeout/schema
 * (or DB read) failure never throws, it resolves to
 * `{ intent: null, unavailable_reason }` so a caller on the hot review path
 * can `.catch`-free await it and never trips an `error`-kind run event.
 */
export class IntentService {
  constructor(
    private readonly container: Container,
    private readonly repo: ReviewRepository,
  ) {}

  /** Read path (`GET /pulls/:id/intent`) — no LLM/GitHub calls, DB only. */
  async get(prId: string): Promise<PrIntentResponse> {
    const stored = await this.repo.getIntent(prId);
    if (!stored) return { intent: null, unavailable_reason: 'not_generated' };
    return { intent: toIntentRecord(stored, prId), unavailable_reason: null };
  }

  /**
   * Ensure a FRESH stored intent exists, deriving one if missing, stale (the
   * PR has new commits since it was derived), or `opts.force`d. Called both
   * eagerly (review pre-work — this is why a review run regenerates intent
   * after new commits, not just on a PR's first review) and on-demand (the
   * manual "Regenerate" action, AC7).
   *
   * The whole body is one try/catch: a transient failure reading the cached
   * row must degrade the same way a classification failure does, never
   * reject and surface as a run-level error for what is, either way, a
   * best-effort step.
   */
  async ensure(
    workspaceId: string,
    pull: PullRow,
    repoRef: RepoRef,
    opts: EnsureIntentOpts,
  ): Promise<PrIntentResponse> {
    try {
      if (!opts.force) {
        const existing = await this.repo.getIntent(pull.id);
        if (existing && existing.headSha === pull.headSha) {
          return { intent: toIntentRecord(existing, pull.id), unavailable_reason: null };
        }
      }
    } catch {
      // Fall through to a fresh derivation — a cache-read hiccup shouldn't
      // block deriving a usable intent.
    }
    return this.derive(workspaceId, pull, repoRef, opts);
  }

  // ---- derivation -----------------------------------------------------------

  private async derive(
    workspaceId: string,
    pull: PullRow,
    repoRef: RepoRef,
    opts: EnsureIntentOpts,
  ): Promise<PrIntentResponse> {
    const t0 = Date.now();
    try {
      const choice = await resolveFeatureModel(this.container, workspaceId, 'review_intent');
      const llm = await this.container.llm(choice.provider);

      const title = pull.title.slice(0, INTENT_MAX_TITLE_CHARS);
      const bodyTrimmed = pull.body?.trim() || null;
      const description = bodyTrimmed ? bodyTrimmed.slice(0, INTENT_MAX_DESCRIPTION_CHARS) : null;

      const linkedIssueNumber = extractIssueRef(pull.body);
      let linkedIssue: IntentLinkedIssueSignal | null = null;
      if (linkedIssueNumber != null) {
        try {
          const github = await this.container.github();
          const issue = await github.getIssue(repoRef, linkedIssueNumber);
          linkedIssue = {
            number: issue.number,
            title: issue.title.slice(0, INTENT_MAX_ISSUE_TITLE_CHARS),
            body: issue.body ? issue.body.slice(0, INTENT_MAX_ISSUE_BODY_CHARS) : null,
          };
        } catch {
          // Best-effort: derive without the linked-issue signal (source omitted).
        }
      }

      const { external: ticketRefs, specPaths } = extractTicketRefs([pull.title, pull.body]);
      const referencedSpec = await this.resolveReferencedSpec(repoRef, specPaths);

      const files = await this.repo.getPrFiles(pull.id);
      const filePaths = files.slice(0, INTENT_MAX_FILE_PATHS).map((f) => f.path);
      const hunks: string[] = [];
      let fullDiffChars = 0;
      for (const f of files) {
        if (!f.patch) continue;
        fullDiffChars += f.patch.length;
        hunks.push(...hunkContexts(f.patch, INTENT_MAX_HUNK_CONTEXT_CHARS));
        if (hunks.length >= INTENT_MAX_HUNK_CONTEXTS) break;
      }

      const signals: IntentSignals = {
        title,
        description,
        linkedIssue,
        referencedSpec,
        filePaths,
        totalFilesCount: files.length,
        hunkContexts: hunks.slice(0, INTENT_MAX_HUNK_CONTEXTS),
        ticketRefs,
      };

      const userPrompt = buildUserPrompt(signals);
      const estTokens = Math.ceil((SYSTEM_PROMPT.length + userPrompt.length) / 4);
      const fullDiffTokens = Math.ceil(fullDiffChars / 4);
      opts.log?.info(`Intent input: ~${estTokens} est. tokens (vs ~${fullDiffTokens} for full diff)`);
      opts.log?.info(`Intent: calling ${choice.provider}/${choice.model}`);

      const result = await this.withTimeout(
        llm.completeStructured<Intent>({
          model: choice.model,
          schema: INTENT_SCHEMA,
          schemaName: INTENT_SCHEMA_NAME,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.2,
          maxRetries: INTENT_MAX_RETRIES,
        }),
        INTENT_TIMEOUT_MS,
      );

      const sanitized = sanitizeIntent(result.data, {
        maxStatementChars: INTENT_MAX_STATEMENT_CHARS,
        maxBullets: INTENT_MAX_BULLETS,
        maxBulletChars: INTENT_MAX_BULLET_CHARS,
      });
      await this.repo.upsertIntent(pull.id, sanitized, pull.headSha);

      opts.log?.info(`Intent derived via ${choice.provider}/${choice.model} (${Date.now() - t0}ms)`, {
        prId: pull.id,
        workspaceId,
        trigger: opts.trigger,
        provider: choice.provider,
        model: choice.model,
        tokensIn: result.tokensIn,
        tokensOut: result.tokensOut,
        costUsd: result.costUsd,
        durationMs: Date.now() - t0,
        linkedIssue: linkedIssue?.number ?? null,
        referencedSpecFound: referencedSpec != null && referencedSpec.excerpt != null,
        ticketRefCount: ticketRefs.length,
        hunkContextCount: signals.hunkContexts.length,
      });

      return { intent: { ...sanitized, pr_id: pull.id }, unavailable_reason: null };
    } catch (err) {
      return this.handleFailure(err, pull.id, workspaceId, opts, Date.now() - t0);
    }
  }

  /** Best-effort read of a spec/plan the PR description references by a
   *  repo-relative path. Never throws — a missing/unreadable file becomes an
   *  explicit "unavailable" signal (AC11), not a thrown error. */
  private async resolveReferencedSpec(
    repoRef: RepoRef,
    specPaths: string[],
  ): Promise<IntentReferencedSpecSignal | null> {
    const path = specPaths[0];
    if (!path) return null;
    try {
      const content = await this.container.git.readFile(repoRef, path);
      return { path, excerpt: content.slice(0, INTENT_MAX_SPEC_EXCERPT_CHARS) };
    } catch {
      return { path, excerpt: null };
    }
  }

  private handleFailure(
    err: unknown,
    prId: string,
    workspaceId: string,
    opts: EnsureIntentOpts,
    durationMs: number,
  ): PrIntentResponse {
    const message = err instanceof Error ? err.message : String(err);
    const isConfig = err instanceof ConfigError;
    const isTimeout = !isConfig && message.includes('timed out');
    const reason = isConfig ? 'provider_not_configured' : isTimeout ? 'timeout' : 'generation_failed';

    opts.log?.info(`Intent unavailable (${reason}) — continuing review without it`, {
      prId,
      workspaceId,
      trigger: opts.trigger,
      durationMs,
      reason,
    });

    return { intent: null, unavailable_reason: reason };
  }

  private withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
    let timer!: ReturnType<typeof setTimeout>;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('intent: timed out')), ms);
    });
    return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
  }
}

function toIntentRecord(stored: Intent, prId: string): PrIntentResponse['intent'] {
  return { intent: stored.intent, in_scope: stored.in_scope, out_of_scope: stored.out_of_scope, pr_id: prId };
}

/** Render a stored intent as the plain-text block reviewer-core's optional
 *  `intent` prompt slot expects. */
export function renderIntentForPrompt(intent: Intent): string {
  const lines = [`Intent: ${intent.intent}`];
  if (intent.in_scope.length > 0) {
    lines.push('In scope:', ...intent.in_scope.map((s) => `- ${s}`));
  }
  if (intent.out_of_scope.length > 0) {
    lines.push('Out of scope:', ...intent.out_of_scope.map((s) => `- ${s}`));
  }
  return lines.join('\n');
}
