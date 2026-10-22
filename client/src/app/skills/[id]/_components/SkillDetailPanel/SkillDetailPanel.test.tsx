import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../../messages/en/skills.json";
import { SkillDetailPanel } from "./SkillDetailPanel";

afterEach(cleanup);

const SKILL: Skill = {
  id: "sk1",
  name: "secret-leakage-gate",
  description: "Flags hardcoded secrets.",
  type: "security",
  source: "manual",
  body: "# Rule\nFlag secrets.",
  enabled: true,
  version: 1,
  evidence_files: null,
};

function renderWithProviders(skill: Skill = SKILL) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
        <SkillDetailPanel skill={skill} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("SkillDetailPanel", () => {
  it("renders a preview with rendered Markdown body and metadata badges", () => {
    renderWithProviders();
    expect(screen.getByText("secret-leakage-gate")).toBeInTheDocument();
    expect(screen.getByText("Enabled")).toBeInTheDocument();
    expect(screen.getByText("v1")).toBeInTheDocument();
    expect(screen.getByText("Flag secrets.")).toBeInTheDocument();
  });

  it("shows the untrusted-source notice for a non-manual skill", () => {
    renderWithProviders({ ...SKILL, source: "imported_url", enabled: false });
    expect(screen.getByText(/untrusted source/i)).toBeInTheDocument();
    expect(screen.getByText("Disabled")).toBeInTheDocument();
  });

  it("does not show the untrusted notice for a manual skill", () => {
    renderWithProviders();
    expect(screen.queryByText(/untrusted source/i)).not.toBeInTheDocument();
  });

  it("does not show the untrusted notice for a non-manual skill once vetted and enabled", () => {
    renderWithProviders({ ...SKILL, source: "imported_url", enabled: true });
    expect(screen.queryByText(/untrusted source/i)).not.toBeInTheDocument();
  });

  it("flipping Enabled on the Config tab persists immediately and clears the notice, without Save", async () => {
    const disabledImported: Skill = { ...SKILL, source: "imported_url", enabled: false };
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ...disabledImported, enabled: true }), { status: 200 }),
    );
    renderWithProviders(disabledImported);

    expect(screen.getByText(/untrusted source/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Config" }));
    fireEvent.click(screen.getByRole("switch"));

    // Notice clears immediately from the local toggle — no Save click involved.
    expect(screen.queryByText(/untrusted source/i)).not.toBeInTheDocument();

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`/skills/${SKILL.id}`),
        expect.objectContaining({ method: "PUT" }),
      ),
    );
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string);
    expect(body).toEqual({ enabled: true });
  });

  it("defaults to the Preview tab and switches to Config on click", () => {
    const { container } = renderWithProviders();
    expect(screen.getByText("Flag secrets.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Config" }));
    const bodyField = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(bodyField).toHaveValue("# Rule\nFlag secrets.");
    expect(screen.queryByText("Flag secrets.")).not.toBeInTheDocument();
  });

  it("switches to the Config tab and saves a body change via PUT /skills/:id", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ...SKILL, body: "new body", version: 2 }), { status: 200 }),
    );
    const { container } = renderWithProviders();

    fireEvent.click(screen.getByRole("button", { name: "Config" }));
    const bodyField = container.querySelector("textarea") as HTMLTextAreaElement;
    expect(bodyField).toHaveValue("# Rule\nFlag secrets.");
    fireEvent.change(bodyField, { target: { value: "new body" } });

    // The "new immutable version" hint only appears once the body actually changed.
    expect(screen.getByText(/new immutable version/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() =>
      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining(`/skills/${SKILL.id}`),
        expect.objectContaining({ method: "PUT" }),
      ),
    );
    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.body).toBe("new body");

    await screen.findByText("v2");
  });

  it("loads real version history on the Versions tab, marking the current version", async () => {
    vi.spyOn(global, "fetch").mockImplementation((url) => {
      expect(String(url)).toContain(`/skills/${SKILL.id}/versions`);
      return Promise.resolve(
        new Response(
          JSON.stringify([{ skill_id: SKILL.id, version: 1, body: SKILL.body, created_at: "2026-01-01T00:00:00Z" }]),
          { status: 200 },
        ),
      );
    });
    renderWithProviders();

    fireEvent.click(screen.getByRole("button", { name: "Versions" }));
    await screen.findByText("Current");
    expect(screen.queryByRole("button", { name: "Restore" })).not.toBeInTheDocument();
  });
});
