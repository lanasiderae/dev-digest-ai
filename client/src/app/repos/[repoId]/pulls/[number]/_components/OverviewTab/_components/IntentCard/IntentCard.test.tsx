import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PrIntentResponse } from "@devdigest/shared";
import messages from "../../../../../../../../../../messages/en/intent.json";
import { IntentCard } from "./IntentCard";

afterEach(cleanup);

function renderWithIntl(prId: string) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ intent: messages }}>
        <IntentCard prId={prId} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

function jsonResponse(body: PrIntentResponse) {
  return new Response(JSON.stringify(body), { status: 200 });
}

describe("IntentCard", () => {
  it("shows the 'not generated' state with a Run Intent button when nothing is stored", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse({ intent: null, unavailable_reason: "not_generated" }),
    );
    renderWithIntl("pr1");
    await waitFor(() => expect(screen.getByText("Intent not yet analysed")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Run Intent/i })).toBeInTheDocument();
  });

  it("renders the statement and in/out-of-scope bullets for a derived intent", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse({
        intent: {
          pr_id: "pr1",
          intent: "Adds pagination to the pull list.",
          in_scope: ["Add page-size query param"],
          out_of_scope: ["Does not add sorting"],
        },
        unavailable_reason: null,
      }),
    );
    renderWithIntl("pr1");
    await waitFor(() => expect(screen.getByText("Adds pagination to the pull list.")).toBeInTheDocument());
    expect(screen.getByText("Add page-size query param")).toBeInTheDocument();
    expect(screen.getByText("Does not add sorting")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Regenerate/i })).toBeInTheDocument();
  });

  it("shows an explicit provider-not-configured note rather than fabricating an intent", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      jsonResponse({ intent: null, unavailable_reason: "provider_not_configured" }),
    );
    renderWithIntl("pr1");
    await waitFor(() =>
      expect(screen.getByText(/isn't configured yet/i)).toBeInTheDocument(),
    );
  });

  it("calls POST /pulls/:id/intent with force:true when Run Intent is clicked", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockResolvedValueOnce(jsonResponse({ intent: null, unavailable_reason: "not_generated" }))
      .mockResolvedValueOnce(
        jsonResponse({
          intent: { pr_id: "pr1", intent: "Fixes the login bug.", in_scope: [], out_of_scope: [] },
          unavailable_reason: null,
        }),
      );
    renderWithIntl("pr1");
    await waitFor(() => expect(screen.getByRole("button", { name: /Run Intent/i })).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /Run Intent/i }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/pulls/pr1/intent"),
        expect.objectContaining({ method: "POST" }),
      ),
    );
  });
});
