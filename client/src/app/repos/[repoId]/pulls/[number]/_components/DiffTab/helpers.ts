/* Pure helpers for the DiffTab (no React, no hooks). */
import type { FindingRecord, PrFile, ReviewRecord, SmartDiff, SmartDiffRole } from "@/lib/types";
import { FALLBACK_ROLE, ROLE_ORDER } from "./constants";

/** A smart-diff group rebuilt from the PR's real files (which carry the patches). */
export interface MergedGroup {
  role: SmartDiffRole;
  files: PrFile[];
  /** Paths the smart-diff flagged with open-finding lines. */
  flaggedPaths: ReadonlySet<string>;
}

/**
 * Smart order + roles come from the smart-diff response; patches come from
 * the PR's real `files` (the smart-diff response never carries patch text).
 * PR files the smart-diff doesn't know about are appended to the fallback
 * (core) group; smart-diff paths absent from the PR's files are dropped.
 * Always returns every role in `ROLE_ORDER`, including empty ones (AC14).
 */
export function mergeSmartOrder(prFiles: PrFile[], smartDiff: SmartDiff): MergedGroup[] {
  const byPath = new Map(prFiles.map((f) => [f.path, f]));
  const seen = new Set<string>();
  const byRole = new Map<SmartDiffRole, MergedGroup>(
    ROLE_ORDER.map((role) => [role, { role, files: [], flaggedPaths: new Set<string>() }]),
  );
  for (const g of smartDiff.groups) {
    const target = byRole.get(g.role);
    if (!target) continue;
    const flagged = target.flaggedPaths as Set<string>;
    for (const sf of g.files) {
      const file = byPath.get(sf.path);
      if (!file || seen.has(sf.path)) continue;
      seen.add(sf.path);
      target.files.push(file);
      if (sf.finding_lines.length > 0) flagged.add(sf.path);
    }
  }
  byRole.get(FALLBACK_ROLE)!.files.push(...prFiles.filter((f) => !seen.has(f.path)));
  return ROLE_ORDER.map((role) => byRole.get(role)!);
}

/** Files in the group the smart-diff flagged with open-finding lines (AC16
 *  counts affected FILES, not total findings). */
export function filesWithFindingsCount(group: MergedGroup): number {
  return group.files.filter((f) => group.flaggedPaths.has(f.path)).length;
}

/**
 * Latest findings per file path — one review per agent (a re-run supersedes
 * that agent's earlier pass), newest first, `kind='review'` only. Dismissed
 * findings are KEPT (FileCard renders them muted, same as the Findings tab).
 */
export function latestFindingsByPath(reviews: ReviewRecord[]): Map<string, FindingRecord[]> {
  const sorted = reviews
    .filter((r) => r.kind === "review")
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const seenAgents = new Set<string>();
  const byPath = new Map<string, FindingRecord[]>();
  for (const r of sorted) {
    const key = r.agent_id ?? r.id;
    if (seenAgents.has(key)) continue;
    seenAgents.add(key);
    for (const f of r.findings) {
      if (f.kind != null && f.kind !== "finding") continue;
      const list = byPath.get(f.file) ?? [];
      list.push(f);
      byPath.set(f.file, list);
    }
  }
  return byPath;
}
