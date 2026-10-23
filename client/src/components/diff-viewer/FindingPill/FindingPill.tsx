/* FindingPill — compact severity label (icon + "blocker"/"warning"/"suggestion")
   shown at the right of a diff row that has a review finding anchored to it.
   Reuses @devdigest/ui's SEV colors/icons (AC25) — not a new palette. */
import React from "react";
import { Icon, SEV, type Severity } from "@devdigest/ui";
import { SEVERITY_PILL_LABEL } from "../findings";
import { s } from "./styles";

export function FindingPill({ severity }: { severity: Severity }) {
  const sev = SEV[severity];
  const I = Icon[sev.icon];
  return (
    <span style={s.pill(sev.c, sev.bg)}>
      <I size={11} />
      {SEVERITY_PILL_LABEL[severity]}
    </span>
  );
}
