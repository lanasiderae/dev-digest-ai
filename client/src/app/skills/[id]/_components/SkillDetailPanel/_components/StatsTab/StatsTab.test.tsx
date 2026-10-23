import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Skill, SkillStats } from "@devdigest/shared";
import messages from "../../../../../../../../messages/en/skills.json";

const STATS: SkillStats = {
  skill_id: "sk1",
  skill_name: "PR Quality Rubric",
  agents_linked: 2,
  agents_active: 2,
  pull_frequency: 1,
  prs_matched: 2,
  prs_total: 2,
  accept_rate: null,
  accepted: 0,
  dismissed: 0,
  findings_total: 2,
  findings_by_category: { bug: 1, security: 1, perf: 0, style: 0, test: 0 },
  agents_using: [
    { agent_id: "ag1", agent_name: "Security Reviewer" },
    { agent_id: "ag2", agent_name: "Test Quality Reviewer" },
  ],
};

let mockState: { data: SkillStats | undefined; isLoading: boolean; isError: boolean };
const refetch = vi.fn();
const routerPush = vi.fn();
const apiGetSpy = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

vi.mock("../../../../../../../lib/api", () => ({
  api: { get: (...args: unknown[]) => apiGetSpy(...args) },
}));

vi.mock("../../../../../../../lib/hooks/skill-stats", () => ({
  useSkillStats: () => ({ ...mockState, refetch }),
}));

import { StatsTab } from "./StatsTab";

const SKILL: Skill = {
  id: "sk1",
  name: "PR Quality Rubric",
  description: "General PR quality rubric",
  type: "rubric",
  source: "manual",
  body: "# Rule",
  enabled: true,
  version: 13,
  project_context: [],
  injection_detected: false,
};

function renderTab() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <StatsTab skill={SKILL} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  refetch.mockClear();
  routerPush.mockClear();
  apiGetSpy.mockClear();
});

describe("StatsTab (skill)", () => {
  it("loading: shows skeletons, never a fabricated metric", () => {
    mockState = { data: undefined, isLoading: true, isError: false };
    renderTab();
    expect(screen.queryByText("100%")).not.toBeInTheDocument();
  });

  it("error: shows the error state with retry", () => {
    mockState = { data: undefined, isLoading: false, isError: true };
    renderTab();
    expect(screen.getByText("Could not load this skill's stats.")).toBeInTheDocument();
  });

  it("empty (no linked agents): shows the empty state, not a zero metrics row", () => {
    mockState = { data: { ...STATS, agents_linked: 0 }, isLoading: false, isError: false };
    renderTab();
    expect(screen.getByText("Not linked to any agent")).toBeInTheDocument();
  });

  it("renders computed metrics, the agents-using list, and the matched-PR denominator", () => {
    mockState = { data: STATS, isLoading: false, isError: false };
    renderTab();
    expect(screen.getByText("100%")).toBeInTheDocument(); // pull_frequency
    expect(screen.getByText("–")).toBeInTheDocument(); // accept_rate: null, never "0%"
    expect(screen.getByText("Security Reviewer")).toBeInTheDocument();
    expect(screen.getByText("Test Quality Reviewer")).toBeInTheDocument();
    expect(screen.getByText(/2 PRs matched/)).toBeInTheDocument();
  });

  it("navigates to the agent's own Stats tab on Open, never calls a mutating endpoint", () => {
    mockState = { data: STATS, isLoading: false, isError: false };
    renderTab();
    screen.getAllByText("Open")[0]!.click();
    expect(routerPush).toHaveBeenCalledWith("/agents/ag1?tab=stats");
    expect(apiGetSpy).not.toHaveBeenCalled();
  });

  it("flags a low-sample accept rate instead of hiding it", () => {
    mockState = {
      data: { ...STATS, accept_rate: 0.5, accepted: 1, dismissed: 1 },
      isLoading: false,
      isError: false,
    };
    renderTab();
    expect(screen.getByText("50%")).toBeInTheDocument();
    expect(screen.getByText("low sample")).toBeInTheDocument();
  });

  it("does not flag low-sample once decisions reach the threshold", () => {
    mockState = {
      data: { ...STATS, accept_rate: 0.6, accepted: 3, dismissed: 2 },
      isLoading: false,
      isError: false,
    };
    renderTab();
    expect(screen.queryByText("low sample")).not.toBeInTheDocument();
  });
});
