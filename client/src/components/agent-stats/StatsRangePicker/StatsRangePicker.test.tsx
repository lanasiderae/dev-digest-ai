import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, renderHook, act } from "@testing-library/react";
import { StatsRangePicker } from "./StatsRangePicker";
import { useStatsRange } from "./useStatsRange";

afterEach(cleanup);

const LABELS = {
  oneDay: "1 day",
  thirtyDays: "30 days",
  custom: "Custom",
  matched: (n: number) => `${n} runs matched`,
};

function Harness({ runsMatched = 5 }: { runsMatched?: number | null }) {
  const range = useStatsRange("30d");
  return <StatsRangePicker range={range} labels={LABELS} runsMatched={runsMatched} />;
}

describe("StatsRangePicker", () => {
  it("defaults to the 30-day preset and shows the resolved window + matched count (AC-10)", () => {
    render(<Harness />);
    expect(screen.getByText("30 days")).toBeInTheDocument();
    expect(screen.getByText(/5 runs matched/)).toBeInTheDocument();
  });

  it("shows '…' instead of a run count while loading (never a fabricated 0)", () => {
    render(<Harness runsMatched={null} />);
    expect(screen.getByText(/…/)).toBeInTheDocument();
  });

  it("switching to Custom reveals the from/to date inputs", () => {
    render(<Harness />);
    expect(screen.queryAllByDisplayValue(/\d{4}-\d{2}-\d{2}/)).toHaveLength(0);
    fireEvent.click(screen.getByText("Custom"));
    expect(screen.getAllByDisplayValue(/\d{4}-\d{2}-\d{2}/)).toHaveLength(2);
  });

  it("useStatsRange: 1d/30d presets produce {range}, custom produces {from,to}", () => {
    const { result } = renderHook(() => useStatsRange("1d"));
    expect(result.current.params).toEqual({ range: "1d" });

    act(() => result.current.setPreset("custom"));
    expect(result.current.params.from).toMatch(/T00:00:00\.000Z$/);
    expect(result.current.params.to).toMatch(/T23:59:59\.999Z$/);
  });
});
