"use client";

import { useEffect, useState } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { ApiError, apiClient } from "@/lib/api-client";
import {
  acquireSharedChatWsTicket,
  getChatWsCooldownRemainingMs,
  resetChatWsCooldown,
  resolveChatRealtimeWsUrl,
} from "@/components/chat/floating/chat-shared-helpers";
import { authKeys } from "@/lib/queries/auth/auth.keys";
import { useFloatingChatStore } from "@/stores/floating-chat";

const NOTIFICATION_POLL_INTERVAL_MS = 30_000;

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
  "ORGANIZATION" | "PROJECT" | "TASK" | "WORK_NOTE" | "CHAT";

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

function requestHeaders(organizationId?: string | null): Headers {
  const headers = new Headers(csrfHeaders());
  if (organizationId?.trim()) {
    headers.set("X-Expected-Organization-Id", organizationId.trim());
  }
  return headers;
}

type NotificationListPayload = {
  items?: readonly NotificationItem[];
  data?: readonly NotificationItem[];
  nextCursor?: string | null;
  unreadCount?: number;
};

function normalizeNotificationList(
  raw: NotificationListPayload,
): NotificationListResponse {
  const items = raw.items ?? raw.data ?? [];
  return {
    items,
    nextCursor: raw.nextCursor ?? null,
    unreadCount:
      typeof raw.unreadCount === "number"
        ? raw.unreadCount
        : items.filter((item) => !item.readAt).length,
  };
}

export const notificationKeys = {
  all: ["notifications"] as const,
  list: (unreadOnly = false, limit = 15, organizationId?: string | null) =>
    organizationId
      ? ([
          "notifications",
          "list",
          { unreadOnly, limit, organizationId },
        ] as const)
      : (["notifications", "list", { unreadOnly, limit }] as const),
  infinite: (unreadOnly = false, limit = 20, organizationId?: string | null) =>
    organizationId
      ? ([
          "notifications",
          "infinite",
          { unreadOnly, limit, organizationId },
        ] as const)
      : (["notifications", "infinite", { unreadOnly, limit }] as const),
  unreadCount: (organizationId?: string | null) =>
    organizationId
      ? (["notifications", "unread-count", { organizationId }] as const)
      : (["notifications", "unread-count"] as const),
  accountEvents: (userId?: string | null) =>
    userId
      ? (["notifications", "account-events", userId] as const)
      : (["notifications", "account-events"] as const),
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
    organizationId?: string | null,
  ): Promise<NotificationListResponse> => {
    const search = new URLSearchParams();
    search.set("limit", String(params.limit ?? 20));
    if (params.cursor) search.set("cursor", params.cursor);
    if (params.unreadOnly) search.set("unreadOnly", "true");
    const raw = await apiClient<NotificationListPayload>(
      `/notifications?${search.toString()}`,
      {
        signal,
        cache: "no-store",
        headers: requestHeaders(organizationId),
      },
    );
    return normalizeNotificationList(raw);
  },

  accountEvents: async (
    params: { cursor?: string; limit?: number } = {},
    signal?: AbortSignal,
  ): Promise<NotificationListResponse> => {
    const search = new URLSearchParams();
    search.set("limit", String(params.limit ?? 20));
    if (params.cursor) search.set("cursor", params.cursor);
    const raw = await apiClient<NotificationListPayload>(
      `/notifications/account-events?${search.toString()}`,
      { signal, cache: "no-store" },
    );
    return normalizeNotificationList(raw);
  },

  unreadCount: (organizationId?: string | null, signal?: AbortSignal) =>
    apiClient<{ count: number }>("/notifications/unread-count", {
      signal,
      cache: "no-store",
      headers: requestHeaders(organizationId),
    }),

  markRead: (id: string, organizationId?: string | null) =>
    apiClient<NotificationItem>(
      `/notifications/${encodeURIComponent(id)}/read`,
      { method: "PATCH", headers: requestHeaders(organizationId) },
    ),

  markAllRead: (organizationId?: string | null) =>
    apiClient<{ updatedCount: number; readAt: string }>(
      "/notifications/read-all",
      { method: "PATCH", headers: requestHeaders(organizationId) },
    ),

  resolveTarget: (
    id: string,
    organizationId?: string | null,
    signal?: AbortSignal,
  ) =>
    apiClient<NotificationResolveResponse>(
      `/notifications/${encodeURIComponent(id)}/resolve`,
      {
        signal,
        cache: "no-store",
        headers: requestHeaders(organizationId),
      },
    ),
};

