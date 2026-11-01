"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { aiChatCsrfHeaders } from "./ai-chat-stream";
import type {
  AiAnswerFeedback,
  AiAnswerFeedbackInput,
  AiAnswerShare,
  AiOwnAnswerFeedback,
  AiSharedAnswer,
} from "./ai-chat.types";

export const aiAnswerActionKeys = {
  feedback: (
    organizationId: string,
    projectId: string,
    threadId: string,
    messageId: string,
  ) =>
    [
      "ai-chat",
      organizationId,
      projectId,
      "feedback",
      threadId,
      messageId,
    ] as const,
  sharedAnswer: (organizationId: string, projectId: string, shareId: string) =>
    ["ai-chat", organizationId, projectId, "shared-answer", shareId] as const,
};

function projectBasePath(projectId: string): string {
  return `/ai-chat/projects/${encodeURIComponent(projectId)}`;
}

export function useAiAnswerFeedbackQuery(
  organizationId: string,
  projectId: string,
  threadId: string | null,
  messageId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: aiAnswerActionKeys.feedback(
      organizationId,
      projectId,
      threadId ?? "",
      messageId,
    ),
    queryFn: ({ signal }) =>
      apiClient<AiOwnAnswerFeedback>(
        `${projectBasePath(projectId)}/threads/${encodeURIComponent(
          threadId ?? "",
        )}/messages/${encodeURIComponent(messageId)}/feedback`,
        {
          signal,
          cache: "no-store",
        },
      ),
    enabled:
      Boolean(organizationId) &&
      Boolean(projectId) &&
      Boolean(threadId) &&
      Boolean(messageId) &&
      options.enabled !== false,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
}

export function useUpsertAiAnswerFeedbackMutation(
  organizationId: string,
  projectId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["ai-chat-feedback-upsert", organizationId, projectId],
    retry: false,
    onMutate: async ({ threadId, messageId }) => {
      await queryClient.cancelQueries({
        queryKey: aiAnswerActionKeys.feedback(
          organizationId,
          projectId,
          threadId,
          messageId,
        ),
        exact: true,
      });
    },
    mutationFn: ({
      threadId,
      messageId,
      body,
    }: {
      threadId: string;
      messageId: string;
      body: AiAnswerFeedbackInput;
    }) =>
      apiClient<AiAnswerFeedback>(
        `${projectBasePath(projectId)}/threads/${encodeURIComponent(
          threadId,
        )}/messages/${encodeURIComponent(messageId)}/feedback`,
        {
          method: "PUT",
          headers: aiChatCsrfHeaders(),
          body: JSON.stringify(body),
          cache: "no-store",
        },
      ),
    onSuccess: async (saved, { threadId, messageId }) => {
      const key = aiAnswerActionKeys.feedback(
        organizationId,
        projectId,
        threadId,
        messageId,
      );
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      queryClient.setQueryData<AiOwnAnswerFeedback>(key, { feedback: saved });
    },
    onError: (_error, { threadId, messageId }) => {
      const key = aiAnswerActionKeys.feedback(
        organizationId,
        projectId,
        threadId,
        messageId,
      );
      if (queryClient.getQueryData(key) === undefined) {
        void queryClient.invalidateQueries({ queryKey: key, exact: true });
      }
    },
  });
}

export function useDeleteAiAnswerFeedbackMutation(
  organizationId: string,
  projectId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["ai-chat-feedback-delete", organizationId, projectId],
    retry: false,
    onMutate: async ({ threadId, messageId }) => {
      await queryClient.cancelQueries({
        queryKey: aiAnswerActionKeys.feedback(
          organizationId,
          projectId,
          threadId,
          messageId,
        ),
        exact: true,
      });
    },
    mutationFn: ({
      threadId,
      messageId,
    }: {
      threadId: string;
      messageId: string;
    }) =>
      apiClient<void>(
        `${projectBasePath(projectId)}/threads/${encodeURIComponent(
          threadId,
        )}/messages/${encodeURIComponent(messageId)}/feedback`,
        {
          method: "DELETE",
          headers: aiChatCsrfHeaders(),
          cache: "no-store",
        },
      ),
    onSuccess: async (_result, { threadId, messageId }) => {
      const key = aiAnswerActionKeys.feedback(
        organizationId,
        projectId,
        threadId,
        messageId,
      );
      await queryClient.cancelQueries({ queryKey: key, exact: true });
      queryClient.setQueryData<AiOwnAnswerFeedback>(key, { feedback: null });
    },
    onError: (_error, { threadId, messageId }) => {
      const key = aiAnswerActionKeys.feedback(
        organizationId,
        projectId,
        threadId,
        messageId,
      );
      if (queryClient.getQueryData(key) === undefined) {
        void queryClient.invalidateQueries({ queryKey: key, exact: true });
      }
    },
  });
}

export function useCreateAiAnswerShareMutation(
  organizationId: string,
  projectId: string,
) {
  return useMutation({
    mutationKey: ["ai-chat-share-create", organizationId, projectId],
    retry: false,
    mutationFn: ({
      threadId,
      messageId,
    }: {
      threadId: string;
      messageId: string;
    }) =>
      apiClient<AiAnswerShare>(
        `${projectBasePath(projectId)}/threads/${encodeURIComponent(
          threadId,
        )}/messages/${encodeURIComponent(messageId)}/shares`,
        {
          method: "POST",
          headers: aiChatCsrfHeaders(),
          body: JSON.stringify({}),
          cache: "no-store",
        },
      ),
  });
}

export function useRevokeAiAnswerShareMutation(
  organizationId: string,
  projectId: string,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationKey: ["ai-chat-share-revoke", organizationId, projectId],
    retry: false,
    mutationFn: ({ shareId }: { shareId: string }) =>
      apiClient<void>(
        `${projectBasePath(projectId)}/shares/${encodeURIComponent(shareId)}`,
        {
          method: "DELETE",
          headers: aiChatCsrfHeaders(),
          cache: "no-store",
        },
      ),
    onSuccess: (_result, { shareId }) => {
      queryClient.removeQueries({
        queryKey: aiAnswerActionKeys.sharedAnswer(
          organizationId,
          projectId,
          shareId,
        ),
      });
    },
  });
}

export function useSharedAiAnswerQuery(
  organizationId: string,
  projectId: string,
  shareId: string,
  options: { enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: aiAnswerActionKeys.sharedAnswer(
      organizationId,
      projectId,
      shareId,
    ),
    queryFn: ({ signal }) =>
      apiClient<AiSharedAnswer>(
        `${projectBasePath(projectId)}/shares/${encodeURIComponent(shareId)}`,
        {
          signal,
          cache: "no-store",
        },
      ),
    enabled:
      Boolean(organizationId) &&
      Boolean(projectId) &&
      Boolean(shareId) &&
      options.enabled !== false,
    retry: false,
    staleTime: 0,
    refetchOnWindowFocus: false,
  });
}
