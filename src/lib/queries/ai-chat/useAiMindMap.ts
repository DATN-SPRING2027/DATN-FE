"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  apiClient,
  isAccessOrResourceUnavailableError,
} from "@/lib/api-client";
import { aiChatCsrfHeaders } from "./ai-chat-stream";
import type { AiChatMindMapResponse } from "./ai-chat.types";

export const AI_MIND_MAP_MAX_TOPIC_LENGTH = 200;

export function normalizeMindMapTopic(raw?: string | null): string {
  if (!raw) return "";
  return raw.trim().replace(/\s+/g, " ");
}

export const aiMindMapKeys = {
  all: ["ai-chat", "mind-map"] as const,
  scope: (userId: string, organizationId: string, projectId: string) =>
    ["ai-chat", "mind-map", userId, organizationId, projectId] as const,
  byTopic: (
    userId: string,
    organizationId: string,
    projectId: string,
    topic?: string | null,
  ) =>
    [
      "ai-chat",
      "mind-map",
      userId,
      organizationId,
      projectId,
      normalizeMindMapTopic(topic),
    ] as const,
};

function projectMindMapPath(projectId: string): string {
  return `/ai-chat/projects/${encodeURIComponent(projectId)}/mind-map`;
}

export function useAiMindMap({
  userId,
  organizationId,
  projectId,
  topic,
}: {
  userId: string;
  organizationId: string;
  projectId: string;
  topic?: string | null;
}) {
  const queryClient = useQueryClient();
  const normalizedTopic = normalizeMindMapTopic(topic);
  const activeKey = aiMindMapKeys.byTopic(
    userId,
    organizationId,
    projectId,
    normalizedTopic,
  );

  // Session-memory cache only: never auto-refetches without explicit user or panel-open trigger.
  const cachedQuery = useQuery<AiChatMindMapResponse>({
    queryKey: activeKey,
    queryFn: () =>
      Promise.reject(new Error("Mind map cache entry is populated via generate")),
    enabled: false,
    retry: false,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const mutation = useMutation({
    mutationKey: ["ai-chat-mind-map-generate", userId, organizationId, projectId],
    retry: false,
    mutationFn: async (overrideTopic?: string | null) => {
      const requestedTopic =
        overrideTopic !== undefined
          ? normalizeMindMapTopic(overrideTopic)
          : normalizedTopic;
      return apiClient<AiChatMindMapResponse>(projectMindMapPath(projectId), {
        method: "POST",
        headers: aiChatCsrfHeaders(),
        body: JSON.stringify(
          requestedTopic ? { topic: requestedTopic } : {},
        ),
        cache: "no-store",
      });
    },
    onSuccess: (response, overrideTopic) => {
      const requestedTopic =
        overrideTopic !== undefined
          ? normalizeMindMapTopic(overrideTopic)
          : normalizedTopic;
      const scopePrefix = aiMindMapKeys.scope(userId, organizationId, projectId);

      // Evict any cached map in the same scope whose underlying authorized documents changed.
      const existingEntries = queryClient.getQueriesData<AiChatMindMapResponse>({
        queryKey: scopePrefix,
      });
      for (const [entryKey, entryData] of existingEntries) {
        if (
          entryData &&
          entryData.scopeFingerprint !== response.scopeFingerprint
        ) {
          queryClient.removeQueries({ queryKey: entryKey, exact: true });
        }
      }

      const targetKey = aiMindMapKeys.byTopic(
        userId,
        organizationId,
        projectId,
        requestedTopic,
      );
      queryClient.setQueryData<AiChatMindMapResponse>(targetKey, response);
    },
    onError: (error) => {
      if (isAccessOrResourceUnavailableError(error)) {
        if (error instanceof ApiError && error.status === 401) {
          queryClient.removeQueries({ queryKey: aiMindMapKeys.all });
        } else {
          queryClient.removeQueries({
            queryKey: aiMindMapKeys.scope(userId, organizationId, projectId),
          });
        }
      }
    },
  });

  return {
    mindMap: cachedQuery.data,
    isGenerating: mutation.isPending,
    error: mutation.error,
    isError: mutation.isError,
    resetError: mutation.reset,
    generate: mutation.mutateAsync,
  };
}
