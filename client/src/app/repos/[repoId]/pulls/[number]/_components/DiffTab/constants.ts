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

/** Per-role i18n description key (namespace `prReview.smartDiff`). */
export const ROLE_DESCRIPTION_KEY: Record<SmartDiffRole, string> = {
  core: "smartDiff.coreDescription",
  tests: "smartDiff.testsDescription",
  wiring: "smartDiff.wiringDescription",
  docs: "smartDiff.docsDescription",
  boilerplate: "smartDiff.boilerplateDescription",
};

/** Per-role dot color, following the `TYPE_COLOR` precedent in
 *  `app/skills/_components/SkillCard/constants.ts`. */
export const ROLE_COLOR: Record<SmartDiffRole, string> = {
  core: "#3b82f6",
  tests: "#8b5cf6",
  wiring: "#10b981",
  docs: "#f59e0b",
  boilerplate: "#6b7280",
};

/** Display order of the role groups; all of them render, even when empty (AC14). */
export const ROLE_ORDER: readonly SmartDiffRole[] = ["core", "tests", "wiring", "docs", "boilerplate"];

/** Roles that start collapsed by default (AC15). */
export const COLLAPSED_BY_DEFAULT: readonly SmartDiffRole[] = ["docs", "boilerplate"];

/** Role a PR file absent from the smart-diff response is appended to. */
export const FALLBACK_ROLE: SmartDiffRole = "core";
