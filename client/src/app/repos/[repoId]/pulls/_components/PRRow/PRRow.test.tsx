import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { PrMeta } from "@/lib/types";
import messages from "../../../../../../../messages/en/prReview.json";
import { PRRow } from "./PRRow";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

afterEach(cleanup);

function pr(o: Partial<PrMeta>): PrMeta {
  return {
    id: "pr1",
    number: 482,
    title: "Add rate limiting to public API endpoints",
    author: "marisa.koch",
    branch: "feat/rate-limit-public",
    base: "main",
    head_sha: "abc123",
    additions: 200,
    deletions: 40,
    files_count: 9,
    status: "needs_review",
    opened_at: "2026-06-13T18:00:00.000Z",
    updated_at: "2026-06-13T20:52:00.000Z",
    score: null,
    cost: null,
    ...o,
  };
}

function renderRow(row: PrMeta) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ prReview: messages }}>
      <PRRow pr={row} repoId="repo1" />
    </NextIntlClientProvider>,
  );
}

describe("PRRow — cost cell", () => {
  it("shows the formatted cost for a reviewed PR", () => {
    renderRow(pr({ score: 61, cost: 0.014 }));
    expect(screen.getByText("$0.01")).toBeInTheDocument();
  });

  it("shows '–' for an unreviewed PR, never '$0.00'", () => {
    renderRow(pr({ score: null, cost: null }));
    // formatCost's "no data" dash (en dash, –) is distinct from the score
    // cell's own "unreviewed" fallback (em dash, —) — assert the cost one.
    expect(screen.getByText("–")).toBeInTheDocument();
    expect(screen.queryByText(/\$0\.00/)).not.toBeInTheDocument();
  });
});
