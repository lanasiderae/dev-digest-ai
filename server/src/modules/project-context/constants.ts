import type { ProjectContextDocumentType } from '@devdigest/shared';

/**
 * Constants for the project-context module (L05, Feature 1).
 *
 * The CAP constants (`MAX_PROJECT_CONTEXT_*`, `DEFAULT_PROJECT_CONTEXT_ROOTS`)
 * already live in the frozen `@devdigest/shared` contract
 * (`contracts/project-context.ts`) — they are NOT redefined here. This file
 * only holds module-local literals that aren't part of the cross-package
 * contract.
 */

/** git tree entry mode for a symlink, as `git ls-tree` reports it. A symlink
    is a blob internally (its content is the link target text) — never safe
    to treat as readable document content; see `adapters/git/tree-reader.ts`. */
export const GIT_MODE_SYMLINK = '120000';

/** git tree entry mode for a submodule/gitlink (points at a commit in
    another repository, not a blob in THIS one). */
export const GIT_MODE_SUBMODULE = '160000';

/** The three C4 default-root category names. `classifyDocumentType`
    (helpers.ts) checks a matched path's segments against this list,
    topmost-first; anything else is `custom` (any other configured root). */
export const KNOWN_DOCUMENT_TYPE_SEGMENTS: ReadonlyArray<Exclude<ProjectContextDocumentType, 'custom'>> = [
  'specs',
  'docs',
  'insights',
];

/** `.md` is the only eligible document extension in this slice (C1's
    "Project Context Folder" scope — see the approved spec's Feature 1). */
export const ELIGIBLE_DOCUMENT_EXTENSION = '.md';

/**
 * Heuristic bytes-per-token used for `tokens_estimate` (discovery/preview).
 * Mirrors the tokenizer adapter's own `ceil(chars / 4)` fallback shape
 * (`adapters/tokenizer/index.ts`'s `approxTokens`) without depending on that
 * adapter directly — it's scoped (by its own doc comment) to repo-intel's
 * repo-map budget search; TASK-04 is the one that formally extends tokenizer
 * policy to this feature's actual review-time token budgeting. Both
 * `ProjectContextDiscoveredDocument.tokens_estimate` and
 * `ProjectContextPreview.tokens_estimate` are explicitly named "_estimate",
 * not an actual model-tokenizer count, so this heuristic satisfies the
 * contract as written.
 */
export const HEURISTIC_BYTES_PER_TOKEN = 4;

/**
 * Sentinel `revision` value for a repo that has no clone yet (or whose
 * `currentHead`/`listTree` call failed) — discovery degrades to an empty,
 * truncation-free result rather than throwing (same "degrade, don't throw"
 * shape repo-intel's own facade uses for an unready clone; see
 * `modules/repo-intel/service.ts`'s `!repo.clonePath` checks). The contract's
 * `revision` field is a plain non-nullable `string` (frozen by TASK-02), so
 * this sentinel — rather than a schema change — is how "no revision exists
 * yet" is represented.
 */
export const UNAVAILABLE_REVISION = 'unavailable';
