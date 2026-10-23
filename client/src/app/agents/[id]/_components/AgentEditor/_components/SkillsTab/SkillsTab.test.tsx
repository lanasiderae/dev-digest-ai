import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent, AgentSkillLink, Skill } from "@devdigest/shared";
import agentsMessages from "../../../../../../../../messages/en/agents.json";
import skillsMessages from "../../../../../../../../messages/en/skills.json";

function skill(id: string, name: string, enabled = true): Skill {
  return {
    id,
    name,
    description: `${name} description`,
    type: "custom",
    source: "manual",
    body: "body",
    enabled,
    version: 1,
    evidence_files: null,
    injection_detected: false,
    project_context: [],
  };
}

const A = skill("a", "skill-a", true);
const B = skill("b", "skill-b", true);
const C = skill("c", "skill-c", false);
const D = skill("d", "skill-d", false);

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const setSkillsMutate = vi.fn();

vi.mock("../../../../../../../lib/hooks/skills", () => ({
  useSkills: () => ({ data: [A, B, C, D], isLoading: false, isError: false }),
}));

let agentSkillLinks: AgentSkillLink[] = [
  { agent_id: "ag1", skill_id: "a", order: 0 },
  { agent_id: "ag1", skill_id: "b", order: 1 },
  { agent_id: "ag1", skill_id: "d", order: 2 },
];

vi.mock("../../../../../../../lib/hooks/agents", () => ({
  useAgentSkills: () => ({ data: agentSkillLinks, isLoading: false, isError: false }),
  useSetAgentSkills: () => ({ mutate: setSkillsMutate }),
}));

import { SkillsTab } from "./SkillsTab";

afterEach(() => {
  cleanup();
  setSkillsMutate.mockClear();
  agentSkillLinks = [
    { agent_id: "ag1", skill_id: "a", order: 0 },
    { agent_id: "ag1", skill_id: "b", order: 1 },
    { agent_id: "ag1", skill_id: "d", order: 2 },
  ];
});

const AGENT: Agent = {
  id: "ag1",
  name: "Security Reviewer",
  description: "",
  provider: "openai",
  model: "gpt-4.1",
  system_prompt: "x",
  output_schema: null,
  strategy: "single-pass",
  ci_fail_on: "critical",
  repo_intel: true,
  enabled: true,
  version: 1,
  project_context: [],
};

function renderWithIntl() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agents: agentsMessages, skills: skillsMessages }}>
      <SkillsTab agent={AGENT} />
    </NextIntlClientProvider>,
  );
}

describe("SkillsTab", () => {
  it("shows enabledCount counting only linked skills whose own enabled flag is true", () => {
    renderWithIntl();
    // Linked: a, b, d. Of those, a and b are themselves enabled=true; d is not.
    expect(screen.getByText("2 of 3 linked skills are enabled")).toBeInTheDocument();
  });

  it("attaching an unlinked skill appends it to the end of the ordered id list", () => {
    renderWithIntl();
    const toggles = screen.getAllByRole("switch");
    // Row order: a, b, d (linked, in saved order), then c (unlinked) — toggle the 4th.
    fireEvent.click(toggles[3]!);
    expect(setSkillsMutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["a", "b", "d", "c"] });
  });

  it("detaching a linked skill removes it, keeping the remaining order", () => {
    renderWithIntl();
    const toggles = screen.getAllByRole("switch");
    fireEvent.click(toggles[0]!); // detach 'a'
    expect(setSkillsMutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["b", "d"] });
  });

  it("moving a linked skill up swaps it with its predecessor", () => {
    renderWithIntl();
    const moveUpButtons = screen.getAllByRole("button", { name: "Move up" });
    // Row order: a, b, d, c — move 'b' (2nd row) up.
    fireEvent.click(moveUpButtons[1]!);
    expect(setSkillsMutate).toHaveBeenCalledWith({ agentId: "ag1", skillIds: ["b", "a", "d"] });
  });

  it("filters the list by name", () => {
    renderWithIntl();
    fireEvent.change(screen.getByPlaceholderText("Filter skills…"), { target: { value: "skill-c" } });
    expect(screen.getByText("skill-c")).toBeInTheDocument();
    expect(screen.queryByText("skill-a")).not.toBeInTheDocument();
  });

  it("shows the 'linked, disabled' badge only for a skill that is both linked AND disabled", () => {
    renderWithIntl();
    // 'd' is linked and disabled -> badge shown. 'c' is disabled but NOT linked -> no badge
    // (regression test: the badge must not appear for every disabled skill, only linked ones).
    expect(screen.getAllByText("linked, disabled")).toHaveLength(1);
    const cRow = screen.getByText("skill-c").closest("div")!;
    expect(cRow).not.toHaveTextContent("linked, disabled");
  });

  it("a linked-but-disabled skill is not draggable, and its move buttons are no-ops", () => {
    renderWithIntl();
    // Row order: a, b, d (linked, in saved order), then c (unlinked). 'd' is
    // linked AND disabled — it must stay inert until vetted, same as it's
    // excluded from the prompt until enabled.
    const dRow = screen.getByText("skill-d").closest("div")!;
    expect(dRow).toHaveAttribute("draggable", "false");

    const moveUpButtons = screen.getAllByRole("button", { name: "Move up" });
    fireEvent.click(moveUpButtons[2]!); // 'd' is the 3rd row
    expect(setSkillsMutate).not.toHaveBeenCalled();
  });

  it("a linked AND enabled skill stays draggable", () => {
    renderWithIntl();
    const bRow = screen.getByText("skill-b").closest("div")!;
    expect(bRow).toHaveAttribute("draggable", "true");
  });
});
