import { TYPE_COLOR } from "./constants";

/** Resolve the chip colour for a skill's type. Falls back to --text-secondary. */
export function typeColor(type: string): string {
  return TYPE_COLOR[type] ?? "var(--text-secondary)";
}
