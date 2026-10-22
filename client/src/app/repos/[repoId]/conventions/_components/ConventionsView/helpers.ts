import type { ConventionCandidate } from "@devdigest/shared";

/** Pure helper: combine the accepted candidates from one scan into a draft
 *  `repo-conventions` skill — the body cites each rule with its evidence
 *  path so the skill stays traceable back to the code that justified it. */
export function buildSkillDraft(
  repoName: string,
  accepted: ConventionCandidate[],
): {
  name: string;
  description: string;
  type: "convention";
  source: "extracted";
  body: string;
  evidenceFiles: string[];
} {
  const body = accepted
    .map((c) => `- ${c.rule} (${c.evidence_path})`)
    .join("\n");
  return {
    name: "repo-conventions",
    description: `Coding conventions extracted from ${repoName}.`,
    type: "convention",
    source: "extracted",
    body: `# Repo conventions\n\n${body}`,
    evidenceFiles: [...new Set(accepted.map((c) => c.evidence_path).filter(Boolean))],
  };
}
