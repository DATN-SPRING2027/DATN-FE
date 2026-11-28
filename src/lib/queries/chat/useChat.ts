"use client";

import { apiClient } from "@/lib/api-client";
import { reconcileMessagePageAssistantState } from "./assistant-state";
import { normalizeChatAttachmentUrl } from "./attachment-url";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

export { normalizeChatAttachmentUrl };

export const CONTINUUM_AI_SENDER_ID = "assistant:continuum_ai" as const;
export const CONTINUUM_AI_HANDLE = "continuumAI" as const;
export const CONTINUUM_AI_DISPLAY_NAME = "Continuum AI" as const;

export type ChatCapabilities = Readonly<{
  dmAssistantEnabled: boolean;
}>;

export type ChatMessageAuthorType = "USER" | "ASSISTANT";

export type ChatAssistantStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "INSUFFICIENT_EVIDENCE"
  | "CANCELLED"
  | "FAILED";

export type ChatAssistantFailureCode =
  | "SOURCE_CHANGED"
  | "TRIGGER_DELETED"
  | "ACCESS_REVOKED"
  | "SERVICE_UNAVAILABLE"
  | "TIMEOUT"
  | "INVALID_MODEL_OUTPUT";

export type ChatAssistantSourceStatus = "ACTIVE" | "EDITED" | "DELETED";

export type ChatAssistantSourceAggregateState =
  | "FRESH"
  | "HAS_EDITED"
  | "HAS_DELETED"
  | "HAS_EDITED_AND_DELETED";

export type ChatAssistantMentionInput = Readonly<{
  handle: typeof CONTINUUM_AI_HANDLE;
  query?: string;
  timezone?: string;
}>;

export type ChatAssistantSourceReference = Readonly<{
  refId: string;
  messageId: string;
  senderName: string;
  createdAt: string;
  quoteSnippet: string;
  status: ChatAssistantSourceStatus;
}>;

export type ChatAssistantMeta = Readonly<{
  handle: typeof CONTINUUM_AI_HANDLE;
  queryMode: "TIME_WINDOW" | "KEYWORD" | "HYBRID";
  partialCoverage: boolean;
  coverageNote: string | null;
  sourceState: ChatAssistantSourceAggregateState;
}>;

export type ChatAssistantJobState = Readonly<{
  jobId: string;
  status: ChatAssistantStatus;
  failureCode: ChatAssistantFailureCode | null;
  responseMessageId: string | null;
  updatedAt: string;
}>;

export type ChatAssistantStatusEvent = Readonly<{
  conversationId: string;
  triggerMessageId: string;
  jobId: string;
  status: ChatAssistantStatus;
  failureCode: ChatAssistantFailureCode | null;
  responseMessageId: string | null;
  updatedAt: string;
}>;

export function isAssistantMessage(
  message: Pick<ChatMessage, "authorType" | "senderId"> | undefined,
): boolean {
  if (!message) return false;
  return (
    message.authorType === "ASSISTANT" ||
    message.senderId === CONTINUUM_AI_SENDER_ID
  );
}

export type ChatCandidate = Readonly<{
  id: string;
  fullName: string;
  email?: string;
  avatarUrl: string | null;
  isOnline: boolean;
}>;

export type ChatParticipant = Readonly<{
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: "OWNER" | "MANAGER" | "MEMBER";
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  lastDeliveredMessageId: string | null;
  lastDeliveredAt: string | null;
  isOnline?: boolean;
}>;

export type ChatAttachment = Readonly<{
  id: string;
  name: string;
  contentType: string;
  size: number;
  kind: "IMAGE" | "DOCUMENT";
}>;

export type ChatConversation = Readonly<{
  id: string;
  type: "DIRECT" | "ROOM";
  title: string | null;
  createdBy: string;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  lastMessageSenderId: string | null;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
  isPinned?: boolean;
  isArchived?: boolean;
  markedUnread?: boolean;
  notificationMode?: "ALL" | "MENTIONS" | "NONE";
  unreadCount: number;
  capabilities?: ChatCapabilities;
  members: readonly ChatParticipant[];
}>;

