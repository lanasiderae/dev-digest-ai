import { describe, it, expect } from "vitest";
import type { ConventionCandidate } from "@devdigest/shared";
import { buildSkillDraft } from "./helpers";

function candidate(overrides: Partial<ConventionCandidate> = {}): ConventionCandidate {
  return {
    id: "c1",
    rule: "Use async/await instead of .then() chains",
    evidence_path: "src/api/users.ts",
    evidence_snippet: "const user = await db.users.find(id);",
    confidence: 0.9,
    accepted: true,
    rejected: false,
    ...overrides,
  };
}

describe("buildSkillDraft", () => {
  it("names the draft repo-conventions, typed convention, sourced extracted", () => {
    const draft = buildSkillDraft("acme/payments-api", [candidate()]);
    expect(draft.name).toBe("repo-conventions");
    expect(draft.type).toBe("convention");
    expect(draft.source).toBe("extracted");
    expect(draft.description).toContain("acme/payments-api");
  });

  it("cites every accepted candidate's rule and evidence path in the body", () => {
    const draft = buildSkillDraft("acme/payments-api", [
      candidate({ id: "c1", rule: "Rule A", evidence_path: "a.ts" }),
      candidate({ id: "c2", rule: "Rule B", evidence_path: "b.ts" }),
    ]);
    expect(draft.body).toContain("Rule A (a.ts)");
    expect(draft.body).toContain("Rule B (b.ts)");
  });

  it("dedupes evidence file paths across candidates", () => {
    const draft = buildSkillDraft("repo", [
      candidate({ id: "c1", evidence_path: "a.ts" }),
      candidate({ id: "c2", evidence_path: "a.ts" }),
      candidate({ id: "c3", evidence_path: "b.ts" }),
    ]);
    expect(draft.evidenceFiles).toEqual(["a.ts", "b.ts"]);
  });

  it("produces an empty-body draft when nothing is accepted", () => {
    const draft = buildSkillDraft("repo", []);
    expect(draft.evidenceFiles).toEqual([]);
    expect(draft.body).toBe("# Repo conventions\n\n");
  });
});
