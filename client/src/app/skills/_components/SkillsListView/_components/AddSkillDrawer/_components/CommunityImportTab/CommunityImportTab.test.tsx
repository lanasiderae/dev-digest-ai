import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../../../messages/en/skills.json";
import { CommunityImportTab } from "./CommunityImportTab";

afterEach(cleanup);

function renderWithIntl() {
  return render(
    <NextIntlClientProvider locale="en" messages={{ skills: messages }}>
      <CommunityImportTab />
    </NextIntlClientProvider>,
  );
}

describe("CommunityImportTab (coming soon)", () => {
  it("renders a coming-soon notice and disabled inputs, firing zero network calls", () => {
    const fetchSpy = vi.spyOn(global, "fetch");
    renderWithIntl();
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/search community skills/i)).toBeDisabled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
