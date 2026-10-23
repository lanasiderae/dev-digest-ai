import React from "react";
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ProjectContextDiscoveredDocument, ProjectContextSelectionList, Repo } from "@devdigest/shared";
import { MAX_PROJECT_CONTEXT_ATTACHMENTS } from "@devdigest/shared";
import projectContextMessages from "../../../../messages/en/project-context.json";

function repo(id: string, fullName: string): Repo {
  return {
    id,
    workspace_id: "ws1",
    owner: fullName.split("/")[0]!,
    name: fullName.split("/")[1]!,
    full_name: fullName,
    default_branch: "main",
    clone_path: "/clones/" + id,
    last_polled_at: null,
    created_by: null,
  };
}

const REPOS: Repo[] = [repo("r1", "acme/widgets"), repo("r2", "acme/other")];

const ALL_DOCS: ProjectContextDiscoveredDocument[] = [
  { repo_id: "r1", path: "specs/alpha.md", type: "specs", size_bytes: 1200, tokens_estimate: 40, updated_at: null, oversized: false },
  { repo_id: "r1", path: "docs/beta.md", type: "docs", size_bytes: 300_000, tokens_estimate: null, updated_at: null, oversized: true },
];

vi.mock("../../../lib/hooks", () => ({
  useRepos: () => ({ data: REPOS, isLoading: false }),
  useSettings: () => ({ data: { project_context: { roots: ["**/{specs,docs,insights}/**/*.md"] } } }),
}));

let truncated = false;

vi.mock("../../../lib/hooks/project-context", () => ({
  useProjectContextDiscovery: (repoId: string | null | undefined, search?: string) => {
    if (!repoId) return { data: undefined, isLoading: false, isError: false };
    const q = (search ?? "").toLowerCase();
    const documents = ALL_DOCS.filter((d) => d.repo_id === repoId && d.path.toLowerCase().includes(q));
    return {
      data: { repo_id: repoId, revision: "abc123", documents, truncated },
      isLoading: false,
      isError: false,
    };
  },
  useProjectContextDocument: (repoId: string | null | undefined, path: string | null) => {
    if (!repoId || !path) return { data: undefined, isLoading: false, isError: false };
    return {
      data: { repo_id: repoId, path, type: "specs", revision: "abc123", content: `# content of ${path}`, tokens_estimate: 40 },
      isLoading: false,
      isError: false,
    };
  },
}));

import { ProjectContextSelector } from "./ProjectContextSelector";

/** Controlled-component test harness — mirrors how AgentEditor's ContextTab
 *  will own the draft `ProjectContextSelectionList` locally. Serializes the
 *  current value to a visible node so tests can assert the onChange result
 *  without reaching into component internals. */
function Harness({ initial }: { initial: ProjectContextSelectionList }) {
  const [value, setValue] = React.useState<ProjectContextSelectionList>(initial);
  return (
    <>
      <ProjectContextSelector value={value} onChange={setValue} />
      <div data-testid="value-json">{JSON.stringify(value)}</div>
    </>
  );
}

function renderWithIntl(initial: ProjectContextSelectionList = []) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ "project-context": projectContextMessages }}>
      <Harness initial={initial} />
    </NextIntlClientProvider>,
  );
}

afterEach(() => {
  cleanup();
  truncated = false;
});

describe("ProjectContextSelector", () => {
  it("shows the configured discovery roots, discovered documents, and lets the user select/deselect one", () => {
    renderWithIntl();

    expect(screen.getByText(/Discovering under:/)).toHaveTextContent("**/{specs,docs,insights}/**/*.md");

    const alphaRow = screen.getByText("specs/alpha.md").closest("div")!;
    const checkbox = within(alphaRow).getByRole("checkbox");
    expect(checkbox).toHaveAttribute("aria-checked", "false");

    fireEvent.click(checkbox);
    expect(JSON.parse(screen.getByTestId("value-json").textContent!)).toEqual([
      { repo_id: "r1", paths: ["specs/alpha.md"] },
    ]);
    expect(screen.getByText("1 document selected")).toBeInTheDocument();
    expect(screen.getByText(/~40 tokens/)).toBeInTheDocument();

    // Deselecting removes the repo entry entirely rather than leaving `paths: []`.
    fireEvent.click(within(alphaRow).getByRole("checkbox"));
    expect(JSON.parse(screen.getByTestId("value-json").textContent!)).toEqual([]);
  });

  it("flags an oversized document as disabled and unselectable", () => {
    renderWithIntl();
    const betaRow = screen.getByText("docs/beta.md").closest("div")!;
    const checkbox = within(betaRow).getByRole("checkbox");
    fireEvent.click(checkbox);
    expect(JSON.parse(screen.getByTestId("value-json").textContent!)).toEqual([]);
    expect(within(betaRow).getByText(/too large/)).toBeInTheDocument();
  });

  it("search filters the discovered document list", () => {
    renderWithIntl();
    expect(screen.getByText("specs/alpha.md")).toBeInTheDocument();
    expect(screen.getByText("docs/beta.md")).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Search documents…"), { target: { value: "alpha" } });

    expect(screen.getByText("specs/alpha.md")).toBeInTheDocument();
    expect(screen.queryByText("docs/beta.md")).not.toBeInTheDocument();
  });

  it("clicking Preview renders the document's view-only content and token estimate", () => {
    renderWithIntl();
    fireEvent.click(screen.getAllByRole("button", { name: "Preview" })[0]!);
    expect(screen.getByText("# content of specs/alpha.md")).toBeInTheDocument();
    expect(screen.getByText("~40 tokens")).toBeInTheDocument();
  });

  it("reload preserves a saved selection, and flags a selected document that is no longer discovered", () => {
    renderWithIntl([{ repo_id: "r1", paths: ["specs/alpha.md", "specs/gone.md"] }]);

    const alphaRow = screen.getByText("specs/alpha.md").closest("div")!;
    expect(within(alphaRow).getByRole("checkbox")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("2 documents selected")).toBeInTheDocument();

    // "specs/gone.md" isn't in this repo's current discovery listing.
    expect(screen.getByText(/no longer found in this repository/)).toHaveTextContent("specs/gone.md");

    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(JSON.parse(screen.getByTestId("value-json").textContent!)).toEqual([
      { repo_id: "r1", paths: ["specs/alpha.md"] },
    ]);
  });

  it("shows the truncated-discovery banner and the attachment cap warning", () => {
    truncated = true;
    const atCapSelection: ProjectContextSelectionList = [
      { repo_id: "r1", paths: Array.from({ length: MAX_PROJECT_CONTEXT_ATTACHMENTS }, (_, i) => `docs/f${i}.md`) },
    ];
    renderWithIntl(atCapSelection);

    expect(screen.getByText(/Showing the first/)).toBeInTheDocument();
    expect(screen.getByText(/At most 100 attached documents total/)).toBeInTheDocument();

    // A not-yet-selected document is disabled once the cap is reached.
    const alphaRow = screen.getByText("specs/alpha.md").closest("div")!;
    fireEvent.click(within(alphaRow).getByRole("checkbox"));
    expect(JSON.parse(screen.getByTestId("value-json").textContent!)).toEqual(atCapSelection);
  });
});
