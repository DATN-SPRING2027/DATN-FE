"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ApiError,
  apiClient,
  isAccessOrResourceUnavailableError,
} from "@/lib/api-client";
import { aiChatCsrfHeaders } from "./ai-chat-stream";
import { authKeys } from "../auth/auth.keys";
import type { AiChatMindMapResponse } from "./ai-chat.types";

export const AI_MIND_MAP_MAX_TOPIC_LENGTH = 200;

export type GenerateMindMapInput =
  | string
  | null
  | undefined
  | Readonly<{
      topic?: string | null;
      refresh?: boolean;
    }>;

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

function projectMindMapPath(projectId: string, topic?: string): string {
  const base = `/ai-chat/projects/${encodeURIComponent(projectId)}/mind-map`;
  return topic ? `${base}?topic=${encodeURIComponent(topic)}` : base;
}

function parseGenerateInput(
  input: GenerateMindMapInput,
  fallbackTopic: string,
): { requestedTopic: string; refresh: boolean | undefined } {
  if (input && typeof input === "object") {
    const requestedTopic =
      input.topic !== undefined
        ? normalizeMindMapTopic(input.topic)
        : fallbackTopic;
    return {
      requestedTopic,
      refresh: input.refresh,
    };
  }
  return {
    requestedTopic:
      input !== undefined ? normalizeMindMapTopic(input) : fallbackTopic,
    refresh: undefined,
  };
}

