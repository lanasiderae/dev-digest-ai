import type { RepoRef } from '@devdigest/shared';
import type { OnboardingOmission, OnboardingTour, OnboardingTourSections } from '@devdigest/shared';
import { OnboardingTour as OnboardingTourSchema } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { ConflictError, NotFoundError, ValidationError } from '../../platform/errors.js';
import { resolveFeatureModel } from '../settings/feature-models.js';
import { estimateWithEncoding } from '../../adapters/tokenizer/index.js';
import { OnboardingTourRepository } from './repository.js';
import {
  ONBOARDING_GENERATION_SCHEMA,
  ONBOARDING_SYSTEM_PROMPT,
  advisoryLockKeyForRepo,
  buildOnboardingMandatoryPrompt,
  buildOnboardingOptionalBlocks,
  buildSkeletonSections,
  isSetupEvidencePath,
  markSectionUnavailable,
  toGeneratedSections,
  validateOnboardingGrounding,
  type OnboardingGeneration,
  type OnboardingPromptFacts,
  type OnboardingSetupDocument,
} from './helpers.js';
import {
  ONBOARDING_INPUT_TOKEN_CAP,
  ONBOARDING_MAX_RETRIES,
  ONBOARDING_OUTPUT_TOKEN_CAP,
  ONBOARDING_READING_ORDER_FILE_COUNT,
  ONBOARDING_SCHEMA_NAME,
  SETUP_EVIDENCE_BASENAMES,
  SETUP_EVIDENCE_EXCLUDED_BASENAMES,
  SETUP_EVIDENCE_MAX_BYTES,
  SETUP_EVIDENCE_MAX_DOCS,
} from './constants.js';

export interface OnboardingTourReadResult {
  tour: OnboardingTour | null;
}

export interface OnboardingTourGenerateResult {
  tour: OnboardingTour;
  cached_tour_preserved: boolean;
}

/**
 * Onboarding Tour orchestration (L05, Feature 3 — ONBOARD-AC-01–08). Named
 * `onboarding-tour`, not `onboarding`, so it is never confused with the
 * pre-existing, unrelated `/onboarding` add-repository CLIENT screen —
 * confirmed by grep before this module was added that NO server route or
 * module currently backs that screen at all (it has no server-side
 * counterpart in this codebase today; its own `_components/AddRepoView`
 * calls other, unrelated repo-creation endpoints). This module adds the
 * first and only backend for the repository-tour feature, exposed at
 * `/repos/:id/onboarding` — a different route than the client's own
 * `/onboarding` PAGE path (client routes and server API routes are
 * different namespaces).
 *
 * Reuses, never re-derives: `repoIntel.getIndexState/getRepoMap/
 * getRankedFilesWithHotness/getCriticalPaths` (TASK-07's persisted-only
 * facade), the SAME safe git-object-addressed read primitives
 * (`container.git`, `container.gitTreeReader`) Project Context's
 * `GitTreeReader` introduced (TASK-03) — but with THIS module's OWN narrow
 * setup-evidence allowlist, since Project Context's `.md`-only,
 * specs/docs/insights-rooted eligibility check deliberately excludes
 * README/package-manifest/Dockerfile-shaped files — and TASK-08's
 * advisory-lock concurrency pattern (same mechanism, a repo-scoped key).
 */
export class OnboardingTourService {
  private repo: OnboardingTourRepository;

  constructor(private container: Container) {
    this.repo = new OnboardingTourRepository(container.db);
  }

  // ===========================================================================
  // GET /repos/:id/onboarding — cache-only read, NO model call.
  // ===========================================================================

  async read(workspaceId: string, repoId: string): Promise<OnboardingTourReadResult> {
    const repoRow = await this.container.reposRepo.getById(workspaceId, repoId);
    if (!repoRow) throw new NotFoundError('Repo not found');

    const raw = await this.repo.get(repoId);
    if (raw === undefined) return { tour: null };
    const parsed = OnboardingTourSchema.safeParse(raw);
    // A cache that no longer matches the contract (e.g. an old shape) is
    // treated as "no valid cache" rather than thrown at the caller — same
    // defensive-degrade shape `brief/service.ts`'s `read()` uses.
    return { tour: parsed.success ? parsed.data : null };
  }

  // ===========================================================================
  // POST /repos/:id/onboarding — generate/regenerate.
  // ===========================================================================