export function useNotificationsQuery(
  options: {
    unreadOnly?: boolean;
    limit?: number;
    enabled?: boolean;
    organizationId?: string | null;
  } = {},
) {
  const limit = options.limit ?? 15;
  return useQuery({
    queryKey: notificationKeys.list(
      Boolean(options.unreadOnly),
      limit,
      options.organizationId,
    ),
    queryFn: ({ signal }) =>
      notificationsApi.list(
        {
          unreadOnly: options.unreadOnly,
          limit,
        },
        signal,
        options.organizationId,
      ),
    enabled: options.enabled ?? true,
    refetchInterval: NOTIFICATION_POLL_INTERVAL_MS,
    staleTime: 5_000,
  });
}

export function useInfiniteNotificationsQuery(
  options: {
    unreadOnly?: boolean;
    limit?: number;
    enabled?: boolean;
    organizationId?: string | null;
  } = {},
) {
  const limit = options.limit ?? 20;
  return useInfiniteQuery({
    queryKey: notificationKeys.infinite(
      Boolean(options.unreadOnly),
      limit,
      options.organizationId,
    ),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) =>
      notificationsApi.list(
        {
          cursor: pageParam,
          unreadOnly: options.unreadOnly,
          limit,
        },
        signal,
        options.organizationId,
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: options.enabled ?? true,
  });
}

export function useUnreadNotificationCountQuery(
  enabled = true,
  realtimeConnected = false,
  organizationId?: string | null,
) {
  return useQuery({
    queryKey: notificationKeys.unreadCount(organizationId),
    queryFn: ({ signal }) => notificationsApi.unreadCount(organizationId, signal),
    enabled,
    refetchInterval: unreadNotificationPollingInterval(realtimeConnected),
    staleTime: 5_000,
  });
}

export function useAccountEventsQuery(options: {
  userId?: string | null;
  enabled?: boolean;
} = {}) {
  return useQuery({
    queryKey: notificationKeys.accountEvents(options.userId),
    queryFn: ({ signal }) => notificationsApi.accountEvents({}, signal),
    enabled: (options.enabled ?? true) && Boolean(options.userId),
    staleTime: 5_000,
  });
}

export function useMarkNotificationReadMutation(
  organizationId?: string | null,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id, organizationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useMarkAllNotificationsReadMutation(
  organizationId?: string | null,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.markAllRead(organizationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
    },
  });
}

export function useNotificationRealtimeSubscription(
  userId?: string | null,
  organizationId?: string | null,
  enabled = true,
) {
  const queryClient = useQueryClient();
  const [connectedIdentity, setConnectedIdentity] = useState<string | null>(
    null,
  );

  useEffect(() => {
    if (!enabled || !userId || !organizationId) return;
    if (typeof window === "undefined" || typeof WebSocket === "undefined") {
      return;
    }
    const identityKey = `${userId}:${organizationId}`;
    if (useFloatingChatStore.getState().realtimeOwner === identityKey) return;

    let stopped = false;
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let delay = 2000;
    let authRecheckAttempted = false;

    const scheduleReconnect = () => {
      const waitMs = Math.max(delay, getChatWsCooldownRemainingMs(identityKey));
      reconnectTimer = setTimeout(() => {
        void connect();
      }, waitMs);
      delay = Math.min(delay * 2, 30_000);
    };

    const connect = async () => {
      try {
        const cooldown = getChatWsCooldownRemainingMs(identityKey);
        if (cooldown > 0) {
          scheduleReconnect();
          return;
        }
        const { ticket } = await acquireSharedChatWsTicket(identityKey);
        if (stopped) return;
        const connection = new WebSocket(resolveChatRealtimeWsUrl(), [
          "continuum-chat.v1",
          `ticket.${ticket}`,
        ]);
        socket = connection;

        connection.onopen = () => {
          if (stopped) {
            connection.close();
            return;
          }
          resetChatWsCooldown(identityKey);
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
  }, [enabled, organizationId, queryClient, userId]);

  return Boolean(
    userId &&
    organizationId &&
    connectedIdentity === `${userId}:${organizationId}`,
  );
}
