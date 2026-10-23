import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { BlastRadiusResponse, PrHistory } from "@devdigest/shared";
import messages from "../../../../../../../../../../messages/en/blast.json";
import { BlastRadiusCard } from "./BlastRadiusCard";

afterEach(cleanup);

const EMPTY_HISTORY: PrHistory = { history: [] };

function renderCard() {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ blast: messages }}>
        <BlastRadiusCard prId="pr1" repoFullName="acme/widgets" headSha="deadbeef" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

/** Routes by URL — `/blast` gets `blastBody`, `/history` gets `historyBody`
    (defaulting to no prior PRs), same approach as OverviewTab.test.tsx's
    `mockFetchByUrl`. A single blanket mock would hand the blast fixture to
    the history fetch too, which `PriorPrsFooter` can't parse. */
function mockFetch(blastBody: BlastRadiusResponse, historyBody: PrHistory = EMPTY_HISTORY) {
  return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/history")) return new Response(JSON.stringify(historyBody), { status: 200 });
    return new Response(JSON.stringify(blastBody), { status: 200 });
  });
}

describe("BlastRadiusCard", () => {
  it("renders summary counts, a caller's file:line with its exact GitHub blob link, and its endpoint, once its symbol row is expanded", async () => {
    mockFetch({
      blast: {
        changed_symbols: [{ name: "rateLimit", file: "src/rate-limit.ts", kind: "function" }],
        downstream: [
          {
            symbol: "rateLimit",
            callers: [{ name: "publicRouter", file: "src/routes/public.ts", line: 23 }],
            endpoints_affected: ["GET /x"],
            crons_affected: [],
          },
        ],
        summary: "ignored",
      },
      degraded: false,
      reason: null,
    });
    renderCard();

    await waitFor(() => expect(screen.getByText("rateLimit")).toBeInTheDocument());
    // Collapsed by default — only the row's own summary (count), not the caller list.
    expect(screen.getByText("1 caller")).toBeInTheDocument();
    expect(screen.queryByText("src/routes/public.ts:23")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /rateLimit/ }));

    expect(screen.getByText("src/routes/public.ts:23")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "src/routes/public.ts:23" });
    expect(link).toHaveAttribute("href", "https://github.com/acme/widgets/blob/deadbeef/src/routes/public.ts#L23");
    expect(screen.getByText("GET /x")).toBeInTheDocument();
  });

  it("shows the per-symbol no-callers note for an expanded symbol with zero callers while a sibling symbol still lists its callers, with no degraded banner", async () => {
    mockFetch({
      blast: {
        changed_symbols: [
          { name: "withCallers", file: "a.ts", kind: "function" },
          { name: "orphan", file: "a.ts", kind: "function" },
        ],
        downstream: [
          {
            symbol: "withCallers",
            callers: [
              { name: "c1", file: "b.ts", line: 1 },
              { name: "c2", file: "c.ts", line: 2 },
            ],
            endpoints_affected: [],
            crons_affected: [],
          },
        ],
        summary: "ignored",
      },
      degraded: false,
      reason: null,
    });
    renderCard();

    await waitFor(() => expect(screen.getByText("withCallers")).toBeInTheDocument());
    expect(screen.getByText("orphan")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /withCallers/ }));
    expect(screen.getByText("b.ts:1")).toBeInTheDocument();
    expect(screen.getByText("c.ts:2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /orphan/ }));
    expect(screen.getByText("No downstream callers found for this symbol.")).toBeInTheDocument();
    expect(screen.queryByText("Index incomplete")).not.toBeInTheDocument();
  });

  it("re-collapses a symbol row on a second click, without affecting a sibling row's state", async () => {
    mockFetch({
      blast: {
        changed_symbols: [
          { name: "a", file: "a.ts", kind: "function" },
          { name: "b", file: "b.ts", kind: "function" },
        ],
        downstream: [
          { symbol: "a", callers: [{ name: "c1", file: "x.ts", line: 1 }], endpoints_affected: [], crons_affected: [] },
          { symbol: "b", callers: [{ name: "c2", file: "y.ts", line: 2 }], endpoints_affected: [], crons_affected: [] },
        ],
        summary: "ignored",
      },
      degraded: false,
      reason: null,
    });
    renderCard();

    await waitFor(() => expect(screen.getByText("a")).toBeInTheDocument());
    const rowA = screen.getByRole("button", { name: /^a /i });
    const rowB = screen.getByRole("button", { name: /^b /i });

    fireEvent.click(rowA);
    fireEvent.click(rowB);
    expect(screen.getByText("x.ts:1")).toBeInTheDocument();
    expect(screen.getByText("y.ts:2")).toBeInTheDocument();

    fireEvent.click(rowA);
    expect(screen.queryByText("x.ts:1")).not.toBeInTheDocument();
    expect(screen.getByText("y.ts:2")).toBeInTheDocument();
  });

  it("renders a distinct degraded banner with the mapped reason when the index is incomplete", async () => {
    mockFetch({
      blast: {
        changed_symbols: [],
        downstream: [],
        summary: "ignored",
      },
      degraded: true,
      reason: "index_partial",
    });
    renderCard();

    await waitFor(() => expect(screen.getByText("Index incomplete")).toBeInTheDocument());
    expect(screen.getByText("The repo index is only partially built.")).toBeInTheDocument();
    expect(screen.queryByText("No changed code symbols.")).not.toBeInTheDocument();
    // Distinct from the per-symbol empty-state text used in the "mixed empty" case.
    expect(screen.queryByText("No downstream callers found for this symbol.")).not.toBeInTheDocument();
  });

  const EMPTY_BLAST: BlastRadiusResponse = {
    blast: { changed_symbols: [], downstream: [], summary: "" },
    degraded: false,
    reason: null,
  };

  it("shows a static, non-interactive empty row when no prior PRs overlap", async () => {
    mockFetch(EMPTY_BLAST, { history: [] });
    renderCard();

    await waitFor(() => expect(screen.getByText("No prior PRs overlap these files.")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Prior PRs touching these files/ })).not.toBeInTheDocument();
    expect(screen.getByText("No changed code symbols.")).toBeInTheDocument();
    expect(screen.queryByText("Index incomplete")).not.toBeInTheDocument();
  });

  it("expands the Prior PRs footer to show each prior PR, linked to GitHub, with its merged-by line and shared-file count", async () => {
    mockFetch(EMPTY_BLAST, {
      history: [
        {
          pr_number: 12,
          title: "Add rate limiting",
          merged_at: "2026-01-02T00:00:00.000Z",
          author: "alice",
          files_overlap: ["src/rate-limit.ts"],
          notes: "",
        },
      ],
    });
    renderCard();

    const trigger = await screen.findByRole("button", { name: /Prior PRs touching these files/ });
    expect(screen.queryByText("#12 Add rate limiting")).not.toBeInTheDocument();

    fireEvent.click(trigger);

    const link = screen.getByRole("link", { name: "#12 Add rate limiting" });
    expect(link).toHaveAttribute("href", "https://github.com/acme/widgets/pull/12");
    expect(screen.getByText(/alice/)).toBeInTheDocument();
    expect(screen.getByText(/1 shared file/)).toBeInTheDocument();
  });
});