  async generate(workspaceId: string, repoId: string): Promise<OnboardingTourGenerateResult> {
    const repoRow = await this.container.reposRepo.getById(workspaceId, repoId);
    if (!repoRow) throw new NotFoundError('Repo not found');

    return this.withGenerationLock(repoId, async () => {
      const priorCache = await this.loadValidCache(repoId);
      const cachedTourPreserved = (tour: OnboardingTour, wrotePersist: boolean): OnboardingTourGenerateResult => ({
        tour,
        cached_tour_preserved: !wrotePersist && priorCache !== null,
      });

      // ---- eligibility gate (ONBOARD-AC-02/05) -------------------------------
      const flagOff = !this.container.config.repoIntelEnabled;
      const indexState = await this.container.repoIntel.getIndexState(repoId);
      const eligible = !flagOff && indexState.status === 'full' && indexState.degraded !== true;

      if (!eligible) {
        const { reason, omissionReason, detail } = this.describeIneligible(flagOff, indexState);
        const tour = this.buildTour({
          repoId,
          sections: buildSkeletonSections(reason),
          status: 'skeleton',
          reason,
          indexRevision: indexState.lastIndexedSha || null,
          attempt: null,
          omissions: [{ path: null, reason: omissionReason, detail }],
        });
        return cachedTourPreserved(tour, false);
      }

      // ---- collect bounded persisted facts (ONBOARD-AC-02/03/07) ------------
      const [repoMapResult, rankedResult, criticalPaths, setupDocuments] = await Promise.all([
        this.container.repoIntel.getRepoMap(repoId),
        this.container.repoIntel.getRankedFilesWithHotness(repoId, ONBOARDING_READING_ORDER_FILE_COUNT),
        this.container.repoIntel.getCriticalPaths(repoId),
        this.collectSetupEvidence(repoRow),
      ]);

      const permittedPaths = new Set<string>([
        ...rankedResult.files.map((f) => f.path),
        ...criticalPaths.flat(),
        ...setupDocuments.map((d) => d.path),
      ]);

      const facts: OnboardingPromptFacts = {
        indexRevision: indexState.lastIndexedSha || null,
        permittedPaths: [...permittedPaths],
        repoMapText: repoMapResult.degraded ? null : repoMapResult.text,
        criticalPaths,
        rankedFiles: rankedResult.files,
        hotnessAvailable: rankedResult.hotnessAvailable,
        setupDocuments,
      };

      const tokenizer = this.container.tokenizer;
      const mandatoryText = buildOnboardingMandatoryPrompt(facts);
      const mandatoryTokens =
        estimateWithEncoding(tokenizer, ONBOARDING_SYSTEM_PROMPT).tokens + estimateWithEncoding(tokenizer, mandatoryText).tokens;

      // Mandatory overflow fails before the call — same shape as the brief's
      // analogous check (`BriefService.generate`).
      if (mandatoryTokens > ONBOARDING_INPUT_TOKEN_CAP) {
        throw new ValidationError(
          `Onboarding tour input cannot fit the ${ONBOARDING_INPUT_TOKEN_CAP}-token budget using mandatory facts alone ` +
            `(~${mandatoryTokens} tokens) — this repository's evidence allowlist is too large for a tour on its own.`,
        );
      }

      // ---- budget: drop optional blocks (repo map/critical paths → ranked
      // files → setup docs) from the TAIL, never a partial fragment ---------
      const remainingBudget = ONBOARDING_INPUT_TOKEN_CAP - mandatoryTokens;
      const blocks = buildOnboardingOptionalBlocks(facts);
      let runningTotal = 0;
      let cutIndex = blocks.length;
      for (let i = 0; i < blocks.length; i++) {
        const tokens = estimateWithEncoding(tokenizer, blocks[i]!.text).tokens;
        if (runningTotal + tokens > remainingBudget) {
          cutIndex = i;
          break;
        }
        runningTotal += tokens;
      }
      const keptBlocks = blocks.slice(0, cutIndex);
      const droppedBlocks = blocks.slice(cutIndex);

      const budgetOmissions: OnboardingOmission[] = droppedBlocks.map((b) => ({
        path: b.label.startsWith('setup-evidence:') ? b.label.slice('setup-evidence:'.length) : null,
        reason: 'budget' as const,
        detail: `Dropped from the tour input to fit the ${ONBOARDING_INPUT_TOKEN_CAP}-token budget (${b.label}).`,
      }));

      const userMessage = [mandatoryText, ...keptBlocks.map((b) => b.text)].join('\n\n');

      // ---- ONE structured model attempt --------------------------------------
      const choice = await resolveFeatureModel(this.container, workspaceId, 'onboarding');
      const attemptedAt = new Date().toISOString();
      let result;
      try {
        const llm = await this.container.llm(choice.provider);
        result = await llm.completeStructured<OnboardingGeneration>({
          model: choice.model,
          schema: ONBOARDING_GENERATION_SCHEMA,
          schemaName: ONBOARDING_SCHEMA_NAME,
          messages: [
            { role: 'system', content: ONBOARDING_SYSTEM_PROMPT },
            { role: 'user', content: userMessage },
          ],
          maxTokens: ONBOARDING_OUTPUT_TOKEN_CAP,
          maxRetries: ONBOARDING_MAX_RETRIES,
          disableTransportRetry: true,
        });
      } catch (err) {
        return cachedTourPreserved(
          this.buildFailureFallback(repoId, indexState.lastIndexedSha || null, choice, attemptedAt, err, budgetOmissions),
          false,
        );
      }

      // ---- grounding (ONBOARD-AC-01/06) --------------------------------------
      const violations = validateOnboardingGrounding(result.data, permittedPaths);
      if (violations.length > 0) {
        const detail = violations.map((v) => `${v.section}: "${v.path}"`).join('; ');
        return cachedTourPreserved(
          this.buildTour({
            repoId,
            sections: buildSkeletonSections(`Generation rejected — cited evidence path(s) not in the collected facts: ${detail}`),
            status: 'failed',
            reason: `Generation rejected — ${violations.length} grounding violation(s): ${detail}`,
            indexRevision: indexState.lastIndexedSha || null,
            attempt: {
              called_model: true,
              provider: choice.provider,
              model: result.model,
              tokens_in: result.tokensIn,
              tokens_out: result.tokensOut,
              cost_usd: result.costUsd,
              attempted_at: attemptedAt,
            },
            omissions: budgetOmissions,
          }),
          false,
        );
      }

      let sections: OnboardingTourSections = toGeneratedSections(result.data, repoId);
      if (setupDocuments.length === 0) {
        sections = markSectionUnavailable(
          sections,
          'local_setup',
          'No setup documentation or manifests were found in this repository.',
        );
      }
      const allGenerated = Object.values(sections).every((s) => s.status === 'generated');

      // ---- re-check the index revision BEFORE persisting (race) -------------
      const freshIndexState = await this.container.repoIntel.getIndexState(repoId);
      if ((freshIndexState.lastIndexedSha || null) !== (indexState.lastIndexedSha || null)) {
        throw new ConflictError('The repository index advanced during tour generation — please retry.');
      }

      const tour = this.buildTour({
        repoId,
        sections,
        status: allGenerated ? 'complete' : 'partial',
        reason: allGenerated
          ? null
          : 'Some sections could not be generated from available evidence (see each section\'s own reason).',
        indexRevision: indexState.lastIndexedSha || null,
        attempt: {
          called_model: true,
          provider: choice.provider,
          model: result.model,
          tokens_in: result.tokensIn,
          tokens_out: result.tokensOut,
          cost_usd: result.costUsd,
          attempted_at: attemptedAt,
        },
        omissions: budgetOmissions,
      });

      const validated = OnboardingTourSchema.parse(tour);
      await this.repo.upsert(repoId, validated);
      return cachedTourPreserved(validated, true);
    });
  }

