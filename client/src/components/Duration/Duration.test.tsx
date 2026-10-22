import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Duration } from "./Duration";

afterEach(cleanup);

describe("Duration", () => {
  it("renders a human-readable duration for a millisecond span", () => {
    render(<Duration ms={61_000} />);
    expect(screen.getByText("1m 1s")).toBeInTheDocument();
  });

  it("renders sub-second spans in milliseconds", () => {
    render(<Duration ms={450} />);
    expect(screen.getByText("450ms")).toBeInTheDocument();
  });
});
