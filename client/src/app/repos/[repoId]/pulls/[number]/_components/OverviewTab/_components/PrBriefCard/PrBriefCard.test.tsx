import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { BriefReadResponse, PrBrief, PrFile } from "@devdigest/shared";
import briefMessages from "../../../../../../../../../../messages/en/brief.json";
import { PrBriefCard } from "./PrBriefCard";

// Hoisted so the `next/navigation` mock factory below can close over them.
const { pushMock, searchRef } = vi.hoisted(() => ({
  pushMock: vi.fn(),
  searchRef: { current: "" },
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  pushMock.mockClear();
  searchRef.current = "";
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/repos/r1/pulls/5",
  useSearchParams: () => new URLSearchParams(searchRef.current),
}));

const FILES: PrFile[] = [{ path: "src/a.ts", additions: 3, deletions: 1, patch: "@@ -1,1 +1,3 @@" }];

const NO_BRIEF: BriefReadResponse = { brief: null, stale: false, stale_reasons: [] };

function makeBrief(overrides: Partial<PrBrief> = {}): PrBrief {
  return {
    summary: "This PR refactors the auth middleware order.",
    intent: null,
    blast: null,
    risks: {
      risks: [
        {
          kind: "auth-bypass",
          title: "Possible auth bypass",
          explanation: "The middleware order changed, which could skip the auth check.",
          severity: "high",
          file_refs: ["src/a.ts", "src/downstream-only.ts"],
        },
      ],
    },
    history: { history: [] },
    review_focus: [
      { file: "src/a.ts", line: 10, reason: "New auth branch added here." },
      { file: "src/downstream-only.ts", line: 3, reason: "Caller of the changed symbol." },
    ],
    sources: {
      intent: { status: "unavailable", reason: "Intent was never derived for this PR." },
      blast: { status: "available", reason: null },
      issue: { status: "unavailable", reason: "No linked issue." },
      reviewer_context: { status: "unavailable", reason: "Reviewer context not selected." },
      documents: { status: "degraded", reason: "2 documents exceeded the size limit." },
    },
    provenance: {
      reviewer_agent_id: null,
      skill_ids: [],
      documents: [],
      pr_linked_spec_path: null,
      head_sha: "abc123",
      context_fingerprint: "fp1",
      generated_at: "2024-01-01T00:00:00.000Z",
    },
    ...overrides,
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

/** Dispatches the mocked fetch by URL+method. `briefGet`/`briefPost` on the
 *  returned `state` are mutable so a test can change what the NEXT GET
 *  returns (e.g. after a refresh persists). */
function mockFetch(opts: {
  briefGet: BriefReadResponse;
  agents?: { id: string; name: string }[];
  reviews?: unknown[];
  briefPost?: PrBrief | null;
  briefPostError?: { error: { code?: string; message: string } };
}) {
  const state = { briefGet: opts.briefGet, briefPost: opts.briefPost ?? null };
  const calls: { url: string; method: string }[] = [];
  vi.spyOn(global, "fetch").mockImplementation(async (input, init) => {
    const url = typeof input === "string" ? input : input.toString();
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ url, method });
    if (url.includes("/brief") && method === "GET") return jsonResponse(state.briefGet);
    if (url.includes("/brief") && method === "POST") {
      if (!state.briefPost) return jsonResponse(opts.briefPostError ?? { error: { message: "generation failed" } }, 500);
      // Mirrors the real server: a persisted generation is what the NEXT GET
      // sees too — a test only needs to set `briefPost`, not keep `briefGet`
      // in sync by hand (a test may still override `state.briefGet` itself
      // afterward for a scenario that needs to diverge from this default).
      state.briefGet = { brief: state.briefPost, stale: false, stale_reasons: [] };
      return jsonResponse(state.briefPost);
    }
    if (url.includes("/agents")) return jsonResponse(opts.agents ?? []);
    if (url.includes("/reviews")) return jsonResponse(opts.reviews ?? []);
    return jsonResponse({}, 404);
  });
  return { calls, state };
}

