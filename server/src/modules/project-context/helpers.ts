import type { ProjectContextDocumentType, ProjectContextOmission, ProjectContextSelection } from '@devdigest/shared';
import {
  ELIGIBLE_DOCUMENT_EXTENSION,
  HEURISTIC_BYTES_PER_TOKEN,
  KNOWN_DOCUMENT_TYPE_SEGMENTS,
} from './constants.js';

/**
 * Pure helpers for the project-context module: glob-root matching, path
 * shape validation, type classification, the heuristic token estimate, and
 * the C3 ordered-union/dedup selection resolver. No I/O, no container — every
 * function here is unit-testable without a mock adapter.
 */

// ---- Glob root matching ----------------------------------------------------

const REGEX_META = /[.+^${}()|[\]\\]/;

function escapeRegexChar(ch: string): string {
  return REGEX_META.test(ch) ? `\\${ch}` : ch;
}

/** Converts one `{a,b,c}`-or-literal glob SEGMENT body into a regex source
    fragment. Called on text that is never itself a `**` token (that's
    handled by the caller, which needs slash-boundary context `**` alone
    does not have). */
function globAtomsToRegex(text: string): string {
  let out = '';
  let i = 0;
  while (i < text.length) {
    const ch = text[i]!;
    if (ch === '{') {
      const end = text.indexOf('}', i);
      if (end === -1) {
        out += escapeRegexChar(ch);
        i++;
        continue;
      }
      const alts = text
        .slice(i + 1, end)
        .split(',')
        .map((alt) => alt.split('').map(escapeRegexChar).join(''));
      out += `(?:${alts.join('|')})`;
      i = end + 1;
      continue;
    }
    if (ch === '*') {
      out += '[^/]*';
      i++;
      continue;
    }
    if (ch === '?') {
      out += '[^/]';
      i++;
      continue;
    }
    out += escapeRegexChar(ch);
    i++;
  }
  return out;
}

/**
 * Converts a configured discovery-root glob (e.g. the C4 default
 * `**\/{specs,docs,insights}/**\/*.md`) into a RegExp matched against a
 * repo-relative, forward-slash path. Supports `**` (any number of whole path
 * segments, including zero — at the start, middle, or end of the pattern),
 * single-segment `*`/`?`, and `{a,b,c}` alternation. This is a small,
 * purpose-built subset of glob syntax (not a general minimatch
 * implementation) — sufficient for workspace-configured roots, which are
 * simple directory-shaped patterns, not arbitrary extglob expressions.
 */
export function compileRootGlob(pattern: string): RegExp {
  let out = '';
  let i = 0;
  const n = pattern.length;
  while (i < n) {
    if (pattern[i] === '*' && pattern[i + 1] === '*') {
      const before = i === 0 ? '' : pattern[i - 1];
      const afterIdx = i + 2;
      const after = afterIdx < n ? pattern[afterIdx] : '';
      if (before === '/' && after === '/') {
        // middle "/**/ " — zero or more whole directories between two
        // literal slashes; the leading slash was already emitted by the
        // previous literal char, so drop it and let the optional group own
        // both boundary slashes.
        if (out.endsWith('/')) out = out.slice(0, -1);
        out += '(?:/.*)?/';
        i += 3;
        continue;
      }
      if ((before === '' || before === '/') && after === '/') {
        // leading "**/ " — zero or more whole directories at the start.
        out += '(?:.*/)?';
        i += 3;
        continue;
      }
      if (before === '/' && after === '') {
        // trailing "/** " at the end of the pattern.
        if (out.endsWith('/')) out = out.slice(0, -1);
        out += '(?:/.*)?';
        i += 2;
        continue;
      }
      // Bare "**" with no slash boundary on either side — match anything.
      out += '.*';
      i += 2;
      continue;
    }
    // Any other character: run the single-char/brace atom converter over the
    // longest run up to the next "**" (so `{a,b,c}` is handled as one atom).
    let j = i;
    while (j < n && !(pattern[j] === '*' && pattern[j + 1] === '*')) j++;
    out += globAtomsToRegex(pattern.slice(i, j));
    i = j;
  }
  return new RegExp(`^${out}$`);
}

/** Does `path` match at least one configured discovery-root glob? */
export function matchesAnyRoot(path: string, roots: readonly string[]): boolean {
  return roots.some((root) => compileRootGlob(root).test(path));
}

// ---- Type classification ---------------------------------------------------

/** Classifies a matched path into one of the three C4 default-root
    categories (first matching path segment wins, topmost first), or
    `custom` for anything else — a custom-configured root, or a default-root
    match whose segment naming doesn't literally say specs/docs/insights. */
export function classifyDocumentType(path: string): ProjectContextDocumentType {
  const segments = path.split('/');
  for (const seg of segments) {
    if ((KNOWN_DOCUMENT_TYPE_SEGMENTS as readonly string[]).includes(seg)) {
      return seg as ProjectContextDocumentType;
    }
  }
  return 'custom';
}

