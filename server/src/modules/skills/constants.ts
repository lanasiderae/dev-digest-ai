/** Constants for the skills module. */

/** Initial body version recorded for a newly-created skill. */
export const INITIAL_SKILL_VERSION = 1;

/** Default skill type when none is supplied (route schema requires one in
 *  practice, but keep a safe fallback for internal callers). */
export const DEFAULT_SKILL_TYPE = 'custom' as const;

// ---- Archive import safety caps -----------------------------------------

/** Max accepted upload size for a .zip archive (compressed bytes). */
export const MAX_ARCHIVE_BYTES = 5 * 1024 * 1024; // 5 MB

/** Max number of entries a .zip archive may contain before it's rejected. */
export const MAX_ARCHIVE_ENTRIES = 200;

/** Max uncompressed size for a single entry (checked from metadata before
 *  inflating — the zip-bomb defense). */
export const MAX_UNCOMPRESSED_ENTRY_BYTES = 1 * 1024 * 1024; // 1 MB

/** Max total uncompressed size across all extracted entries. */
export const MAX_UNCOMPRESSED_TOTAL_BYTES = 10 * 1024 * 1024; // 10 MB

/** Filename patterns rejected outright — the archive is refused, not
 *  silently skipped, when any entry matches. */
export const EXECUTABLE_ENTRY_EXTENSIONS = [
  '.sh',
  '.bash',
  '.zsh',
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.ps1',
  '.py',
  '.js',
  '.mjs',
  '.cjs',
  '.rb',
  '.pl',
  '.php',
  '.dll',
  '.so',
  '.dylib',
  '.jar',
  '.app',
  '.msi',
  '.scr',
];

// ---- URL import safety caps ----------------------------------------------

export const URL_IMPORT_TIMEOUT_MS = 8000;
export const URL_IMPORT_MAX_BYTES = 1 * 1024 * 1024; // 1 MB
