import type {
  ProjectContextDiscoveredDocument,
  ProjectContextDiscoveryQuery,
  ProjectContextDiscoveryResponse,
  ProjectContextDocumentQuery,
  ProjectContextPreview,
} from '@devdigest/shared';
import { MAX_PROJECT_CONTEXT_DISCOVERED_DOCUMENTS, MAX_PROJECT_CONTEXT_DOCUMENT_BYTES } from '@devdigest/shared';
import type { Container } from '../../platform/container.js';
import { NotFoundError, ValidationError } from '../../platform/errors.js';
import { getProjectContextRoots } from '../settings/feature-models.js';
import { ProjectContextRepository } from './repository.js';
import { UNAVAILABLE_REVISION } from './constants.js';
import { classifyDocumentType, estimateTokensFromBytes, isEligibleMarkdownPath, normalizeRequestedPath } from './helpers.js';

/**
 * project-context service — orchestration for discovery/preview. No SQL (see
 * repository.ts), no direct git/filesystem calls (see
 * `container.git`/`container.gitTreeReader`). Security-critical read path:
 * every document access is validated against the workspace-scoped repo
 * ownership check (`repository.getOwnedRepo`) and the configured discovery
 * roots BEFORE any clone content is read.
 */
export class ProjectContextService {
  private repo: ProjectContextRepository;
  // Instance property (not a free function call) so tests can override it
  // the same way they override `.repo` below, without needing a chainable
  // mock `Db` — see `server/test/project-context-service.test.ts`.
  private getRoots = (workspaceId: string): Promise<string[]> =>
    getProjectContextRoots(this.container, workspaceId);

  constructor(private container: Container) {
    this.repo = new ProjectContextRepository(container.db);
  }

  async discover(
    workspaceId: string,
    repoId: string,
    query: ProjectContextDiscoveryQuery,
  ): Promise<ProjectContextDiscoveryResponse> {
    const repoRow = await this.repo.getOwnedRepo(workspaceId, repoId);
    if (!repoRow) throw new NotFoundError('Repo not found');
    if (!repoRow.clonePath) {
      return { repo_id: repoId, revision: UNAVAILABLE_REVISION, documents: [], truncated: false };
    }

    const repoRef = { owner: repoRow.owner, name: repoRow.name };
    const roots = await this.getRoots(workspaceId);

    let revision: string;
    let entries: Awaited<ReturnType<Container['gitTreeReader']['listTree']>>;
    try {
      revision = await this.container.git.currentHead(repoRef);
      entries = await this.container.gitTreeReader.listTree(repoRef, revision);
    } catch {
      // Clone exists but isn't a readable git repo yet (e.g. a clone job
      // still in flight) — degrade rather than 500.
      return { repo_id: repoId, revision: UNAVAILABLE_REVISION, documents: [], truncated: false };
    }

    const search = query.search?.toLowerCase();
    const matched = entries
      .filter((e) => e.kind === 'blob' || e.kind === 'symlink')
      .filter((e) => isEligibleMarkdownPath(e.path, roots))
      .filter((e) => !search || e.path.toLowerCase().includes(search))
      // Defensive explicit sort for determinism — `git ls-tree`'s own order
      // is already lexicographic-by-tree, but we don't rely on that being
      // stable across git versions for the "same prefix truncates" guarantee.
      .sort((a, b) => a.path.localeCompare(b.path));

    const truncated = matched.length > MAX_PROJECT_CONTEXT_DISCOVERED_DOCUMENTS;
    const page = matched.slice(0, MAX_PROJECT_CONTEXT_DISCOVERED_DOCUMENTS);

    const documents: ProjectContextDiscoveredDocument[] = page.map((e) => {
      if (e.kind === 'symlink') {
        // Listed for transparency (so the UI can show *why* it's excluded),
        // but never read — see tree-reader.ts's doc comment. No size/token
        // claim is made about a symlink's target.
        return {
          repo_id: repoId,
          path: e.path,
          type: classifyDocumentType(e.path),
          size_bytes: null,
          tokens_estimate: null,
          updated_at: null,
          oversized: false,
        };
      }
      const sizeBytes = e.sizeBytes ?? 0;
      const oversized = sizeBytes > MAX_PROJECT_CONTEXT_DOCUMENT_BYTES;
      return {
        repo_id: repoId,
        path: e.path,
        type: classifyDocumentType(e.path),
        size_bytes: sizeBytes,
        // An oversized document is listed (so the user understands why it's
        // excluded) but never read, so no token estimate is claimed either.
        tokens_estimate: oversized ? null : estimateTokensFromBytes(sizeBytes),
        // No per-file commit-date read in this slice (would cost one `git
        // log` per file) — left null rather than guessed.
        updated_at: null,
        oversized,
      };
    });

    return { repo_id: repoId, revision, documents, truncated };
  }

  async preview(
    workspaceId: string,
    repoId: string,
    query: ProjectContextDocumentQuery,
  ): Promise<ProjectContextPreview> {
    const normalized = normalizeRequestedPath(query.path);
    if (!normalized) throw new ValidationError('Invalid document path');

    const repoRow = await this.repo.getOwnedRepo(workspaceId, repoId);
    if (!repoRow) throw new NotFoundError('Repo not found');
    if (!repoRow.clonePath) throw new NotFoundError('Repository clone is not ready yet');

    const roots = await this.getRoots(workspaceId);
    if (!isEligibleMarkdownPath(normalized, roots)) {
      throw new ValidationError('Path is outside the configured project-context roots');
    }

    const repoRef = { owner: repoRow.owner, name: repoRow.name };
    let revision: string;
    let entries: Awaited<ReturnType<Container['gitTreeReader']['listTree']>>;
    try {
      revision = await this.container.git.currentHead(repoRef);
      entries = await this.container.gitTreeReader.listTree(repoRef, revision);
    } catch {
      throw new NotFoundError('Repository clone is not ready yet');
    }

    // Exact-string match against the tree listing — never a filesystem
    // join/resolve against `normalized`. A path that isn't literally one of
    // git's own reported entries at this pinned commit cannot be read, full
    // stop; see helpers.ts's `normalizeRequestedPath` doc comment.
    const entry = entries.find((e) => e.path === normalized);
    if (!entry || entry.kind !== 'blob' || !entry.oid) {
      // Covers: missing, and the symlink/submodule cases (CTX-AC-07) — a
      // symlink matches `path` but its `kind` is never `'blob'`, so it falls
      // through to this same "not found" response rather than being read.
      throw new NotFoundError('Document not found');
    }
    if ((entry.sizeBytes ?? 0) > MAX_PROJECT_CONTEXT_DOCUMENT_BYTES) {
      throw new ValidationError('Document exceeds the maximum previewable size', { reason: 'oversized' });
    }

    const { content } = await this.container.gitTreeReader.readBlob(
      repoRef,
      entry.oid,
      MAX_PROJECT_CONTEXT_DOCUMENT_BYTES,
    );

    return {
      repo_id: repoId,
      path: normalized,
      type: classifyDocumentType(normalized),
      revision,
      content,
      tokens_estimate: estimateTokensFromBytes(Buffer.byteLength(content, 'utf8')),
    };
  }
}
