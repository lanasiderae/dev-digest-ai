import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { FindingRecord, PrFile } from "@devdigest/shared";
import messages from "../../../../messages/en/shell.json";
import { FileCard } from "./FileCard";
import type { DiffFindingApi } from "../findings";

afterEach(cleanup);

function renderWithIntl(ui: React.ReactElement) {
  return render(<NextIntlClientProvider locale="en" messages={{ shell: messages }}>{ui}</NextIntlClientProvider>);
}

const FILE: PrFile = { path: "src/config.ts", additions: 3, deletions: 1, patch: null };

function finding(overrides: Partial<FindingRecord> = {}): FindingRecord {
  return {
    id: "f1",
    severity: "CRITICAL",
    category: "security",
    title: "Hardcoded secret",
    file: FILE.path,
    start_line: 1,
    end_line: 1,
    rationale: "A secret is committed.",
    suggestion: null,
    confidence: 0.95,
    kind: "finding",
    trifecta_components: null,
    evidence: null,
    review_id: "r1",
    accepted_at: null,
    dismissed_at: null,
    ...overrides,
  };
}

function findingsApi(records: FindingRecord[]): DiffFindingApi {
  return {
    forPath: () => records,
    visible: true,
    renderFinding: () => null,
  };
}

describe("FileCard — findings dot indicator", () => {
  it("shows the dot when the file has an open (non-dismissed) finding", () => {
    renderWithIntl(<FileCard file={FILE} findings={findingsApi([finding()])} />);
    expect(screen.getByRole("img", { name: "This file has findings" })).toBeInTheDocument();
  });

  it("hides the dot when the file's only findings are dismissed", () => {
    renderWithIntl(
      <FileCard file={FILE} findings={findingsApi([finding({ dismissed_at: "2026-01-01T00:00:00Z" })])} />,
    );
    expect(screen.queryByRole("img", { name: "This file has findings" })).not.toBeInTheDocument();
  });

  it("hides the dot when no findings API is passed", () => {
    renderWithIntl(<FileCard file={FILE} />);
    expect(screen.queryByRole("img", { name: "This file has findings" })).not.toBeInTheDocument();
  });
});