export type ChatMessage = Readonly<{
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  content: string;
  createdAt: string;
  authorType?: ChatMessageAuthorType;
  assistantMention?: Readonly<{
    handle: typeof CONTINUUM_AI_HANDLE;
    query: string;
    timezone: string;
  }> | null;
  triggerMessageId?: string | null;
  assistantStatus?: "COMPLETED" | "INSUFFICIENT_EVIDENCE" | null;
  assistantFailureCode?: ChatAssistantFailureCode | null;
  assistantMeta?: ChatAssistantMeta | null;
  sourceReferences?: readonly ChatAssistantSourceReference[];
  assistantState?: ChatAssistantJobState | null;
  mentionUserIds?: readonly string[];
  isPinned?: boolean;
  forwardedFrom?: { senderName: string } | null;
  contentVersion?: number;
  isEdited?: boolean;
  editedAt: string | null;
  deletedAt: string | null;
  replyToMessageId: string | null;
  replyTo: Readonly<{
    id: string;
    senderName: string;
    preview: string;
    deleted: boolean;
  }> | null;
  attachments: readonly ChatAttachment[];
  reactions: readonly Readonly<{
    emoji: string;
    count: number;
    reactedByMe: boolean;
  }>[];
}>;

export type ChatPage<T> = Readonly<{
  data: readonly T[];
  nextCursor: string | null;
  capabilities?: ChatCapabilities;
}>;

export const chatKeys = {
  conversations: (organizationId: string, search?: string) =>
    search
      ? (["chat", organizationId, "conversations", "search", search] as const)
      : (["chat", organizationId, "conversations"] as const),
  conversation: (organizationId: string, conversationId: string) =>
    ["chat", organizationId, "detail", conversationId] as const,
  candidates: (organizationId: string, search: string) =>
    ["chat", organizationId, "candidates", search] as const,
  messages: (organizationId: string, conversationId: string) =>
    ["chat", organizationId, "messages", conversationId] as const,
  search: (organizationId: string, conversationId: string, query?: string) =>
    query !== undefined
      ? (["chat", organizationId, "search", conversationId, query] as const)
      : (["chat", organizationId, "search", conversationId] as const),
  toolsSearch: (organizationId: string) =>
    ["chat", organizationId, "tools", "search"] as const,
  toolsLibrary: (organizationId: string, conversationId: string) =>
    ["chat", organizationId, "tools", "library", conversationId] as const,
  context: (
    organizationId: string,
    conversationId: string,
    messageId: string,
  ) =>
    [
      "chat",
      organizationId,
      "messages",
      conversationId,
      "context",
      messageId,
    ] as const,
};

