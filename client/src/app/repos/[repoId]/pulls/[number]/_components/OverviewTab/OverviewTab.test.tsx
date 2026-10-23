import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import intentMessages from "../../../../../../../../messages/en/intent.json";
import blastMessages from "../../../../../../../../messages/en/blast.json";
import { OverviewTab } from "./OverviewTab";

afterEach(cleanup);

const BLAST_FIXTURE = {
  blast: { changed_symbols: [], downstream: [], summary: "" },
  degraded: false,
  reason: null,
};

function mockFetchByUrl() {
  return vi.spyOn(global, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : input.toString();
    if (url.includes("/blast")) {
      return new Response(JSON.stringify(BLAST_FIXTURE), { status: 200 });
    }
    if (url.includes("/history")) {
      return new Response(JSON.stringify({ history: [] }), { status: 200 });
    }
    return new Response(JSON.stringify({ intent: null, unavailable_reason: "not_generated" }), { status: 200 });
  });
}

function renderWithIntl(prId: string, prBody: string | null) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ intent: intentMessages, blast: blastMessages }}>
        <OverviewTab prId={prId} prBody={prBody} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("OverviewTab", () => {
  it("renders the PR description when present, alongside the Intent card", async () => {
    mockFetchByUrl();
    renderWithIntl("pr1", "This PR fixes the login bug.");
    expect(screen.getByText("This PR fixes the login bug.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Intent")).toBeInTheDocument());
  });

  it("omits the description section when the PR has no body", async () => {
    mockFetchByUrl();
    renderWithIntl("pr1", null);
    expect(screen.queryByText("Description")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Intent")).toBeInTheDocument());
  });
});
