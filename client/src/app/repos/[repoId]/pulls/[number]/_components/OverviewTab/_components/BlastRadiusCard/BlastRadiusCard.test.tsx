import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
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
  it("renders summary counts, a caller's file:line with its exact GitHub blob link, and its endpoint", async () => {
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
    expect(screen.getByText("src/routes/public.ts:23")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: "src/routes/public.ts:23" });
    expect(link).toHaveAttribute("href", "https://github.com/acme/widgets/blob/deadbeef/src/routes/public.ts#L23");
    expect(screen.getByText("GET /x")).toBeInTheDocument();
  });

  it("shows the per-symbol no-callers note for a symbol with zero callers while a sibling symbol still lists its callers, with no degraded banner", async () => {
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
    expect(screen.getByText("b.ts:1")).toBeInTheDocument();
    expect(screen.getByText("c.ts:2")).toBeInTheDocument();
    expect(screen.getByText("orphan")).toBeInTheDocument();
    expect(screen.getByText("No downstream callers found for this symbol.")).toBeInTheDocument();
    expect(screen.queryByText("Index incomplete")).not.toBeInTheDocument();
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
