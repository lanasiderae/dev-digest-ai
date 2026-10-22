/** Constants for the DiffTab (Smart Diff grouping). */
import type { SmartDiffRole } from "@/lib/types";

/** Per-role i18n label key (namespace `prReview.smartDiff`). */
export const ROLE_LABEL_KEY: Record<SmartDiffRole, string> = {
  core: "smartDiff.coreLabel",
  tests: "smartDiff.testsLabel",
  wiring: "smartDiff.wiringLabel",
  docs: "smartDiff.docsLabel",
  boilerplate: "smartDiff.boilerplateLabel",
};

/** Display order of the role groups; all of them render, even when empty (AC14). */
export const ROLE_ORDER: readonly SmartDiffRole[] = ["core", "tests", "wiring", "docs", "boilerplate"];

/** Roles that start collapsed by default (AC15). */
export const COLLAPSED_BY_DEFAULT: readonly SmartDiffRole[] = ["docs", "boilerplate"];

/** Role a PR file absent from the smart-diff response is appended to. */
export const FALLBACK_ROLE: SmartDiffRole = "core";
