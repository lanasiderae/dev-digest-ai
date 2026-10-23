import type { Container } from '../../platform/container.js';
import type { BlastRadius, PrBrief, PrFile, ProjectContextOmission } from '@devdigest/shared';
import { PrBrief as PrBriefSchema } from '@devdigest/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../platform/errors.js';
import { getProjectContextRoots, resolveFeatureModel } from '../settings/feature-models.js';
import { getBlastRadius } from '../blast/service.js';
import { getPrHistory } from '../history/service.js';
import { buildSmartDiff, openFindingLinesByPath } from '../pulls/helpers.js';
import { extractIssueRef, extractTicketRefs } from '../reviews/pipeline/intent-signals.js';
import { IntentService } from '../reviews/pipeline/intent.js';
import { isEligibleMarkdownPath, resolveProjectContextPaths } from '../project-context/helpers.js';
import { ProjectContextService, type ResolvedProjectContextDocument } from '../project-context/service.js';
import {
  buildProjectContextAttachment,
  emptyProjectContextAttachment,
} from '../reviews/pipeline/project-context.js';
import { estimateWithEncoding } from '../../adapters/tokenizer/index.js';
import { BriefRepository } from './repository.js';
import {
  BRIEF_GENERATION_SCHEMA,
  BRIEF_SYSTEM_PROMPT,
  advisoryLockKeyForPr,
  buildAllowedFileSet,
  buildBriefMandatoryPrompt,
  computeContextFingerprint,
  digestOf,
  validateGrounding,
  type BriefGeneration,
} from './helpers.js';
import { BRIEF_INPUT_TOKEN_CAP, BRIEF_MAX_RETRIES, BRIEF_OUTPUT_TOKEN_CAP, BRIEF_SCHEMA_NAME } from './constants.js';

export interface BriefReadResult {
  brief: PrBrief | null;
  stale: boolean;
  stale_reasons: string[];
}

interface ContextIdentity {
  reviewerAgentId: string | null;
  skillIds: string[];
  documents: ResolvedProjectContextDocument[];
  prLinkedSpecPath: string | null;
  omissions: ProjectContextOmission[];
  fingerprint: string;
}

/**
 * PR Brief orchestration (L05, Feature 2 — BRIEF-AC-01–04/06/09–12). Reuses,
 * never re-derives: saved Intent (`IntentService.get`, read-only), persisted
 * Blast Radius (`getBlastRadius`), PR facts/Smart Diff roles (`reviewRepo`/
 * `buildSmartDiff`), and resolved project-context documents
 * (`ProjectContextService.resolveDocuments`). The ONE model call is a single
 * `llm.completeStructured` attempt producing `{summary, risks, review_focus}`
 * — everything else on the final `PrBrief` is assembled here from already-
 * available data.
 */
export class BriefService {
  private repo: BriefRepository;

  constructor(private container: Container) {
    this.repo = new BriefRepository(container.db);
  }

  // ===========================================================================
  // GET /pulls/:id/brief — cache-only read, NO model call.
  // ===========================================================================

  async read(workspaceId: string, prId: string, agentIdQuery?: string): Promise<BriefReadResult> {
    const pull = await this.container.reviewRepo.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');

    const raw = await this.repo.get(prId);
    if (raw === undefined) return { brief: null, stale: false, stale_reasons: [] };

    const parsed = PrBriefSchema.safeParse(raw);
    if (!parsed.success) {
      // A cache that no longer matches the contract (e.g. an old shape) is
      // treated as "no valid cache" rather than thrown at the caller.
      return { brief: null, stale: false, stale_reasons: [] };
    }
    const brief = parsed.data;

    const staleReasons: string[] = [];
    if (brief.provenance.head_sha !== pull.headSha) staleReasons.push('head_sha_changed');

    if (agentIdQuery !== undefined) {
      if (agentIdQuery !== (brief.provenance.reviewer_agent_id ?? undefined)) {
        staleReasons.push('reviewer_changed');
      } else {
        // Same reviewer id named — still recompute the full context identity
        // (skills/documents/order/spec) so a changed selection under an
        // unchanged agent id is also caught, without any model call.
        try {
          const current = await this.computeContextIdentity(workspaceId, pull.repoId, pull, agentIdQuery);
          if (current.fingerprint !== brief.provenance.context_fingerprint) {
            staleReasons.push('context_changed');
          }
        } catch {
          // Best-effort — a transient resolution failure during a read must
          // never throw; the cached brief is still returned, just without
          // this extra staleness signal.
        }
      }
    }

    return { brief, stale: staleReasons.length > 0, stale_reasons: staleReasons };
  }

