import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { Skill } from "@devdigest/shared";
import messages from "../../../../../messages/en/skills.json";
import { SkillCard } from "./SkillCard";

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
  injection_detected: false,
  project_context: [],
};

function renderWithIntl(ui: React.ReactElement) {
  const qc = new QueryClient();
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
        {ui}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("SkillCard (smoke)", () => {
  it("renders the skill name, type chip and description", () => {
    renderWithIntl(<SkillCard skill={SKILL} />);
    expect(screen.getByText("secret-leakage-gate")).toBeInTheDocument();
    expect(screen.getByText("security")).toBeInTheDocument();
    expect(screen.getByText("Flags hardcoded secrets.")).toBeInTheDocument();
  });

  it("shows the full name in a hover tooltip (no click) for a truncated long name", () => {
    const longName = "an-extremely-long-skill-name-that-gets-truncated-in-the-list";
    renderWithIntl(<SkillCard skill={{ ...SKILL, name: longName }} />);

    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getAllByText(longName)[0]!.parentElement!);
    expect(screen.getByRole("tooltip")).toHaveTextContent(longName);

    fireEvent.mouseLeave(screen.getAllByText(longName)[0]!.parentElement!);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("shows the source/version line and a real agent count", () => {
    renderWithIntl(<SkillCard skill={{ ...SKILL, version: 11, agent_count: 3 }} />);
    expect(screen.getByText("Manual · v11")).toBeInTheDocument();
    expect(screen.getByText("3 agents")).toBeInTheDocument();
  });

  it("falls back to 0 agents when agent_count is absent (e.g. a hand-built fixture)", () => {
    renderWithIntl(<SkillCard skill={SKILL} />);
    expect(screen.getByText("0 agents")).toBeInTheDocument();
  });

  it("shows the real pull frequency when present", () => {
    renderWithIntl(<SkillCard skill={{ ...SKILL, pull_frequency: 1 }} />);
    expect(screen.getByText("100% pull freq")).toBeInTheDocument();
  });

  it("shows '–' (not a fabricated 0%) when pull_frequency is null or absent", () => {
    renderWithIntl(<SkillCard skill={{ ...SKILL, pull_frequency: null }} />);
    expect(screen.getByText("– pull freq")).toBeInTheDocument();
  });

  it("shows a 'needs vetting' badge for a disabled, non-manual skill", () => {
    renderWithIntl(<SkillCard skill={{ ...SKILL, source: "imported_url", enabled: false }} />);
    expect(screen.getByText("needs vetting")).toBeInTheDocument();
  });

  it("does not show a vetting badge for an enabled imported skill or a manual one", () => {
    renderWithIntl(<SkillCard skill={{ ...SKILL, source: "imported_url", enabled: true }} />);
    expect(screen.queryByText("needs vetting")).not.toBeInTheDocument();
  });

  it("the enabled toggle does not trigger the card's onClick", () => {
    const onClick = vi.fn();
    const onToggle = vi.fn();
    renderWithIntl(<SkillCard skill={SKILL} onClick={onClick} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledWith(false);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("asks for confirmation before deleting, and does not delete on cancel", () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    renderWithIntl(<SkillCard skill={SKILL} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete skill" }));
    expect(screen.getByText("Delete this skill?")).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Delete this skill?")).not.toBeInTheDocument();
  });

  it("deletes the skill once the confirmation modal's Delete button is clicked", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    renderWithIntl(<SkillCard skill={SKILL} />);

    fireEvent.click(screen.getByRole("button", { name: "Delete skill" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/skills/${SKILL.id}`),
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });

  it("a disabled skill can still be deleted — the delete button isn't dimmed/blocked by the disabled state", async () => {
    vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    renderWithIntl(<SkillCard skill={{ ...SKILL, enabled: false }} />);

    const deleteButton = screen.getByRole("button", { name: "Delete skill" });
    expect(deleteButton).not.toBeDisabled();

    fireEvent.click(deleteButton);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/skills/${SKILL.id}`),
        expect.objectContaining({ method: "DELETE" }),
      ),
    );
  });
});
