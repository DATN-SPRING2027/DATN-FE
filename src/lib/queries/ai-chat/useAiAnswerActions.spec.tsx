import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  AiAnswerFeedback,
  AiOwnAnswerFeedback,
} from "./ai-chat.types";
import {
  aiAnswerActionKeys,
  useAiAnswerFeedbackQuery,
  useDeleteAiAnswerFeedbackMutation,
  useUpsertAiAnswerFeedbackMutation,
} from "./useAiAnswerActions";

const { apiClientMock } = vi.hoisted(() => ({
  apiClientMock: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: (...args: unknown[]) => apiClientMock(...args),
}));

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useAiAnswerActions query/mutation race safety (Finding #7)", () => {
  beforeEach(() => {
    apiClientMock.mockReset();
  });

  it("cancels slow in-flight GET /feedback so it cannot overwrite a completed PUT or DELETE vote", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const slowInitialGet = createDeferred<AiOwnAnswerFeedback>();
    const savedLike: AiAnswerFeedback = {
      messageId: "msg-a1",
      rating: "LIKE",
      updatedAt: "2026-10-30T10:00:00Z",
    };

    apiClientMock.mockImplementation((path: string, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "GET" && path.endsWith("/feedback")) {
        return slowInitialGet.promise;
      }
      if (method === "PUT" && path.endsWith("/feedback")) {
        return Promise.resolve(savedLike);
      }
      if (method === "DELETE" && path.endsWith("/feedback")) {
        return Promise.resolve(undefined);
      }
      throw new Error(`Unexpected apiClient call: ${method} ${path}`);
    });

    const { result } = renderHook(
      () => ({
        query: useAiAnswerFeedbackQuery("org-1", "proj-1", "thr-1", "msg-a1"),
        upsert: useUpsertAiAnswerFeedbackMutation("org-1", "proj-1"),
        remove: useDeleteAiAnswerFeedbackMutation("org-1", "proj-1"),
      }),
      { wrapper },
    );

    // 1. PUT LIKE completes BEFORE the initial GET /feedback resolves
    await act(async () => {
      await result.current.upsert.mutateAsync({
        threadId: "thr-1",
        messageId: "msg-a1",
        body: { rating: "LIKE" },
      });
    });

    const key = aiAnswerActionKeys.feedback(
      "org-1",
      "proj-1",
      "thr-1",
      "msg-a1",
    );
    expect(queryClient.getQueryData<AiOwnAnswerFeedback>(key)).toEqual({
      feedback: savedLike,
    });

    // Late resolution of the cancelled GET with { feedback: null } must NOT overwrite LIKE!
    await act(async () => {
      slowInitialGet.resolve({ feedback: null });
      await Promise.resolve();
    });
    expect(queryClient.getQueryData<AiOwnAnswerFeedback>(key)).toEqual({
      feedback: savedLike,
    });

    // 2. Start another slow GET refetch, then DELETE completes before GET resolves
    const slowRefetchGet = createDeferred<AiOwnAnswerFeedback>();
    apiClientMock.mockImplementation((path: string, init?: RequestInit) => {
      const method = (init?.method ?? "GET").toUpperCase();
      if (method === "GET" && path.endsWith("/feedback")) {
        return slowRefetchGet.promise;
      }
      if (method === "DELETE" && path.endsWith("/feedback")) {
        return Promise.resolve(undefined);
      }
      throw new Error(`Unexpected apiClient call: ${method} ${path}`);
    });

    let refetchPromise: Promise<unknown> | undefined;
    act(() => {
      refetchPromise = result.current.query.refetch();
    });

    await act(async () => {
      await result.current.remove.mutateAsync({
        threadId: "thr-1",
        messageId: "msg-a1",
      });
    });
    expect(queryClient.getQueryData<AiOwnAnswerFeedback>(key)).toEqual({
      feedback: null,
    });

    // Late resolution of stale GET with savedLike must NOT resurrect deleted vote!
    await act(async () => {
      slowRefetchGet.resolve({ feedback: savedLike });
      await refetchPromise?.catch(() => undefined);
    });
    expect(queryClient.getQueryData<AiOwnAnswerFeedback>(key)).toEqual({
      feedback: null,
    });
  });
});
