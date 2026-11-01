import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { ApiError } from "@/lib/api-client";
import type { AiChatMindMapResponse } from "@/lib/queries/ai-chat/ai-chat.types";
import AiChatMindMapPanel, {
  AI_CHAT_MIND_MAP_DEFAULT_WIDTH,
  AI_CHAT_MIND_MAP_MAX_WIDTH,
  AI_CHAT_MIND_MAP_MIN_WIDTH,
  AI_CHAT_MIND_MAP_WIDTH_STORAGE_KEY,
} from "./AiChatMindMapPanel";

const { apiClientMock } = vi.hoisted(() => ({
  apiClientMock: vi.fn(),
}));

vi.mock("@/lib/api-client", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api-client")>(
      "@/lib/api-client",
    );
  return {
    ...actual,
    apiClient: (...args: unknown[]) => apiClientMock(...args),
  };
});

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function renderPanel(
  overrides: Partial<React.ComponentProps<typeof AiChatMindMapPanel>> = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  const onClose = vi.fn();
  const onInspectEvidence = vi.fn();
  const onAskBranch = vi.fn();

  const view = render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={messages}>
        <AiChatMindMapPanel
          isOpen
          userId="user-1"
          organizationId="org-1"
          projectId="proj-1"
          projectName="Continuum Core"
          isChatBusy={false}
          onClose={onClose}
          onInspectEvidence={onInspectEvidence}
          onAskBranch={onAskBranch}
          {...overrides}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );

  return { ...view, queryClient, onClose, onInspectEvidence, onAskBranch };
}

