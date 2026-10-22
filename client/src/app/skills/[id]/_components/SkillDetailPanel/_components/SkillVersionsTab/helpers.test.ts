import { describe, it, expect } from "vitest";
import { diffLines, formatVersionDate, sortVersionsDesc } from "./helpers";

describe("diffLines", () => {
  it("marks unchanged lines as same", () => {
    expect(diffLines("a\nb\nc", "a\nb\nc")).toEqual([
      { type: "same", text: "a" },
      { type: "same", text: "b" },
      { type: "same", text: "c" },
    ]);
  });

  it("marks an added line", () => {
    expect(diffLines("a\nc", "a\nb\nc")).toEqual([
      { type: "same", text: "a" },
      { type: "add", text: "b" },
      { type: "same", text: "c" },
    ]);
  });

  it("marks a removed line", () => {
    expect(diffLines("a\nb\nc", "a\nc")).toEqual([
      { type: "same", text: "a" },
      { type: "del", text: "b" },
      { type: "same", text: "c" },
    ]);
  });

  it("handles a full replacement", () => {
    expect(diffLines("old", "new")).toEqual([
      { type: "del", text: "old" },
      { type: "add", text: "new" },
    ]);
  });
});

describe("sortVersionsDesc", () => {
  it("sorts newest version first without mutating the input", () => {
    const input = [{ version: 1 }, { version: 3 }, { version: 2 }];
    const sorted = sortVersionsDesc(input);
    expect(sorted.map((v) => v.version)).toEqual([3, 2, 1]);
    expect(input.map((v) => v.version)).toEqual([1, 3, 2]);
  });
});

describe("formatVersionDate", () => {
  it("formats a valid ISO date", () => {
    expect(formatVersionDate("2026-05-30T00:00:00.000Z")).not.toBe("2026-05-30T00:00:00.000Z");
  });
  it("falls back to the raw string for an invalid date", () => {
    expect(formatVersionDate("not-a-date")).toBe("not-a-date");
  });
});