export const chatApi = {
  conversations: (cursor?: string, signal?: AbortSignal, search?: string) => {
    const query = new URLSearchParams({ limit: "50" });
    if (cursor) query.set("cursor", cursor);
    if (search) query.set("search", search);
    return apiClient<ChatPage<ChatConversation>>(
      `/chat/conversations?${query}`,
      {
        signal,
        cache: "no-store",
      },
    );
  },
  candidates: (search = "", signal?: AbortSignal) => {
    const trimmed = search.trim();
    const query = trimmed ? `?search=${encodeURIComponent(trimmed)}` : "";
    return apiClient<{ data: readonly ChatCandidate[] }>(
      `/chat/candidates${query}`,
      { signal, cache: "no-store" },
    );
  },
  messages: (conversationId: string, signal?: AbortSignal) =>
    apiClient<ChatPage<ChatMessage>>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/messages?limit=50`,
      { signal, cache: "no-store" },
    ),
  olderMessages: (
    conversationId: string,
    cursor: string,
    signal?: AbortSignal,
  ) =>
    apiClient<ChatPage<ChatMessage>>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/messages?limit=50&cursor=${encodeURIComponent(cursor)}`,
      { signal, cache: "no-store" },
    ),
  messageContext: (
    conversationId: string,
    messageId: string,
    signal?: AbortSignal,
  ) =>
    apiClient<ChatPage<ChatMessage>>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/messages?limit=50&aroundMessageId=${encodeURIComponent(messageId)}`,
      { signal, cache: "no-store" },
    ),
  syncMessages: async (
    conversationId: string,
    previous: readonly ChatMessage[] = [],
    signal?: AbortSignal,
  ): Promise<ChatPage<ChatMessage>> => {
    const MAX_SYNC_PAGES = 3;
    let page = await chatApi.messages(conversationId, signal);
    const pageChunks: (readonly ChatMessage[])[] = [page.data];
    const oldest = previous[0];
    let pagesFetched = 1;
    // Cap reconciliation pages so reconnecting long histories never loops unboundedly.
    while (
      pagesFetched < MAX_SYNC_PAGES &&
      oldest &&
      page.nextCursor &&
      page.data.length > 0 &&
      (page.data[0].createdAt > oldest.createdAt ||
        (page.data[0].createdAt === oldest.createdAt &&
          page.data[0].id > oldest.id))
    ) {
      page = await chatApi.olderMessages(
        conversationId,
        page.nextCursor,
        signal,
      );
      pageChunks.unshift(page.data);
      pagesFetched += 1;
    }
    const seen = new Set<string>();
    const merged: ChatMessage[] = [];
    for (const chunk of pageChunks) {
      for (const message of chunk) {
        if (!seen.has(message.id)) {
          seen.add(message.id);
          merged.push(message);
        }
      }
    }
    return {
      data: merged,
      nextCursor: page.nextCursor,
    };
  },
  searchMessages: (conversationId: string, search: string, cursor?: string) => {
    const query = new URLSearchParams({ q: search, limit: "30" });
    if (cursor) query.set("cursor", cursor);
    return apiClient<ChatPage<ChatMessage>>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/messages/search?${query}`,
      { cache: "no-store" },
    );
  },
  createDirect: (participantId: string) =>
    apiClient<{ id: string; type: "DIRECT" }>("/chat/direct", {
      method: "POST",
      body: JSON.stringify({ participantId }),
    }),
  createRoom: (input: {
    title: string;
    participantIds: readonly string[];
    clientRoomId: string;
  }) =>
    apiClient<{ id: string; type: "ROOM" }>("/chat/rooms", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  renameRoom: (conversationId: string, title: string) =>
    apiClient<{ id: string; type: "ROOM" }>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/room`,
      { method: "PATCH", body: JSON.stringify({ title }) },
    ),
  addRoomMembers: (conversationId: string, participantIds: readonly string[]) =>
    apiClient<{ id: string; type: "ROOM" }>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/members`,
      { method: "POST", body: JSON.stringify({ participantIds }) },
    ),
  removeRoomMember: (conversationId: string, userId: string) =>
    apiClient<{ id: string; type: "ROOM" }>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/members/${encodeURIComponent(userId)}`,
      { method: "DELETE" },
    ),
  leaveRoom: (conversationId: string) =>
    apiClient<{ id: string; type: "ROOM" }>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/leave`,
      { method: "POST" },
    ),
  sendMessage: (
    conversationId: string,
    input: {
      clientMessageId: string;
      content: string;
      attachments?: readonly string[];
      replyToMessageId?: string;
      mentionUserIds?: readonly string[];
      assistantMention?: ChatAssistantMentionInput;
    },
  ) =>
    apiClient<ChatMessage>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/messages`,
      { method: "POST", body: JSON.stringify(input) },
    ),
  editMessage: (
    conversationId: string,
    messageId: string,
    content: string,
    mentionUserIds?: readonly string[],
  ) =>
    apiClient<ChatMessage>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
      { method: "PATCH", body: JSON.stringify({ content, mentionUserIds }) },
    ),
  deleteMessage: (conversationId: string, messageId: string) =>
    apiClient<ChatMessage>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}`,
      { method: "DELETE" },
    ),
  setReaction: (
    conversationId: string,
    messageId: string,
    emoji: string,
    active: boolean,
  ) =>
    apiClient<ChatMessage>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/messages/${encodeURIComponent(messageId)}/reactions/${encodeURIComponent(emoji)}`,
      { method: active ? "PUT" : "DELETE" },
    ),
  markRead: (conversationId: string, messageId: string) =>
    apiClient(
      `/chat/conversations/${encodeURIComponent(conversationId)}/read`,
      {
        method: "POST",
        body: JSON.stringify({ messageId }),
      },
    ),
  markDelivered: (conversationId: string, messageId: string) =>
    apiClient(
      `/chat/conversations/${encodeURIComponent(conversationId)}/delivered`,
      { method: "POST", body: JSON.stringify({ messageId }) },
    ),
  uploadAttachment: async (conversationId: string, file: File) => {
    const upload = await apiClient<{
      uploadId: string;
    }>(`/chat/conversations/${encodeURIComponent(conversationId)}/uploads`, {
      method: "POST",
      body: JSON.stringify({
        name: file.name,
        contentType: file.type,
        size: file.size,
      }),
    });
    await apiClient(
      `/chat/conversations/${encodeURIComponent(conversationId)}/uploads/${encodeURIComponent(upload.uploadId)}/content`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/octet-stream" },
        body: file,
      },
    );
    await apiClient(
      `/chat/conversations/${encodeURIComponent(conversationId)}/uploads/${encodeURIComponent(upload.uploadId)}/complete`,
      { method: "POST" },
    );
    return upload.uploadId;
  },
  attachmentDownloadUrl: async (conversationId: string, attachmentId: string) => {
    const result = await apiClient<{ url: string; expiresInSeconds: number }>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/attachments/${encodeURIComponent(attachmentId)}/download-url`,
      { cache: "no-store" },
    );
    return {
      ...result,
      url: normalizeChatAttachmentUrl(result.url),
    };
  },
  wsTicket: () =>
    apiClient<{ ticket: string; expiresInSeconds: number }>("/chat/ws-ticket", {
      method: "POST",
    }),
};

