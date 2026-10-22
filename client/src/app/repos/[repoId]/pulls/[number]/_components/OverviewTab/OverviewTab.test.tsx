import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import intentMessages from "../../../../../../../../messages/en/intent.json";
import { OverviewTab } from "./OverviewTab";

afterEach(cleanup);

function renderWithIntl(prId: string, prBody: string | null) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ intent: intentMessages }}>
        <OverviewTab prId={prId} prBody={prBody} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("OverviewTab", () => {
  it("renders the PR description when present, alongside the Intent card", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ intent: null, unavailable_reason: "not_generated" }), { status: 200 }),
    );
    renderWithIntl("pr1", "This PR fixes the login bug.");
    expect(screen.getByText("This PR fixes the login bug.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Intent")).toBeInTheDocument());
  });

  it("omits the description section when the PR has no body", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ intent: null, unavailable_reason: "not_generated" }), { status: 200 }),
    );
    renderWithIntl("pr1", null);
    expect(screen.queryByText("Description")).not.toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Intent")).toBeInTheDocument());
  });
});
