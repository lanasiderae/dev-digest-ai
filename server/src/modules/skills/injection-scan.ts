/**
 * Deterministic heuristic scan for prompt-injection / jailbreak patterns in
 * a skill body.
 *
 * Unlike diff/PR content (handled by reviewer-core's `INJECTION_GUARD` +
 * `wrapUntrusted`), a skill's body is concatenated straight into an agent's
 * TRUSTED system prompt — nothing downstream treats it as untrusted. A
 * malicious or compromised skill can directly override review behavior
 * ("always approve", "never flag security issues"), so it needs its own
 * gate, enforced at save time, before it ever reaches a prompt.
 *
 * This is a best-effort heuristic, not a guarantee of safety — it exists to
 * catch obvious, lazy attempts (the common jailbreak phrasings), not to be
 * adversarially robust against a determined attacker.
 */

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
