import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { Agent, ProjectContextDiscoveredDocument, Repo } from "@devdigest/shared";
import agentsMessages from "../../../../../../../../messages/en/agents.json";
import projectContextMessages from "../../../../../../../../messages/en/project-context.json";
import { ToastProvider } from "../../../../../../../lib/toast";
import type { WithProjectContext } from "../../../../../../../lib/hooks/project-context";

const REPOS: Repo[] = [
  {
    id: "r1",
    workspace_id: "ws1",
    owner: "acme",
    name: "widgets",
    full_name: "acme/widgets",
    default_branch: "main",
    clone_path: "/clones/r1",
    last_polled_at: null,
    created_by: null,
  },
];

const DOCS: ProjectContextDiscoveredDocument[] = [
  { repo_id: "r1", path: "specs/alpha.md", type: "specs", size_bytes: 100, tokens_estimate: 10, updated_at: null, oversized: false },
];

vi.mock("../../../../../../../lib/hooks", () => ({
  useRepos: () => ({ data: REPOS, isLoading: false }),
  useSettings: () => ({ data: { project_context: { roots: ["**/{specs,docs,insights}/**/*.md"] } } }),
}));

vi.mock("../../../../../../../lib/hooks/project-context", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../../../../lib/hooks/project-context")>();
  return {
    ...actual,
    useProjectContextDiscovery: () => ({
      data: { repo_id: "r1", revision: "abc123", documents: DOCS, truncated: false },
      isLoading: false,
      isError: false,
    }),
    useProjectContextDocument: () => ({ data: undefined, isLoading: false, isError: false }),
  };
});

const updateMutate = vi.fn();
let updateIsPending = false;

vi.mock("../../../../../../../lib/hooks/agents", () => ({
  useUpdateAgent: () => ({ mutate: updateMutate, isPending: updateIsPending, isSuccess: false, data: undefined }),
}));

import { ContextTab } from "./ContextTab";

afterEach(() => {
  cleanup();
  updateMutate.mockClear();
  updateIsPending = false;
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
};

function renderWithIntl(agent: WithProjectContext<Agent>) {
  return render(
    <NextIntlClientProvider
      locale="en"
      messages={{ agents: agentsMessages, "project-context": projectContextMessages }}
    >
      <ToastProvider>
        <ContextTab agent={agent} />
      </ToastProvider>
    </NextIntlClientProvider>,
  );
}

describe("ContextTab", () => {
  it("reload: seeds the draft checkbox state from the agent's saved project_context", () => {
    renderWithIntl({ ...AGENT, project_context: [{ repo_id: "r1", paths: ["specs/alpha.md"] }] });
    const row = screen.getByText("specs/alpha.md").closest("div")!;
    expect(within(row).getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
  });

  it("defaults to an empty selection when the agent has no saved project_context yet", () => {
    renderWithIntl(AGENT);
    const row = screen.getByText("specs/alpha.md").closest("div")!;
    expect(within(row).getByRole("checkbox")).toHaveAttribute("aria-checked", "false");
  });

  it("toggling a document then clicking Save persists the updated selection via the existing agent update hook", () => {
    renderWithIntl(AGENT);
    const row = screen.getByText("specs/alpha.md").closest("div")!;
    fireEvent.click(within(row).getByRole("checkbox"));

    fireEvent.click(screen.getByRole("button", { name: "Save context" }));

    expect(updateMutate).toHaveBeenCalledTimes(1);
    const [arg] = updateMutate.mock.calls[0]!;
    expect(arg).toEqual({
      id: "ag1",
      patch: { project_context: [{ repo_id: "r1", paths: ["specs/alpha.md"] }] },
    });
  });
});
