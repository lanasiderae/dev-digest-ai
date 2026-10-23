import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { OnboardingGenerateResponse, OnboardingReadResponse, OnboardingTour } from "@devdigest/shared";
import onboardingTourMessages from "../../../../../../../../../messages/en/onboarding-tour.json";
import { OnboardingTourPanel } from "./OnboardingTourPanel";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const NO_TOUR: OnboardingReadResponse = { tour: null };

function makeTour(overrides: Partial<OnboardingTour> = {}): OnboardingTour {
  return {
    repo_id: "r1",
    sections: {
      architecture_overview: {
        narrative: "A Fastify API behind a thin Next.js studio.",
        evidence: [{ repo_id: "r1", path: "server/src/app.ts", note: "entry point" }],
        status: "generated",
        reason: null,
      },
      critical_paths: {
        narrative: "Review runs flow through run-executor.",
        evidence: [{ repo_id: "r1", path: "server/src/modules/reviews/run-executor.ts", note: null }],
        status: "generated",
        reason: null,
      },
      local_setup: {
        narrative: "docker compose up, then pnpm install && pnpm dev.",
        evidence: [{ repo_id: "r1", path: "README.md", note: "quick start" }],
        status: "generated",
        reason: null,
      },
      reading_order: {
        narrative: "Start with the API entry point, then the review pipeline.",
        evidence: [
          { repo_id: "r1", path: "server/src/app.ts", note: "first" },
          { repo_id: "r1", path: "server/src/modules/reviews/run-executor.ts", note: "second" },
        ],
        status: "generated",
        reason: null,
      },
      first_tasks: {
        narrative: "Fix a small bug in the findings list.",
        evidence: [{ repo_id: "r1", path: "client/src/app/repos/[repoId]/pulls/page.tsx", note: null }],
        status: "generated",
        reason: null,
      },
    },
    status: "complete",
    reason: null,
    index_revision: "deadbeef",
    attempt: {
      called_model: true,
      provider: "openai",
      model: "gpt-x",
      tokens_in: 1200,
      tokens_out: 400,
      cost_usd: null,
      attempted_at: "2026-10-23T00:00:00.000Z",
    },
    omissions: [],
    generated_at: "2026-10-23T00:00:00.000Z",
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function mockFetch(opts: { tourGet: OnboardingReadResponse; tourPost?: OnboardingGenerateResponse | "fail" }) {
  const state = { tourGet: opts.tourGet, tourPost: opts.tourPost };
  const calls: { url: string; method: string }[] = [];
  vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ url, method });
    if (url.includes("/onboarding") && method === "GET") return jsonResponse(state.tourGet);
    if (url.includes("/onboarding") && method === "POST") {
      if (!state.tourPost || state.tourPost === "fail") {
        return jsonResponse({ error: { message: "Generation failed" } }, 500);
      }
      // Mirror the real server: unless the cache was preserved, the NEXT GET
      // sees exactly what this POST persisted.
      if (!state.tourPost.cached_tour_preserved) {
        state.tourGet = { tour: state.tourPost.tour };
      }
      return jsonResponse(state.tourPost);
    }
    return jsonResponse({}, 404);
  });
  return { calls, state };
}

