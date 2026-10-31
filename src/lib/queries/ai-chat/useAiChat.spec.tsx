import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AiChatThread } from "./ai-chat.types";
import {
  aiChatKeys,
  useBranchAiChatThreadMutation,
  useDeleteAiChatThreadMutation,
  useUpdateAiChatThreadMutation,
} from "./useAiChat";

const { apiClientMock } = vi.hoisted(() => ({
  apiClientMock: vi.fn(),
}));

vi.mock("@/lib/api-client", () => ({
  apiClient: (...args: unknown[]) => apiClientMock(...args),
}));

vi.mock("./ai-chat-stream", () => ({
  aiChatCsrfHeaders: () => ({ "X-CSRF-Token": "csrf-tok-1" }),
}));

describe("useAiChat branch & delete cache lineage synchronization", () => {
  beforeEach(() => {
    apiClientMock.mockReset();
  });

  function createWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      );
    };
  }

  it("posts to the branch endpoint with CSRF headers and prepends the branched thread in cache", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const parentThread: AiChatThread = {
      id: "thread-parent",
      title: "Architecture Audit",
      createdAt: "2026-10-30T08:00:00Z",
      updatedAt: "2026-10-30T08:10:00Z",
      isBranched: false,
      parentThreadId: null,
      parentThreadTitle: null,
      branchPointMessageId: null,
    };
    queryClient.setQueryData<readonly AiChatThread[]>(
      aiChatKeys.threads("org-1", "proj-1"),
      [parentThread],
    );

    const branchedResponse: AiChatThread = {
      id: "thread-branch-1",
      title: "Branch · Architecture Audit",
      createdAt: "2026-10-30T08:15:00Z",
      updatedAt: "2026-10-30T08:15:00Z",
      isBranched: true,
      parentThreadId: "thread-parent",
      parentThreadTitle: "Architecture Audit",
      branchPointMessageId: "msg-a2",
    };
    apiClientMock.mockResolvedValueOnce(branchedResponse);

    const { result } = renderHook(
      () => useBranchAiChatThreadMutation("org-1", "proj-1"),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.mutateAsync({
        threadId: "thread-parent",
        messageId: "msg-a2",
      });
    });

    expect(apiClientMock).toHaveBeenCalledWith(
      "/ai-chat/projects/proj-1/threads/thread-parent/messages/msg-a2/branch",
      expect.objectContaining({
        method: "POST",
        headers: { "X-CSRF-Token": "csrf-tok-1" },
        body: "{}",
      }),
    );

    const cached = queryClient.getQueryData<readonly AiChatThread[]>(
      aiChatKeys.threads("org-1", "proj-1"),
    );
    expect(cached).toEqual([branchedResponse, parentThread]);
  });

  it("clears parentThreadId and parentThreadTitle on child branches when the parent thread is deleted", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const parentThread: AiChatThread = {
      id: "thread-parent",
      title: "Architecture Audit",
      createdAt: "2026-10-30T08:00:00Z",
      updatedAt: "2026-10-30T08:10:00Z",
    };
    const childThread: AiChatThread = {
      id: "thread-branch-1",
      title: "Branch · Architecture Audit",
      createdAt: "2026-10-30T08:15:00Z",
      updatedAt: "2026-10-30T08:15:00Z",
      isBranched: true,
      parentThreadId: "thread-parent",
      parentThreadTitle: "Architecture Audit",
      branchPointMessageId: "msg-a2",
    };
    queryClient.setQueryData<readonly AiChatThread[]>(
      aiChatKeys.threads("org-1", "proj-1"),
      [childThread, parentThread],
    );
    apiClientMock.mockResolvedValueOnce(undefined);

    const { result } = renderHook(
      () => useDeleteAiChatThreadMutation("org-1", "proj-1"),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.mutateAsync({ threadId: "thread-parent" });
    });

    const cached = queryClient.getQueryData<readonly AiChatThread[]>(
      aiChatKeys.threads("org-1", "proj-1"),
    );
    expect(cached).toEqual([
      {
        ...childThread,
        parentThreadId: null,
        parentThreadTitle: null,
      },
    ]);
  });

  it("propagates renamed parent title to cached child branches immediately", async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    const parentThread: AiChatThread = {
      id: "thread-parent",
      title: "Old Parent Title",
      createdAt: "2026-10-30T08:00:00Z",
      updatedAt: "2026-10-30T08:10:00Z",
    };
    const childThread: AiChatThread = {
      id: "thread-branch-1",
      title: "Branch · Old Parent Title",
      createdAt: "2026-10-30T08:15:00Z",
      updatedAt: "2026-10-30T08:15:00Z",
      isBranched: true,
      parentThreadId: "thread-parent",
      parentThreadTitle: "Old Parent Title",
      branchPointMessageId: "msg-a2",
    };
    queryClient.setQueryData<readonly AiChatThread[]>(
      aiChatKeys.threads("org-1", "proj-1"),
      [childThread, parentThread],
    );

    const renamedParent: AiChatThread = {
      ...parentThread,
      title: "New Security Architecture Title",
      updatedAt: "2026-10-30T08:20:00Z",
    };
    apiClientMock.mockResolvedValueOnce(renamedParent);

    const { result } = renderHook(
      () => useUpdateAiChatThreadMutation("org-1", "proj-1"),
      { wrapper: createWrapper(queryClient) },
    );

    await act(async () => {
      await result.current.mutateAsync({
        threadId: "thread-parent",
        title: "New Security Architecture Title",
      });
    });

    const cached = queryClient.getQueryData<readonly AiChatThread[]>(
      aiChatKeys.threads("org-1", "proj-1"),
    );
    expect(cached).toEqual([
      {
        ...childThread,
        parentThreadTitle: "New Security Architecture Title",
      },
      renamedParent,
    ]);
  });
});
