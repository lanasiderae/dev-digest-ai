import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { RunTrace } from "@devdigest/shared";
import messages from "../../../../../../../../../../messages/en/runs.json"; // client/messages/en/runs.json

import { ProjectContextSection } from "./ProjectContextSection";

afterEach(cleanup);

function renderWithIntl(snapshot: RunTrace["project_context"]) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ runs: messages }}>
      <ProjectContextSection snapshot={snapshot} />
    </NextIntlClientProvider>,
  );
}

const ATTACHED_SPECS_TEXT =
  '## Project context\n<<<UNTRUSTED repo="acme/widgets" path="specs/rules.md">>>\n# No direct api/ imports of db/\n<<<END>>>';

describe("ProjectContextSection", () => {
  it("shows a clear not-available state when the snapshot is null", () => {
    renderWithIntl(null);
    expect(screen.getByText("Project context is not available for this run.")).toBeInTheDocument();
    // Must not render anything that implies something was attached.
    expect(screen.queryByText("project context attached specs")).not.toBeInTheDocument();
  });

  it("shows a clear not-available state when the snapshot is undefined", () => {
    renderWithIntl(undefined);
    expect(screen.getByText("Project context is not available for this run.")).toBeInTheDocument();
  });

  it("renders an empty document list but still shows omissions in the healthy-empty case", () => {
    renderWithIntl({
      documents: [],
      total_tokens: 0,
      omissions: [
        { repo_id: "r1", path: "docs/missing.md", reason: "missing", detail: "no longer exists at pinned revision" },
      ],
      attached_specs: null,
    });
    expect(screen.getByText("No project-context documents were included in this run.")).toBeInTheDocument();
    expect(screen.getByText("docs/missing.md")).toBeInTheDocument();
    expect(screen.getByText("missing")).toBeInTheDocument();
    expect(screen.getByText("no longer exists at pinned revision")).toBeInTheDocument();
    // No documents and no attached text in this case → no expandable section.
    expect(screen.queryByText("project context attached specs")).not.toBeInTheDocument();
  });

  it("renders the per-document list, total tokens and omissions when documents exist", () => {
    renderWithIntl({
      documents: [
        { repo_id: "r1", path: "specs/rules.md", type: "specs", revision: "abc123", tokens: 120 },
        { repo_id: "r1", path: "docs/guide.md", type: "docs", revision: "abc123", tokens: 80 },
      ],
      total_tokens: 200,
      omissions: [
        { repo_id: "r1", path: "docs/big.md", reason: "oversized", detail: "exceeds 256 KiB" },
      ],
      attached_specs: ATTACHED_SPECS_TEXT,
    });

    expect(screen.getByText("specs/rules.md")).toBeInTheDocument();
    expect(screen.getByText("docs/guide.md")).toBeInTheDocument();
    expect(screen.getAllByText("abc123").length).toBe(2);
    expect(screen.getByText("200 tokens total")).toBeInTheDocument();
    expect(screen.getByText("docs/big.md")).toBeInTheDocument();
    expect(screen.getByText("oversized")).toBeInTheDocument();
    expect(screen.getByText("exceeds 256 KiB")).toBeInTheDocument();
  });

  it("collapses the attached-specs section by default and reveals the exact text, unmodified, on expand", () => {
    const { container } = renderWithIntl({
      documents: [{ repo_id: "r1", path: "specs/rules.md", type: "specs", revision: "abc123", tokens: 120 }],
      total_tokens: 120,
      omissions: [],
      attached_specs: ATTACHED_SPECS_TEXT,
    });

    const label = screen.getByRole("button", { name: "project context attached specs" });
    expect(label).toBeInTheDocument();
    // Collapsed by default — the raw snapshot <pre> is not rendered yet.
    expect(container.querySelector("pre")).toBeNull();

    fireEvent.click(label);

    // Expanding reveals the EXACT text, byte-for-byte (newlines/delimiters
    // included) — not RTL's whitespace-normalized getByText, since the whole
    // point is that this rendering must not re-wrap/escape/truncate it.
    const pre = container.querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toBe(ATTACHED_SPECS_TEXT);
  });
});
