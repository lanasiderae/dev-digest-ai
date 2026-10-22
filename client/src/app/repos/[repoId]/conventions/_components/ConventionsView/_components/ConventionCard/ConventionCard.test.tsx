import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ConventionCandidate } from "@devdigest/shared";
import messages from "../../../../../../../../../messages/en/conventions.json";
import { ConventionCard } from "./ConventionCard";

afterEach(cleanup);

const CANDIDATE: ConventionCandidate = {
  id: "c1",
  rule: "Always use async/await instead of .then() chains",
  evidence_path: "src/api/users.ts",
  evidence_snippet: "const user = await db.users.find(id);",
  confidence: 0.91,
  accepted: false,
  rejected: false,
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ conventions: messages }}>
      {ui}
    </NextIntlClientProvider>,
  );
}

function base(overrides: Partial<React.ComponentProps<typeof ConventionCard>> = {}) {
  return {
    candidate: CANDIDATE,
    onAccept: vi.fn(),
    onReject: vi.fn(),
    onEditRule: vi.fn(),
    ...overrides,
  };
}

describe("ConventionCard (smoke)", () => {
  it("renders the rule, evidence path/snippet, and confidence", () => {
    renderWithIntl(<ConventionCard {...base()} />);
    expect(screen.getByText(CANDIDATE.rule)).toBeInTheDocument();
    expect(screen.getByText(CANDIDATE.evidence_path)).toBeInTheDocument();
    expect(screen.getByText(CANDIDATE.evidence_snippet)).toBeInTheDocument();
    expect(screen.getByText(/91%/)).toBeInTheDocument();
  });

  it("calls onAccept when the Accept button is clicked", () => {
    const onAccept = vi.fn();
    renderWithIntl(<ConventionCard {...base({ onAccept })} />);
    fireEvent.click(screen.getByRole("button", { name: "Accept" }));
    expect(onAccept).toHaveBeenCalled();
  });

  it("calls onReject when the Reject button is clicked", () => {
    const onReject = vi.fn();
    renderWithIntl(<ConventionCard {...base({ onReject })} />);
    fireEvent.click(screen.getByRole("button", { name: "Reject" }));
    expect(onReject).toHaveBeenCalled();
  });

  it("shows the accepted label once accepted", () => {
    renderWithIntl(<ConventionCard {...base({ candidate: { ...CANDIDATE, accepted: true } })} />);
    expect(screen.getByRole("button", { name: "Accepted" })).toBeInTheDocument();
  });

  it("shows the rejected label once rejected, distinct from a pending (never-reviewed) card", () => {
    renderWithIntl(<ConventionCard {...base({ candidate: { ...CANDIDATE, rejected: true } })} />);
    expect(screen.getByRole("button", { name: "Rejected" })).toBeInTheDocument();
  });

  it("a pending (never-reviewed) card shows neither Accepted nor Rejected", () => {
    renderWithIntl(<ConventionCard {...base()} />);
    expect(screen.getByRole("button", { name: "Accept" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("edit: clicking Edit reveals a textarea prefilled with the rule, Save commits via onEditRule", () => {
    const onEditRule = vi.fn();
    renderWithIntl(<ConventionCard {...base({ onEditRule })} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.value).toBe(CANDIDATE.rule);

    fireEvent.change(textarea, { target: { value: "Edited rule text" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onEditRule).toHaveBeenCalledWith("Edited rule text");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("edit: Cancel discards the draft without calling onEditRule", () => {
    const onEditRule = vi.fn();
    renderWithIntl(<ConventionCard {...base({ onEditRule })} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Discarded draft" } });
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onEditRule).not.toHaveBeenCalled();
    expect(screen.getByText(CANDIDATE.rule)).toBeInTheDocument();
  });

  it("does not call onEditRule when Save is clicked with the text unchanged", () => {
    const onEditRule = vi.fn();
    renderWithIntl(<ConventionCard {...base({ onEditRule })} />);

    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    fireEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onEditRule).not.toHaveBeenCalled();
  });
});
