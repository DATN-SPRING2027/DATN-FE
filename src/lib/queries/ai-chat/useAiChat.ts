"use client";

import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { aiChatCsrfHeaders } from "./ai-chat-stream";
import type { AiChatMessagePage, AiChatThread } from "./ai-chat.types";

export const aiChatKeys = {
  project: (organizationId: string, projectId: string) =>
    ["ai-chat", organizationId, projectId] as const,
  threads: (organizationId: string, projectId: string) =>
    ["ai-chat", organizationId, projectId, "threads"] as const,
  messages: (organizationId: string, projectId: string, threadId: string) =>
    ["ai-chat", organizationId, projectId, "messages", threadId] as const,
};

function projectBasePath(projectId: string): string {
  return `/ai-chat/projects/${encodeURIComponent(projectId)}`;
}

export function useAiChatThreadsQuery(
  organizationId: string,
  projectId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: aiChatKeys.threads(organizationId, projectId),
    queryFn: ({ signal }) =>
      apiClient<readonly AiChatThread[]>(
        `${projectBasePath(projectId)}/threads?limit=50&offset=0`,
        {
          signal,
          cache: "no-store",
        },
      ),
    enabled:
      Boolean(organizationId) &&
      Boolean(projectId) &&
      options.enabled !== false,
    retry: false,
    staleTime: 15_000,
    refetchOnWindowFocus: false,
  });
}

export function useCreateAiChatThreadMutation(
  organizationId: string,
  projectId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["ai-chat-thread-create", organizationId, projectId],
    retry: false,
    mutationFn: (input: { title?: string } = {}) =>
      apiClient<AiChatThread>(`${projectBasePath(projectId)}/threads`, {
        method: "POST",
        headers: aiChatCsrfHeaders(),
        body: JSON.stringify(
          input.title !== undefined ? { title: input.title } : {},
        ),
      }),
    onSuccess: (created) => {
      queryClient.setQueryData<readonly AiChatThread[]>(
        aiChatKeys.threads(organizationId, projectId),
        (existing) => {
          const list = existing ?? [];
          if (list.some((item) => item.id === created.id)) {
            return list.map((item) =>
              item.id === created.id ? created : item,
            );
          }
          return [created, ...list];
        },
      );
    },
  });
}

export function useUpdateAiChatThreadMutation(
  organizationId: string,
  projectId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["ai-chat-thread-update", organizationId, projectId],
    retry: false,
    mutationFn: ({ threadId, title }: { threadId: string; title: string }) =>
      apiClient<AiChatThread>(
        `${projectBasePath(projectId)}/threads/${encodeURIComponent(threadId)}`,
        {
          method: "PATCH",
          headers: aiChatCsrfHeaders(),
          body: JSON.stringify({ title }),
        },
      ),
    onSuccess: (updated) => {
      queryClient.setQueryData<readonly AiChatThread[]>(
        aiChatKeys.threads(organizationId, projectId),
        (existing) =>
          (existing ?? []).map((item) => {
            if (item.id === updated.id) return updated;
            if (item.parentThreadId === updated.id) {
              return { ...item, parentThreadTitle: updated.title };
            }
            return item;
          }),
      );
    },
  });
}

export function useDeleteAiChatThreadMutation(
  organizationId: string,
  projectId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["ai-chat-thread-delete", organizationId, projectId],
    retry: false,
    mutationFn: ({ threadId }: { threadId: string }) =>
      apiClient<void>(
        `${projectBasePath(projectId)}/threads/${encodeURIComponent(threadId)}`,
        {
          method: "DELETE",
          headers: aiChatCsrfHeaders(),
        },
      ),
    onSuccess: (_result, { threadId }) => {
      queryClient.setQueryData<readonly AiChatThread[]>(
        aiChatKeys.threads(organizationId, projectId),
        (existing) =>
          (existing ?? [])
            .filter((item) => item.id !== threadId)
            .map((item) =>
              item.parentThreadId === threadId
                ? {
                    ...item,
                    parentThreadId: null,
                    parentThreadTitle: null,
                  }
                : item,
            ),
      );
      queryClient.removeQueries({
        queryKey: aiChatKeys.messages(organizationId, projectId, threadId),
      });
    },
  });
}

export async function branchAiChatThread(
  projectId: string,
  threadId: string,
  messageId: string,
  input: { title?: string } = {},
): Promise<AiChatThread> {
  return apiClient<AiChatThread>(
    `${projectBasePath(projectId)}/threads/${encodeURIComponent(
      threadId,
    )}/messages/${encodeURIComponent(messageId)}/branch`,
    {
      method: "POST",
      headers: aiChatCsrfHeaders(),
      body: JSON.stringify(
        input.title !== undefined ? { title: input.title } : {},
      ),
    },
  );
}

export function useBranchAiChatThreadMutation(
  organizationId: string,
  projectId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["ai-chat-thread-branch", organizationId, projectId],
    retry: false,
    mutationFn: ({
      threadId,
      messageId,
      title,
    }: {
      threadId: string;
      messageId: string;
      title?: string;
    }) =>
      branchAiChatThread(
        projectId,
        threadId,
        messageId,
        title !== undefined ? { title } : {},
      ),
    onSuccess: (branched) => {
      queryClient.setQueryData<readonly AiChatThread[]>(
        aiChatKeys.threads(organizationId, projectId),
        (existing) => {
          const list = existing ?? [];
          if (list.some((item) => item.id === branched.id)) {
            return list.map((item) =>
              item.id === branched.id ? branched : item,
            );
          }
          return [branched, ...list];
        },
      );
    },
  });
}

export function useAiChatMessagesInfiniteQuery(
  organizationId: string,
  projectId: string,
  threadId: string | null,
  options: { enabled?: boolean } = {},
) {
  return useInfiniteQuery({
    queryKey: aiChatKeys.messages(organizationId, projectId, threadId ?? ""),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ limit: "40" });
      if (pageParam) {
        params.set("cursor", pageParam);
      }
      return apiClient<AiChatMessagePage>(
        `${projectBasePath(projectId)}/threads/${encodeURIComponent(
          threadId ?? "",
        )}/messages?${params.toString()}`,
        {
          signal,
          cache: "no-store",
        },
      );
    },
    getNextPageParam: (lastPage) =>
      lastPage.hasMore && lastPage.nextCursor ? lastPage.nextCursor : undefined,
    enabled:
      Boolean(organizationId) &&
      Boolean(projectId) &&
      Boolean(threadId) &&
      options.enabled !== false,
    retry: false,
    staleTime: 10_000,
    refetchOnWindowFocus: false,
  });
}