  // ===========================================================================
  // POST /pulls/:id/brief — generate/regenerate.
  // ===========================================================================

  async generate(workspaceId: string, prId: string, agentId: string | null): Promise<PrBrief> {
    const pull = await this.container.reviewRepo.getPull(workspaceId, prId);
    if (!pull) throw new NotFoundError('Pull request not found');
    const repoRow = await this.container.reviewRepo.getRepo(pull.repoId);
    if (!repoRow) throw new NotFoundError('Repo not found');

    return this.withGenerationLock(prId, async () => {
      // ---- gather facts (no model call yet) --------------------------------
      const identity = await this.computeContextIdentity(workspaceId, pull.repoId, pull, agentId);

      const files = await this.container.reviewRepo.getPrFiles(prId);
      const prFiles: PrFile[] = files.map((f) => ({
        path: f.path,
        additions: f.additions,
        deletions: f.deletions,
        patch: f.patch,
      }));
      const smartDiff = buildSmartDiff(prFiles, openFindingLinesByPath([]));

      const intentResp = await new IntentService(this.container, this.container.reviewRepo).get(prId);
      const intent = intentResp.intent ? { ...intentResp.intent } : null;

      let blast: BlastRadius | null = null;
      let blastDegraded = false;
      let blastReason: string | null = null;
      try {
        const blastResp = await getBlastRadius(this.container, workspaceId, prId);
        blast = blastResp.blast;
        blastDegraded = blastResp.degraded;
        blastReason = blastResp.reason;
      } catch (err) {
        blastReason = (err as Error).message;
      }

      const issueNumber = extractIssueRef(pull.body);
      let linkedIssue: { number: number; title: string; body: string | null } | null = null;
      let issueStatus: 'available' | 'degraded' | 'unavailable' = 'unavailable';
      let issueReason: string | null = 'No linked issue referenced in this PR.';
      if (issueNumber != null) {
        try {
          const github = await this.container.github();
          const issue = await github.getIssue({ owner: repoRow.owner, name: repoRow.name }, issueNumber);
          linkedIssue = { number: issue.number, title: issue.title, body: issue.body ?? null };
          issueStatus = 'available';
          issueReason = null;
        } catch (err) {
          issueStatus = 'degraded';
          issueReason = (err as Error).message;
        }
      }

      const history = await getPrHistory(this.container, workspaceId, prId);

      const allowedFiles = buildAllowedFileSet(prFiles.map((f) => f.path), blast);

      // ---- budget: mandatory text first, documents last (dropped from tail) --
      const mandatoryText = buildBriefMandatoryPrompt({
        headSha: pull.headSha,
        allowedFiles: [...allowedFiles],
        prFiles,
        smartDiff,
        intent,
        blast,
        prDescription: pull.body ?? null,
        linkedIssue,
      });
      const tokenizer = this.container.tokenizer;
      const mandatoryTokens =
        estimateWithEncoding(tokenizer, BRIEF_SYSTEM_PROMPT).tokens + estimateWithEncoding(tokenizer, mandatoryText).tokens;

      if (mandatoryTokens > BRIEF_INPUT_TOKEN_CAP) {
        throw new ValidationError(
          `Brief input cannot fit the ${BRIEF_INPUT_TOKEN_CAP}-token budget using mandatory facts alone ` +
            `(~${mandatoryTokens} tokens) — this PR is too large for a brief, independent of any attached documents.`,
        );
      }

      const remainingBudget = BRIEF_INPUT_TOKEN_CAP - mandatoryTokens;
      const attachment =
        identity.documents.length > 0
          ? buildProjectContextAttachment(identity.documents, identity.omissions, remainingBudget, tokenizer)
          : emptyProjectContextAttachment(identity.omissions);

      const userMessage = attachment.snapshot.attached_specs
        ? `${mandatoryText}\n\n## Project context\n${attachment.snapshot.attached_specs}`
        : mandatoryText;

      // ---- sources (BRIEF-AC-02) ---------------------------------------------
      const sources = {
        intent: intent
          ? { status: 'available' as const, reason: null }
          : { status: 'unavailable' as const, reason: intentResp.unavailable_reason ?? 'not_generated' },
        blast: blast
          ? blastDegraded
            ? { status: 'degraded' as const, reason: blastReason }
            : { status: 'available' as const, reason: null }
          : { status: 'unavailable' as const, reason: blastReason },
        issue: { status: issueStatus, reason: issueReason },
        reviewer_context:
          agentId === null
            ? { status: 'unavailable' as const, reason: 'Reviewer context not selected.' }
            : identity.omissions.length > 0
              ? { status: 'degraded' as const, reason: `${identity.omissions.length} selection(s) omitted` }
              : { status: 'available' as const, reason: null },
        documents:
          attachment.snapshot.documents.length > 0
            ? attachment.snapshot.omissions.length > 0
              ? { status: 'degraded' as const, reason: `${attachment.snapshot.omissions.length} document(s) omitted` }
              : { status: 'available' as const, reason: null }
            : { status: 'unavailable' as const, reason: 'No project-context documents selected.' },
      };

      // ---- ONE structured model attempt --------------------------------------
      const choice = await resolveFeatureModel(this.container, workspaceId, 'risk_brief');
      const llm = await this.container.llm(choice.provider);
      const result = await llm.completeStructured<BriefGeneration>({
        model: choice.model,
        schema: BRIEF_GENERATION_SCHEMA,
        schemaName: BRIEF_SCHEMA_NAME,
        messages: [
          { role: 'system', content: BRIEF_SYSTEM_PROMPT },
          { role: 'user', content: userMessage },
        ],
        maxTokens: BRIEF_OUTPUT_TOKEN_CAP,
        maxRetries: BRIEF_MAX_RETRIES,
        disableTransportRetry: true,
      });

      // ---- grounding (BRIEF-AC-03/04) ----------------------------------------
      const violations = validateGrounding(result.data, allowedFiles);
      if (violations.length > 0) {
        throw new ValidationError(
          `Brief generation rejected — ${violations.length} grounding violation(s): ${violations
            .map((v) => v.detail)
            .join('; ')}`,
        );
      }

      // ---- re-check head/context BEFORE persisting (race) --------------------
      const freshPull = await this.container.reviewRepo.getPull(workspaceId, prId);
      if (!freshPull || freshPull.headSha !== pull.headSha) {
        throw new ConflictError('The PR advanced to a new commit during brief generation — please retry.');
      }
      const freshIdentity = await this.computeContextIdentity(workspaceId, pull.repoId, freshPull, agentId);
      if (freshIdentity.fingerprint !== identity.fingerprint) {
        throw new ConflictError('The selected context changed during brief generation — please retry.');
      }

      const now = new Date().toISOString();
      const brief: PrBrief = {
        summary: result.data.summary,
        intent,
        blast,
        risks: { risks: result.data.risks },
        history,
        review_focus: result.data.review_focus,
        sources,
        provenance: {
          reviewer_agent_id: agentId,
          skill_ids: identity.skillIds,
          documents: attachment.snapshot.documents.map((d) => {
            const resolved = identity.documents.find((doc) => doc.path === d.path && doc.repo_id === d.repo_id);
            return {
              repo_id: d.repo_id,
              path: d.path,
              revision: d.revision,
              digest: resolved ? digestOf(resolved.content) : null,
            };
          }),
          pr_linked_spec_path: identity.prLinkedSpecPath,
          head_sha: pull.headSha,
          context_fingerprint: identity.fingerprint,
          generated_at: now,
        },
      };

      const validated = PrBriefSchema.parse(brief);
      await this.repo.upsert(prId, validated);
      return validated;
    });
  }

