"use client";

import { apiClient } from "@/lib/api-client";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

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
  mentionUserIds?: readonly string[];
  isPinned?: boolean;
  forwardedFrom?: { senderName: string } | null;
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
}>;

export const chatKeys = {
  conversations: (organizationId: string, search?: string) =>
    search
      ? (["chat", organizationId, "conversations", "search", search] as const)
      : (["chat", organizationId, "conversations"] as const),
  candidates: (organizationId: string, search: string) =>
    ["chat", organizationId, "candidates", search] as const,
  messages: (organizationId: string, conversationId: string) =>
    ["chat", organizationId, "messages", conversationId] as const,
  search: (organizationId: string, conversationId: string, query: string) =>
    ["chat", organizationId, "search", conversationId, query] as const,
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
    let page = await chatApi.messages(conversationId, signal);
    let data = [...page.data];
    const oldest = previous[0];
    // Reload through the oldest visible message so offline edits and gaps are reconciled too.
    while (
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
      data = [...page.data, ...data];
    }
    const seen = new Set<string>();
    return {
      data: data.filter((message) => {
        if (seen.has(message.id)) return false;
        seen.add(message.id);
        return true;
      }),
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
  attachmentDownloadUrl: (conversationId: string, attachmentId: string) =>
    apiClient<{ url: string; expiresInSeconds: number }>(
      `/chat/conversations/${encodeURIComponent(conversationId)}/attachments/${encodeURIComponent(attachmentId)}/download-url`,
      { cache: "no-store" },
    ),
  wsTicket: () =>
    apiClient<{ ticket: string; expiresInSeconds: number }>("/chat/ws-ticket", {
      method: "POST",
    }),
};

export function useChatConversationsQuery(organizationId: string, search = "") {
  return useInfiniteQuery({
    queryKey: chatKeys.conversations(organizationId, search),
    queryFn: ({ pageParam, signal }) =>
      chatApi.conversations(pageParam, signal, search),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: Boolean(organizationId),
    retry: false,
    staleTime: 5_000,
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
) {
  const client = useQueryClient();
  return useQuery({
    queryKey: chatKeys.messages(organizationId, conversationId),
    queryFn: ({ signal }) =>
      chatApi.syncMessages(
        conversationId,
        client.getQueryData<ChatPage<ChatMessage>>(
          chatKeys.messages(organizationId, conversationId),
        )?.data,
        signal,
      ),
    enabled: Boolean(organizationId && conversationId),
    retry: false,
    staleTime: 0,
  });
}

export function useChatMessageContextQuery(
  organizationId: string,
  conversationId: string,
  messageId: string,
) {
  return useQuery({
    queryKey: chatKeys.context(organizationId, conversationId, messageId),
    queryFn: ({ signal }) =>
      chatApi.messageContext(conversationId, messageId, signal),
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
