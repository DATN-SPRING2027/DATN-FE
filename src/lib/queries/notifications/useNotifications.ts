"use client";

import { useEffect, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ApiError, apiClient } from "@/lib/api-client";
import { authKeys } from "@/lib/queries/auth/auth.keys";

const NOTIFICATION_POLL_INTERVAL_MS = 30_000;
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
  reportId?: string | null;
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

const CSRF_COOKIE_PREFIXES = [
  "__Host-csrf=",
  "continuum_csrf=",
  "csrf_token=",
] as const;

function csrfHeaders(): HeadersInit {
  if (typeof document === "undefined") return {};
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    for (const prefix of CSRF_COOKIE_PREFIXES) {
      if (trimmed.startsWith(prefix)) {
        return {
          "X-CSRF-Token": decodeURIComponent(trimmed.slice(prefix.length)),
        };
      }
    }
  }
  return {};
}

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (unreadOnly = false, limit = 15) =>
    ["notifications", "list", { unreadOnly, limit }] as const,
  infinite: (unreadOnly = false, limit = 20) =>
    ["notifications", "infinite", { unreadOnly, limit }] as const,
  unreadCount: () => ["notifications", "unread-count"] as const,
};

export function unreadNotificationPollingInterval(
  realtimeConnected: boolean,
): number | false {
  return realtimeConnected ? false : NOTIFICATION_POLL_INTERVAL_MS;
}

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
      { method: "PATCH", headers: csrfHeaders() },
    ),

  markAllRead: () =>
    apiClient<{ updatedCount: number; readAt: string }>(
      "/notifications/read-all",
      { method: "PATCH", headers: csrfHeaders() },
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
  const limit = options.limit ?? 15;
  return useQuery({
    queryKey: notificationKeys.list(Boolean(options.unreadOnly), limit),
    queryFn: ({ signal }) =>
      notificationsApi.list(
        {
          unreadOnly: options.unreadOnly,
          limit,
        },
        signal,
      ),
    enabled: options.enabled ?? true,
    refetchInterval: NOTIFICATION_POLL_INTERVAL_MS,
    staleTime: 5_000,
  });
}

export function useInfiniteNotificationsQuery(
  options: { unreadOnly?: boolean; limit?: number; enabled?: boolean } = {},
) {
  const limit = options.limit ?? 20;
  return useInfiniteQuery({
    queryKey: notificationKeys.infinite(Boolean(options.unreadOnly), limit),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      notificationsApi.list(
        {
          cursor: pageParam,
          unreadOnly: options.unreadOnly,
          limit,
        },
        signal,
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: options.enabled ?? true,
  });
}

export function useUnreadNotificationCountQuery(
  enabled = true,
  realtimeConnected = false,
) {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: ({ signal }) => notificationsApi.unreadCount(signal),
    enabled,
    refetchInterval: unreadNotificationPollingInterval(realtimeConnected),
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
  const [connectedIdentity, setConnectedIdentity] = useState<string | null>(null);

  useEffect(() => {
    if (!userId || !organizationId) return;
    if (typeof window === "undefined" || typeof WebSocket === "undefined") {
      return;
    }
    const identityKey = `${userId}:${organizationId}`;

    let stopped = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let delay = 2000;
    let authRecheckAttempted = false;

    const scheduleReconnect = () => {
      reconnectTimer = setTimeout(() => {
        void connect();
      }, delay);
      delay = Math.min(delay * 2, 30_000);
    };

    const connect = async () => {
      try {
        const { ticket } = await getSharedWsTicket();
        if (stopped) return;
        const defaultUrl = `${
          window.location.protocol === "https:" ? "wss:" : "ws:"
        }//${window.location.host}/internal/chat/ws`;
        const connection = new WebSocket(
          process.env.NEXT_PUBLIC_CHAT_WS_URL || defaultUrl,
          ["continuum-chat.v1", `ticket.${ticket}`],
        );
        socket = connection;

        connection.onopen = () => {
          if (stopped) {
            connection.close();
            return;
          }
          setConnectedIdentity(identityKey);
          delay = 2000;
          authRecheckAttempted = false;
        };

        connection.onmessage = (event) => {
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

        connection.onclose = () => {
          if (stopped) return;
          setConnectedIdentity((current) =>
            current === identityKey ? null : current,
          );
          scheduleReconnect();
        };
      } catch (error) {
        if (stopped) return;
        setConnectedIdentity((current) =>
          current === identityKey ? null : current,
        );

        if (error instanceof ApiError && error.status === 401) {
          if (authRecheckAttempted) return;
          authRecheckAttempted = true;
          await queryClient
            .invalidateQueries({
              queryKey: authKeys.currentUser(),
              exact: true,
            })
            .catch(() => undefined);
          if (stopped) return;
        } else if (error instanceof ApiError && error.status === 403) {
          return;
        }

        scheduleReconnect();
      }
    };

    void connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      setConnectedIdentity((current) =>
        current === identityKey ? null : current,
      );
      if (
        socket &&
        (socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING)
      ) {
        socket.close();
      }
    };
  }, [organizationId, queryClient, userId]);

  return Boolean(
    userId &&
      organizationId &&
      connectedIdentity === `${userId}:${organizationId}`,
  );
}

let wsTicketInFlight: ReturnType<typeof chatApi.wsTicket> | undefined;

function getSharedWsTicket() {
  if (!wsTicketInFlight) {
    wsTicketInFlight = chatApi.wsTicket().finally(() => {
      wsTicketInFlight = undefined;
    });
  }
  return wsTicketInFlight;
}
