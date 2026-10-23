import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PrHistory } from "@devdigest/shared";
import messages from "../../../../../../../../../../../../messages/en/blast.json";
import { PriorPrsFooter } from "./PriorPrsFooter";

afterEach(cleanup);

function renderFooter(repoFullName: string | null = "acme/widgets") {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ blast: messages }}>
        <PriorPrsFooter prId="pr1" repoFullName={repoFullName} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function jsonResponse(body: PrHistory) {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("PriorPrsFooter", () => {
  it("renders a static, non-interactive empty row when no prior PRs overlap", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(jsonResponse({ history: [] }));
    renderFooter();

    await waitFor(() => expect(screen.getByText("No prior PRs overlap these files.")).toBeInTheDocument());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders nothing on a fetch error, rather than crashing or fabricating a result", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(new Response("error", { status: 500 }));
    const { container } = renderFooter();

    // Give the query a tick to settle into its error state.
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("collapses the list by default; expanding reveals each prior PR linked to GitHub with its merged-by line and overlap count", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse({
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
      }),
    );
    renderFooter();

    const trigger = await screen.findByRole("button", { name: /Prior PRs touching these files/ });
    expect(screen.queryByText("#12 Add rate limiting")).not.toBeInTheDocument();

    fireEvent.click(trigger);

    const link = screen.getByRole("link", { name: "#12 Add rate limiting" });
    expect(link).toHaveAttribute("href", "https://github.com/acme/widgets/pull/12");
    expect(link).toHaveAttribute("target", "_blank");
    expect(screen.getByText(/alice/)).toBeInTheDocument();
    expect(screen.getByText(/1 shared file/)).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.queryByText("#12 Add rate limiting")).not.toBeInTheDocument();
  });

  it("renders a plain (non-linked) PR title when repoFullName is unavailable", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse({
        history: [
          {
            pr_number: 3,
            title: "Earlier change",
            merged_at: "",
            author: "bob",
            files_overlap: ["a.ts", "b.ts"],
            notes: "",
          },
        ],
      }),
    );
    renderFooter(null);

    fireEvent.click(await screen.findByRole("button", { name: /Prior PRs touching these files/ }));

    expect(screen.getByText("#3 Earlier change")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "#3 Earlier change" })).not.toBeInTheDocument();
    // An unparseable/empty merged_at falls back to an explicit em dash, not a blank.
    expect(screen.getByText(/bob · merged —/)).toBeInTheDocument();
  });
});