describe("AiChatMindMapPanel — clutter-free Studio UI, citations, revalidation & ChatAI handoff", () => {
  beforeEach(() => {
    apiClientMock.mockReset();
    window.localStorage.clear();
  });

  it("renders clean canvas without fallback/subtitle/root-inspector clutter, supports direct source click + branch quickbar, and sends deep-dive prompt", async () => {
    const response: AiChatMindMapResponse = {
      projectId: "proj-1",
      topic: null,
      status: "ready",
      generationMode: "outline_fallback",
      fallbackReason: "LLM_UNAVAILABLE",
      scopeFingerprint: "fp_outline_1234567890",
      coverage: {
        accessibleReadyDocumentCount: 4,
        usedDocumentCount: 3,
        omittedDocumentCount: 1,
        pendingDocumentCount: 2,
        truncatedDocumentCount: 0,
        evidenceUnitCount: 9,
      },
      tree: {
        id: "root",
        label: "Continuum Core",
        summary: "Project document structure",
        citationNumbers: [],
        children: [
          {
            id: "doc_1",
            label: "Handover Governance",
            summary: "Checklist and verification gates for handovers.",
            citationNumbers: [1],
            children: [
              {
                id: "sec_1",
                label: "Readiness Gate",
                summary: "Leader sign-off before completion.",
                citationNumbers: [1],
                children: [],
              },
            ],
          },
        ],
      },
      citations: [
        {
          number: 1,
          sourceId: "src-1",
          documentId: "507f1f77bcf86cd799439088",
          documentName: "Handover Spec.pdf",
          versionNo: 2,
          heading: "1. Readiness Gate",
          snippet: "Every handover requires explicit source verification.",
          pageFrom: 4,
        },
      ],
      generatedAt: "2026-10-30T16:15:00Z",
    };
    apiClientMock.mockResolvedValueOnce(response);

    const { onInspectEvidence, onAskBranch } = renderPanel();

    expect(await screen.findByText("Handover Governance")).toBeTruthy();
    expect(screen.queryByText("Readiness Gate")).toBeNull();

    // Redundant banners & root Selected Node boilerplate are omitted
    expect(screen.queryByTestId("mind-map-fallback-badge")).toBeNull();
    expect(
      screen.queryByText(/Synthesized strictly from authorized ready/i),
    ).toBeNull();
    expect(screen.queryByTestId("mind-map-branch-quickbar")).toBeNull();
    expect(
      screen.queryByText(/Structural grouping node/i),
    ).toBeNull();

    // Direct click on SVG "1 source" pill opens Evidence Sheet with focusTerms
    fireEvent.click(screen.getByTestId("mind-map-node-sources-doc_1"));
    expect(onInspectEvidence).toHaveBeenCalledWith({
      kind: "document",
      citation: response.citations[0],
      focusLabel: "Handover Governance",
      focusTerms: ["Handover Governance"],
      relatedCitations: [response.citations[0]],
    });

    // Selecting non-root branch surfaces minimal quick-action bar with citation + Ask in ChatAI
    expect(screen.getByTestId("mind-map-branch-quickbar")).toBeTruthy();
    const citeButton = await screen.findByTestId("mind-map-citation-1");
    fireEvent.click(citeButton);
    expect(onInspectEvidence).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByTestId("mind-map-ask-branch"));
    expect(onAskBranch).toHaveBeenCalledTimes(1);
    expect(onAskBranch.mock.calls[0]?.[0]).toContain("Handover Governance");

    // Dismissing branch selection hides quickbar cleanly
    fireEvent.click(screen.getByTestId("mind-map-selection-clear"));
    expect(screen.queryByTestId("mind-map-branch-quickbar")).toBeNull();

    // Expand branch to reveal depth 2 ("Readiness Gate")
    fireEvent.click(screen.getByTestId("mind-map-toggle-doc_1"));
    expect(await screen.findByText("Readiness Gate")).toBeTruthy();

    // Toggle Fullscreen modal open & close
    fireEvent.click(screen.getByTestId("mind-map-fullscreen-toggle"));
    expect(screen.getByTestId("mind-map-fullscreen-dialog")).toBeTruthy();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByTestId("mind-map-fullscreen-dialog")).toBeNull();
  });

  it("handles empty state, casefold-expanding topic >200 validation error, 503 server error, and 403 permission denied", async () => {
    apiClientMock.mockResolvedValueOnce({
      projectId: "proj-1",
      topic: null,
      status: "empty",
      generationMode: "none",
      fallbackReason: null,
      scopeFingerprint: "fp_empty_1234567890",
      coverage: {
        accessibleReadyDocumentCount: 0,
        usedDocumentCount: 0,
        omittedDocumentCount: 0,
        pendingDocumentCount: 2,
        truncatedDocumentCount: 0,
        evidenceUnitCount: 0,
      },
      tree: null,
      citations: [],
      generatedAt: "2026-10-30T16:16:00Z",
    } satisfies AiChatMindMapResponse);

    renderPanel();
    expect(await screen.findByTestId("mind-map-empty-state")).toBeTruthy();

    // Topic with 101 'ß' chars expands to 202 chars (>200) -> client validation error without calling API
    apiClientMock.mockClear();
    const input = screen.getByTestId("mind-map-topic-input");
    fireEvent.change(input, { target: { value: "ß".repeat(101) } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByTestId("mind-map-validation-error")).toBeTruthy();
    expect(apiClientMock).not.toHaveBeenCalled();

    // Valid topic triggers 503 server error -> surfaces error alert
    apiClientMock.mockRejectedValueOnce(
      new ApiError(503, "AI_ENGINE_UNAVAILABLE", "Engine unavailable"),
    );
    fireEvent.change(input, { target: { value: "Database topology" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => {
      expect(screen.getByTestId("mind-map-server-error")).toBeTruthy();
    });

    // Retry returns 403 -> surfaces permission denied state
    apiClientMock.mockRejectedValueOnce(
      new ApiError(403, "FORBIDDEN", "No project access"),
    );
    fireEvent.click(screen.getByTestId("mind-map-retry-button"));
    await waitFor(() => {
      expect(screen.getByTestId("mind-map-permission-error")).toBeTruthy();
    });
  });

  it("revalidates permissions on reopen without flashing revoked snapshot, auto-initializes when uninitialized, and refreshes on user request", async () => {
    const savedMap: AiChatMindMapResponse = {
      projectId: "proj-1",
      topic: null,
      status: "ready",
      generationMode: "llm",
      fallbackReason: null,
      scopeFingerprint: "fp_saved_1234567890",
      cached: true,
      hasSourceUpdates: true,
      coverage: {
        accessibleReadyDocumentCount: 3,
        usedDocumentCount: 2,
        omittedDocumentCount: 0,
        pendingDocumentCount: 0,
        truncatedDocumentCount: 0,
        evidenceUnitCount: 5,
      },
      tree: {
        id: "root",
        label: "Saved Overview",
        summary: "Loaded immediately from server snapshot.",
        citationNumbers: [],
        children: [],
      },
      citations: [],
      generatedAt: "2026-10-31T05:40:00Z",
    };
    apiClientMock.mockResolvedValueOnce(savedMap);

    const { rerender, queryClient, unmount } = renderPanel();
    expect(
      (await screen.findAllByText("Saved Overview")).length,
    ).toBeGreaterThanOrEqual(1);
    expect(apiClientMock).toHaveBeenCalledTimes(1);

    // Explicit refresh via "New docs · Refresh" badge
    const refreshedMap: AiChatMindMapResponse = {
      ...savedMap,
      cached: false,
      hasSourceUpdates: false,
      scopeFingerprint: "fp_refreshed_9999999999",
      tree: {
        id: "root",
        label: "Refreshed Overview",
        summary: "Updated with newly indexed docs.",
        citationNumbers: [],
        children: [],
      },
    };
    apiClientMock.mockResolvedValueOnce(refreshedMap);
    fireEvent.click(screen.getByTestId("mind-map-new-docs-refresh"));
    expect(
      (await screen.findAllByText("Refreshed Overview")).length,
    ).toBeGreaterThanOrEqual(1);
    expect(apiClientMock).toHaveBeenLastCalledWith(
      "/ai-chat/projects/proj-1/mind-map",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refresh: true }),
      }),
    );

    // Close panel -> reopen after permission revocation: must NOT render old snapshot while GET is pending!
    let rejectReopen!: (error: Error) => void;
    apiClientMock.mockImplementationOnce(
      () =>
        new Promise<AiChatMindMapResponse>((_resolve, reject) => {
          rejectReopen = reject;
        }),
    );

    rerender(
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="en" messages={messages}>
          <AiChatMindMapPanel
            isOpen={false}
            userId="user-1"
            organizationId="org-1"
            projectId="proj-1"
            projectName="Continuum Core"
            isChatBusy={false}
            onClose={vi.fn()}
            onInspectEvidence={vi.fn()}
            onAskBranch={vi.fn()}
          />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );

    rerender(
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale="en" messages={messages}>
          <AiChatMindMapPanel
            isOpen
            userId="user-1"
            organizationId="org-1"
            projectId="proj-1"
            projectName="Continuum Core"
            isChatBusy={false}
            onClose={vi.fn()}
            onInspectEvidence={vi.fn()}
            onAskBranch={vi.fn()}
          />
        </NextIntlClientProvider>
      </QueryClientProvider>,
    );

    // Old snapshot is NOT rendered while server revalidation is pending
    expect(screen.queryByText("Refreshed Overview")).toBeNull();
    expect(screen.getByTestId("mind-map-checking-state")).toBeTruthy();

    rejectReopen(new ApiError(403, "FORBIDDEN", "Revoked"));
    expect(await screen.findByTestId("mind-map-permission-error")).toBeTruthy();
    expect(screen.queryByText("Refreshed Overview")).toBeNull();
    unmount();

    // Uninitialized project auto-synthesizes and persists once
    apiClientMock.mockClear();
    apiClientMock
      .mockResolvedValueOnce({
        projectId: "proj-2",
        topic: null,
        status: "uninitialized",
        generationMode: "none",
        fallbackReason: null,
        scopeFingerprint: "fp_uninit_1234567890",
        cached: false,
        hasSourceUpdates: false,
        coverage: {
          accessibleReadyDocumentCount: 2,
          usedDocumentCount: 0,
          omittedDocumentCount: 0,
          pendingDocumentCount: 0,
          truncatedDocumentCount: 0,
          evidenceUnitCount: 0,
        },
        tree: null,
        citations: [],
        generatedAt: "2026-10-31T05:45:00Z",
      } satisfies AiChatMindMapResponse)
      .mockResolvedValueOnce({
        ...savedMap,
        projectId: "proj-2",
        cached: false,
        hasSourceUpdates: false,
        tree: {
          id: "root",
          label: "Initial Overview",
          summary: "Persisted on server for project.",
          citationNumbers: [],
          children: [],
        },
      });

    renderPanel({ projectId: "proj-2" });
    expect(
      (await screen.findAllByText("Initial Overview")).length,
    ).toBeGreaterThanOrEqual(1);
    expect(apiClientMock).toHaveBeenCalledTimes(2);
    expect(apiClientMock.mock.calls[0]?.[1]).toMatchObject({ method: "GET" });
    expect(apiClientMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ refresh: false }),
    });
  });

  it("supports dragging the docked panel wider/narrower, clamping, localStorage persistence, keyboard resize, double-click reset, and mid-drag cleanup", async () => {
    apiClientMock.mockResolvedValue({
      projectId: "proj-1",
      topic: null,
      status: "ready",
      generationMode: "llm",
      fallbackReason: null,
      scopeFingerprint: "fp_resize_1234567890",
      cached: true,
      hasSourceUpdates: false,
      coverage: {
        accessibleReadyDocumentCount: 2,
        usedDocumentCount: 2,
        omittedDocumentCount: 0,
        pendingDocumentCount: 0,
        truncatedDocumentCount: 0,
        evidenceUnitCount: 4,
      },
      tree: {
        id: "root",
        label: "Resizable Map",
        summary: "Test resizable docked Mind Map.",
        citationNumbers: [],
        children: [],
      },
      citations: [],
      generatedAt: "2026-10-31T08:00:00Z",
    } satisfies AiChatMindMapResponse);

    const { unmount } = renderPanel();
    const dockedPanel = screen.getByTestId("mind-map-docked-panel");
    const resizer = screen.getByRole("separator", {
      name: "Resize Mind Map panel",
    });

    expect(dockedPanel).toHaveStyle({
      width: `${AI_CHAT_MIND_MAP_DEFAULT_WIDTH}px`,
    });

    // Start dragging at X=800; moving left to X=640 (+160px) widens docked panel to 600px
    fireEvent.mouseDown(resizer, { button: 0, clientX: 800 });
    expect(document.body.style.cursor).toBe("col-resize");
    act(() => {
      fireEvent.mouseMove(window, { clientX: 640 });
    });
    expect(dockedPanel).toHaveStyle({ width: "600px" });

    // Drag far left past max -> clamps to AI_CHAT_MIND_MAP_MAX_WIDTH
    act(() => {
      fireEvent.mouseMove(window, { clientX: 100 });
    });
    expect(dockedPanel).toHaveStyle({
      width: `${AI_CHAT_MIND_MAP_MAX_WIDTH}px`,
    });

    // Drag far right past min -> clamps to AI_CHAT_MIND_MAP_MIN_WIDTH
    act(() => {
      fireEvent.mouseMove(window, { clientX: 1100 });
    });
    expect(dockedPanel).toHaveStyle({
      width: `${AI_CHAT_MIND_MAP_MIN_WIDTH}px`,
    });

    // Settle at 580px (startX=800 -> clientX=660 => 440 + 140 = 580px) and release
    act(() => {
      fireEvent.mouseMove(window, { clientX: 660 });
      fireEvent.mouseUp(window);
    });
    expect(dockedPanel).toHaveStyle({ width: "580px" });
    expect(document.body.style.cursor).toBe("");
    expect(
      window.localStorage.getItem(AI_CHAT_MIND_MAP_WIDTH_STORAGE_KEY),
    ).toBe("580");

    // Remount restores persisted 580px width immediately
    unmount();
    const remounted = renderPanel();
    const restoredPanel = screen.getByTestId("mind-map-docked-panel");
    const restoredResizer = screen.getByRole("separator", {
      name: "Resize Mind Map panel",
    });
    expect(restoredPanel).toHaveStyle({ width: "580px" });

    // Keyboard ArrowLeft widens (+20px -> 600px), ArrowRight narrows (-20px -> 580px), double-click resets
    fireEvent.keyDown(restoredResizer, { key: "ArrowLeft" });
    expect(restoredPanel).toHaveStyle({ width: "600px" });
    fireEvent.keyDown(restoredResizer, { key: "ArrowRight" });
    expect(restoredPanel).toHaveStyle({ width: "580px" });
    fireEvent.doubleClick(restoredResizer);
    expect(restoredPanel).toHaveStyle({
      width: `${AI_CHAT_MIND_MAP_DEFAULT_WIDTH}px`,
    });

    // Mid-drag unmount restores body styles cleanly
    fireEvent.mouseDown(restoredResizer, { button: 0, clientX: 800 });
    expect(document.body.style.cursor).toBe("col-resize");
    remounted.unmount();
    expect(document.body.style.cursor).toBe("");
    expect(document.body.style.userSelect).toBe("");
  });

  it("plays docked exit animation when smooth motion is enabled and closes immediately under reduced motion", () => {
    vi.useFakeTimers();
    const originalMatchMedia = window.matchMedia;
    try {
      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion: no-preference"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      apiClientMock.mockReturnValue(new Promise(() => {}));
      const { onClose, unmount } = renderPanel();
      const dockedPanel = screen.getByTestId("mind-map-docked-panel");

      fireEvent.click(screen.getByRole("button", { name: "Close Mind Map panel" }));
      expect(dockedPanel.className).toContain("continuum-docked-exit");
      expect(onClose).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(190);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
      unmount();

      window.matchMedia = vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));

      const reduced = renderPanel();
      fireEvent.click(screen.getByRole("button", { name: "Close Mind Map panel" }));
      expect(reduced.onClose).toHaveBeenCalledTimes(1);
    } finally {
      window.matchMedia = originalMatchMedia;
      vi.useRealTimers();
    }
  });
});