  // ===========================================================================
  // Context identity — reviewer/skills/documents/spec, fingerprinted
  // (BRIEF-AC-12). Shared between GET's staleness check and POST's
  // pre-generation resolve + pre-persist recheck. No model call; bounded
  // git-object reads only.
  // ===========================================================================

  private async computeContextIdentity(
    workspaceId: string,
    repoId: string,
    pull: { title: string; body: string | null },
    agentId: string | null,
  ): Promise<ContextIdentity> {
    const roots = await getProjectContextRoots(this.container, workspaceId);
    const { specPaths } = extractTicketRefs([pull.title, pull.body]);
    const candidateSpecPath = specPaths[0] ?? null;
    const prLinkedSpecPath =
      candidateSpecPath && isEligibleMarkdownPath(candidateSpecPath, roots) ? candidateSpecPath : null;

    let skillIds: string[] = [];
    let paths: string[] = [];
    let omissions: ProjectContextOmission[] = [];

    if (agentId !== null) {
      const agent = await this.container.agentsRepo.getById(workspaceId, agentId);
      if (!agent) throw new NotFoundError('Agent not found');
      const links = await this.container.agentsRepo.linkedSkills(agentId);
      const enabled = links.filter((l) => l.skill.enabled);
      skillIds = enabled.map((l) => l.skill.id);
      const resolved = resolveProjectContextPaths({
        repoId,
        agentSelections: agent.projectContext,
        skillSelections: enabled.map((l) => l.skill.projectContext),
      });
      paths = resolved.paths;
      omissions = resolved.omissions;
    }

    if (prLinkedSpecPath && !paths.includes(prLinkedSpecPath)) {
      paths = [...paths, prLinkedSpecPath];
    }

    let documents: ResolvedProjectContextDocument[] = [];
    if (paths.length > 0) {
      const result = await new ProjectContextService(this.container).resolveDocuments(workspaceId, repoId, paths);
      documents = result.documents;
      omissions = [...omissions, ...result.omissions];
    }

    const fingerprint = computeContextFingerprint({
      reviewer_agent_id: agentId,
      skill_ids: skillIds,
      documents: documents.map((d) => ({ repo_id: d.repo_id, path: d.path, revision: d.revision, digest: digestOf(d.content) })),
      pr_linked_spec_path: prLinkedSpecPath,
    });

    return { reviewerAgentId: agentId, skillIds, documents, prLinkedSpecPath, omissions, fingerprint };
  }