// ---- Path shape validation --------------------------------------------------

/**
 * Validates the SHAPE of a requested repo-relative markdown path — rejects
 * absolute paths, drive letters, backslashes, `.`/`..` segments and empty
 * segments (so `//`, a leading `/`, or a trailing `/` all fail), and
 * requires a `.md` extension. Returns the path unchanged (never resolved,
 * joined, or touched against a filesystem) when valid, or `null`.
 *
 * This is a STRING check only — the actual safety guarantee comes from how
 * callers use the result: it is matched by exact string equality against a
 * `GitTreeReader.listTree()` entry, never passed to `fs`/`path.resolve` or
 * to a git command as a path argument. A gap in this regex could only ever
 * cause a request to fail to match an existing tree entry (safe), not cause
 * an escape, because there is nowhere to join/resolve against.
 */
export function normalizeRequestedPath(raw: string): string | null {
  if (!raw) return null;
  if (raw.includes('\\')) return null;
  if (raw.startsWith('/') || /^[a-zA-Z]:/.test(raw)) return null;
  if (!raw.toLowerCase().endsWith(ELIGIBLE_DOCUMENT_EXTENSION)) return null;
  const segments = raw.split('/');
  for (const seg of segments) {
    if (seg === '' || seg === '.' || seg === '..') return null;
  }
  return raw;
}

/** `normalizeRequestedPath` shape check AND configured-root membership — the
    full eligibility test both discovery (indirectly, via the root filter
    applied to tree entries) and preview (directly, on the requested path)
    apply before any content is read. */
export function isEligibleMarkdownPath(path: string, roots: readonly string[]): boolean {
  return normalizeRequestedPath(path) === path && matchesAnyRoot(path, roots);
}

// ---- Token estimate ---------------------------------------------------------

/** Heuristic `tokens_estimate` — see constants.ts's `HEURISTIC_BYTES_PER_TOKEN`
    doc comment for why this doesn't call the tokenizer adapter. */
export function estimateTokensFromBytes(sizeBytes: number): number {
  return Math.ceil(sizeBytes / HEURISTIC_BYTES_PER_TOKEN);
}

// ---- C3 ordered-union / dedup resolver -------------------------------------

export interface ResolveProjectContextPathsInput {
  /** The repository being reviewed/resolved against — only selections for
      THIS repo are included; every other repo's entries become a
      `cross_repo` omission. */
  repoId: string;
  /** Direct-agent selections, in their stored (save) order. */
  agentSelections: readonly ProjectContextSelection[];
  /** Each enabled safe skill's own selection list, already ordered by the
      caller's configured skill order. This function does not re-order
      skills — only dedups paths within and across them, in the order
      given. */
  skillSelections: readonly (readonly ProjectContextSelection[])[];
}

export interface ResolveProjectContextPathsResult {
  /** Deduplicated, ordered repo-relative paths for `repoId` — direct-agent
      selections first, then each skill's selections in the caller's order;
      first occurrence wins. */
  paths: string[];
  /** Entries skipped from `paths`, with why (`cross_repo`/`duplicate`). This
      function performs NO filesystem/safety validation of its own — paths
      here are exactly as stored in selection metadata; a caller that
      actually reads them (discovery/preview, or a review's context
      resolution) re-validates root membership/existence/symlink-safety
      independently and may add further omissions (`missing`/`oversized`/
      `unsafe_path`/`budget`) on top of this function's output. */
  omissions: ProjectContextOmission[];
}

/**
 * C3/CTX-AC-05: unions direct-agent selections first, then enabled safe
 * skills in their configured order, deduplicates by first occurrence, and
 * excludes any selection naming a repository other than the one under
 * review. Pure/synchronous — the only caller today is this module's own
 * tests; TASK-04 (agent/skill CRUD context resolution) and TASK-06 (review
 * context) call this with their own real selection data.
 */
export function resolveProjectContextPaths(
  input: ResolveProjectContextPathsInput,
): ResolveProjectContextPathsResult {
  const seen = new Set<string>();
  const paths: string[] = [];
  const omissions: ProjectContextOmission[] = [];

  const consume = (selections: readonly ProjectContextSelection[]) => {
    for (const sel of selections) {
      for (const path of sel.paths) {
        if (sel.repo_id !== input.repoId) {
          omissions.push({ repo_id: sel.repo_id, path, reason: 'cross_repo', detail: null });
          continue;
        }
        if (seen.has(path)) {
          omissions.push({ repo_id: sel.repo_id, path, reason: 'duplicate', detail: null });
          continue;
        }
        seen.add(path);
        paths.push(path);
      }
    }
  };

  consume(input.agentSelections);
  for (const skillSel of input.skillSelections) consume(skillSel);

  return { paths, omissions };
}
