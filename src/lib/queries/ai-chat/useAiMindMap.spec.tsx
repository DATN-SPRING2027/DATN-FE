import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api-client";
import type { AiChatMindMapResponse } from "./ai-chat.types";
import {
  aiMindMapKeys,
  normalizeMindMapTopic,
  useAiMindMap,
} from "./useAiMindMap";

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

function sampleResponse(
  overrides: Partial<AiChatMindMapResponse> = {},
): AiChatMindMapResponse {
  return {
    projectId: "proj-1",
    topic: null,
    status: "ready",
    generationMode: "llm",
    fallbackReason: null,
    scopeFingerprint: "fp_1111111111111111",
    coverage: {
      accessibleReadyDocumentCount: 2,
      usedDocumentCount: 2,
      omittedDocumentCount: 0,
      pendingDocumentCount: 0,
      truncatedDocumentCount: 0,
      evidenceUnitCount: 6,
    },
    tree: {
      id: "root",
      label: "Continuum Core",
      summary: "Overview",
      citationNumbers: [],
      children: [],
    },
    citations: [],
    generatedAt: "2026-10-30T16:00:00Z",
    ...overrides,
  };
}

describe("useAiMindMap scope-bound cache & access revocation hygiene", () => {
  beforeEach(() => {
    apiClientMock.mockReset();
  });

  it("normalizes topic keys, isolates cache by userId/organizationId/projectId/topic, evicts stale scopeFingerprints, and purges cache on 403", async () => {
    expect(normalizeMindMapTopic("   Handover   Spec  ")).toBe("Handover Spec");
    expect(normalizeMindMapTopic("   ")).toBe("");

    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const overviewMap = sampleResponse({
      topic: null,
      scopeFingerprint: "fp_v1_000000000000",
    });
    const focusedV2Map = sampleResponse({
      topic: "Handover Spec",
      scopeFingerprint: "fp_v2_999999999999",
    });

    apiClientMock
      .mockResolvedValueOnce(overviewMap)
      .mockResolvedValueOnce(focusedV2Map);

    const { result, rerender } = renderHook(
      (props: {
        userId: string;
        orgId: string;
        projectId: string;
        topic: string;
      }) =>
        useAiMindMap({
          userId: props.userId,
          organizationId: props.orgId,
          projectId: props.projectId,
          topic: props.topic,
        }),
      {
        wrapper,
        initialProps: {
          userId: "user-1",
          orgId: "org-1",
          projectId: "proj-1",
          topic: "",
        },
      },
    );

    await act(async () => {
      await result.current.generate("");
    });

    expect(apiClientMock).toHaveBeenCalledWith(
      "/ai-chat/projects/proj-1/mind-map",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({}),
      }),
    );
    expect(
      queryClient.getQueryData(
        aiMindMapKeys.byTopic("user-1", "org-1", "proj-1", ""),
      ),
    ).toEqual(overviewMap);

    // Different user on same project must NEVER see user-1's cached map
    rerender({
      userId: "user-2",
      orgId: "org-1",
      projectId: "proj-1",
      topic: "",
    });
    expect(result.current.mindMap).toBeUndefined();

    // Switch back to user-1 with a focused topic returning a NEW scopeFingerprint -> evicts stale v1 overview cache!
    rerender({
      userId: "user-1",
      orgId: "org-1",
      projectId: "proj-1",
      topic: "  Handover   Spec ",
    });
    await act(async () => {
      await result.current.generate("  Handover   Spec ");
    });
    expect(
      queryClient.getQueryData(
        aiMindMapKeys.byTopic("user-1", "org-1", "proj-1", ""),
      ),
    ).toBeUndefined();
    expect(
      queryClient.getQueryData(
        aiMindMapKeys.byTopic("user-1", "org-1", "proj-1", "Handover Spec"),
      ),
    ).toEqual(focusedV2Map);

    // 403 access error purges all Mind Map cache entries for that scope
    apiClientMock.mockRejectedValueOnce(
      new ApiError(403, "FORBIDDEN", "Access revoked"),
    );
    await act(async () => {
      await result.current.generate("Handover Spec").catch(() => undefined);
    });
    expect(
      queryClient.getQueryData(
        aiMindMapKeys.byTopic("user-1", "org-1", "proj-1", "Handover Spec"),
      ),
    ).toBeUndefined();
  });
});
