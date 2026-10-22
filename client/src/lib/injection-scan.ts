/* injection-scan.ts — client-side mirror of
   server/src/modules/skills/injection-scan.ts. The server is the actual
   enforcement point (a skill can never be saved enabled while flagged); this
   copy exists only so the UI can warn/block on an UNSAVED draft body before
   the user even hits Save, instead of waiting on a round trip. Keep the two
   pattern lists in sync by hand, same as the rest of vendor/shared. */

interface Pattern {
  label: string;
  re: RegExp;
}

const PATTERNS: Pattern[] = [
  {
    label: 'Instruction override',
    re: /\b(ignore|disregard|forget)\s+(all|any)?\s*(previous|prior|above|earlier)\s+(instructions?|prompts?)\b/i,
  },
  { label: 'Role override', re: /\byou are now\b.{0,40}\b(assistant|ai|model)\b/i },
  {
    label: 'System prompt exfiltration',
    re: /\b(output|reveal|print|show)\b.{0,20}\b(system prompts?|agent configurations?|your instructions)\b/i,
  },
  { label: 'Safety override', re: /\boverride\s+(all\s+)?safety(\s+guidelines)?\b/i },
  { label: 'Explicit SYSTEM directive', re: /^\s*SYSTEM:\s*\S/im },
  {
    label: 'Review-manipulation directive',
    re: /\balways\s+(approve|pass|return\s+score:?\s*100|give\s+(a\s+)?score:?\s*100)\b/i,
  },
  {
    label: 'Review-manipulation directive',
    re: /\bnever\s+(flag|report|mention)\s+(security|vulnerabilit(y|ies)|issues?)\b/i,
  },
  { label: 'No-restrictions claim', re: /\bno restrictions?\b/i },
];

/** Returns the distinct pattern labels matched, or `[]` if the body looks clean. */
export function detectInjectionPatterns(body: string): string[] {
  const hits = new Set<string>();
  for (const { label, re } of PATTERNS) {
    if (re.test(body)) hits.add(label);
  }
  return [...hits];
}
