import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import messages from "../../../../../../../../../messages/en/skills.json";
import { FileImportTab } from "./FileImportTab";

afterEach(cleanup);

function renderWithProviders(onImported = vi.fn()) {
  const qc = new QueryClient();
  return {
    onImported,
    ...render(
      <QueryClientProvider client={qc}>
        <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
          <FileImportTab onImported={onImported} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    ),
  };
}

function selectFile(file: File) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [file] } });
}

describe("FileImportTab", () => {
  it("reads a pasted/selected .md file entirely client-side — no network call until confirm", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "new-skill-id", enabled: false }), { status: 201 }),
    );
    const { onImported } = renderWithProviders();

    const file = new File(["# My Skill\nBody text here."], "my-skill.md", { type: "text/markdown" });
    selectFile(file);

    await screen.findByDisplayValue("My Skill");
    expect(fetchSpy).not.toHaveBeenCalled();

    const descriptionInput = screen.getByPlaceholderText(/reviewing pull requests for test coverage/i);
    fireEvent.change(descriptionInput, { target: { value: "A description." } });

    fireEvent.click(screen.getByRole("button", { name: "Import skill" }));

    await waitFor(() => expect(onImported).toHaveBeenCalledWith("new-skill-id"));
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.source).toBe("extracted");
    expect(body.body).toContain("Body text here.");
  });

  it("shows a picker when a .zip archive has multiple ambiguous Markdown candidates", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          body: "",
          candidates: [
            { path: "a.md", body: "# A\nbody a" },
            { path: "b.md", body: "# B\nbody b" },
          ],
        }),
        { status: 200 },
      ),
    );
    renderWithProviders();

    const file = new File(["zip-bytes"], "bundle.zip", { type: "application/zip" });
    selectFile(file);

    await screen.findByText("a.md");
    expect(screen.getByText("b.md")).toBeInTheDocument();

    fireEvent.click(screen.getByText("b.md"));
    await screen.findByDisplayValue("B");
  });

  it("surfaces an archive-rejection error inline (e.g. an executable entry) without creating a skill", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ error: { code: "validation_error", message: "Archive rejected: contains run.sh" } }),
        { status: 422 },
      ),
    );
    renderWithProviders();

    const file = new File(["zip-bytes"], "bundle.zip", { type: "application/zip" });
    selectFile(file);

    await screen.findByText(/Archive rejected/i);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
