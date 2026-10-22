import { apiClient } from "@/lib/api-client";
import type { ChatConversation, ChatMessage, ChatPage } from "./useChat";

export type ChatPreferences = {
  isPinned: boolean;
  isArchived: boolean;
  markedUnread: boolean;
  notificationMode: "ALL" | "MENTIONS" | "NONE";
};
export type ChatNotification = {
  id: string;
  conversationId: string;
  messageId: string;
  senderName: string;
  preview: string;
  createdAt: string;
  readAt: string | null;
};
const path = (id: string) => `/chat/conversations/${encodeURIComponent(id)}`;
const write = <T>(url: string, method: string, body: unknown) =>
  apiClient<T>(url, { method, body: JSON.stringify(body) });
const queryString = (input: Record<string, string | undefined>) =>
  new URLSearchParams(
    Object.entries(input).filter((entry): entry is [string, string] =>
      Boolean(entry[1]),
    ),
  ).toString();

export const chatFeatures = {
  conversation: (id: string) =>
    apiClient<ChatConversation>(path(id), { cache: "no-store" }),
  preferences: (id: string) =>
    apiClient<ChatPreferences>(`${path(id)}/preferences`, {
      cache: "no-store",
    }),
  setPreferences: (id: string, changes: Partial<ChatPreferences>) =>
    write<ChatPreferences>(`${path(id)}/preferences`, "PATCH", changes),
  draft: (id: string) =>
    apiClient<{
      content: string;
      mentionUserIds?: string[];
      updatedAt: string | null;
    }>(`${path(id)}/draft`, { cache: "no-store" }),
  saveDraft: (
    id: string,
    content: string,
    mentionUserIds: readonly string[] = [],
  ) => write(`${path(id)}/draft`, "PUT", { content, mentionUserIds }),
  ownership: (id: string, userId: string) =>
    write(`${path(id)}/ownership`, "POST", { userId }),
  manager: (id: string, userId: string, active: boolean) =>
    write(`${path(id)}/managers/${encodeURIComponent(userId)}`, "PUT", {
      active,
    }),
  search: (input: Record<string, string | undefined>, signal?: AbortSignal) =>
    apiClient<ChatPage<ChatMessage>>(
      `/chat/messages/search?${queryString(input)}`,
      { cache: "no-store", signal },
    ),
  library: (id: string, kind: string, cursor?: string, signal?: AbortSignal) =>
    apiClient<ChatPage<ChatMessage>>(
      `${path(id)}/library?${queryString({ kind, cursor })}`,
      { cache: "no-store", signal },
    ),
  pin: (id: string, messageId: string, active: boolean) =>
    write(`${path(id)}/messages/${encodeURIComponent(messageId)}/pin`, "PUT", {
      active,
    }),
  forward: (
    id: string,
    sourceConversationId: string,
    messageId: string,
    clientMessageId: string,
  ) =>
    write<ChatMessage>(`${path(id)}/forward`, "POST", {
      sourceConversationId,
      messageId,
      clientMessageId,
    }),
  receipts: (id: string, messageId: string) =>
    apiClient<{
      data: {
        userId: string;
        displayName: string;
        read: boolean;
        delivered: boolean;
        readAt: string | null;
        deliveredAt: string | null;
      }[];
    }>(`${path(id)}/messages/${encodeURIComponent(messageId)}/receipts`, {
      cache: "no-store",
    }),
  notifications: (cursor?: string) =>
    apiClient<ChatPage<ChatNotification>>(
      `/chat/notifications?${queryString({ cursor })}`,
      { cache: "no-store" },
    ),
  readNotification: (id: string) =>
    write(`/chat/notifications/${encodeURIComponent(id)}/read`, "PUT", {}),
  block: (userId: string, active: boolean) =>
    write(`/chat/blocks/${encodeURIComponent(userId)}`, "PUT", { active }),
  report: (conversationId: string, reason: string, messageId?: string) =>
    write("/chat/reports", "POST", { conversationId, reason, messageId }),
};