function renderPanel(repoId = "r1") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ "onboarding-tour": onboardingTourMessages }}>
        <OnboardingTourPanel repoId={repoId} repoFullName="acme/widgets" />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("OnboardingTourPanel", () => {
  it("shows a loading skeleton while the initial read is in flight, with no premature generation call", async () => {
    let resolveGet!: (v: Response) => void;
    vi.spyOn(global, "fetch").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveGet = resolve;
        }),
    );
    const { container } = renderPanel();

    expect(container.querySelector(".skeleton")).toBeInTheDocument();
    resolveGet(jsonResponse(NO_TOUR));
    await waitFor(() => expect(container.querySelector(".skeleton")).not.toBeInTheDocument());
  });

  it("shows Generate (no premature POST) for an empty cache, then generates and renders exactly five sections with status/revision/attempt/omissions (ONBOARD-AC-01/04/05/07)", async () => {
    const generated: OnboardingGenerateResponse = { tour: makeTour(), cached_tour_preserved: false };
    const { calls } = mockFetch({ tourGet: NO_TOUR, tourPost: generated });

    renderPanel();

    await waitFor(() => expect(screen.getByRole("button", { name: /generate tour/i })).toBeInTheDocument());
    expect(calls.some((c) => c.method === "POST")).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: /generate tour/i }));

    await waitFor(() => expect(screen.getByTestId("onboarding-tour-status")).toBeInTheDocument());
    expect(calls.some((c) => c.method === "POST")).toBe(true);

    // Exactly the five required sections, each rendered.
    expect(screen.getByTestId("onboarding-section-architecture_overview")).toBeInTheDocument();
    expect(screen.getByTestId("onboarding-section-critical_paths")).toBeInTheDocument();
    expect(screen.getByTestId("onboarding-section-local_setup")).toBeInTheDocument();
    expect(screen.getByTestId("onboarding-section-reading_order")).toBeInTheDocument();
    expect(screen.getByTestId("onboarding-section-first_tasks")).toBeInTheDocument();

    // Reading order renders as an ORDERED list of its evidence.
    const readingOrder = screen.getByTestId("onboarding-section-reading_order");
    expect(within(readingOrder).getByRole("list").tagName).toBe("OL");
    expect(within(readingOrder).getByText("server/src/app.ts")).toBeInTheDocument();
    expect(within(readingOrder).getByText("server/src/modules/reviews/run-executor.ts")).toBeInTheDocument();

    // Revision and a known-call-but-unreported-cost attempt are disclosed.
    expect(screen.getByText(/deadbeef/)).toBeInTheDocument();
    expect(screen.getByText(/unknown/)).toBeInTheDocument(); // cost, never "$0.00"/free
    expect(screen.getByText(/openai/)).toBeInTheDocument();

    // No omissions on a complete tour.
    expect(screen.getByText("Nothing was omitted.")).toBeInTheDocument();
  });

  it("reloads a valid cached tour with zero generation calls (cache state, ONBOARD-AC-08)", async () => {
    const cached = makeTour({ status: "partial", reason: "Index was partially built." });
    const { calls } = mockFetch({ tourGet: { tour: cached } });

    renderPanel();

    await waitFor(() => expect(screen.getByText("Index was partially built.")).toBeInTheDocument());
    expect(calls.some((c) => c.method === "POST")).toBe(false);
    expect(screen.getByText("Partial")).toBeInTheDocument();
  });

  it("discloses omissions on a partial/skeleton tour rather than silently hiding them (ONBOARD-AC-05/07)", async () => {
    const cached = makeTour({
      status: "skeleton",
      reason: "Repository index unavailable.",
      attempt: null,
      omissions: [
        { path: null, reason: "index_unavailable", detail: "No index has been built for this repository yet." },
      ],
      sections: {
        ...makeTour().sections,
        architecture_overview: { narrative: null, evidence: [], status: "unavailable", reason: "No index available." },
      },
    });
    mockFetch({ tourGet: { tour: cached } });

    renderPanel();

    await waitFor(() => expect(screen.getByText("Repository index unavailable.")).toBeInTheDocument());
    expect(screen.getByText("Repository index unavailable")).toBeInTheDocument(); // omission reason label
    expect(screen.getByText("No index has been built for this repository yet.")).toBeInTheDocument();
    expect(screen.getByText("No model call was made for this generation.")).toBeInTheDocument();
    expect(screen.getByText("No index available.")).toBeInTheDocument();
  });

  it("renders the honest cache-preserved fallback banner instead of silently showing stale data as fresh, after a failed refresh (ONBOARD-AC-06)", async () => {
    const cached = makeTour({ status: "complete" });
    const { calls, state } = mockFetch({ tourGet: { tour: cached } });

    renderPanel();

    await waitFor(() => expect(screen.getByTestId("onboarding-tour-status")).toBeInTheDocument());
    expect(screen.queryByTestId("onboarding-fallback-banner")).not.toBeInTheDocument();

    // The next POST falls back (model/validation failure) and leaves the
    // cache untouched — mirrors the real server's `cached_tour_preserved: true`.
    state.tourPost = {
      tour: makeTour({ status: "failed", reason: "Model call failed." }),
      cached_tour_preserved: true,
    };

    fireEvent.click(screen.getByRole("button", { name: /refresh/i }));

    await waitFor(() => expect(screen.getByTestId("onboarding-fallback-banner")).toBeInTheDocument());
    expect(screen.getByText(/Refresh failed; showing the last successful tour\./)).toBeInTheDocument();
    // Still shows the PRESERVED (old, complete) tour's status, not the
    // ephemeral failed attempt's — the cache was never overwritten.
    within(screen.getByTestId("onboarding-tour-status")).getByText("Complete");
    expect(calls.some((c) => c.method === "POST")).toBe(true);
  });

  it("shows an explicit error with Retry on a hard GET failure, and still fetches on retry", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
    renderPanel();

    await waitFor(() => expect(screen.getByText(/couldn.t load the onboarding tour/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    const callsBeforeRetry = fetchSpy.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(callsBeforeRetry));
  });
});
