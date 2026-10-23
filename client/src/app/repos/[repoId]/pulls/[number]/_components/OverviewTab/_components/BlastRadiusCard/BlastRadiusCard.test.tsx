import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { BlastRadiusResponse } from "@devdigest/shared";
import messages from "../../../../../../../../../../messages/en/blast.json";
import { BlastRadiusCard } from "./BlastRadiusCard";

afterEach(cleanup);

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

function jsonResponse(body: BlastRadiusResponse) {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("BlastRadiusCard", () => {
  it("renders summary counts, a caller's file:line with its exact GitHub blob link, and its endpoint, once its symbol row is expanded", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse({
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
      }),
    );
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
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse({
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
      }),
    );
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
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse({
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
      }),
    );
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
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse({
        blast: {
          changed_symbols: [],
          downstream: [],
          summary: "ignored",
        },
        degraded: true,
        reason: "index_partial",
      }),
    );
    renderCard();

    await waitFor(() => expect(screen.getByText("Index incomplete")).toBeInTheDocument());
    expect(screen.getByText("The repo index is only partially built.")).toBeInTheDocument();
    // Distinct from the per-symbol empty-state text used in the "mixed empty" case.
    expect(screen.queryByText("No downstream callers found for this symbol.")).not.toBeInTheDocument();
  });
});
