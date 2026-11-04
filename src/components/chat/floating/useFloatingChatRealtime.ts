"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import {
  chatApi,
  chatKeys,
  type ChatCandidate,
  type ChatConversation,
  type ChatMessage,
  type ChatPage,
} from "@/lib/queries/chat/useChat";
import { preserveLocalReactions } from "../message-state";
import { useFloatingChatStore } from "@/stores/floating-chat";
import {
  acquireSharedChatWsTicket,
  getChatWsCooldownRemainingMs,
  isChatMessagePacket,
  mergeChatMessage,
  resolveChatRealtimeWsUrl,
  type FloatingConnectionState,
} from "./chat-shared-helpers";

const EMPTY_TYPING_MAP: Readonly<Record<string, Record<string, string>>> = {};

function sendSocketFrame(
  socket: WebSocket | null,
  event: string,
  data: unknown,
) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ event, data }));
  }
}

export type UseFloatingChatRealtimeOptions = Readonly<{
  organizationId: string;
  actorId: string;
  openWindowIds: readonly string[];
  conversations: readonly ChatConversation[];
  refreshCurrentUser: () => Promise<unknown>;
}>;

type SocketRuntimeState = Readonly<{
  identity: string;
  status: FloatingConnectionState;
  epoch: number;
  typing: Record<string, Record<string, string>>;
}>;

