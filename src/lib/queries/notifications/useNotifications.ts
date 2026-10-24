"use client";

import { useEffect } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { chatApi } from "@/lib/queries/chat/useChat";

export type NotificationMvpType =
  | "ORGANIZATION_MEMBER_INVITED"
  | "ORGANIZATION_MEMBER_ADDED"
  | "ORGANIZATION_MEMBER_REMOVED"
  | "PROJECT_MEMBER_ADDED"
  | "PROJECT_MEMBER_REMOVED"
  | "PROJECT_LEADER_ASSIGNED"
  | "PROJECT_LEADER_CHANGED"
  | "PROJECT_LEADER_REVOKED"
  | "TASK_ASSIGNED"
  | "TASK_DEADLINE_APPROACHING"
  | "TASK_DEADLINE_OVERDUE"
  | "WORK_NOTE_MENTION"
  | "CHAT_MENTION";

export type NotificationTargetKind =
  | "ORGANIZATION"
  | "PROJECT"
  | "TASK"
  | "WORK_NOTE"
  | "CHAT";

export type NotificationTarget = Readonly<{
  kind: NotificationTargetKind;
  url: string;
  organizationId?: string | null;
  projectId?: string | null;
  taskId?: string | null;
  noteId?: string | null;
  conversationId?: string | null;
  messageId?: string | null;
}>;

export type NotificationItem = Readonly<{
  id: string;
  recipientId: string;
  actorId: string | null;
  organizationId: string | null;
  projectId: string | null;
  taskId: string | null;
  noteId: string | null;
  conversationId: string | null;
  type: NotificationMvpType | string;
  title: string;
  message: string;
  target: NotificationTarget | null;
  readAt: string | null;
  createdAt: string;
}>;

export type NotificationListResponse = Readonly<{
  items: readonly NotificationItem[];
  nextCursor: string | null;
  unreadCount: number;
}>;

export type NotificationResolveResponse = Readonly<{
  available: boolean;
  reason?: "OK" | "DELETED" | "FORBIDDEN" | null;
  message?: string | null;
  url?: string | null;
  target?: NotificationTarget | null;
}>;

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (unreadOnly = false) =>
    ["notifications", "list", { unreadOnly }] as const,
  infinite: (unreadOnly = false) =>
    ["notifications", "infinite", { unreadOnly }] as const,
  unreadCount: () => ["notifications", "unread-count"] as const,
};

export const notificationsApi = {
  list: async (
    params: { cursor?: string; limit?: number; unreadOnly?: boolean } = {},
    signal?: AbortSignal,
  ): Promise<NotificationListResponse> => {
    const search = new URLSearchParams();
    search.set("limit", String(params.limit ?? 20));
    if (params.cursor) search.set("cursor", params.cursor);
    if (params.unreadOnly) search.set("unreadOnly", "true");
    const raw = await apiClient<{
      items?: readonly NotificationItem[];
      data?: readonly NotificationItem[];
      nextCursor?: string | null;
      unreadCount?: number;
    }>(`/notifications?${search.toString()}`, { signal, cache: "no-store" });
    const items = raw.items ?? raw.data ?? [];
    return {
      items,
      nextCursor: raw.nextCursor ?? null,
      unreadCount:
        typeof raw.unreadCount === "number"
          ? raw.unreadCount
          : items.filter((item) => !item.readAt).length,
    };
  },

  unreadCount: (signal?: AbortSignal) =>
    apiClient<{ count: number }>("/notifications/unread-count", {
      signal,
      cache: "no-store",
    }),

  markRead: (id: string) =>
    apiClient<NotificationItem>(
      `/notifications/${encodeURIComponent(id)}/read`,
      { method: "PATCH" },
    ),

  markAllRead: () =>
    apiClient<{ updatedCount: number; readAt: string }>(
      "/notifications/read-all",
      { method: "PATCH" },
    ),

  resolveTarget: (id: string, signal?: AbortSignal) =>
    apiClient<NotificationResolveResponse>(
      `/notifications/${encodeURIComponent(id)}/resolve`,
      { signal, cache: "no-store" },
    ),
};

export function useNotificationsQuery(
  options: { unreadOnly?: boolean; limit?: number; enabled?: boolean } = {},
) {
  return useQuery({
    queryKey: notificationKeys.list(Boolean(options.unreadOnly)),
    queryFn: ({ signal }) =>
      notificationsApi.list(
        {
          unreadOnly: options.unreadOnly,
          limit: options.limit ?? 15,
        },
        signal,
      ),
    enabled: options.enabled ?? true,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
}

export function useInfiniteNotificationsQuery(
  options: { unreadOnly?: boolean; limit?: number; enabled?: boolean } = {},
) {
  return useInfiniteQuery({
    queryKey: notificationKeys.infinite(Boolean(options.unreadOnly)),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      notificationsApi.list(
        {
          cursor: pageParam,
          unreadOnly: options.unreadOnly,
          limit: options.limit ?? 20,
        },
        signal,
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: options.enabled ?? true,
  });
}

export function useUnreadNotificationCountQuery(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: ({ signal }) => notificationsApi.unreadCount(signal),
    enabled,
    refetchInterval: 15_000,
    staleTime: 5_000,
  });
}

export function useMarkNotificationReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsReadMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useNotificationRealtimeSubscription(
  userId?: string | null,
  organizationId?: string | null,
) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || !organizationId) return;
    if (typeof window === "undefined" || typeof WebSocket === "undefined") {
      return;
    }

    let stopped = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let delay = 2000;

    const connect = async () => {
      try {
        const { ticket } = await chatApi.wsTicket();
        if (stopped) return;
        const defaultUrl = `${
          window.location.protocol === "https:" ? "wss:" : "ws:"
        }//${window.location.host}/internal/chat/ws`;
        socket = new WebSocket(
          process.env.NEXT_PUBLIC_CHAT_WS_URL || defaultUrl,
          ["continuum-chat.v1", `ticket.${ticket}`],
        );

        socket.onopen = () => {
          if (stopped) {
            socket?.close();
            return;
          }
          delay = 2000;
        };

        socket.onmessage = (event) => {
          try {
            const packet = JSON.parse(String(event.data)) as {
              event?: unknown;
            };
            if (
              packet.event === "notification.created" ||
              packet.event === "notification.read" ||
              packet.event === "notification.read_all"
            ) {
              void queryClient.invalidateQueries({
                queryKey: notificationKeys.all,
              });
            }
          } catch {
            // Ignore malformed socket frame
          }
        };

        socket.onclose = () => {
          if (stopped) return;
          reconnectTimer = setTimeout(() => {
            void connect();
          }, delay);
          delay = Math.min(delay * 2, 30_000);
        };
      } catch {
        // Polling fallback remains active when WS is unavailable
      }
    };

    void connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (socket && socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [organizationId, queryClient, userId]);
}
