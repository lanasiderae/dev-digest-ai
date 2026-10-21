/* FindingsCell — the PR list's Findings column: a compact severity-badge
   cluster (critical/warning/suggestion counts summed across every agent that
   reviewed the PR, each contributing its own latest review) that opens a
   read-only popover of those findings on HOVER (with a short close delay so
   crossing from the trigger into the popover itself doesn't close it) —
   keyboard users get the same popover via focus + Enter/Space, since hover
   alone isn't reachable without a pointer.

   The popover breaks the same findings down per agent, so the cluster answers
   "how much is open on this PR" and the popover answers "who found it". */
"use client";

import React from "react";
import { SeverityBadge } from "@devdigest/ui";
import type { PrMeta } from "@/lib/types";
import { FindingsPopover } from "../FindingsPopover";
import { SEVERITY_ORDER } from "./constants";
import { s } from "./styles";

const ZERO_COUNTS = { CRITICAL: 0, WARNING: 0, SUGGESTION: 0 };
const CLOSE_DELAY_MS = 150;

export function FindingsCell({ pr }: { pr: PrMeta }) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLDivElement>(null);
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const counts = pr.findings_by_severity ?? ZERO_COUNTS;
  const total = counts.CRITICAL + counts.WARNING + counts.SUGGESTION;

  const clearCloseTimer = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const openNow = () => {
    clearCloseTimer();
    setOpen(true);
  };
  const closeSoon = () => {
    clearCloseTimer();
    closeTimer.current = setTimeout(() => setOpen(false), CLOSE_DELAY_MS);
  };
  React.useEffect(() => () => clearCloseTimer(), []);

  // Empty cell, not "0" — a PR with no open findings shows nothing here.
  if (total === 0) return <div />;

  return (
    <div style={s.wrap}>
      <div
        ref={triggerRef}
        role="button"
        tabIndex={0}
        aria-haspopup="dialog"
        aria-expanded={open}
        onMouseEnter={openNow}
        onMouseLeave={closeSoon}
        onClick={(e) => {
          // The row itself navigates to the PR detail page on click — the
          // badge cluster isn't itself a click target (hover opens it), but
          // a stray click must still not fall through to that navigation.
          e.stopPropagation();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.stopPropagation();
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
        style={s.trigger}
      >
        {SEVERITY_ORDER.filter((sev) => counts[sev] > 0).map((sev) => (
          <SeverityBadge key={sev} severity={sev} count={counts[sev]} compact />
        ))}
      </div>
      {open && pr.id && (
        <FindingsPopover
          prId={pr.id}
          headSha={pr.head_sha}
          anchorRef={triggerRef}
          onMouseEnter={openNow}
          onMouseLeave={closeSoon}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}
