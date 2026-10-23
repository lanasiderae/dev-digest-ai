import { describe, it, expect } from "vitest";
import type { OnboardingAttempt, OnboardingGenerateResponse, OnboardingTour } from "@devdigest/shared";
import { attemptCallCount, formatAttemptCost, isRefreshFallback, selectDisplayTour } from "./helpers";

function makeTour(overrides: Partial<OnboardingTour> = {}): OnboardingTour {
  return {
    repo_id: "r1",
    sections: {
      architecture_overview: { narrative: "Overview text.", evidence: [], status: "generated", reason: null },
      critical_paths: { narrative: "Critical paths text.", evidence: [], status: "generated", reason: null },
      local_setup: { narrative: "Setup text.", evidence: [], status: "generated", reason: null },
      reading_order: { narrative: "Reading order text.", evidence: [], status: "generated", reason: null },
      first_tasks: { narrative: "First tasks text.", evidence: [], status: "generated", reason: null },
    },
    status: "complete",
    reason: null,
    index_revision: "abc123",
    attempt: null,
    omissions: [],
    generated_at: "2026-10-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("selectDisplayTour", () => {
  it("renders the cached tour when no generation has happened yet", () => {
    const cached = makeTour();
    expect(selectDisplayTour(undefined, cached)).toBe(cached);
  });

  it("renders null when there is neither a cached tour nor a generation result", () => {
    expect(selectDisplayTour(undefined, null)).toBeNull();
    expect(selectDisplayTour(undefined, undefined)).toBeNull();
  });

  it("renders the fresh generation result when the cache was NOT preserved (a real new generation)", () => {
    const fresh = makeTour({ generated_at: "2026-10-23T01:00:00.000Z" });
    const result: OnboardingGenerateResponse = { tour: fresh, cached_tour_preserved: false };
    expect(selectDisplayTour(result, makeTour())).toBe(fresh);
  });

  it("prefers the still-persisted cached tour over the ephemeral fallback attempt when cached_tour_preserved is true", () => {
    const cached = makeTour({ status: "complete" });
    const ephemeralFailure = makeTour({ status: "failed", reason: "model call failed" });
    const result: OnboardingGenerateResponse = { tour: ephemeralFailure, cached_tour_preserved: true };
    expect(selectDisplayTour(result, cached)).toBe(cached);
  });

  it("falls back to the generation result's own tour if, defensively, no cached tour is available even though cached_tour_preserved is true", () => {
    const ephemeralFailure = makeTour({ status: "failed" });
    const result: OnboardingGenerateResponse = { tour: ephemeralFailure, cached_tour_preserved: true };
    expect(selectDisplayTour(result, null)).toBe(ephemeralFailure);
  });
});

describe("isRefreshFallback", () => {
  it("is false with no generation result yet", () => {
    expect(isRefreshFallback(undefined)).toBe(false);
  });

  it("is false for a fresh successful generation", () => {
    expect(isRefreshFallback({ tour: makeTour(), cached_tour_preserved: false })).toBe(false);
  });

  it("is true when the cache was preserved (refresh fell back without overwriting)", () => {
    expect(isRefreshFallback({ tour: makeTour({ status: "failed" }), cached_tour_preserved: true })).toBe(true);
  });
});

describe("formatAttemptCost", () => {
  it("renders an en dash when no attempt exists at all", () => {
    expect(formatAttemptCost(null)).toBe("–");
  });

  it("renders an en dash when the attempt never called the model", () => {
    const attempt: OnboardingAttempt = {
      called_model: false,
      provider: null,
      model: null,
      tokens_in: null,
      tokens_out: null,
      cost_usd: null,
      attempted_at: "2026-10-23T00:00:00.000Z",
    };
    expect(formatAttemptCost(attempt)).toBe("–");
  });

  it('renders "unknown" — never "$0.00"/free — when a call happened but cost is unreported', () => {
    const attempt: OnboardingAttempt = {
      called_model: true,
      provider: "openai",
      model: "gpt-x",
      tokens_in: 100,
      tokens_out: 50,
      cost_usd: null,
      attempted_at: "2026-10-23T00:00:00.000Z",
    };
    expect(formatAttemptCost(attempt)).toBe("unknown");
  });

  it("renders a formatted USD cost when known", () => {
    const attempt: OnboardingAttempt = {
      called_model: true,
      provider: "openai",
      model: "gpt-x",
      tokens_in: 100,
      tokens_out: 50,
      cost_usd: 0.0013,
      attempted_at: "2026-10-23T00:00:00.000Z",
    };
    expect(formatAttemptCost(attempt)).toBe("$0.0013");
  });
});

describe("attemptCallCount", () => {
  it("is 0 when no attempt exists", () => {
    expect(attemptCallCount(null)).toBe(0);
  });

  it("is 0 for a zero-call skeleton attempt", () => {
    expect(
      attemptCallCount({
        called_model: false,
        provider: null,
        model: null,
        tokens_in: null,
        tokens_out: null,
        cost_usd: null,
        attempted_at: "2026-10-23T00:00:00.000Z",
      }),
    ).toBe(0);
  });

  it("is 1 for an attempt that called the model", () => {
    expect(
      attemptCallCount({
        called_model: true,
        provider: "openai",
        model: "gpt-x",
        tokens_in: 1,
        tokens_out: 1,
        cost_usd: 0.01,
        attempted_at: "2026-10-23T00:00:00.000Z",
      }),
    ).toBe(1);
  });
});
