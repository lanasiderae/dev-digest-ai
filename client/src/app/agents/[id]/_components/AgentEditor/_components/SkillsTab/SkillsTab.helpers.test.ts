import { describe, it, expect } from "vitest";
import type { AgentSkillLink, Skill } from "@devdigest/shared";
import { attachId, detachId, filterRows, joinSkillRows, moveLinkedId, reorderLinkedId } from "./helpers";

function skill(id: string, name: string): Skill {
  return {
    id,
    name,
    description: `${name} description`,
    type: "custom",
    source: "manual",
    body: "body",
    enabled: true,
    version: 1,
    evidence_files: null,
    injection_detected: false,
  };
}

const A = skill("a", "skill-a");
const B = skill("b", "skill-b");
const C = skill("c", "skill-c");

describe("joinSkillRows", () => {
  it("puts linked skills first, in their saved order, then unlinked skills", () => {
    const links: AgentSkillLink[] = [
      { agent_id: "ag", skill_id: "c", order: 0 },
      { agent_id: "ag", skill_id: "a", order: 1 },
    ];
    const rows = joinSkillRows([A, B, C], links);
    expect(rows.map((r) => r.skill.id)).toEqual(["c", "a", "b"]);
    expect(rows.map((r) => r.linked)).toEqual([true, true, false]);
  });

  it("ignores a link whose skill id no longer exists", () => {
    const links: AgentSkillLink[] = [{ agent_id: "ag", skill_id: "ghost", order: 0 }];
    const rows = joinSkillRows([A], links);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.skill.id).toBe("a");
    expect(rows[0]!.linked).toBe(false);
  });
});

describe("filterRows", () => {
  it("filters case-insensitively by name or description", () => {
    const rows = joinSkillRows([A, B], []);
    expect(filterRows(rows, "SKILL-A").map((r) => r.skill.id)).toEqual(["a"]);
    expect(filterRows(rows, "")).toHaveLength(2);
  });
});

describe("attachId / detachId", () => {
  it("attachId appends, is idempotent for an already-linked id", () => {
    expect(attachId(["a"], "b")).toEqual(["a", "b"]);
    expect(attachId(["a"], "a")).toEqual(["a"]);
  });
  it("detachId removes the id, leaving order intact for the rest", () => {
    expect(detachId(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });
});

describe("moveLinkedId", () => {
  it("swaps with the previous/next neighbor", () => {
    expect(moveLinkedId(["a", "b", "c"], "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveLinkedId(["a", "b", "c"], "b", "down")).toEqual(["a", "c", "b"]);
  });
  it("is a no-op at the ends", () => {
    expect(moveLinkedId(["a", "b"], "a", "up")).toEqual(["a", "b"]);
    expect(moveLinkedId(["a", "b"], "b", "down")).toEqual(["a", "b"]);
  });
});

describe("reorderLinkedId", () => {
  it("drops a dragged id into the position of the id dropped on", () => {
    expect(reorderLinkedId(["a", "b", "c", "d"], "a", "c")).toEqual(["b", "c", "a", "d"]);
    expect(reorderLinkedId(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"]);
  });
  it("is a no-op when dragged onto itself", () => {
    expect(reorderLinkedId(["a", "b", "c"], "b", "b")).toEqual(["a", "b", "c"]);
  });
  it("is a no-op when either id is not in the linked list (e.g. an unlinked drop target)", () => {
    expect(reorderLinkedId(["a", "b"], "a", "ghost")).toEqual(["a", "b"]);
    expect(reorderLinkedId(["a", "b"], "ghost", "a")).toEqual(["a", "b"]);
  });
});
