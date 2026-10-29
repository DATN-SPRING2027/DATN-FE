import { type ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient, type ApiRequestOptions } from "@/lib/api-client";
import {
  useAskHandoverQuestionMutation,
  useCreateHandoverMutation,
  useReplaceHandoverDraftMutation,
} from "./useHandovers";

vi.mock("@/lib/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api-client")>();
  return {
    ...actual,
    apiClient: vi.fn(),
  };
});

const mockedApiClient = vi.mocked(apiClient);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("useHandovers command idempotency key stability (F09)", () => {
  const originalCookie = document.cookie;

  beforeEach(() => {
    mockedApiClient.mockReset();
    document.cookie = "continuum_csrf=csrf-test-token-456";
  });

  afterEach(() => {
    document.cookie = "continuum_csrf=; Max-Age=0";
    if (originalCookie) {
      document.cookie = originalCookie;
    }
  });

  it("reuses the exact same Idempotency-Key when retrying a failed createHandover with identical intent, and rotates on payload change or after success", async () => {
    const { result } = renderHook(
      () => useCreateHandoverMutation("proj-101"),
      { wrapper: createWrapper() },
    );

    const payloadA = {
      departingUserId: "user-a",
      assignedLeaderId: "user-d",
      successorUserId: "user-b",
      teamId: null,
      targetCompletionDate: "2026-12-01T00:00:00.000Z",
      title: "Core Distributed Auth Handover",
    };

    // 1st attempt: server commits internally, but network drops before response arrives
    mockedApiClient.mockRejectedValueOnce(new Error("Network timeout"));

    await act(async () => {
      await expect(result.current.mutateAsync(payloadA)).rejects.toThrow(
        "Network timeout",
      );
    });

    const firstHeaders = mockedApiClient.mock.calls[0]?.[1]?.headers as Headers;
    const firstKey = firstHeaders.get("Idempotency-Key");
    expect(firstKey).toBeTruthy();

    // 2nd attempt (retry with identical intent): must send the EXACT SAME Idempotency-Key to replay receipt
    mockedApiClient.mockImplementationOnce(
      async (_endpoint: string, options?: ApiRequestOptions) => {
        options?.onResponseHeaders?.(
          new Headers({
            etag: '"handover:ho-replayed:1"',
            "idempotency-replayed": "true",
          }),
        );
        return {
          operationId: "op-replayed",
          handoverId: "ho-replayed",
          version: 1,
          status: "OPEN",
          revisionId: null,
          replayed: true,
        };
      },
    );

    let replayRes: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;
    await act(async () => {
      replayRes = await result.current.mutateAsync(payloadA);
    });

    const secondHeaders = mockedApiClient.mock.calls[1]?.[1]
      ?.headers as Headers;
    const secondKey = secondHeaders.get("Idempotency-Key");
    expect(secondKey).toBe(firstKey);
    expect(replayRes?.replayed).toBe(true);
    expect(replayRes?.data.handoverId).toBe("ho-replayed");

    // 3rd attempt after prior success (even with identical payload): must rotate to a fresh Idempotency-Key
    mockedApiClient.mockRejectedValueOnce(new Error("Validation or conflict"));
    await act(async () => {
      await expect(result.current.mutateAsync(payloadA)).rejects.toThrow(
        "Validation or conflict",
      );
    });
    const thirdHeaders = mockedApiClient.mock.calls[2]?.[1]?.headers as Headers;
    const thirdKey = thirdHeaders.get("Idempotency-Key");
    expect(thirdKey).toBeTruthy();
    expect(thirdKey).not.toBe(firstKey);

    // 4th attempt after changing intent (different title): must rotate to a fresh Idempotency-Key
    mockedApiClient.mockRejectedValueOnce(new Error("Another error"));
    await act(async () => {
      await expect(
        result.current.mutateAsync({
          ...payloadA,
          title: "Updated Handover Scope Title",
        }),
      ).rejects.toThrow("Another error");
    });
    const fourthHeaders = mockedApiClient.mock.calls[3]?.[1]
      ?.headers as Headers;
    const fourthKey = fourthHeaders.get("Idempotency-Key");
    expect(fourthKey).toBeTruthy();
    expect(fourthKey).not.toBe(thirdKey);
  });

  it("reuses Idempotency-Key across retries on optimistic-concurrency mutations and never attaches Idempotency-Key to read-only Q&A", async () => {
    const wrapper = createWrapper();
    const { result: draftMut } = renderHook(
      () => useReplaceHandoverDraftMutation("proj-101", "ho-1"),
      { wrapper },
    );
    const { result: qaMut } = renderHook(
      () => useAskHandoverQuestionMutation("proj-101", "ho-1"),
      { wrapper },
    );

    const draftVars = {
      etag: '"handover:ho-1:2"',
      input: {
        expectedDraftVersion: 1,
        selectedSources: [],
        taskIds: [],
        items: [],
      },
    };

    mockedApiClient.mockRejectedValueOnce(new Error("Socket hang up"));
    await act(async () => {
      await expect(draftMut.current.mutateAsync(draftVars)).rejects.toThrow(
        "Socket hang up",
      );
    });

    mockedApiClient.mockImplementationOnce(
      async (_endpoint: string, options?: ApiRequestOptions) => {
        options?.onResponseHeaders?.(
          new Headers({
            etag: '"handover:ho-1:3"',
            "idempotency-replayed": "true",
          }),
        );
        return {
          operationId: "op-draft-1",
          handoverId: "ho-1",
          version: 3,
          status: "OPEN",
          revisionId: null,
          replayed: true,
        };
      },
    );

    await act(async () => {
      await draftMut.current.mutateAsync(draftVars);
    });

    const draftKey1 = (
      mockedApiClient.mock.calls[0]?.[1]?.headers as Headers
    ).get("Idempotency-Key");
    const draftKey2 = (
      mockedApiClient.mock.calls[1]?.[1]?.headers as Headers
    ).get("Idempotency-Key");
    expect(draftKey2).toBe(draftKey1);

    mockedApiClient.mockResolvedValueOnce({
      revisionId: "rev-1",
      answerStatus: "INSUFFICIENT_EVIDENCE",
      message: "No grounded evidence.",
      sections: [],
    });

    await act(async () => {
      await qaMut.current.mutateAsync({
        revisionId: "rev-1",
        assignmentVersion: 1,
        question: "How is failover triggered?",
      });
    });

    const qaHeaders = mockedApiClient.mock.calls[2]?.[1]?.headers as Headers;
    expect(qaHeaders.get("Idempotency-Key")).toBeNull();
  });
});