  // ===========================================================================
  // Advisory lock (BRIEF-AC-06/12) — a nonblocking, DB-backed cross-process
  // lock on a dedicated connection (`sql.reserve()`), so a second concurrent
  // generation for the SAME PR fails fast with an actionable 409 instead of
  // hanging or silently duplicating work. Deliberately NOT a DB transaction —
  // the lock is held across the (slow) model call, but no transaction is kept
  // open for that whole duration.
  // ===========================================================================

  private async withGenerationLock<T>(prId: string, fn: () => Promise<T>): Promise<T> {
    const rawSql = this.container.rawSql;
    if (!rawSql) {
      // No real Postgres connection available (hermetic test) — nothing to
      // lock against; run uncontended. Production (`buildApp`) always
      // supplies `rawSql`.
      return fn();
    }
    // postgres-js has no bigint parameter binding — pass the key as text and
    // cast server-side; `advisoryLockKeyForPr` always produces a valid
    // signed-64-bit decimal string, never user-controlled SQL.
    const key = advisoryLockKeyForPr(prId).toString();
    const conn = await rawSql.reserve();
    try {
      const rows = await conn`select pg_try_advisory_lock(${key}::bigint) as locked`;
      const locked = Boolean((rows[0] as { locked: boolean } | undefined)?.locked);
      if (!locked) {
        throw new ConflictError('A brief generation is already in progress for this pull request.');
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
export type { BriefGeneration };