export function useFloatingChatRealtime({
  organizationId,
  actorId,
  openWindowIds,
  conversations,
  refreshCurrentUser,
}: UseFloatingChatRealtimeOptions) {
  const queryClient = useQueryClient();
  const identityKey =
    organizationId && actorId ? `${actorId}:${organizationId}` : "";

  const [runtime, setRuntime] = useState<SocketRuntimeState>({
    identity: "",
    status: "connecting",
    epoch: 0,
    typing: {},
  });
  const [cachedCandidateState, setCachedCandidateState] = useState<{
    identity: string;
    idsKey: string;
  }>({ identity: "", idsKey: "" });
  const cachedCandidateIdsKey =
    cachedCandidateState.identity === identityKey
      ? cachedCandidateState.idsKey
      : "";

  const connection: FloatingConnectionState =
    runtime.identity === identityKey ? runtime.status : "connecting";
  const socketEpoch = runtime.identity === identityKey ? runtime.epoch : 0;
  const typingByConversation =
    runtime.identity === identityKey ? runtime.typing : EMPTY_TYPING_MAP;

  const socketRef = useRef<WebSocket | null>(null);
  const openWindowIdsRef = useRef<readonly string[]>(openWindowIds);
  const remoteTypingTimers = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );

  // Claim realtime ownership during layout phase so NotificationDropdown
  // reuses this WebSocket instead of requesting a duplicate ws-ticket.
  useLayoutEffect(() => {
    if (!identityKey) return;
    useFloatingChatStore.getState().setRealtimeOwner(identityKey);
    return () => {
      const store = useFloatingChatStore.getState();
      if (store.realtimeOwner === identityKey) {
        store.setRealtimeOwner(null);
      }
    };
  }, [identityKey]);

  useEffect(() => {
    openWindowIdsRef.current = openWindowIds;
  }, [openWindowIds]);

  // Track candidate IDs already fetched into QueryClient cache (e.g. when Launcher opens)
  // without issuing extra network requests before the user opens the Launcher.
  useEffect(() => {
    if (!organizationId || !actorId || !identityKey) {
      return;
    }

    let active = true;
    const syncCandidateIds = () => {
      if (!active) return;
      const entries = queryClient.getQueriesData<{
        data: readonly ChatCandidate[];
      }>({
        queryKey: ["chat", organizationId, "candidates"],
      });
      const ids = entries.flatMap(([, payload]) =>
        (payload?.data ?? [])
          .filter((candidate) => candidate.id !== actorId)
          .map((candidate) => candidate.id),
      );
      const nextKey = [...new Set(ids)].sort().join(",");
      setCachedCandidateState((prev) =>
        prev.identity === identityKey && prev.idsKey === nextKey
          ? prev
          : { identity: identityKey, idsKey: nextKey },
      );
    };

    queueMicrotask(syncCandidateIds);
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" && event.type !== "removed") {
        return;
      }
      const key = event.query.queryKey;
      if (
        Array.isArray(key) &&
        key[0] === "chat" &&
        key[1] === organizationId &&
        key[2] === "candidates"
      ) {
        queueMicrotask(syncCandidateIds);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [actorId, identityKey, organizationId, queryClient]);

  const updatePresence = useCallback(
    (userId: string, isOnline: boolean) => {
      queryClient.setQueriesData<
        InfiniteData<ChatPage<ChatConversation>, string | undefined>
      >({ queryKey: chatKeys.conversations(organizationId) }, (result) => {
        if (!result) return result;
        let changed = false;
        const pages = result.pages.map((page) => {
          let pageChanged = false;
          const data = page.data.map((conversation) => {
            let convChanged = false;
            const members = conversation.members.map((member) => {
              if (member.userId === userId && member.isOnline !== isOnline) {
                convChanged = true;
                return { ...member, isOnline };
              }
              return member;
            });
            if (!convChanged) return conversation;
            pageChanged = true;
            return { ...conversation, members };
          });
          if (!pageChanged) return page;
          changed = true;
          return { ...page, data };
        });
        return changed ? { ...result, pages } : result;
      });
      queryClient.setQueriesData<{ data: readonly ChatCandidate[] }>(
        { queryKey: ["chat", organizationId, "candidates"] },
        (result) => {
          if (!result) return result;
          let changed = false;
          const data = result.data.map((candidate) => {
            if (candidate.id === userId && candidate.isOnline !== isOnline) {
              changed = true;
              return { ...candidate, isOnline };
            }
            return candidate;
          });
          return changed ? { ...result, data } : result;
        },
      );
    },
    [organizationId, queryClient],
  );

  useEffect(() => {
    if (!organizationId || !actorId || !identityKey) return;
    if (typeof window === "undefined" || typeof WebSocket === "undefined") {
      return;
    }

    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let delay = 1000;
    let authRecheckAttempted = false;
    const timersMap = remoteTypingTimers.current;

    const setTypingForRoom = (
      updater: (
        prev: Record<string, Record<string, string>>,
      ) => Record<string, Record<string, string>>,
    ) => {
      setRuntime((prev) => {
        const baseTyping = prev.identity === identityKey ? prev.typing : {};
        const nextTyping = updater(baseTyping);
        if (prev.identity === identityKey && nextTyping === baseTyping) {
          return prev;
        }
        return {
          identity: identityKey,
          status: prev.identity === identityKey ? prev.status : "connecting",
          epoch: prev.identity === identityKey ? prev.epoch : 0,
          typing: nextTyping,
        };
      });
    };

    const scheduleReconnect = () => {
      if (stopped) return;
      useFloatingChatStore.getState().setRealtimeConnectedOwner(null);
      setRuntime((prev) => ({
        identity: identityKey,
        status: "reconnecting",
        epoch: prev.identity === identityKey ? prev.epoch : 0,
        typing: prev.identity === identityKey ? prev.typing : {},
      }));
      const cooldown = getChatWsCooldownRemainingMs(identityKey);
      const waitMs = Math.max(delay + Math.random() * 400, cooldown);
      reconnectTimer = setTimeout(() => void connect(), waitMs);
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
        const socket = new WebSocket(resolveChatRealtimeWsUrl(), [
          "continuum-chat.v1",
          `ticket.${ticket}`,
        ]);
        socketRef.current = socket;

        socket.onopen = () => {
          if (stopped) {
            socket.close();
            return;
          }
          delay = 1000;
          authRecheckAttempted = false;
        };

        socket.onmessage = (event) => {
          if (stopped) return;
          try {
            const packet = JSON.parse(String(event.data)) as {
              event?: unknown;
              data?: unknown;
            };

            if (packet.event === "connected") {
              useFloatingChatStore
                .getState()
                .setRealtimeConnectedOwner(identityKey);
              setRuntime((prev) => ({
                identity: identityKey,
                status: "connected",
                epoch: prev.epoch + 1,
                typing: prev.identity === identityKey ? prev.typing : {},
              }));
              void queryClient.invalidateQueries({
                queryKey: ["chat", organizationId],
              });
            } else if (
              packet.event === "message.created" &&
              isChatMessagePacket(packet.data)
            ) {
              const message = packet.data;
              queryClient.setQueryData<ChatPage<ChatMessage>>(
                chatKeys.messages(organizationId, message.conversationId),
                (page) => mergeChatMessage(page, message),
              );
              void queryClient.invalidateQueries({
                queryKey: chatKeys.conversations(organizationId),
              });
              if (
                openWindowIdsRef.current.includes(message.conversationId) &&
                message.senderId !== actorId
              ) {
                void chatApi
                  .markDelivered(message.conversationId, message.id)
                  .catch(() => undefined);
                if (document.visibilityState === "visible") {
                  void chatApi
                    .markRead(message.conversationId, message.id)
                    .catch(() => undefined);
                }
              }
            } else if (
              (packet.event === "message.updated" ||
                packet.event === "message.deleted") &&
              isChatMessagePacket(packet.data)
            ) {
              const message = packet.data;
              const current = queryClient.getQueryData<ChatPage<ChatMessage>>(
                chatKeys.messages(organizationId, message.conversationId),
              );
              const previous = current?.data.find(
                (item) => item.id === message.id,
              );
              queryClient.setQueryData<ChatPage<ChatMessage>>(
                chatKeys.messages(organizationId, message.conversationId),
                (page) =>
                  mergeChatMessage(
                    page,
                    preserveLocalReactions(message, previous),
                  ),
              );
              void queryClient.invalidateQueries({
                queryKey: chatKeys.messages(
                  organizationId,
                  message.conversationId,
                ),
              });
              void queryClient.invalidateQueries({
                queryKey: chatKeys.conversations(organizationId),
              });
            } else if (
              packet.event === "conversation.removed" &&
              typeof packet.data === "object" &&
              packet.data !== null &&
              "id" in packet.data &&
              typeof packet.data.id === "string"
            ) {
              useFloatingChatStore
                .getState()
                .removeConversation(organizationId, packet.data.id);
              void queryClient.invalidateQueries({
                queryKey: chatKeys.conversations(organizationId),
              });
            } else if (packet.event === "conversation.updated") {
              void queryClient.invalidateQueries({
                queryKey: ["chat", organizationId],
              });
            } else if (
              packet.event === "read.changed" &&
              typeof packet.data === "object" &&
              packet.data !== null &&
              "conversationId" in packet.data &&
              typeof packet.data.conversationId === "string" &&
              "userId" in packet.data &&
              typeof packet.data.userId === "string" &&
              "lastReadMessageId" in packet.data &&
              typeof packet.data.lastReadMessageId === "string" &&
              "lastReadAt" in packet.data &&
              typeof packet.data.lastReadAt === "string"
            ) {
              const readState = packet.data as {
                conversationId: string;
                userId: string;
                lastReadMessageId: string;
                lastReadAt: string;
              };
              void queryClient.invalidateQueries({
                queryKey: ["chat", organizationId, "notifications"],
              });
              queryClient.setQueryData<
                InfiniteData<ChatPage<ChatConversation>>
              >(chatKeys.conversations(organizationId), (current) => {
                if (!current) return current;
                return {
                  ...current,
                  pages: current.pages.map((page) => ({
                    ...page,
                    data: page.data.map((conversation) =>
                      conversation.id !== readState.conversationId
                        ? conversation
                        : {
                            ...conversation,
                            members: conversation.members.map((member) =>
                              member.userId !== readState.userId
                                ? member
                                : {
                                    ...member,
                                    lastReadMessageId:
                                      readState.lastReadMessageId,
                                    lastReadAt: readState.lastReadAt,
                                  },
                            ),
                          },
                    ),
                  })),
                };
              });
            } else if (
              packet.event === "delivery.changed" &&
              typeof packet.data === "object" &&
              packet.data !== null &&
              "conversationId" in packet.data &&
              typeof packet.data.conversationId === "string" &&
              "userId" in packet.data &&
              typeof packet.data.userId === "string" &&
              "lastDeliveredMessageId" in packet.data &&
              typeof packet.data.lastDeliveredMessageId === "string" &&
              "lastDeliveredAt" in packet.data &&
              typeof packet.data.lastDeliveredAt === "string"
            ) {
              const delivery = packet.data as {
                conversationId: string;
                userId: string;
                lastDeliveredMessageId: string;
                lastDeliveredAt: string;
              };
              queryClient.setQueryData<
                InfiniteData<ChatPage<ChatConversation>>
              >(chatKeys.conversations(organizationId), (current) =>
                current
                  ? {
                      ...current,
                      pages: current.pages.map((page) => ({
                        ...page,
                        data: page.data.map((conversation) =>
                          conversation.id !== delivery.conversationId
                            ? conversation
                            : {
                                ...conversation,
                                members: conversation.members.map((member) =>
                                  member.userId !== delivery.userId
                                    ? member
                                    : {
                                        ...member,
                                        lastDeliveredMessageId:
                                          delivery.lastDeliveredMessageId,
                                        lastDeliveredAt:
                                          delivery.lastDeliveredAt,
                                      },
                                ),
                              },
                        ),
                      })),
                    }
                  : current,
              );
            } else if (
              packet.event === "presence.changed" &&
              typeof packet.data === "object" &&
              packet.data !== null &&
              "userId" in packet.data &&
              typeof packet.data.userId === "string" &&
              "isOnline" in packet.data &&
              typeof packet.data.isOnline === "boolean"
            ) {
              updatePresence(packet.data.userId, packet.data.isOnline);
            } else if (
              packet.event === "presence.snapshot" &&
              typeof packet.data === "object" &&
              packet.data !== null &&
              "data" in packet.data &&
              Array.isArray(packet.data.data)
            ) {
              for (const presence of packet.data.data) {
                if (
                  typeof presence === "object" &&
                  presence !== null &&
                  "userId" in presence &&
                  typeof presence.userId === "string" &&
                  "isOnline" in presence &&
                  typeof presence.isOnline === "boolean"
                ) {
                  updatePresence(presence.userId, presence.isOnline);
                }
              }
            } else if (
              packet.event === "typing" &&
              typeof packet.data === "object" &&
              packet.data !== null &&
              "conversationId" in packet.data &&
              typeof packet.data.conversationId === "string" &&
              openWindowIdsRef.current.includes(packet.data.conversationId) &&
              "userId" in packet.data &&
              typeof packet.data.userId === "string" &&
              packet.data.userId !== actorId &&
              "displayName" in packet.data &&
              typeof packet.data.displayName === "string" &&
              "isTyping" in packet.data &&
              typeof packet.data.isTyping === "boolean"
            ) {
              const typingData = packet.data as {
                conversationId: string;
                userId: string;
                displayName: string;
                isTyping: boolean;
              };
              const timerKey = `${typingData.conversationId}:${typingData.userId}`;
              const existingTimer = timersMap.get(timerKey);
              if (existingTimer) clearTimeout(existingTimer);

              if (typingData.isTyping) {
                setTypingForRoom((current) => ({
                  ...current,
                  [typingData.conversationId]: {
                    ...(current[typingData.conversationId] ?? {}),
                    [typingData.userId]: typingData.displayName,
                  },
                }));
                timersMap.set(
                  timerKey,
                  setTimeout(() => {
                    setTypingForRoom((current) => {
                      const roomMap = current[typingData.conversationId];
                      if (!roomMap || !(typingData.userId in roomMap)) {
                        return current;
                      }
                      const nextRoom = { ...roomMap };
                      delete nextRoom[typingData.userId];
                      return {
                        ...current,
                        [typingData.conversationId]: nextRoom,
                      };
                    });
                    timersMap.delete(timerKey);
                  }, 2500),
                );
              } else {
                setTypingForRoom((current) => {
                  const roomMap = current[typingData.conversationId];
                  if (!roomMap || !(typingData.userId in roomMap)) {
                    return current;
                  }
                  const nextRoom = { ...roomMap };
                  delete nextRoom[typingData.userId];
                  return {
                    ...current,
                    [typingData.conversationId]: nextRoom,
                  };
                });
                timersMap.delete(timerKey);
              }
            } else if (
              packet.event === "notification.created" ||
              packet.event === "notification.read" ||
              packet.event === "notification.read_all"
            ) {
              void queryClient.invalidateQueries({
                queryKey: ["notifications"],
              });
            }
          } catch {
            // Ignore malformed realtime frames; persisted messages are fetched over HTTP.
          }
        };

        socket.onclose = (event) => {
          if (socketRef.current === socket) socketRef.current = null;
          if (stopped) return;
          if (event.code === 1008) {
            if (authRecheckAttempted) return;
            authRecheckAttempted = true;
            void refreshCurrentUser().then(
              scheduleReconnect,
              scheduleReconnect,
            );
          } else {
            scheduleReconnect();
          }
        };

        socket.onerror = () => socket.close();
      } catch (error) {
        if (stopped) return;
        useFloatingChatStore.getState().setRealtimeConnectedOwner(null);
        if (error instanceof ApiError && error.status === 401) {
          if (authRecheckAttempted) return;
          authRecheckAttempted = true;
          try {
            await refreshCurrentUser();
          } catch {
            return;
          }
          if (stopped) return;
        } else if (
          error instanceof ApiError &&
          (error.status === 403 || error.status === 404)
        ) {
          return;
        }
        scheduleReconnect();
      }
    };

    void connect();
    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      for (const timer of timersMap.values()) clearTimeout(timer);
      timersMap.clear();
      const store = useFloatingChatStore.getState();
      if (store.realtimeConnectedOwner === identityKey) {
        store.setRealtimeConnectedOwner(null);
      }
      socketRef.current?.close(1000, "Floating dock closed");
      socketRef.current = null;
    };
  }, [
    actorId,
    identityKey,
    organizationId,
    queryClient,
    refreshCurrentUser,
    updatePresence,
  ]);

  const openWindowKey = openWindowIds.join(",");
  useEffect(() => {
    if (connection !== "connected" || socketEpoch === 0 || !openWindowKey) {
      return;
    }
    const socket = socketRef.current;
    const ids = openWindowKey.split(",").filter(Boolean);
    for (const id of ids) {
      sendSocketFrame(socket, "subscribe", { conversationId: id });
    }
    return () => {
      for (const id of ids) {
        sendSocketFrame(socket, "unsubscribe", {
          conversationId: id,
        });
      }
    };
  }, [connection, openWindowKey, socketEpoch]);

  // Stable sorted key prevents re-sending presence.watch on every message/read/presence cache update.
  const watchedPeersKey = useMemo(() => {
    const directPeers = conversations
      .filter((conversation) => conversation.type === "DIRECT")
      .flatMap((conversation) =>
        conversation.members
          .filter((member) => member.userId !== actorId)
          .map((member) => member.userId),
      );
    const candidatePeers = cachedCandidateIdsKey
      ? cachedCandidateIdsKey.split(",").filter(Boolean)
      : [];
    return [...new Set([...directPeers, ...candidatePeers])]
      .sort()
      .slice(0, 100)
      .join(",");
  }, [actorId, cachedCandidateIdsKey, conversations]);

  useEffect(() => {
    if (connection !== "connected" || socketEpoch === 0 || !watchedPeersKey) {
      return;
    }
    const uniquePeers = watchedPeersKey.split(",").filter(Boolean);
    if (uniquePeers.length > 0) {
      sendSocketFrame(socketRef.current, "presence.watch", {
        userIds: uniquePeers,
      });
    }
  }, [connection, socketEpoch, watchedPeersKey]);

  const sendTyping = useCallback((conversationId: string, isTyping: boolean) => {
    if (!conversationId) return;
    sendSocketFrame(socketRef.current, "typing", {
      conversationId,
      isTyping,
    });
  }, []);

  return {
    connection,
    typingByConversation,
    sendTyping,
  };
}