export function useAiMindMap({
  userId,
  organizationId,
  projectId,
  topic,
  enabled = false,
  skipAutoFetch = false,
}: {
  userId: string;
  organizationId: string;
  projectId: string;
  topic?: string | null;
  enabled?: boolean;
  skipAutoFetch?: boolean;
}) {
  const queryClient = useQueryClient();
  const normalizedTopic = normalizeMindMapTopic(topic);
  const hasScope = Boolean(userId && organizationId && projectId);
  const isOpenSession = Boolean(enabled && hasScope);
  const scopeTopicId = `${userId}\0${organizationId}\0${projectId}\0${normalizedTopic}`;
  const activeKey = aiMindMapKeys.byTopic(
    userId,
    organizationId,
    projectId,
    normalizedTopic,
  );

  // Revalidate permissions and document-freshness on every panel open or scope/topic
  // change while open. Cached snapshots are never rendered until the live server check resolves.
  const [sessionGate, setSessionGate] = useState<{
    wasOpen: boolean;
    scopeTopicId: string;
    openSeq: number;
    verifiedTag: string;
  }>(() => ({
    wasOpen: isOpenSession,
    scopeTopicId,
    openSeq: isOpenSession ? 1 : 0,
    verifiedTag: "",
  }));

  let effectiveOpenSeq = sessionGate.openSeq;
  let effectiveVerifiedTag = sessionGate.verifiedTag;
  if (
    sessionGate.wasOpen !== isOpenSession ||
    sessionGate.scopeTopicId !== scopeTopicId
  ) {
    effectiveOpenSeq = isOpenSession
      ? sessionGate.openSeq + 1
      : sessionGate.openSeq;
    effectiveVerifiedTag = isOpenSession ? sessionGate.verifiedTag : "";
    setSessionGate({
      wasOpen: isOpenSession,
      scopeTopicId,
      openSeq: effectiveOpenSeq,
      verifiedTag: effectiveVerifiedTag,
    });
  }

  const expectedVerifiedTag = `${effectiveOpenSeq}:${scopeTopicId}`;
  const isAwaitingOpenVerification =
    isOpenSession && effectiveVerifiedTag !== expectedVerifiedTag;

  useEffect(() => {
    if (!isOpenSession) return;
    return () => {
      queryClient.removeQueries({
        queryKey: aiMindMapKeys.scope(userId, organizationId, projectId),
      });
    };
  }, [isOpenSession, organizationId, projectId, queryClient, userId]);

  const purgeScopeOnAccessError = useCallback(
    (error: unknown, preserveKey?: readonly unknown[]) => {
      if (!isAccessOrResourceUnavailableError(error)) return;
      const preserveSerialized = preserveKey
        ? JSON.stringify(preserveKey)
        : null;
      const shouldRemove = (query: { queryKey: readonly unknown[] }) =>
        preserveSerialized === null ||
        JSON.stringify(query.queryKey) !== preserveSerialized;

      if (error instanceof ApiError && error.status === 401) {
        queryClient.removeQueries({
          queryKey: aiMindMapKeys.all,
          predicate: shouldRemove,
        });
        void queryClient
          .invalidateQueries({
            queryKey: authKeys.currentUser(),
            exact: true,
          })
          .catch(() => undefined);
      } else {
        queryClient.removeQueries({
          queryKey: aiMindMapKeys.scope(userId, organizationId, projectId),
          predicate: shouldRemove,
        });
      }
    },
    [organizationId, projectId, queryClient, userId],
  );

  const savedQuery = useQuery<AiChatMindMapResponse>({
    queryKey: activeKey,
    queryFn: async () => {
      try {
        const response = await apiClient<AiChatMindMapResponse>(
          projectMindMapPath(projectId, normalizedTopic || undefined),
          {
            method: "GET",
            cache: "no-store",
          },
        );
        setSessionGate((prev) =>
          prev.wasOpen && prev.scopeTopicId === scopeTopicId
            ? { ...prev, verifiedTag: `${prev.openSeq}:${scopeTopicId}` }
            : prev,
        );
        return response;
      } catch (error) {
        purgeScopeOnAccessError(error, activeKey);
        throw error;
      }
    },
    enabled: Boolean(
      isOpenSession && !skipAutoFetch && isAwaitingOpenVerification,
    ),
    retry: false,
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  const mutation = useMutation({
    mutationKey: [
      "ai-chat-mind-map-generate",
      userId,
      organizationId,
      projectId,
    ],
    retry: false,
    onMutate: () => ({
      queryKey: activeKey,
      cacheEntry: queryClient
        .getQueryCache()
        .build(queryClient, { queryKey: activeKey as readonly unknown[] }),
    }),
    mutationFn: async (input?: GenerateMindMapInput) => {
      const { requestedTopic, refresh } = parseGenerateInput(
        input,
        normalizedTopic,
      );
      return apiClient<AiChatMindMapResponse>(projectMindMapPath(projectId), {
        method: "POST",
        headers: aiChatCsrfHeaders(),
        body: JSON.stringify({
          ...(requestedTopic ? { topic: requestedTopic } : {}),
          ...(refresh !== undefined ? { refresh } : {}),
        }),
        cache: "no-store",
      });
    },
    onSuccess: (response, input, context) => {
      // Logout/access revocation removes this exact entry. A late response must
      // not recreate it or overwrite a new session's entry with the same key.
      if (
        !context?.cacheEntry ||
        queryClient.getQueryCache().find({
          queryKey: context.queryKey,
          exact: true,
        }) !== context.cacheEntry
      ) {
        return;
      }
      const { requestedTopic } = parseGenerateInput(input, normalizedTopic);
      const scopePrefix = aiMindMapKeys.scope(
        userId,
        organizationId,
        projectId,
      );

      // Evict any cached map in the same scope whose underlying authorized documents changed.
      const existingEntries =
        queryClient.getQueriesData<AiChatMindMapResponse>({
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
      const targetScopeTopicId = `${userId}\0${organizationId}\0${projectId}\0${requestedTopic}`;
      setSessionGate((prev) =>
        prev.wasOpen && prev.scopeTopicId === targetScopeTopicId
          ? { ...prev, verifiedTag: `${prev.openSeq}:${targetScopeTopicId}` }
          : prev,
      );
      queryClient.setQueryData<AiChatMindMapResponse>(targetKey, response);
    },
    onError: (error, _input, context) => {
      if (
        !context?.cacheEntry ||
        queryClient.getQueryCache().find({
          queryKey: context.queryKey,
          exact: true,
        }) !== context.cacheEntry
      ) {
        return;
      }
      purgeScopeOnAccessError(error);
    },
  });

  const resetError = useCallback(() => {
    mutation.reset();
  }, [mutation]);

  return {
    mindMap: isAwaitingOpenVerification ? undefined : savedQuery.data,
    isCheckingSaved:
      savedQuery.isLoading ||
      savedQuery.isFetching ||
      (isAwaitingOpenVerification &&
        !skipAutoFetch &&
        !savedQuery.isError &&
        !mutation.isError),
    isGenerating: mutation.isPending,
    error: mutation.error ?? savedQuery.error,
    isError: mutation.isError || savedQuery.isError,
    resetError,
    refetchSaved: savedQuery.refetch,
    generate: mutation.mutateAsync,
  };
}
