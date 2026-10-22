import type { AgentSkillLink, Skill } from "@devdigest/shared";

export interface SkillRow {
  skill: Skill;
  linked: boolean;
}

/** Join all workspace skills with an agent's ordered links: linked skills
 *  first (in their saved order), then unlinked skills after. Pure — no I/O. */
export function joinSkillRows(allSkills: Skill[], links: AgentSkillLink[]): SkillRow[] {
  const bySkillId = new Map(allSkills.map((sk) => [sk.id, sk]));
  const linkedOrdered = [...links]
    .sort((a, b) => a.order - b.order)
    .map((l) => bySkillId.get(l.skill_id))
    .filter((sk): sk is Skill => sk !== undefined);
  const linkedIds = new Set(linkedOrdered.map((sk) => sk.id));
  const unlinked = allSkills.filter((sk) => !linkedIds.has(sk.id));
  return [
    ...linkedOrdered.map((skill) => ({ skill, linked: true })),
    ...unlinked.map((skill) => ({ skill, linked: false })),
  ];
}

/** Case-insensitive filter over a skill row's name + description. */
export function filterRows(rows: SkillRow[], search: string): SkillRow[] {
  const q = search.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((r) => `${r.skill.name} ${r.skill.description}`.toLowerCase().includes(q));
}

/** Append a skill id to the end of the linked-id order. */
export function attachId(linkedIds: string[], skillId: string): string[] {
  return linkedIds.includes(skillId) ? linkedIds : [...linkedIds, skillId];
}

/** Remove a skill id from the linked-id order. */
export function detachId(linkedIds: string[], skillId: string): string[] {
  return linkedIds.filter((id) => id !== skillId);
}

/** Swap a linked skill id with its neighbor one position up/down. No-op at the ends. */
export function moveLinkedId(linkedIds: string[], skillId: string, direction: "up" | "down"): string[] {
  const i = linkedIds.indexOf(skillId);
  if (i === -1) return linkedIds;
  const j = direction === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= linkedIds.length) return linkedIds;
  const next = [...linkedIds];
  [next[i], next[j]] = [next[j]!, next[i]!];
  return next;
}

/** Move a dragged linked skill id to sit at the dropped-on id's position.
 *  No-op when either id is missing/unlinked, or they're the same id. */
export function reorderLinkedId(linkedIds: string[], draggedId: string, overId: string): string[] {
  if (draggedId === overId) return linkedIds;
  const from = linkedIds.indexOf(draggedId);
  const to = linkedIds.indexOf(overId);
  if (from === -1 || to === -1) return linkedIds;
  const next = [...linkedIds];
  next.splice(from, 1);
  next.splice(to, 0, draggedId);
  return next;
}
