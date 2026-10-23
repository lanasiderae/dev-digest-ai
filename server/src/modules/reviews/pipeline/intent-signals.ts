/**
 * Pure helpers for the Intent Layer (no I/O, no fastify/drizzle/adapters) —
 * extraction/sanitization only. All regexes are linear (no catastrophic
 * backtracking) and are always applied to already-capped strings.
 */

const CLOSE_KEYWORD_RE = /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\b\s*:?\s*#(\d+)\b/i;
/**
 * A bare `#N` not preceded by another `#` (excludes `##heading`), a word
 * character (excludes `owner/repo#123`), or a `/` (excludes URL fragments).
 */
const BARE_REF_RE = /(?:^|[^#\w/])#(\d+)\b/;

/** Parse a same-repo linked-issue number from a PR body; `null` if none. */
export function extractIssueRef(body: string | null | undefined): number | null {
  if (!body) return null;
  const closing = body.match(CLOSE_KEYWORD_RE);
  if (closing?.[1]) return Number(closing[1]);
  const bare = body.match(BARE_REF_RE);
  return bare?.[1] ? Number(bare[1]) : null;
}

/** Jira/Linear-style short codes, e.g. `ABC-123`, `ENG-42`. */
const TICKET_KEY_RE = /\b[A-Z][A-Z0-9]{1,9}-\d+\b/g;
/** Notion / Google Docs / Linear URLs — recorded as text only, never fetched
 *  (no credentials to reach them, and they're outside this repo's git history). */
const TICKET_URL_RE = /\bhttps?:\/\/(?:www\.)?(?:notion\.so|docs\.google\.com|linear\.app)\/\S+/g;
/** Repo-relative spec/plan doc paths — the one reference kind this layer
 *  actually attempts to fetch (via the git adapter), per AC11. */
const SPEC_PATH_RE = /\b(?:docs|specs|server\/docs|server\/specs|client\/docs|client\/specs|reviewer-core\/docs|reviewer-core\/specs)\/[\w./-]+\.md\b/g;

export interface TicketRefs {
  /** External ticket keys/URLs — included as text-only signals, never fetched. */
  external: string[];
  /** Repo-relative spec/plan paths found in the text — candidates to fetch. */
  specPaths: string[];
}

/** Extract ticket/spec references from PR text. External refs are text-only
 *  signals; `specPaths` are candidates the caller may attempt to read from
 *  the repo. Dedups within each list; order of first appearance. */
export function extractTicketRefs(texts: (string | null | undefined)[]): TicketRefs {
  const joined = texts.filter((t): t is string => Boolean(t)).join('\n');
  const external = dedupe([...(joined.match(TICKET_KEY_RE) ?? []), ...(joined.match(TICKET_URL_RE) ?? [])]);
  const specPaths = dedupe(joined.match(SPEC_PATH_RE) ?? []);
  return { external, specPaths };
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

/** Text after the second `@@` in a unified-diff hunk header (the "changed
 *  symbols" hint) — never the changed lines themselves. */
const HUNK_HEADER_RE = /^@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@(.*)$/gm;

/** Extract non-empty hunk-header trailing context from a per-file patch's raw
 *  text. The patch text itself is never forwarded anywhere — only these
 *  short extracted strings are, per AC6 ("never full diff bodies"). */
export function hunkContexts(patchText: string, maxChars: number): string[] {
  const out: string[] = [];
  for (const m of patchText.matchAll(HUNK_HEADER_RE)) {
    const ctx = m[1]?.trim();
    if (!ctx) continue;
    out.push(ctx.slice(0, maxChars));
  }
  return out;
}

function sanitizeBullets(bullets: string[], maxBullets: number, maxChars: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of bullets) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const capped = trimmed.slice(0, maxChars);
    const key = capped.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(capped);
    if (out.length >= maxBullets) break;
  }
  return out;
}

export interface SanitizeIntentLimits {
  maxStatementChars: number;
  maxBullets: number;
  maxBulletChars: number;
}

/**
 * Sanitize the model's structured output: trim, drop empties, dedupe, cap
 * lengths/counts. An empty statement (after trim) throws — the caller maps
 * that to a `generation_failed` unavailable reason rather than persisting
 * garbage.
 */
export function sanitizeIntent(
  raw: { intent: string; in_scope: string[]; out_of_scope: string[] },
  limits: SanitizeIntentLimits,
): { intent: string; in_scope: string[]; out_of_scope: string[] } {
  const statement = raw.intent.trim().slice(0, limits.maxStatementChars);
  if (!statement) throw new Error('intent: empty statement (schema_invalid)');
  return {
    intent: statement,
    in_scope: sanitizeBullets(raw.in_scope, limits.maxBullets, limits.maxBulletChars),
    out_of_scope: sanitizeBullets(raw.out_of_scope, limits.maxBullets, limits.maxBulletChars),
  };
}
