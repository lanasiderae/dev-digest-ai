/* Inline review-finding support for the DiffViewer (Files changed tab).
   Pure helpers + the render-prop contract the viewer needs; no hooks. The
   route supplies `renderFinding` so this shared component never imports a
   route's _components (FindingCard lives there, per frontend-ui-architecture's
   no-cross-route-_components-import rule). */
import type { ReactNode } from "react";
import type { Severity } from "@devdigest/ui";
import type { FindingRecord } from "../../lib/types";
import { lineKey } from "./comments";

/** What the viewer needs to show review findings inline. */
export interface DiffFindingApi {
  /** Findings for `path` (dismissed ones included — rendered muted, same as
   *  the Findings tab). */
  forPath: (path: string) => FindingRecord[];
  /** Gate for both the pill and the expanded card — same flag that already
   *  hides/shows GitHub comment threads (AC28: one visibility toggle). */
  visible: boolean;
  /** Render prop: the route supplies the finding card. */
  renderFinding: (f: FindingRecord) => ReactNode;
}

/** Findings are graded against the diff's NEW-side line numbers (reviewer-core's
 *  grounding uses `newLineNumbers`), so a finding always anchors RIGHT. */
export function keyForFinding(f: FindingRecord): string {
  return lineKey("RIGHT", f.start_line) ?? `RIGHT:${f.start_line}`;
}

/**
 * Split findings into those that match a rendered new-side line and ones
 * whose line isn't in this patch (AC27) — surfaced separately so none are
 * silently dropped.
 */
export function partitionFindings(
  findings: FindingRecord[],
  renderedKeys: Set<string>,
): { matched: Map<string, FindingRecord[]>; outside: FindingRecord[] } {
  const matched = new Map<string, FindingRecord[]>();
  const outside: FindingRecord[] = [];
  for (const f of findings) {
    const key = keyForFinding(f);
    if (renderedKeys.has(key)) {
      const list = matched.get(key) ?? [];
      list.push(f);
      matched.set(key, list);
    } else {
      outside.push(f);
    }
  }
  return { matched, outside };
}

const SEVERITY_RANK: Record<Severity, number> = { CRITICAL: 0, WARNING: 1, SUGGESTION: 2, INFO: 3 };

/** Most severe finding on one line — drives that line's single pill. */
export function topSeverity(findings: FindingRecord[]): Severity {
  return findings.reduce<Severity>(
    (best, f) => (SEVERITY_RANK[f.severity as Severity] < SEVERITY_RANK[best] ? (f.severity as Severity) : best),
    findings[0]!.severity as Severity,
  );
}

/** AC25's label mapping — reuses `SEV`'s colors/icons, just a different label. */
export const SEVERITY_PILL_LABEL: Record<Severity, string> = {
  CRITICAL: "blocker",
  WARNING: "warning",
  SUGGESTION: "suggestion",
  INFO: "info",
};