function renderCard(prId = "pr1", files: PrFile[] = FILES) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <NextIntlClientProvider locale="en" messages={{ brief: briefMessages }}>
        <PrBriefCard prId={prId} files={files} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("PrBriefCard", () => {
  it("shows Generate (no premature call), then generates with the selected reviewer and renders the brief (BRIEF-AC-01/02/18)", async () => {
    const generated = makeBrief({ provenance: { ...makeBrief().provenance, reviewer_agent_id: "a1" } });
    const { calls } = mockFetch({
      briefGet: NO_BRIEF,
      agents: [{ id: "a1", name: "Agent One" }],
      briefPost: generated,
    });

    renderCard();

    await waitFor(() => expect(screen.getByRole("button", { name: /generate brief/i })).toBeInTheDocument());
    // No generation happened just by loading the card.
    expect(calls.some((c) => c.method === "POST")).toBe(false);

    await waitFor(() => expect(screen.getByRole("combobox")).toBeInTheDocument());
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "a1" } });
    fireEvent.click(screen.getByRole("button", { name: /generate brief/i }));

    await waitFor(() => expect(screen.getByText(generated.summary)).toBeInTheDocument());
    const postCall = calls.find((c) => c.method === "POST");
    expect(postCall).toBeTruthy();
  });

  it("renders missing/degraded sources, the explicit no-reviewer label, and distinguishes it from the live selector even when both name the same reviewer (BRIEF-AC-02, D1)", async () => {
    const withReviewer = makeBrief({ provenance: { ...makeBrief().provenance, reviewer_agent_id: "a1" } });
    mockFetch({
      briefGet: { brief: withReviewer, stale: false, stale_reasons: [] },
      agents: [{ id: "a1", name: "Agent One" }],
    });

    renderCard();

    await waitFor(() => expect(screen.getByText(withReviewer.summary)).toBeInTheDocument());

    // Explicit source status/reason rendered, not silently omitted.
    expect(screen.getByText("Intent was never derived for this PR.")).toBeInTheDocument();
    expect(screen.getByText("2 documents exceeded the size limit.")).toBeInTheDocument();

    // The LIVE selector and the READ-ONLY cached-generation label both end up
    // naming "Agent One" right after load, but are two distinct elements.
    const select = screen.getByRole("combobox");
    await waitFor(() => expect(select).toHaveValue("a1"));
    const cached = screen.getByTestId("brief-cached-reviewer");
    expect(within(cached).getByText(/Agent One/)).toBeInTheDocument();
    expect(cached).not.toBe(select);
    expect(cached.tagName).not.toBe("SELECT");
  });

  it("shows 'Reviewer context not selected.' (not an error) when no reviewer was used, and an unreviewed VerdictBanner state", async () => {
    mockFetch({ briefGet: { brief: makeBrief(), stale: false, stale_reasons: [] } });
    renderCard();
    await waitFor(() => expect(screen.getAllByText("Reviewer context not selected.").length).toBeGreaterThan(0));
    expect(screen.getByText("Not reviewed yet.")).toBeInTheDocument();
  });

  it("navigates to the diff for an in-PR focus/risk file with an encoded ?tab=diff&file&line URL, and labels a downstream-only file instead of navigating (BRIEF-AC-05/13/16/17)", async () => {
    searchRef.current = "trace=run1"; // an existing unrelated query param must be preserved
    mockFetch({ briefGet: { brief: makeBrief(), stale: false, stale_reasons: [] } });
    renderCard();

    await waitFor(() => expect(screen.getByText("Possible auth bypass")).toBeInTheDocument());

    // Focus item for the in-diff file is clickable and carries file+line.
    fireEvent.click(screen.getByRole("button", { name: "src/a.ts:10" }));
    expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("/repos/r1/pulls/5?"));
    const pushedUrl = pushMock.mock.calls.at(-1)![0] as string;
    const sp = new URLSearchParams(pushedUrl.split("?")[1]);
    expect(sp.get("tab")).toBe("diff");
    expect(sp.get("file")).toBe("src/a.ts");
    expect(sp.get("line")).toBe("10");
    expect(sp.get("trace")).toBe("run1"); // preserved

    // The downstream-only focus item is explicitly labelled, not a dead link.
    expect(screen.getAllByText(/File not in this PR's diff/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /downstream-only\.ts/ })).not.toBeInTheDocument();

    // Expand the risk and click its in-diff file ref (no line for risk refs).
    fireEvent.click(screen.getByText("Possible auth bypass"));
    fireEvent.click(screen.getByRole("button", { name: "src/a.ts" }));
    const riskPushedUrl = pushMock.mock.calls.at(-1)![0] as string;
    const riskSp = new URLSearchParams(riskPushedUrl.split("?")[1]);
    expect(riskSp.get("file")).toBe("src/a.ts");
    expect(riskSp.has("line")).toBe(false);
  });

  it("reloads a valid cached brief with zero generation calls, and a stale brief's Refresh regenerates and persists (BRIEF-AC-06/12)", async () => {
    const refreshed = makeBrief({ summary: "Updated after refresh." });
    const { calls, state } = mockFetch({
      briefGet: { brief: makeBrief(), stale: true, stale_reasons: ["head_sha_changed"] },
      briefPost: refreshed,
    });

    renderCard();

    await waitFor(() => expect(screen.getByText("This brief is out of date.")).toBeInTheDocument());
    expect(calls.some((c) => c.method === "POST")).toBe(false); // reload alone never generates

    // After refresh persists, subsequent GETs report the fresh, non-stale brief.
    state.briefGet = { brief: refreshed, stale: false, stale_reasons: [] };
    // "Refresh" is offered both in the stale banner and the card footer — either
    // one must regenerate; click the first (the stale banner's).
    fireEvent.click(screen.getAllByRole("button", { name: /^refresh$/i })[0]!);

    await waitFor(() => expect(screen.getByText("Updated after refresh.")).toBeInTheDocument());
    expect(screen.queryByText("This brief is out of date.")).not.toBeInTheDocument();
    expect(calls.some((c) => c.method === "POST")).toBe(true);
  });

  it("keeps risk files visible while collapsed and composes context beside Blast above full-width focus", async () => {
    mockFetch({ briefGet: { brief: makeBrief(), stale: false, stale_reasons: [] } });
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <NextIntlClientProvider locale="en" messages={{ brief: briefMessages }}>
          <PrBriefCard prId="pr1" files={FILES} intent={<div>Existing Intent</div>} blast={<div>Existing Blast</div>} />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText("Possible auth bypass")).toBeInTheDocument());
    const left = screen.getByTestId("brief-intent-risks");
    const grid = screen.getByTestId("brief-facts-grid");
    const focus = screen.getByTestId("brief-review-focus");
    expect(within(left).getByText("Existing Intent")).toBeInTheDocument();
    expect(within(left).getByRole("button", { name: "src/a.ts" })).toBeVisible();
    expect(within(grid).getByText("Existing Blast")).toBeInTheDocument();
    expect(screen.queryByText("The middleware order changed, which could skip the auth check.")).not.toBeInTheDocument();
    expect(grid).not.toContainElement(focus);
    expect(grid.compareDocumentPosition(focus) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("shows an explicit error with Retry on a hard GET failure, and still fetches on retry", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
    renderCard();

    await waitFor(() => expect(screen.getByText(/couldn't generate the brief/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
    const callsBeforeRetry = fetchSpy.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    // Retry triggers another fetch attempt without throwing inside the component.
    await waitFor(() => expect(fetchSpy.mock.calls.length).toBeGreaterThan(callsBeforeRetry));
  });

  it("shows the API failure and model-settings hint when brief generation fails", async () => {
    mockFetch({
      briefGet: NO_BRIEF,
      briefPostError: {
        error: { code: "config_error", message: "OPENAI_API_KEY is not configured" },
      },
    });
    renderCard();

    await waitFor(() => expect(screen.getByRole("button", { name: /generate brief/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /generate brief/i }));

    expect(await screen.findByText(/OPENAI_API_KEY is not configured/)).toBeInTheDocument();
    expect(screen.getByText(/Settings → Models → Risk Brief/)).toBeInTheDocument();
  });
});