export function useChatConversationsQuery(
  organizationId: string,
  search = "",
  options?: {
    refetchInterval?: number | false;
    refetchIntervalInBackground?: boolean;
  },
) {
  return useInfiniteQuery({
    queryKey: chatKeys.conversations(organizationId, search),
    queryFn: ({ pageParam, signal }) =>
      chatApi.conversations(pageParam, signal, search),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(organizationId),
    retry: false,
    staleTime: 5_000,
    ...(options?.refetchInterval !== undefined
      ? {
          refetchInterval: options.refetchInterval,
          refetchIntervalInBackground:
            options.refetchIntervalInBackground ?? false,
        }
      : {}),
  });
}

export function useChatCandidatesQuery(
  organizationId: string,
  search = "",
  enabled = true,
) {
  const normalizedSearch = search.trim();
  return useQuery({
    queryKey: chatKeys.candidates(organizationId, normalizedSearch),
    queryFn: ({ signal }) => chatApi.candidates(normalizedSearch, signal),
    enabled: Boolean(organizationId && enabled),
    retry: false,
    staleTime: 3_000,
  });
}

export function useChatMessagesQuery(
  organizationId: string,
  conversationId: string,
  options?: {
    refetchInterval?: number | false;
    refetchIntervalInBackground?: boolean;
  },
) {
  const client = useQueryClient();
  return useQuery({
    queryKey: chatKeys.messages(organizationId, conversationId),
    queryFn: async ({ signal }) => {
      const previousPage = client.getQueryData<ChatPage<ChatMessage>>(
        chatKeys.messages(organizationId, conversationId),
      );
      const fetched = await chatApi.syncMessages(
        conversationId,
        previousPage?.data,
        signal,
      );
      const latestCached = client.getQueryData<ChatPage<ChatMessage>>(
        chatKeys.messages(organizationId, conversationId),
      );
      return reconcileMessagePageAssistantState(
        fetched,
        latestCached ?? previousPage,
      );
    },
    enabled: Boolean(organizationId && conversationId),
    retry: false,
    staleTime: 0,
    ...(options?.refetchInterval !== undefined
      ? {
          refetchInterval: options.refetchInterval,
          refetchIntervalInBackground:
            options.refetchIntervalInBackground ?? false,
        }
      : {}),
  });
}

export function useChatMessageContextQuery(
  organizationId: string,
  conversationId: string,
  messageId: string,
) {
  const client = useQueryClient();
  return useQuery({
    queryKey: chatKeys.context(organizationId, conversationId, messageId),
    queryFn: async ({ signal }) => {
      const fetched = await chatApi.messageContext(
        conversationId,
        messageId,
        signal,
      );
      const latestCached = client.getQueryData<ChatPage<ChatMessage>>(
        chatKeys.context(organizationId, conversationId, messageId),
      );
      return reconcileMessagePageAssistantState(fetched, latestCached);
    },
    enabled: Boolean(organizationId && conversationId && messageId),
    retry: false,
  });
}

export function useChatMessageSearchQuery(
  organizationId: string,
  conversationId: string,
  search: string,
) {
  const value = search.trim();
  return useInfiniteQuery({
    queryKey: chatKeys.search(organizationId, conversationId, value),
    queryFn: ({ pageParam }) =>
      chatApi.searchMessages(conversationId, value, pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(organizationId && conversationId && value.length >= 2),
    retry: false,
    staleTime: 3_000,
  });
}

export function useCreateDirectMutation(organizationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: chatApi.createDirect,
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: chatKeys.conversations(organizationId),
      }),
  });
}

export function useCreateRoomMutation(organizationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: chatApi.createRoom,
    onSuccess: () =>
      client.invalidateQueries({
        queryKey: chatKeys.conversations(organizationId),
      }),
  });
}
