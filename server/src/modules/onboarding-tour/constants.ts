/**
 * Onboarding Tour (L05, Feature 3) constants — ONBOARD-AC-01–08.
 *
 * Named `onboarding-tour`, not `onboarding`, to avoid any confusion with the
 * pre-existing, unrelated `/onboarding` add-repository CLIENT screen (which
 * has no backend module of its own — confirmed by grep before this module
 * was added; see the service.ts doc comment).
 */

/** The five fixed sections, in order — re-exported here for local use next
 *  to the other module constants (the canonical list lives on the contract,
 *  `ONBOARDING_TOUR_SECTION_KEYS`). */
export { ONBOARDING_TOUR_SECTION_KEYS } from '@devdigest/shared';

/** C7: whole-input token cap for the ONE tour generation call (instructions/
 *  delimiters included). Enforced BEFORE calling the model — the mandatory
 *  section (index status/revision/permitted file allowlist) must fit on its
 *  own; compact facts, ranked files, then setup documents are dropped from
 *  the tail to make room. */
export const ONBOARDING_INPUT_TOKEN_CAP = 24_000;

/** C7: output token cap for the structured completion — larger than the
 *  brief's (1,500) to accommodate five structured sections and reduce JSON
 *  truncation risk; a cap, not a usage target. */
export const ONBOARDING_OUTPUT_TOKEN_CAP = 8_000;

/** One structured attempt only (ONBOARD-AC-04/06) — no schema-reprompt, no
 *  transport retry. */
export const ONBOARDING_MAX_RETRIES = 0;

/** The structured-output schema name sent to the provider. */
export const ONBOARDING_SCHEMA_NAME = 'OnboardingTourGeneration';

/** How many top-ranked (rank × (1+hotness)) files to request from
 *  `getRankedFilesWithHotness` for the reading-order/first-tasks facts. */
export const ONBOARDING_READING_ORDER_FILE_COUNT = 25;

// ---- Setup-evidence allowlist (distinct from Project Context's roots) -----
//
// Project Context's discovery roots (`**/{specs,docs,insights}/**/*.md`)
// deliberately EXCLUDE README/package-manifest/Dockerfile-shaped files — see
// `project-context/constants.ts`'s `ELIGIBLE_DOCUMENT_EXTENSION` (`.md`
// only) and `KNOWN_DOCUMENT_TYPE_SEGMENTS`. Local-setup evidence needs
// exactly those excluded files, so this module defines its OWN narrow
// allowlist by basename (case-insensitive, matched at any depth so a
// monorepo's `server/package.json`/`client/README.md` are still eligible),
// reusing the SAME safe git-object read primitives (`container.git`,
// `container.gitTreeReader`) rather than a new filesystem reader or
// Project Context's markdown-only eligibility check.
export const SETUP_EVIDENCE_BASENAMES: ReadonlySet<string> = new Set(
  [
    'README.md',
    'README',
    'CONTRIBUTING.md',
    'package.json',
    'Dockerfile',
    'docker-compose.yml',
    'docker-compose.yaml',
    'Makefile',
    'pyproject.toml',
    'requirements.txt',
    'go.mod',
    'Cargo.toml',
    'Procfile',
    '.nvmrc',
    'tsconfig.json',
  ].map((s) => s.toLowerCase()),
);

/** Never read a lock file as setup evidence — huge, generated, and not
 *  itself a human-authored setup instruction (the manifest it's derived
 *  from, e.g. `package.json`, is already in the allowlist above). */
export const SETUP_EVIDENCE_EXCLUDED_BASENAMES: ReadonlySet<string> = new Set(
  ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'poetry.lock', 'cargo.lock', 'go.sum'].map((s) =>
    s.toLowerCase(),
  ),
);

/** Bounded read: at most this many setup-evidence documents are collected,
 *  regardless of how many the repository actually has. */
export const SETUP_EVIDENCE_MAX_DOCS = 20;

/** Per-document byte cap for a setup-evidence read — smaller than Project
 *  Context's 256 KiB cap (`MAX_PROJECT_CONTEXT_DOCUMENT_BYTES`), since these
 *  documents compete for the same 24,000-token whole-input budget as the
 *  repo map / critical paths / ranked files. */
export const SETUP_EVIDENCE_MAX_BYTES = 65_536;

/** Advisory-lock seed namespace — see `helpers.ts`'s `advisoryLockKeyForRepo`.
 *  Mixed into the hash so a repo id's onboarding-tour lock key never
 *  collides with brief's PR-id-derived lock key for the same literal uuid
 *  string (repo ids and PR ids are drawn from the same `uuid` space). */
export const ADVISORY_LOCK_NAMESPACE = 'onboarding-tour';
