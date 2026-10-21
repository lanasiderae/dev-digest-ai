import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import type { PrMeta } from "@/lib/types";

vi.mock("../FindingsPopover", () => ({
  FindingsPopover: () => <div data-testid="findings-popover" />,
}));

import { FindingsCell } from "./FindingsCell";

afterEach(cleanup);

function pr(findingsBySeverity?: PrMeta["findings_by_severity"]): PrMeta {
  return {
    id: "pr1",
    number: 482,
    title: "Add rate limiting",
    author: "marisa.koch",
    branch: "feat/rl",
    base: "main",
    head_sha: "abc123",
    additions: 10,
    deletions: 2,
    files_count: 1,
    status: "needs_review",
    score: 61,
    cost: 0.014,
    findings_by_severity: findingsBySeverity,
  };
}

describe("FindingsCell", () => {
  it("renders nothing when there are no findings", () => {
    render(<FindingsCell pr={pr({ CRITICAL: 0, WARNING: 0, SUGGESTION: 0 })} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("findings-popover")).not.toBeInTheDocument();
  });

  it("renders nothing when findings_by_severity is absent (unreviewed PR)", () => {
    render(<FindingsCell pr={pr(undefined)} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders severity badges in CRITICAL → WARNING → SUGGESTION order", () => {
    render(<FindingsCell pr={pr({ CRITICAL: 2, WARNING: 1, SUGGESTION: 3 })} />);
    const trigger = screen.getByRole("button");
    const text = trigger.textContent ?? "";
    expect(text.indexOf("2")).toBeLessThan(text.indexOf("1"));
    expect(text.indexOf("1")).toBeLessThan(text.indexOf("3"));
  });

  it("omits zero-count severities", () => {
    render(<FindingsCell pr={pr({ CRITICAL: 0, WARNING: 2, SUGGESTION: 0 })} />);
    expect(screen.getByRole("button").textContent).toBe("2");
  });

  it("opens the popover on hover, not on click", () => {
    render(<FindingsCell pr={pr({ CRITICAL: 1, WARNING: 0, SUGGESTION: 0 })} />);
    expect(screen.queryByTestId("findings-popover")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByTestId("findings-popover")).not.toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByRole("button"));
    expect(screen.getByTestId("findings-popover")).toBeInTheDocument();
  });

  it("a stray click on the badge cluster does not navigate the row", () => {
    const rowClick = vi.fn();
    render(
      <div onClick={rowClick}>
        <FindingsCell pr={pr({ CRITICAL: 1, WARNING: 0, SUGGESTION: 0 })} />
      </div>,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(rowClick).not.toHaveBeenCalled();
  });

  it("opens on keyboard activation (Enter) for non-pointer users", () => {
    render(<FindingsCell pr={pr({ CRITICAL: 1, WARNING: 0, SUGGESTION: 0 })} />);
    fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
    expect(screen.getByTestId("findings-popover")).toBeInTheDocument();
  });

  it("closes shortly after the mouse leaves, unless it entered the popover", () => {
    vi.useFakeTimers();
    render(<FindingsCell pr={pr({ CRITICAL: 1, WARNING: 0, SUGGESTION: 0 })} />);
    fireEvent.mouseEnter(screen.getByRole("button"));
    expect(screen.getByTestId("findings-popover")).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByRole("button"));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByTestId("findings-popover")).not.toBeInTheDocument();
    vi.useRealTimers();
  });
});
