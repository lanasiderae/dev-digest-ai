import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import messages from "../../../../../../../../../messages/en/skills.json";
import { UrlImportTab } from "./UrlImportTab";

afterEach(cleanup);

function renderWithProviders(onImported = vi.fn()) {
  const qc = new QueryClient();
  return {
    onImported,
    ...render(
      <QueryClientProvider client={qc}>
        <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
          <UrlImportTab onImported={onImported} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  };
}

describe("UrlImportTab (preview then confirm)", () => {
  it("fetches a preview without creating a skill, then confirms via a separate POST /skills call", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes("/skills/import/url")) {
        return new Response(JSON.stringify({ name: "remote-skill", body: "# Remote\nBody." }), { status: 200 });
      }
      if (url.endsWith("/skills")) {
        return new Response(JSON.stringify({ id: "new-skill-id", enabled: false }), { status: 201 });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { onImported } = renderWithProviders();

    fireEvent.change(screen.getByPlaceholderText(/https:\/\/example\.com/i), {
      target: { value: "https://example.com/skill.md" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import from URL" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/skills/import/url"),
        expect.objectContaining({ method: "POST" }),
      ),
    );
    // No skill created yet from the preview call alone.
    expect(fetchSpy).not.toHaveBeenCalledWith(expect.stringMatching(/\/skills$/), expect.anything());

    // Preview populated the form.
    await screen.findByDisplayValue("remote-skill");

    fireEvent.click(screen.getByRole("button", { name: "Import skill" }));

    await waitFor(() => expect(onImported).toHaveBeenCalledWith("new-skill-id"));
    const createCall = fetchSpy.mock.calls.find(([u]) => String(u).endsWith("/skills"));
    expect(createCall).toBeDefined();
    const body = JSON.parse((createCall![1] as RequestInit).body as string);
    expect(body.source).toBe("imported_url");
    expect(body.body).toContain("Body.");
  });
});