  // ===========================================================================
  // Helpers (private) — kept as instance methods, not free functions, so the
  // module keeps a single surface for the tests that need to stub part of it.
  // ===========================================================================

  private async loadValidCache(repoId: string): Promise<OnboardingTour | null> {
    const raw = await this.repo.get(repoId);
    if (raw === undefined) return null;
    const parsed = OnboardingTourSchema.safeParse(raw);
    return parsed.success ? parsed.data : null;
  }

  private describeIneligible(
    flagOff: boolean,
    indexState: { status: string; degraded?: boolean; degradedReason?: string; reason?: string },
  ): { reason: string; omissionReason: 'index_unavailable' | 'index_partial'; detail: string } {
    if (flagOff) {
      return {
        reason: 'Repository indexing (repo-intel) is disabled for this workspace.',
        omissionReason: 'index_unavailable',
        detail: 'REPO_INTEL_ENABLED is false for this workspace.',
      };
    }
    if (indexState.status === 'partial') {
      return {
        reason: 'The repository index is still partial — regenerate once indexing completes for a full tour.',
        omissionReason: 'index_partial',
        detail: indexState.reason ?? 'repo_index_state.status is partial',
      };
    }
    return {
      reason: 'No usable repository index is available yet for this repository.',
      omissionReason: 'index_unavailable',
      detail: indexState.degradedReason ?? indexState.reason ?? 'no_data',
    };
  }

  private buildFailureFallback(
    repoId: string,
    indexRevision: string | null,
    choice: { provider: 'openai' | 'anthropic' | 'openrouter'; model: string },
    attemptedAt: string,
    err: unknown,
    omissions: OnboardingOmission[],
  ): OnboardingTour {
    const details = (err as { details?: unknown } | undefined)?.details as
      | { usage?: { tokensIn: number; tokensOut: number } | 'unknown' }
      | undefined;
    const usage = details?.usage;
    const usageKnown = usage !== undefined && usage !== 'unknown';
    const message = err instanceof Error ? err.message : String(err);
    return this.buildTour({
      repoId,
      sections: buildSkeletonSections(`The model attempt failed: ${message}`),
      status: 'failed',
      reason: `The model attempt failed: ${message}`,
      indexRevision,
      attempt: {
        called_model: true,
        provider: choice.provider,
        model: choice.model,
        tokens_in: usageKnown ? (usage as { tokensIn: number }).tokensIn : null,
        tokens_out: usageKnown ? (usage as { tokensOut: number }).tokensOut : null,
        cost_usd: null,
        attempted_at: attemptedAt,
      },
      omissions,
    });
  }

