import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { ApiError } from "@/lib/api-client";
import type { AiChatMindMapResponse } from "@/lib/queries/ai-chat/ai-chat.types";
import AiChatMindMapPanel from "./AiChatMindMapPanel";

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

  return { ...view, onClose, onInspectEvidence, onAskBranch };
}

describe("AiChatMindMapPanel — 8 states, citations, fallback badge & ChatAI handoff", () => {
  beforeEach(() => {
    apiClientMock.mockReset();
  });

  it("auto-generates overview map on open, renders coverage + outline_fallback badge, opens source excerpt, and sends deep-dive prompt to ChatAI", async () => {
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

    // Depth 2 ("Readiness Gate") is collapsed initially; depth 1 ("Handover Governance") is visible
    expect(await screen.findByText("Handover Governance")).toBeTruthy();
    expect(screen.queryByText("Readiness Gate")).toBeNull();

    // Explicit outline fallback badge is rendered
    expect(screen.getByTestId("mind-map-fallback-badge")).toBeTruthy();

    // Select "Handover Governance" node -> inspect citation [1] + click Ask in ChatAI
    fireEvent.click(screen.getByTestId("mind-map-node-doc_1"));

    const citeButton = await screen.findByTestId("mind-map-citation-1");
    fireEvent.click(citeButton);
    expect(onInspectEvidence).toHaveBeenCalledWith({
      kind: "document",
      citation: response.citations[0],
    });

    fireEvent.click(screen.getByTestId("mind-map-ask-branch"));
    expect(onAskBranch).toHaveBeenCalledTimes(1);
    expect(onAskBranch.mock.calls[0]?.[0]).toContain("Handover Governance");

    // Expand branch to reveal depth 2 ("Readiness Gate")
    fireEvent.click(screen.getByTestId("mind-map-toggle-doc_1"));
    expect(await screen.findByText("Readiness Gate")).toBeTruthy();

    // Toggle Fullscreen modal open & close
    fireEvent.click(screen.getByTestId("mind-map-fullscreen-toggle"));
    expect(screen.getByTestId("mind-map-fullscreen-dialog")).toBeTruthy();
  });

  it("handles empty state, topic >200 validation error, 503 server error (without fake fallback), and 403 permission denied", async () => {
    // 1. Empty project (0 ready documents, 2 pending)
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

    // 2. Topic > 200 chars -> client validation error without calling API
    apiClientMock.mockClear();
    const input = screen.getByTestId("mind-map-topic-input");
    fireEvent.change(input, { target: { value: "a".repeat(205) } });
    fireEvent.submit(input.closest("form")!);
    expect(await screen.findByTestId("mind-map-validation-error")).toBeTruthy();
    expect(apiClientMock).not.toHaveBeenCalled();

    // 3. Valid topic triggers 503 server error -> surfaces error alert even after prior empty state!
    apiClientMock.mockRejectedValueOnce(
      new ApiError(503, "AI_ENGINE_UNAVAILABLE", "Engine unavailable"),
    );
    fireEvent.change(input, { target: { value: "Database topology" } });
    fireEvent.submit(input.closest("form")!);
    await waitFor(() => {
      expect(screen.getByTestId("mind-map-server-error")).toBeTruthy();
    });
    expect(screen.queryByTestId("mind-map-fallback-badge")).toBeNull();

    // 4. Retry returns 403 -> surfaces permission denied state
    apiClientMock.mockRejectedValueOnce(
      new ApiError(403, "FORBIDDEN", "No project access"),
    );
    fireEvent.click(screen.getByTestId("mind-map-retry-button"));
    await waitFor(() => {
      expect(screen.getByTestId("mind-map-permission-error")).toBeTruthy();
    });
  });

  it("opens saved Project snapshot in 0s without POST, auto-initializes when uninitialized, supports collapsible inspector, and refreshes on explicit user request", async () => {
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
        label: "Saved Continuum Overview",
        summary: "Loaded immediately from server snapshot.",
        citationNumbers: [],
        children: [],
      },
      citations: [],
      generatedAt: "2026-10-31T05:40:00Z",
    };
    apiClientMock.mockResolvedValueOnce(savedMap);

    const firstView = renderPanel();
    expect(
      (await screen.findAllByText("Saved Continuum Overview")).length,
    ).toBeGreaterThanOrEqual(1);
    expect(apiClientMock).toHaveBeenCalledTimes(1);
    expect(apiClientMock).toHaveBeenCalledWith(
      "/ai-chat/projects/proj-1/mind-map",
      expect.objectContaining({ method: "GET" }),
    );

    expect(
      screen.getByText("Loaded immediately from server snapshot."),
    ).toBeTruthy();
    fireEvent.click(screen.getByTestId("mind-map-inspector-toggle"));
    expect(
      screen.queryByText("Loaded immediately from server snapshot."),
    ).toBeNull();
    fireEvent.click(screen.getByTestId("mind-map-inspector-toggle"));
    expect(
      screen.getByText("Loaded immediately from server snapshot."),
    ).toBeTruthy();

    const refreshedMap: AiChatMindMapResponse = {
      ...savedMap,
      cached: false,
      hasSourceUpdates: false,
      scopeFingerprint: "fp_refreshed_9999999999",
      tree: {
        id: "root",
        label: "Refreshed Continuum Overview",
        summary: "Updated with newly indexed docs.",
        citationNumbers: [],
        children: [],
      },
    };
    apiClientMock.mockResolvedValueOnce(refreshedMap);
    fireEvent.click(screen.getByTestId("mind-map-new-docs-refresh"));
    expect(
      (await screen.findAllByText("Refreshed Continuum Overview")).length,
    ).toBeGreaterThanOrEqual(1);
    expect(apiClientMock).toHaveBeenLastCalledWith(
      "/ai-chat/projects/proj-1/mind-map",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ refresh: true }),
      }),
    );
    firstView.unmount();

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
          label: "First-Time Generated Overview",
          summary: "Persisted on server for project.",
          citationNumbers: [],
          children: [],
        },
      });

    renderPanel({ projectId: "proj-2" });
    expect(
      (await screen.findAllByText("First-Time Generated Overview")).length,
    ).toBeGreaterThanOrEqual(1);
    expect(apiClientMock).toHaveBeenCalledTimes(2);
    expect(apiClientMock.mock.calls[0]?.[1]).toMatchObject({ method: "GET" });
    expect(apiClientMock.mock.calls[1]?.[1]).toMatchObject({
      method: "POST",
      body: JSON.stringify({ refresh: false }),
    });
    await waitFor(() => {
    expect(screen.queryByTestId("mind-map-loading-state")).toBeNull();
    });
  });
});
