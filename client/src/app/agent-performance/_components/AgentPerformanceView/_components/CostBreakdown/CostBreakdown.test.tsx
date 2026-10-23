import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "../../../../../../../messages/en/agentPerformance.json";
import { CostBreakdown } from "./CostBreakdown";

afterEach(cleanup);

function renderBreakdown(costByAgent: { label: string; value: number }[], costByModel: { label: string; value: number }[]) {
  return render(
    <NextIntlClientProvider locale="en" messages={{ agentPerformance: messages }}>
      <CostBreakdown costByAgent={costByAgent} costByModel={costByModel} />
    </NextIntlClientProvider>,
  );
}

describe("CostBreakdown", () => {
  it("renders a donut per non-empty breakdown with its segment values", () => {
    renderBreakdown(
      [{ label: "Security Reviewer", value: 1.2 }],
      [{ label: "gpt-4.1", value: 1.2 }],
    );
    expect(screen.getByText("Security Reviewer")).toBeInTheDocument();
    expect(screen.getByText("gpt-4.1")).toBeInTheDocument();
    expect(screen.getAllByText("$1.20")).toHaveLength(2);
  });

  it("shows the explicit no-cost state instead of an empty/blank donut (AC-05/AC-09)", () => {
    renderBreakdown([], []);
    expect(screen.getAllByText("No cost recorded yet.")).toHaveLength(2);
  });
});
