import { join } from 'node:path';
import { simpleGit } from 'simple-git';
import type { RepoRef } from '@devdigest/shared';

/**
 * Git tree/blob reader (L05, Project Context Folder).
 *
 * Reads repository content by git OBJECT ID at a pinned commit, never by
 * filesystem path. `GitClient.readFile` (`./simple-git.ts`) validates a
 * filesystem path with `resolve()` + `realpath()` before opening it — safe in
 * the common case, but that's a check-then-use over a MUTABLE working-tree
 * directory: between the realpath check and the actual `fs.readFile`, a
 * concurrent `git reset --hard`/fetch (or, in a more adversarial setting, a
 * symlink swap) could in principle change what the final path resolves to —
 * final-file `O_NOFOLLOW` alone doesn't close a parent-directory TOCTOU
 * window. `git ls-tree`/`cat-file` never touch the working-tree filesystem at
 * all: a tree listing and a blob read are both resolved once against one
 * pinned commit sha, then addressed purely by content-addressed git object id
 * — there is no path to join/resolve against attacker input, and no window
 * where a concurrent operation on the working tree can affect the read (see
 * `tree-reader.test.ts`'s "immune to a TOCTOU swap" case for a reproduction).
 *
 * We never execute repo code — only read-only git plumbing commands.
 */

const MODE_SYMLINK = '120000';
const MODE_SUBMODULE = '160000';

export type GitEntryKind = 'blob' | 'symlink' | 'submodule' | 'tree' | 'other';

export interface GitTreeEntry {
  /** Repo-relative path, forward-slash separated, exactly as git reports it —
      never run through a filesystem `resolve()`/`realpath()`. */
  path: string;
  kind: GitEntryKind;
  /** Git blob object id. Null for a `tree`/`submodule` entry (nothing we read
      a blob for). */
  oid: string | null;
  /** Byte size of the blob, read from `ls-tree --long`'s own column — no
      separate `cat-file -s` round trip needed to list sizes. Null when git
      doesn't report one (non-blob kinds). */
  sizeBytes: number | null;
}

export interface GitTreeReadResult {
  content: string;
  sizeBytes: number;
}

export class BlobTooLargeError extends Error {
  constructor(
    public readonly oid: string,
    public readonly sizeBytes: number,
    public readonly maxBytes: number,
  ) {
    super(`blob ${oid} (${sizeBytes} bytes) exceeds the ${maxBytes}-byte cap`);
  }
}

export interface GitTreeReader {
  /**
   * Recursive listing of every entry reachable from `revision`'s tree
   * (`git ls-tree -r -l -z <revision>`). `-r` recurses into subtrees without
   * ever listing a tree itself or descending into a symlinked directory
   * (git's tree walk is structural — it does not follow a `120000` entry as
   * a directory); `-l` includes each blob's size inline; `-z` NUL-delimits
   * records so a path containing a literal newline can't be misparsed as two
   * entries. Symlink/submodule entries ARE included (with their kind set
   * accordingly) so a caller can show *why* a matching path is excluded
   * rather than have it silently vanish — this reader itself never
   * dereferences a symlink's target or reads inside a submodule.
   */
  listTree(repo: RepoRef, revision: string): Promise<GitTreeEntry[]>;
  /**
   * Reads a blob's content by object id. Bounded by `maxBytes`, checked via
   * `git cat-file -s` BEFORE `git cat-file -p` reads any content — an
   * oversized blob is rejected (`BlobTooLargeError`) without ever reading its
   * body. Both commands address the object store directly; neither takes a
   * filesystem or in-tree path.
   */
  readBlob(repo: RepoRef, oid: string, maxBytes: number): Promise<GitTreeReadResult>;
}

const LS_TREE_LONG_RE = /^(\d{6}) (blob|tree|commit) ([0-9a-f]{40}|[0-9a-f]{64})\s+(-|\d+)\t([\s\S]*)$/;

function parseLsTreeLongLine(line: string): GitTreeEntry {
  const m = LS_TREE_LONG_RE.exec(line);
  if (!m) throw new Error(`unexpected git ls-tree output line: ${JSON.stringify(line)}`);
  const [, mode, type, oid, sizeTok, path] = m as unknown as [string, string, string, string, string, string];
  const kind: GitEntryKind =
    mode === MODE_SYMLINK
      ? 'symlink'
      : mode === MODE_SUBMODULE
        ? 'submodule'
        : type === 'blob'
          ? 'blob'
          : type === 'tree'
            ? 'tree'
            : 'other';
  const sizeBytes = sizeTok === '-' ? null : Number(sizeTok);
  return { path, kind, oid: type === 'blob' ? oid : null, sizeBytes };
}

export class SimpleGitTreeReader implements GitTreeReader {
  constructor(private cloneDir: string) {}

  private pathFor(repo: RepoRef): string {
    return join(this.cloneDir, repo.owner, repo.name);
  }

  async listTree(repo: RepoRef, revision: string): Promise<GitTreeEntry[]> {
    const git = simpleGit(this.pathFor(repo));
    const raw = await git.raw(['ls-tree', '-r', '-l', '-z', revision]);
    return raw.split('\0').filter((line) => line.length > 0).map(parseLsTreeLongLine);
  }

  async readBlob(repo: RepoRef, oid: string, maxBytes: number): Promise<GitTreeReadResult> {
    const git = simpleGit(this.pathFor(repo));
    const sizeRaw = (await git.raw(['cat-file', '-s', oid])).trim();
    const sizeBytes = Number(sizeRaw);
    if (!Number.isFinite(sizeBytes)) {
      throw new Error(`git cat-file -s returned a non-numeric size for ${oid}: ${JSON.stringify(sizeRaw)}`);
    }
    if (sizeBytes > maxBytes) throw new BlobTooLargeError(oid, sizeBytes, maxBytes);
    const content = await git.raw(['cat-file', '-p', oid]);
    return { content, sizeBytes };
  }
}
