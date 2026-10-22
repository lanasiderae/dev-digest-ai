import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord, PrFile } from "@devdigest/shared";
import type { DiffFindingApi } from "@/components/diff-viewer";
import messages from "../../../../../../../../../../messages/en/prReview.json";
import shellMessages from "../../../../../../../../../../messages/en/shell.json";
import { RoleGroup } from "./RoleGroup";
import type { MergedGroup } from "../../helpers";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages, shell: shellMessages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

function prFile(path: string, patch: string): PrFile {
  return { path, additions: 1, deletions: 0, patch };
}

function finding(overrides: Partial<FindingRecord> = {}): FindingRecord {
  return {
    id: "f1",
    severity: "CRITICAL",
    category: "security",
    title: "t",
    file: "a.ts",
    start_line: 1,
    end_line: 1,
    rationale: "r",
    suggestion: null,
    confidence: 0.9,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    matched_skill: null,
    review_id: "rev1",
    accepted_at: null,
    dismissed_at: null,
    ...overrides,
  };
}

// Diff whose new (RIGHT) line 1 is "first line" — matches `finding({ start_line: 1 })`.
const PATCH_A = "@@ -1,1 +1,1 @@\n+first line";
const PATCH_B = "@@ -1,1 +1,1 @@\n+second line";

describe("RoleGroup — jump to findings", () => {
  it("scrolls directly to the finding's line, and cycles to the next one on repeat clicks", () => {
    const scrollSpy = vi.fn();
    Element.prototype.scrollIntoView = scrollSpy;

    const findingsByPath: Record<string, FindingRecord[]> = {
      "a.ts": [finding({ id: "a1", file: "a.ts", start_line: 1 })],
      "b.ts": [finding({ id: "b1", file: "b.ts", start_line: 1 })],
    };
    const findings: DiffFindingApi = {
      forPath: (path) => findingsByPath[path] ?? [],
      visible: true,
      renderFinding: () => null,
    };
    const group: MergedGroup = {
      role: "core",
      files: [prFile("a.ts", PATCH_A), prFile("b.ts", PATCH_B)],
      flaggedPaths: new Set(["a.ts", "b.ts"]),
    };

    renderWithIntl(<RoleGroup group={group} findings={findings} />);

    const badge = screen.getByRole("button", { name: "2 open finding(s)" });
    fireEvent.click(badge);

    expect(scrollSpy).toHaveBeenCalledTimes(1);
    const firstTarget = scrollSpy.mock.instances[0] as unknown as HTMLElement;
    expect(firstTarget.getAttribute("data-line-key")).toBe("RIGHT:1");
    expect(firstTarget.textContent).toContain("first line");

    fireEvent.click(badge);
    expect(scrollSpy).toHaveBeenCalledTimes(2);
    const secondTarget = scrollSpy.mock.instances[1] as unknown as HTMLElement;
    expect(secondTarget.textContent).toContain("second line");

    // Wraps back to the first finding after the last one.
    fireEvent.click(badge);
    expect(scrollSpy).toHaveBeenCalledTimes(3);
    const thirdTarget = scrollSpy.mock.instances[2] as unknown as HTMLElement;
    expect(thirdTarget.textContent).toContain("first line");
  });
});