  private buildTour(input: {
    repoId: string;
    sections: OnboardingTourSections;
    status: OnboardingTour['status'];
    reason: string | null;
    indexRevision: string | null;
    attempt: OnboardingTour['attempt'];
    omissions: OnboardingOmission[];
  }): OnboardingTour {
    return {
      repo_id: input.repoId,
      sections: input.sections,
      status: input.status,
      reason: input.reason,
      index_revision: input.indexRevision,
      attempt: input.attempt,
      omissions: input.omissions,
      generated_at: new Date().toISOString(),
    };
  }

  /**
   * Setup-evidence collection (ONBOARD-AC-02/07) — a SEPARATE allowlist from
   * Project Context's discovery roots (`**\/{specs,docs,insights}/**\/*.md`,
   * `.md`-only), since setup docs/manifests like `README.md`/`package.json`/
   * `Dockerfile` are explicitly EXCLUDED by that glob. Reuses the SAME safe
   * git-object-addressed primitives (`container.git.currentHead`,
   * `container.gitTreeReader.listTree/readBlob`) TASK-03's `GitTreeReader`
   * introduced — never a filesystem path join/resolve, never a command
   * execution. Degrades to `[]` (never throws) on any clone/tree-read
   * problem, same "degrade, don't throw" shape the rest of this module and
   * `ProjectContextService` use.
   */
  private async collectSetupEvidence(repoRow: {
    owner: string;
    name: string;
    clonePath: string | null;
  }): Promise<OnboardingSetupDocument[]> {
    if (!repoRow.clonePath) return [];
    const repoRef: RepoRef = { owner: repoRow.owner, name: repoRow.name };
    let entries;
    try {
      const revision = await this.container.git.currentHead(repoRef);
      entries = await this.container.gitTreeReader.listTree(repoRef, revision);
    } catch {
      return [];
    }

    const matched = entries
      .filter((e) => e.kind === 'blob' && e.oid)
      .filter((e) => isSetupEvidencePath(e.path, SETUP_EVIDENCE_BASENAMES, SETUP_EVIDENCE_EXCLUDED_BASENAMES))
      .filter((e) => (e.sizeBytes ?? 0) <= SETUP_EVIDENCE_MAX_BYTES)
      .sort((a, b) => a.path.localeCompare(b.path))
      .slice(0, SETUP_EVIDENCE_MAX_DOCS);

    const docs: OnboardingSetupDocument[] = [];
    for (const entry of matched) {
      try {
        const { content } = await this.container.gitTreeReader.readBlob(repoRef, entry.oid!, SETUP_EVIDENCE_MAX_BYTES);
        docs.push({ path: entry.path, content });
      } catch {
        // Oversized/unreadable at read time — skip, never throw.
      }
    }
    return docs;
  }

  /**
   * Advisory lock (ONBOARD-AC-08) — reuses TASK-08's exact nonblocking,
   * DB-backed cross-process lock mechanism (`container.rawSql`,
   * `sql.reserve()`, `pg_try_advisory_lock`/`pg_advisory_unlock`), with a
   * repo-id-derived key distinct from brief's PR-id-derived one (see
   * `helpers.ts`'s `advisoryLockKeyForRepo`), so a second concurrent
   * generation for the SAME repo fails fast with 409 instead of hanging or
   * silently duplicating work.
   */
  private async withGenerationLock<T>(repoId: string, fn: () => Promise<T>): Promise<T> {
    const rawSql = this.container.rawSql;
    if (!rawSql) {
      // No real Postgres connection available (hermetic test) — nothing to
      // lock against; run uncontended. Production (`buildApp`) always
      // supplies `rawSql`.
      return fn();
    }
    const key = advisoryLockKeyForRepo(repoId).toString();
    const conn = await rawSql.reserve();
    try {
      const rows = await conn`select pg_try_advisory_lock(${key}::bigint) as locked`;
      const locked = Boolean((rows[0] as { locked: boolean } | undefined)?.locked);
      if (!locked) {
        throw new ConflictError('An onboarding tour generation is already in progress for this repository.');
      }
      try {
        return await fn();
      } finally {
        await conn`select pg_advisory_unlock(${key}::bigint)`.catch(() => undefined);
      }
    } finally {
      conn.release();
    }
  }
}

// Re-export for route-level typing.
export type { OnboardingGeneration };
