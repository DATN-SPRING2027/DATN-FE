"use client";

import AvatarText from "./ChatAvatar";
import ChatTools, { type ChatToolMode } from "./ChatTools";
import ChatDraftComposer from "./ChatDraftComposer";
import { chatFeatures } from "@/lib/queries/chat/features";
import { useChatNavigation } from "@/stores/chat-navigation";
import {
  ChatIcon,
  GroupIcon,
  SearchIcon,
  InfoIcon,
  MoreDotIcon,
} from "@/icons";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import {
  chatApi,
  chatKeys,
  type ChatCandidate,
  type ChatConversation,
  type ChatMessage,
  type ChatPage,
  useChatCandidatesQuery,
  useChatConversationsQuery,
  useChatMessageSearchQuery,
  useChatMessagesQuery,
  useChatMessageContextQuery,
  useCreateDirectMutation,
  useCreateRoomMutation,
} from "@/lib/queries/chat/useChat";
import {
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { ApiError } from "@/lib/api-client";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ChatDialog from "./ChatDialog";
import ChatMessageBubble from "./ChatMessageBubble";
import ChatSearchResults from "./ChatSearchResults";
import { sameMessageGroup } from "./message-layout";
import { preserveLocalReactions } from "./message-state";
import { hasReadMessage } from "./read-receipt";
import { foldSearchText } from "./search-text";

type ComposeMode = "direct" | "room" | null;
type ConnectionState = "connecting" | "connected" | "reconnecting";

function conversationName(conversation: ChatConversation, actorId: string) {
  if (conversation.type === "ROOM") return conversation.title ?? "";
  return (
    conversation.members.find((member) => member.userId !== actorId)
      ?.displayName ?? ""
  );
}

function mergeMessage(
  page: ChatPage<ChatMessage> | undefined,
  message: ChatMessage,
): ChatPage<ChatMessage> {
  const existing = page?.data ?? [];
  const replaced = existing.some((item) => item.id === message.id)
    ? existing.map((item) => (item.id === message.id ? message : item))
    : [...existing, message];
  return {
    data: replaced.sort(
      (left, right) =>
        Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
        left.id.localeCompare(right.id),
    ),
    nextCursor: page?.nextCursor ?? null,
  };
}

function isMessage(value: unknown): value is ChatMessage {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof value.id === "string" &&
    "conversationId" in value &&
    typeof value.conversationId === "string" &&
    "senderId" in value &&
    typeof value.senderId === "string" &&
    "content" in value &&
    typeof value.content === "string" &&
    "createdAt" in value &&
    typeof value.createdAt === "string" &&
    "replyTo" in value &&
    (value.replyTo === null ||
      (typeof value.replyTo === "object" &&
        value.replyTo !== null &&
        "id" in value.replyTo &&
        typeof value.replyTo.id === "string" &&
        "senderName" in value.replyTo &&
        typeof value.replyTo.senderName === "string" &&
        "preview" in value.replyTo &&
        typeof value.replyTo.preview === "string" &&
        "deleted" in value.replyTo &&
        typeof value.replyTo.deleted === "boolean"))
  );
}

function hasDeliveredMessage(
  participant: ChatConversation["members"][number],
  message: ChatMessage,
) {
  if (!participant.lastDeliveredMessageId || !participant.lastDeliveredAt)
    return false;
  const deliveredAt = Date.parse(participant.lastDeliveredAt);
  const messageAt = Date.parse(message.createdAt);
  return (
    deliveredAt > messageAt ||
    (deliveredAt === messageAt &&
      participant.lastDeliveredMessageId.localeCompare(message.id) >= 0)
  );
}

function sendSocketEvent(
  socket: WebSocket | null,
  event: string,
  data: unknown,
) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ event, data }));
  }
}

export default function ChatWorkspace() {
  const t = useTranslations("chat");
  const queryClient = useQueryClient();
  const currentUser = useCurrentUserQuery();
  const refreshCurrentUser = currentUser.refetch;
  const actorId = currentUser.data?.id ?? "";
  const organizationId =
    currentUser.data && "organizationId" in currentUser.data
      ? (currentUser.data.organizationId ?? "")
      : "";
  const conversationsQuery = useChatConversationsQuery(organizationId);
  const createDirect = useCreateDirectMutation(organizationId);
  const createRoom = useCreateRoomMutation(organizationId);
  const [tool, setTool] = useState<{
    mode: ChatToolMode;
    message?: ChatMessage;
    global?: boolean;
  } | null>(null);
  const navigationTarget = useChatNavigation((state) => state.target);
  const clearNavigation = useChatNavigation((state) => state.clear);
  const pendingContext = useRef("");
  const [activeId, setActiveId] = useState("");
  const [mobileListOpen, setMobileListOpen] = useState(false);
  const [activeFallback, setActiveFallback] = useState<{
    name: string;
    type: "DIRECT" | "ROOM";
    conversation?: ChatConversation;
  } | null>(null);
  const [composeMode, setComposeMode] = useState<ComposeMode>(null);
  const [conversationSearch, setConversationSearch] = useState("");
  const [debouncedConversationSearch, setDebouncedConversationSearch] =
    useState("");
  const [messageSearch, setMessageSearch] = useState("");
  const [debouncedMessageSearch, setDebouncedMessageSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [contextMessageId, setContextMessageId] = useState("");
  const [highlightedMessageId, setHighlightedMessageId] = useState("");
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [personSearch, setPersonSearch] = useState("");
  const [debouncedPersonSearch, setDebouncedPersonSearch] = useState("");
  const [roomTitle, setRoomTitle] = useState("");
  const [roomMembers, setRoomMembers] = useState<ChatCandidate[]>([]);
  const [sendError, setSendError] = useState(false);
  const [roomError, setRoomError] = useState(false);
  const [roomManagementOpen, setRoomManagementOpen] = useState(false);
  const [roomTitleDraft, setRoomTitleDraft] = useState("");
  const [roomManagementMembers, setRoomManagementMembers] = useState<
    ChatCandidate[]
  >([]);
  const [roomManagementError, setRoomManagementError] = useState(false);
  const [roomMutationPending, setRoomMutationPending] = useState(false);
  const [removeMemberId, setRemoveMemberId] = useState("");
  const [confirmLeaveRoom, setConfirmLeaveRoom] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const [olderMessagesError, setOlderMessagesError] = useState(false);
  const [messageActionError, setMessageActionError] = useState(false);
  const [connection, setConnection] = useState<ConnectionState>("connecting");
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({});
  const socketRef = useRef<WebSocket | null>(null);
  const activeIdRef = useRef(activeId);
  const localTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTypingTimers = useRef(
    new Map<string, ReturnType<typeof setTimeout>>(),
  );
  const pendingUploads = useRef(
    new Map<string, { fingerprint: string; ids: string[] }>(),
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const isLoadingEarlierRef = useRef(false);
  const roomCreation = useRef<{ fingerprint: string; id: string } | null>(null);

  activeIdRef.current = activeId;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPersonSearch(personSearch), 250);
    return () => clearTimeout(timer);
  }, [personSearch]);

  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedConversationSearch(conversationSearch.trim()),
      250,
    );
    return () => clearTimeout(timer);
  }, [conversationSearch]);

  const conversationSearchQuery = useChatConversationsQuery(
    organizationId,
    debouncedConversationSearch,
  );
  const visibleConversationsQuery = debouncedConversationSearch
    ? conversationSearchQuery
    : conversationsQuery;

  const defaultOrgMembersQuery = useChatCandidatesQuery(organizationId, "");
  const orgMembersQuery = useChatCandidatesQuery(
    organizationId,
    debouncedConversationSearch,
  );
  const candidatesQuery = useChatCandidatesQuery(
    organizationId,
    debouncedPersonSearch,
    Boolean(composeMode || roomManagementOpen),
  );
  const messagesQuery = useChatMessagesQuery(organizationId, activeId);
  const searchQuery = useChatMessageSearchQuery(
    organizationId,
    activeId,
    searchOpen ? debouncedMessageSearch : "",
  );
  useEffect(() => {
    const timer = setTimeout(
      () => setDebouncedMessageSearch(messageSearch.trim()),
      250,
    );
    return () => clearTimeout(timer);
  }, [messageSearch]);
  const conversations = useMemo(
    () => conversationsQuery.data?.pages.flatMap((page) => page.data) ?? [],
    [conversationsQuery.data],
  );
  const detailQuery = useQuery({
    queryKey: ["chat", organizationId, "detail", activeId],
    queryFn: () => chatFeatures.conversation(activeId),
    enabled: Boolean(activeId && organizationId),
    retry: false,
  });
  const openMessageContext = (
    message: Pick<ChatMessage, "id" | "conversationId">,
  ) => {
    setTool(null);
    setSearchOpen(false);
    setMobileListOpen(false);
    if (message.conversationId === activeId) setContextMessageId(message.id);
    else {
      pendingContext.current = message.id;
      setActiveId(message.conversationId);
      setActiveFallback(null);
    }
  };
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const conversationId = params.get("conversation");
    const messageId = params.get("message");
    if (
      conversationId &&
      messageId &&
      /^[a-f\d]{24}$/i.test(conversationId) &&
      /^[a-f\d]{24}$/i.test(messageId)
    ) {
      pendingContext.current = messageId;
      setActiveId(conversationId);
    }
  }, []);
  useEffect(() => {
    if (!navigationTarget) return;
    if (navigationTarget.conversationId === activeId)
      setContextMessageId(navigationTarget.messageId);
    else {
      pendingContext.current = navigationTarget.messageId;
      setActiveId(navigationTarget.conversationId);
    }
    setMobileListOpen(false);
    clearNavigation();
  }, [navigationTarget, activeId, clearNavigation]);
  const activeConversation =
    conversations.find((item) => item.id === activeId) ??
    conversationSearchQuery.data?.pages
      .flatMap((page) => page.data)
      .find((item) => item.id === activeId) ??
    detailQuery.data ??
    activeFallback?.conversation;
  const activeName = activeConversation
    ? conversationName(activeConversation, actorId)
    : (activeFallback?.name ?? "");
  const activeType = activeConversation?.type ?? activeFallback?.type;
  const contextQuery = useChatMessageContextQuery(
    organizationId,
    activeId,
    contextMessageId,
  );
  const displayedMessagesQuery = contextMessageId
    ? contextQuery
    : messagesQuery;
  const messages = displayedMessagesQuery.data?.data ?? [];
  const latestMessageId = messages.at(-1)?.id;
  const latestOwnMessage = [...messages]
    .reverse()
    .find((message) => message.senderId === actorId);
  const seenByCount = latestOwnMessage
    ? (activeConversation?.members.filter(
        (member) =>
          member.userId !== actorId && hasReadMessage(member, latestOwnMessage),
      ).length ?? 0)
    : 0;
  const deliveredByCount = latestOwnMessage
    ? (activeConversation?.members.filter(
        (member) =>
          member.userId !== actorId &&
          hasDeliveredMessage(member, latestOwnMessage),
      ).length ?? 0)
    : 0;
  const typingNames = Object.values(typingUsers);
  const typingStatus =
    typingNames.length === 1
      ? t("typing", { name: typingNames[0] })
      : typingNames.length === 2
        ? t("typingTwo", { first: typingNames[0], second: typingNames[1] })
        : typingNames.length > 2
          ? t("typingMany", {
              name: typingNames[0],
              count: typingNames.length - 1,
            })
          : "";
  const isRoomOwner =
    activeConversation?.members.some(
      (member) => member.userId === actorId && member.role === "OWNER",
    ) ?? false;
  const filteredConversations = useMemo(() => {
    const serverPages =
      visibleConversationsQuery.data?.pages.flatMap((page) => page.data) ?? [];
    if (!debouncedConversationSearch || !visibleConversationsQuery.isError) {
      return [...serverPages].sort(
        (a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)),
      );
    }
    const tokens = foldSearchText(debouncedConversationSearch)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return conversations
      .filter((conversation) => {
        const foldedLabel = foldSearchText(
          conversationName(conversation, actorId),
        );
        return (
          tokens.length === 0 ||
          tokens.every((token) => foldedLabel.includes(token))
        );
      })
      .sort((a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)));
  }, [
    actorId,
    conversations,
    debouncedConversationSearch,
    visibleConversationsQuery.data,
    visibleConversationsQuery.isError,
  ]);
  const searchResults =
    searchQuery.data?.pages.flatMap((page) => [...page.data].reverse()) ?? [];

  useEffect(() => {
    if (!activeId || !messagesQuery.dataUpdatedAt) return;
    void queryClient.invalidateQueries({
      queryKey: ["chat", organizationId, "search", activeId],
    });
  }, [activeId, messagesQuery.dataUpdatedAt, organizationId, queryClient]);

  useEffect(() => {
    if (!activeId && !conversationsQuery.isFetching && conversations[0]) {
      setActiveId(conversations[0].id);
      setActiveFallback(null);
    }
  }, [activeId, conversations, conversationsQuery.isFetching]);

  useEffect(() => {
    if (
      messagesQuery.error instanceof ApiError &&
      messagesQuery.error.status === 404
    ) {
      setActiveId("");
      setActiveFallback(null);
      setRoomManagementOpen(false);
    }
  }, [messagesQuery.error]);

  const updatePresence = useCallback(
    (userId: string, isOnline: boolean) => {
      queryClient.setQueriesData<
        InfiniteData<ChatPage<ChatConversation>, string | undefined>
      >({ queryKey: chatKeys.conversations(organizationId) }, (result) =>
        result
          ? {
              ...result,
              pages: result.pages.map((page) => ({
                ...page,
                data: page.data.map((conversation) => ({
                  ...conversation,
                  members: conversation.members.map((member) =>
                    member.userId === userId ? { ...member, isOnline } : member,
                  ),
                })),
              })),
            }
          : result,
      );
      queryClient.setQueriesData<{ data: readonly ChatCandidate[] }>(
        { queryKey: ["chat", organizationId, "candidates"] },
        (result) =>
          result
            ? {
                ...result,
                data: result.data.map((candidate) =>
                  candidate.id === userId
                    ? { ...candidate, isOnline }
                    : candidate,
                ),
              }
            : result,
      );
    },
    [organizationId, queryClient],
  );

  useEffect(() => {
    if (!organizationId || !actorId) return;
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let delay = 1000;

    const scheduleReconnect = () => {
      if (stopped) return;
      setConnection("reconnecting");
      reconnectTimer = setTimeout(
        () => void connect(),
        delay + Math.random() * 400,
      );
      delay = Math.min(delay * 2, 30_000);
    };

    const connect = async () => {
      try {
        const { ticket } = await chatApi.wsTicket();
        if (stopped) return;
        const defaultUrl = `${
          window.location.protocol === "https:" ? "wss:" : "ws:"
        }//${window.location.host}/internal/chat/ws`;
        const socket = new WebSocket(
          process.env.NEXT_PUBLIC_CHAT_WS_URL || defaultUrl,
          ["continuum-chat.v1", `ticket.${ticket}`],
        );
        socketRef.current = socket;
        socket.onopen = () => {
          if (stopped) return socket.close();
          delay = 1000;
        };
        socket.onmessage = (event) => {
          try {
            const packet = JSON.parse(String(event.data)) as {
              event?: unknown;
              data?: unknown;
            };
            if (packet.event === "connected") {
              setConnection("connected");
              void queryClient.invalidateQueries({
                queryKey: ["chat", organizationId],
              });
            } else if (
              packet.event === "message.created" &&
              isMessage(packet.data)
            ) {
              const message = packet.data;
              queryClient.setQueryData<ChatPage<ChatMessage>>(
                chatKeys.messages(organizationId, message.conversationId),
                (page) => mergeMessage(page, message),
              );
              void queryClient.invalidateQueries({
                queryKey: chatKeys.conversations(organizationId),
              });
              if (
                message.conversationId === activeIdRef.current &&
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
              isMessage(packet.data)
            ) {
              const message = packet.data as ChatMessage;
              const current = queryClient.getQueryData<ChatPage<ChatMessage>>(
                chatKeys.messages(organizationId, message.conversationId),
              );
              const previous = current?.data.find(
                (item) => item.id === message.id,
              );
              queryClient.setQueryData<ChatPage<ChatMessage>>(
                chatKeys.messages(organizationId, message.conversationId),
                (page) =>
                  mergeMessage(page, preserveLocalReactions(message, previous)),
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
              void queryClient.invalidateQueries({
                queryKey: chatKeys.conversations(organizationId),
              });
              if (activeIdRef.current === packet.data.id) {
                setActiveId("");
                setActiveFallback(null);
                setComposeMode(null);
                setRoomManagementOpen(false);
              }
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
                queryKey: [
                  "chat",
                  organizationId,
                  "tools",
                  "receipts",
                  readState.conversationId,
                ],
              });
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
              void queryClient.invalidateQueries({
                queryKey: [
                  "chat",
                  organizationId,
                  "tools",
                  "receipts",
                  delivery.conversationId,
                ],
              });
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
                )
                  updatePresence(presence.userId, presence.isOnline);
              }
            } else if (
              packet.event === "typing" &&
              typeof packet.data === "object" &&
              packet.data !== null &&
              "conversationId" in packet.data &&
              packet.data.conversationId === activeIdRef.current &&
              "userId" in packet.data &&
              packet.data.userId !== actorId &&
              "displayName" in packet.data &&
              typeof packet.data.displayName === "string" &&
              "isTyping" in packet.data &&
              typeof packet.data.isTyping === "boolean"
            ) {
              const typingData = packet.data as {
                userId: string;
                displayName: string;
                isTyping: boolean;
              };
              const userId = typingData.userId;
              const timer = remoteTypingTimers.current.get(userId);
              if (timer) clearTimeout(timer);
              if (typingData.isTyping) {
                setTypingUsers((current) => ({
                  ...current,
                  [userId]: typingData.displayName,
                }));
                remoteTypingTimers.current.set(
                  userId,
                  setTimeout(() => {
                    setTypingUsers((current) => {
                      const next = { ...current };
                      delete next[userId];
                      return next;
                    });
                    remoteTypingTimers.current.delete(userId);
                  }, 2500),
                );
              } else {
                setTypingUsers((current) => {
                  const next = { ...current };
                  delete next[userId];
                  return next;
                });
                remoteTypingTimers.current.delete(userId);
              }
            }
          } catch {
            // Ignore malformed realtime frames; persisted messages are fetched over HTTP.
          }
        };
        socket.onclose = (event) => {
          if (socketRef.current === socket) socketRef.current = null;
          if (!stopped && event.code === 1008) {
            void refreshCurrentUser().then(
              scheduleReconnect,
              scheduleReconnect,
            );
          } else if (!stopped) {
            scheduleReconnect();
          }
        };
        socket.onerror = () => socket.close();
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          try {
            await refreshCurrentUser();
          } catch {
            // The current-user query carries the terminal authentication error.
          }
        }
        scheduleReconnect();
      }
    };

    void connect();
    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socketRef.current?.close(1000, "Page closed");
      socketRef.current = null;
      setConnection("connecting");
    };
  }, [
    actorId,
    refreshCurrentUser,
    organizationId,
    queryClient,
    updatePresence,
  ]);

  useEffect(() => {
    if (connection !== "connected" || !activeId) return;
    sendSocketEvent(socketRef.current, "subscribe", {
      conversationId: activeId,
    });
    return () =>
      sendSocketEvent(socketRef.current, "unsubscribe", {
        conversationId: activeId,
      });
  }, [activeId, connection]);

  useEffect(() => {
    if (connection !== "connected") return;
    const peers = [
      ...conversations
        .filter((conversation) => conversation.type === "DIRECT")
        .flatMap((conversation) =>
          conversation.members
            .filter((member) => member.userId !== actorId)
            .map((member) => member.userId),
        ),
      ...(orgMembersQuery.data?.data
        .filter((member) => member.id !== actorId)
        .map((member) => member.id) ?? []),
    ];
    sendSocketEvent(socketRef.current, "presence.watch", {
      userIds: [...new Set(peers)].slice(0, 100),
    });
  }, [actorId, connection, conversations, orgMembersQuery.data]);

  useEffect(() => {
    if (!latestMessageId || !activeId) return;
    void chatApi
      .markDelivered(activeId, latestMessageId)
      .catch(() => undefined);
    const markVisibleRead = () => {
      if (document.visibilityState !== "visible") return;
      void chatApi
        .markRead(activeId, latestMessageId)
        .then(() =>
          queryClient.invalidateQueries({
            queryKey: chatKeys.conversations(organizationId),
          }),
        )
        .catch(() => undefined);
    };
    markVisibleRead();
    document.addEventListener("visibilitychange", markVisibleRead);
    return () =>
      document.removeEventListener("visibilitychange", markVisibleRead);
  }, [activeId, latestMessageId, organizationId, queryClient]);

  useEffect(() => {
    if (!latestMessageId || contextMessageId) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [activeId, latestMessageId, contextMessageId]);

  useEffect(() => {
    setTypingUsers({});
    setMessageSearch("");
    setContextMessageId(pendingContext.current);
    pendingContext.current = "";
    setHighlightedMessageId("");
    setSearchOpen(false);
    setReplyingTo(null);
    for (const timer of remoteTypingTimers.current.values())
      clearTimeout(timer);
    remoteTypingTimers.current.clear();
    if (localTypingTimer.current) clearTimeout(localTypingTimer.current);
  }, [activeId]);

  const sendTyping = useCallback((isTyping: boolean) => {
    sendSocketEvent(socketRef.current, "typing", {
      conversationId: activeIdRef.current,
      isTyping,
    });
  }, []);

  const onComposerTyping = (isTyping: boolean) => {
    sendTyping(isTyping);
    if (localTypingTimer.current) clearTimeout(localTypingTimer.current);
    if (isTyping) {
      localTypingTimer.current = setTimeout(() => sendTyping(false), 1800);
    }
  };

  const sendMessage = async (
    content: string,
    clientMessageId: string,
    files: readonly File[] = [],
    replyToMessageId?: string,
    mentionUserIds: readonly string[] = [],
  ): Promise<boolean> => {
    if (!activeId) return false;
    setIsSending(true);
    setSendError(false);
    try {
      const fingerprint = files
        .map(
          (file) =>
            `${file.name}:${file.size}:${file.type}:${file.lastModified}`,
        )
        .join("|");
      const cached = pendingUploads.current.get(clientMessageId);
      const pending =
        cached?.fingerprint === fingerprint ? cached : { fingerprint, ids: [] };
      pendingUploads.current.set(clientMessageId, pending);
      while (pending.ids.length < files.length) {
        const uploadId = await chatApi.uploadAttachment(
          activeId,
          files[pending.ids.length],
        );
        pending.ids.push(uploadId);
      }
      const message = await chatApi.sendMessage(activeId, {
        clientMessageId,
        content: content.trim(),
        ...(pending.ids.length > 0 ? { attachments: pending.ids } : {}),
        ...(replyToMessageId ? { replyToMessageId } : {}),
        mentionUserIds,
      });
      pendingUploads.current.delete(clientMessageId);
      queryClient.setQueryData<ChatPage<ChatMessage>>(
        chatKeys.messages(organizationId, activeId),
        (page) => mergeMessage(page, message),
      );
      if (replyToMessageId) {
        setReplyingTo((current) =>
          current?.id === replyToMessageId ? null : current,
        );
      }
      await queryClient.invalidateQueries({
        queryKey: chatKeys.conversations(organizationId),
      });
      return true;
    } catch {
      setSendError(true);
      return false;
    } finally {
      setIsSending(false);
    }
  };

  const saveMessageEdit = async (
    messageId: string,
    content: string,
  ): Promise<boolean> => {
    if (!activeId || !content.trim()) return false;
    setMessageActionError(false);
    try {
      const updated = await chatApi.editMessage(
        activeId,
        messageId,
        content,
        messages
          .find((message) => message.id === messageId)
          ?.mentionUserIds?.filter((id) => {
            const person = activeConversation?.members.find(
              (member) => member.userId === id,
            );
            return person && content.includes(`@${person.displayName}`);
          }),
      );
      queryClient.setQueryData<ChatPage<ChatMessage>>(
        chatKeys.messages(organizationId, activeId),
        (page) => mergeMessage(page, updated),
      );
      await queryClient.invalidateQueries({
        queryKey: chatKeys.messages(organizationId, activeId),
      });
      await queryClient.invalidateQueries({
        queryKey: chatKeys.conversations(organizationId),
      });
      return true;
    } catch {
      setMessageActionError(true);
      return false;
    }
  };

  const deleteChatMessage = async (messageId: string): Promise<boolean> => {
    if (!activeId) return false;
    setMessageActionError(false);
    try {
      const updated = await chatApi.deleteMessage(activeId, messageId);
      queryClient.setQueryData<ChatPage<ChatMessage>>(
        chatKeys.messages(organizationId, activeId),
        (page) => mergeMessage(page, updated),
      );
      await queryClient.invalidateQueries({
        queryKey: chatKeys.messages(organizationId, activeId),
      });
      await queryClient.invalidateQueries({
        queryKey: chatKeys.conversations(organizationId),
      });
      return true;
    } catch {
      setMessageActionError(true);
      return false;
    }
  };

  const setReaction = async (
    message: ChatMessage,
    emoji: string,
    active: boolean,
  ) => {
    if (!activeId) return;
    setMessageActionError(false);
    try {
      const updated = await chatApi.setReaction(
        activeId,
        message.id,
        emoji,
        active,
      );
      queryClient.setQueryData<ChatPage<ChatMessage>>(
        chatKeys.messages(organizationId, activeId),
        (page) => mergeMessage(page, updated),
      );
      await queryClient.invalidateQueries({
        queryKey: chatKeys.messages(organizationId, activeId),
      });
    } catch {
      setMessageActionError(true);
    }
  };

  const loadEarlier = async () => {
    const cursor = displayedMessagesQuery.data?.nextCursor;
    const conversationId = activeIdRef.current;
    if (!conversationId || !cursor || isLoadingEarlierRef.current) return;
    isLoadingEarlierRef.current = true;
    const container = scrollRef.current;
    const priorHeight = container?.scrollHeight ?? 0;
    const priorTop = container?.scrollTop ?? 0;
    setIsLoadingEarlier(true);
    setOlderMessagesError(false);
    try {
      const older = await chatApi.olderMessages(conversationId, cursor);
      queryClient.setQueryData<ChatPage<ChatMessage>>(
        contextMessageId
          ? chatKeys.context(organizationId, conversationId, contextMessageId)
          : chatKeys.messages(organizationId, conversationId),
        (page) => ({
          data: [...older.data, ...(page?.data ?? [])].filter(
            (message, index, all) =>
              all.findIndex((item) => item.id === message.id) === index,
          ),
          nextCursor: older.nextCursor,
        }),
      );
      requestAnimationFrame(() => {
        const current = scrollRef.current;
        if (current && activeIdRef.current === conversationId) {
          current.scrollTop = priorTop + current.scrollHeight - priorHeight;
        }
      });
    } catch {
      setOlderMessagesError(true);
    } finally {
      isLoadingEarlierRef.current = false;
      setIsLoadingEarlier(false);
    }
  };

  const handleMessageScroll = () => {
    if (scrollRef.current && scrollRef.current.scrollTop <= 72) {
      void loadEarlier();
    }
  };

  const closeCompose = () => {
    setComposeMode(null);
    setPersonSearch("");
    setRoomTitle("");
    setRoomMembers([]);
    setRoomError(false);
    createDirect.reset();
    createRoom.reset();
  };

  const toggleCompose = (mode: Exclude<ComposeMode, null>) => {
    setRoomManagementOpen(false);
    setSearchOpen(false);
    if (composeMode === mode) {
      closeCompose();
      return;
    }
    setComposeMode(mode);
    setPersonSearch("");
    setRoomTitle("");
    setRoomMembers([]);
    setRoomError(false);
    createDirect.reset();
    createRoom.reset();
  };

  const openConversation = (conversation: ChatConversation) => {
    if (conversation.markedUnread)
      void chatFeatures
        .setPreferences(conversation.id, { markedUnread: false })
        .then(() =>
          queryClient.invalidateQueries({ queryKey: ["chat", organizationId] }),
        )
        .catch(() => setMessageActionError(true));
    setActiveId(conversation.id);
    setMobileListOpen(false);
    setActiveFallback({
      name: conversationName(conversation, actorId),
      type: conversation.type,
      conversation,
    });
    closeCompose();
    setRoomManagementOpen(false);
    setRoomManagementMembers([]);
    setPersonSearch("");
  };

  const openDirect = (candidate: ChatCandidate) => {
    createDirect.mutate(candidate.id, {
      onSuccess: ({ id }) => {
        setActiveId(id);
        setMobileListOpen(false);
        setActiveFallback({ name: candidate.fullName, type: "DIRECT" });
        closeCompose();
        setRoomManagementOpen(false);
        setPersonSearch("");
      },
    });
  };

  const toggleRoomMember = (candidate: ChatCandidate) => {
    setRoomMembers((selected) =>
      selected.some((member) => member.id === candidate.id)
        ? selected.filter((member) => member.id !== candidate.id)
        : [...selected, candidate],
    );
  };

  const submitRoom = () => {
    if (!roomTitle.trim() || roomMembers.length === 0) {
      setRoomError(true);
      return;
    }
    setRoomError(false);
    const participantIds = roomMembers.map((member) => member.id);
    const fingerprint = JSON.stringify([roomTitle.trim(), participantIds]);
    const clientRoomId =
      roomCreation.current?.fingerprint === fingerprint
        ? roomCreation.current.id
        : crypto.randomUUID();
    roomCreation.current = { fingerprint, id: clientRoomId };
    createRoom.mutate(
      {
        title: roomTitle.trim(),
        participantIds,
        clientRoomId,
      },
      {
        onSuccess: ({ id }) => {
          roomCreation.current = null;
          setActiveId(id);
          setMobileListOpen(false);
          setActiveFallback({ name: roomTitle.trim(), type: "ROOM" });
          closeCompose();
          setRoomManagementOpen(false);
          setPersonSearch("");
          setRoomTitle("");
          setRoomMembers([]);
        },
      },
    );
  };

  const saveRoomTitle = async () => {
    const title = roomTitleDraft.trim();
    if (!activeId || !title || !isRoomOwner) return;
    setRoomManagementError(false);
    setRoomMutationPending(true);
    try {
      await chatApi.renameRoom(activeId, title);
      await queryClient.invalidateQueries({
        queryKey: chatKeys.conversations(organizationId),
      });
    } catch {
      setRoomManagementError(true);
    } finally {
      setRoomMutationPending(false);
    }
  };

  const toggleRoomManagementMember = (candidate: ChatCandidate) => {
    setRoomManagementMembers((selected) =>
      selected.some((member) => member.id === candidate.id)
        ? selected.filter((member) => member.id !== candidate.id)
        : [...selected, candidate],
    );
  };

  const addRoomManagementMembers = async () => {
    if (!activeId || roomManagementMembers.length === 0 || !isRoomOwner) return;
    setRoomManagementError(false);
    setRoomMutationPending(true);
    try {
      await chatApi.addRoomMembers(
        activeId,
        roomManagementMembers.map((member) => member.id),
      );
      setRoomManagementMembers([]);
      setPersonSearch("");
      await queryClient.invalidateQueries({
        queryKey: chatKeys.conversations(organizationId),
      });
    } catch {
      setRoomManagementError(true);
    } finally {
      setRoomMutationPending(false);
    }
  };

  const removeRoomMember = async (userId: string) => {
    if (!activeId || !isRoomOwner) return;
    setRoomManagementError(false);
    setRoomMutationPending(true);
    try {
      await chatApi.removeRoomMember(activeId, userId);
      setRemoveMemberId("");
      await queryClient.invalidateQueries({
        queryKey: chatKeys.conversations(organizationId),
      });
    } catch {
      setRoomManagementError(true);
    } finally {
      setRoomMutationPending(false);
    }
  };

  const leaveRoom = async () => {
    if (!activeId || isRoomOwner) return;
    setRoomManagementError(false);
    setRoomMutationPending(true);
    try {
      await chatApi.leaveRoom(activeId);
      await queryClient.invalidateQueries({
        queryKey: chatKeys.conversations(organizationId),
      });
      setActiveId("");
      setActiveFallback(null);
      setRoomManagementOpen(false);
      setConfirmLeaveRoom(false);
    } catch {
      setRoomManagementError(true);
    } finally {
      setRoomMutationPending(false);
    }
  };

  const connectionLabel =
    connection === "connected"
      ? t("live")
      : connection === "connecting"
        ? t("connecting")
        : t("connectionLost");
  const orgMembers = useMemo(
    () => orgMembersQuery.data?.data ?? [],
    [orgMembersQuery.data],
  );
  const orgMemberById = useMemo(
    () =>
      new Map(
        [...(defaultOrgMembersQuery.data?.data ?? []), ...orgMembers].map(
          (member) => [member.id, member],
        ),
      ),
    [defaultOrgMembersQuery.data, orgMembers],
  );
  const directPeerIds = useMemo(() => {
    const ids = new Set<string>();
    for (const conversation of filteredConversations) {
      if (conversation.type !== "DIRECT") continue;
      for (const member of conversation.members) {
        if (member.userId !== actorId) ids.add(member.userId);
      }
    }
    return ids;
  }, [actorId, filteredConversations]);
  const sidebarOrgMembers = useMemo(
    () =>
      orgMembers.filter(
        (member) => member.id !== actorId && !directPeerIds.has(member.id),
      ),
    [actorId, directPeerIds, orgMembers],
  );
  const candidateResults = useMemo(() => {
    const trimmedInput = personSearch.trim();
    const trimmedDebounced = debouncedPersonSearch.trim();
    if (trimmedInput === trimmedDebounced && candidatesQuery.data?.data) {
      return candidatesQuery.data.data;
    }
    const baseList =
      candidatesQuery.data?.data ??
      defaultOrgMembersQuery.data?.data ??
      orgMembers;
    if (!trimmedInput) return baseList;
    const tokens = foldSearchText(trimmedInput)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    const lowerInput = trimmedInput.toLowerCase();
    return baseList.filter((member) => {
      const foldedName = foldSearchText(member.fullName);
      const lowerEmail = member.email?.toLowerCase() ?? "";
      return (
        (tokens.length > 0 &&
          tokens.every(
            (token) =>
              foldedName.includes(token) || lowerEmail.includes(token),
          )) ||
        lowerEmail.includes(lowerInput)
      );
    });
  }, [
    candidatesQuery.data,
    debouncedPersonSearch,
    defaultOrgMembersQuery.data,
    orgMembers,
    personSearch,
  ]);
  useEffect(() => {
    if (!contextMessageId || !contextQuery.data) return;
    const target = document.getElementById(`chat-message-${contextMessageId}`);
    target?.scrollIntoView?.({ block: "center", behavior: "smooth" });
    target?.focus({ preventScroll: true });
    setHighlightedMessageId(contextMessageId);
    const timer = setTimeout(() => setHighlightedMessageId(""), 3000);
    return () => clearTimeout(timer);
  }, [contextMessageId, contextQuery.data]);

  const roomCandidates = candidateResults.filter(
    (candidate) =>
      !activeConversation?.members.some(
        (member) => member.userId === candidate.id,
      ),
  );

  return (
    <section
      aria-label={t("title")}
      className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white dark:bg-gray-900"
    >
      <div className="grid min-h-0 flex-1 overflow-hidden md:grid-cols-[20rem_minmax(0,1fr)]">
        <aside
          className={`min-h-0 min-w-0 flex-col border-e border-gray-200 dark:border-gray-800 ${activeId && !mobileListOpen ? "hidden md:flex" : "flex"}`}
        >
          <div className="space-y-3 border-b border-gray-200 p-4 dark:border-gray-800">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h1 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                  {t("title")}
                </h1>
                <span
                  role="status"
                  aria-label={connectionLabel}
                  title={connectionLabel}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400"
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 rounded-full ${connection === "connected" ? "bg-success-500" : "bg-warning-500"}`}
                  />
                  {connectionLabel}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    toggleCompose("direct");
                    setPersonSearch("");
                  }}
                  aria-label={t("newMessage")}
                  title={t("newMessage")}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-2 text-xs font-medium whitespace-nowrap text-gray-700 transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-transparent dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <ChatIcon viewBox="1 1.1 22 22" className="size-4 shrink-0" />
                  {t("newMessage")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toggleCompose("room");
                    setPersonSearch("");
                  }}
                  aria-label={t("newRoom")}
                  title={t("newRoom")}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-2 text-xs font-medium whitespace-nowrap text-gray-700 transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-transparent dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <GroupIcon viewBox="0.5 0.5 23 23" className="size-4 shrink-0" />
                  {t("newRoom")}
                </button>
              </div>
            </div>
            <label className="relative block">
              <span className="sr-only">{t("searchConversations")}</span>
              <input
                value={conversationSearch}
                maxLength={80}
                onChange={(event) => setConversationSearch(event.target.value)}
                placeholder={t("searchConversations")}
                className="h-10 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {visibleConversationsQuery.isLoading ? (
              <ul
                role="status"
                aria-label={t("loading")}
                className="space-y-1 px-1 py-2"
              >
                {Array.from({ length: 6 }, (_, index) => (
                  <li key={index} className="flex items-center gap-3 px-2 py-3">
                    <span className="h-11 w-11 shrink-0 animate-pulse bg-gray-200 dark:bg-gray-800" />
                    <span className="min-w-0 flex-1 space-y-2">
                      <span className="block h-3 w-2/3 animate-pulse bg-gray-200 dark:bg-gray-800" />
                      <span className="block h-3 w-full animate-pulse bg-gray-100 dark:bg-gray-800/70" />
                    </span>
                  </li>
                ))}
              </ul>
            ) : visibleConversationsQuery.isError &&
              filteredConversations.length === 0 &&
              sidebarOrgMembers.length === 0 ? (
              <div className="space-y-2 px-3 py-5 text-sm text-error-600 dark:text-error-400">
                <p>{t("conversationError")}</p>
                <button
                  type="button"
                  onClick={() => void visibleConversationsQuery.refetch()}
                  className="font-semibold underline underline-offset-2"
                >
                  {t("connectionLost")}
                </button>
              </div>
            ) : filteredConversations.length === 0 &&
              sidebarOrgMembers.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                  {t(
                    debouncedConversationSearch
                      ? "noConversationMatches"
                      : "noConversations",
                  )}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    debouncedConversationSearch
                      ? setConversationSearch("")
                      : toggleCompose("direct")
                  }
                  className="mt-3 text-sm font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-300"
                >
                  {t(
                    debouncedConversationSearch
                      ? "clearSearch"
                      : "startConversation",
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredConversations.length > 0 && (
                  <ul className="space-y-1">
                    {filteredConversations.map((conversation) => {
                      const name = conversationName(conversation, actorId);
                      const peer = conversation.members.find(
                        (member) => member.userId !== actorId,
                      );
                      const peerEmail =
                        conversation.type === "DIRECT" && peer
                          ? orgMemberById.get(peer.userId)?.email
                          : undefined;
                      return (
                        <li key={conversation.id}>
                          <button
                            type="button"
                            aria-current={
                              activeId === conversation.id ? "true" : undefined
                            }
                            onClick={() => openConversation(conversation)}
                            className={`flex w-full items-center gap-3 rounded-md p-3 text-start transition focus-visible:outline-2 focus-visible:outline-brand-500 ${activeId === conversation.id ? "bg-brand-50 dark:bg-brand-500/10" : "hover:bg-gray-50 dark:hover:bg-gray-800/70"}`}
                          >
                            <span className="relative shrink-0">
                              <AvatarText
                                src={
                                  conversation.type === "DIRECT"
                                    ? peer?.avatarUrl
                                    : null
                                }
                                name={name || t("title")}
                                className="h-11 w-11"
                              />
                              {conversation.type === "DIRECT" && (
                                <span
                                  className={`absolute end-0 bottom-0 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900 ${peer?.isOnline ? "bg-success-500" : "bg-gray-300"}`}
                                />
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center justify-between gap-2">
                                <span
                                  title={name}
                                  className="line-clamp-2 text-sm leading-5 font-semibold break-words text-gray-900 dark:text-white"
                                >
                                  {conversation.isPinned && (
                                    <span
                                      className="me-1 text-xs text-brand-500"
                                      title={t("pinnedConversation")}
                                    >
                                      ◆
                                    </span>
                                  )}
                                  {name}
                                </span>
                              </span>
                              {peerEmail && (
                                <span className="block truncate text-[11px] text-gray-500 dark:text-gray-400">
                                  {peerEmail}
                                </span>
                              )}
                              <span className="mt-1 flex items-center justify-between gap-2">
                                <span className="truncate text-xs text-gray-500 dark:text-gray-400">
                                  {conversation.lastMessagePreview ||
                                    t("messageEmpty")}
                                </span>
                                {conversation.lastMessageAt && (
                                  <time className="shrink-0 text-[11px] text-gray-400">
                                    {new Date(
                                      conversation.lastMessageAt,
                                    ).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </time>
                                )}
                                {(conversation.unreadCount > 0 ||
                                  conversation.markedUnread) && (
                                  <span
                                    aria-label={t("unread", {
                                      count: conversation.unreadCount,
                                    })}
                                    className="rounded-full bg-brand-500 px-1.5 py-0.5 text-[10px] font-bold text-white"
                                  >
                                    {conversation.unreadCount || "•"}
                                  </span>
                                )}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {sidebarOrgMembers.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="px-3 text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                      {t("organizationMembers") === "chat.organizationMembers"
                        ? "Organization members"
                        : t("organizationMembers")}
                    </p>
                    {!composeMode && createDirect.isError && (
                      <p
                        role="alert"
                        className="px-3 text-xs text-error-600 dark:text-error-400"
                      >
                        {t("conversationError")}
                      </p>
                    )}
                    <ul className="space-y-1">
                      {sidebarOrgMembers.map((member) => (
                        <li key={member.id}>
                          <button
                            type="button"
                            disabled={createDirect.isPending}
                            onClick={() => openDirect(member)}
                            aria-label={t("startChatWith", {
                              name: member.fullName,
                            })}
                            className="flex w-full items-center gap-3 rounded-md p-3 text-start transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 dark:hover:bg-gray-800/70"
                          >
                            <span className="relative shrink-0">
                              <AvatarText
                                src={member.avatarUrl}
                                name={member.fullName}
                                className="h-11 w-11"
                              />
                              <span
                                className={`absolute end-0 bottom-0 h-3 w-3 rounded-full border-2 border-white dark:border-gray-900 ${member.isOnline ? "bg-success-500" : "bg-gray-300"}`}
                              />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">
                                {member.fullName}
                              </span>
                              {member.email && (
                                <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                                  {member.email}
                                </span>
                              )}
                              <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${member.isOnline ? "bg-success-500" : "bg-gray-300"}`}
                                />
                                {member.isOnline ? t("online") : t("offline")}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-200 pt-3 dark:border-gray-700">
              <button
                className="rounded-lg px-2 py-2 text-xs text-brand-600 dark:text-brand-300"
                onClick={() => setTool({ mode: "search", global: true })}
              >
                {t("advancedSearch")}
              </button>
              <button
                className="rounded-lg px-2 py-2 text-xs text-gray-600 dark:text-gray-400"
                onClick={() => setTool({ mode: "archived", global: true })}
              >
                {t("archivedConversations")}
              </button>
            </div>
            {visibleConversationsQuery.hasNextPage && (
              <button
                type="button"
                onClick={() => void visibleConversationsQuery.fetchNextPage()}
                disabled={visibleConversationsQuery.isFetchingNextPage}
                className="mt-2 w-full rounded-lg px-3 py-2 text-xs font-semibold text-brand-600 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
              >
                {t(
                  visibleConversationsQuery.isFetchingNextPage
                    ? "loading"
                    : "loadMoreConversations",
                )}
              </button>
            )}
          </div>
        </aside>

        <main
          className={`relative min-h-0 min-w-0 flex-col ${activeId && !mobileListOpen ? "flex" : "hidden md:flex"}`}
        >
          {activeId ? (
            <>
              <header className="flex shrink-0 items-center gap-2 border-b border-gray-200 px-3 py-2 sm:gap-3 sm:px-4 sm:py-3 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setMobileListOpen(true)}
                  aria-label={t("title")}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 md:hidden dark:hover:bg-gray-800"
                >
                  <span aria-hidden="true">←</span>
                </button>
                <AvatarText
                  src={
                    activeType === "DIRECT"
                      ? activeConversation?.members.find(
                          (member) => member.userId !== actorId,
                        )?.avatarUrl
                      : null
                  }
                  name={activeName || t("title")}
                  className="h-10 w-10 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <h2
                    title={activeName}
                    className="line-clamp-2 text-sm leading-4 font-semibold break-words text-gray-900 sm:leading-5 dark:text-white"
                  >
                    {activeName || t("title")}
                  </h2>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    {activeType === "ROOM"
                      ? t("members", {
                          count: activeConversation?.members.length ?? 0,
                        })
                      : activeConversation?.members.find(
                            (member) => member.userId !== actorId,
                          )?.isOnline
                        ? t("online")
                        : t("offline")}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={t("conversationTools")}
                  title={t("conversationTools")}
                  onClick={() => {
                    setTool({ mode: "tools" });
                    setSearchOpen(false);
                    setRoomManagementOpen(false);
                  }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <MoreDotIcon width={20} height={20} className="h-5 w-5 shrink-0" />
                </button>
                <button
                  type="button"
                  aria-label={t("searchMessages")}
                  title={t("searchMessages")}
                  aria-expanded={searchOpen}
                  onClick={() => {
                    setSearchOpen(!searchOpen);
                    setRoomManagementOpen(false);
                    closeCompose();
                  }}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <SearchIcon width={20} height={20} className="h-5 w-5 shrink-0" />
                </button>
                {activeType === "DIRECT" && (
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${activeConversation?.members.find((member) => member.userId !== actorId)?.isOnline ? "bg-success-500" : "bg-gray-300"}`}
                  />
                )}
                {activeType === "ROOM" && (
                  <button
                    type="button"
                    aria-label={t("manageRoom")}
                    title={t("manageRoom")}
                    aria-expanded={roomManagementOpen}
                    onClick={() => {
                      const opening = !roomManagementOpen;
                      setRoomManagementOpen(opening);
                      setSearchOpen(false);
                      closeCompose();
                      setRoomManagementMembers([]);
                      setRoomManagementError(false);
                      setPersonSearch("");
                      setRemoveMemberId("");
                      setConfirmLeaveRoom(false);
                      if (opening)
                        setRoomTitleDraft(activeConversation?.title ?? "");
                    }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <InfoIcon width={20} height={20} className="h-5 w-5 shrink-0" />
                  </button>
                )}
              </header>

              {contextMessageId && (
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-brand-100 bg-brand-50 px-4 py-2 text-xs text-brand-800 dark:border-brand-900 dark:bg-brand-500/10 dark:text-brand-200">
                  <span>{t("viewingMessageContext")}</span>
                  <button
                    type="button"
                    onClick={() => setContextMessageId("")}
                    className="min-h-9 rounded-lg px-2 font-semibold hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-brand-900"
                  >
                    {t("backToLatest")}
                  </button>
                </div>
              )}
              <div
                ref={scrollRef}
                onScroll={handleMessageScroll}
                className="min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-5 md:px-6"
              >
                {(isLoadingEarlier || olderMessagesError) && (
                  <div
                    role={olderMessagesError ? "alert" : "status"}
                    className="flex justify-center py-1 text-xs text-gray-500 dark:text-gray-400"
                  >
                    {olderMessagesError
                      ? t("messageError")
                      : t("loadingMessages")}
                  </div>
                )}
                {displayedMessagesQuery.isLoading ? (
                  <div
                    role="status"
                    aria-label={t("loadingMessages")}
                    className="space-y-4 py-1"
                  >
                    {Array.from({ length: 6 }, (_, index) => (
                      <div
                        key={index}
                        className={`flex ${index % 2 === 0 ? "justify-start" : "justify-end"}`}
                      >
                        <div className="w-56 space-y-2">
                          <span className="block h-3 w-24 animate-pulse bg-gray-200 dark:bg-gray-800" />
                          <span
                            className={`block h-12 animate-pulse bg-gray-200 dark:bg-gray-800 ${index % 2 === 0 ? "w-5/6" : "w-full"}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : displayedMessagesQuery.isError ? (
                  <p
                    role="alert"
                    className="py-8 text-center text-sm text-error-600 dark:text-error-400"
                  >
                    {t("messageError")}
                  </p>
                ) : messages.length === 0 ? (
                  <div className="flex h-full min-h-56 flex-col items-center justify-center text-center">
                    <AvatarText
                      name={activeName || t("title")}
                      className="h-14 w-14"
                    />
                    <p className="mt-4 max-w-xs text-sm text-gray-500 dark:text-gray-400">
                      {t("messageEmpty")}
                    </p>
                  </div>
                ) : (
                  messages.map((message, index) => {
                    const mine = message.senderId === actorId;
                    const receipt =
                      mine &&
                      message.id === latestOwnMessage?.id &&
                      (seenByCount > 0 || deliveredByCount > 0)
                        ? seenByCount > 0
                          ? activeType === "ROOM"
                            ? t("seenBy", { count: seenByCount })
                            : t("seen")
                          : activeType === "ROOM"
                            ? t("deliveredBy", { count: deliveredByCount })
                            : t("delivered")
                        : undefined;
                    return (
                      <ChatMessageBubble
                        key={message.id}
                        message={message}
                        mine={mine}
                        showSender={!mine && activeType === "ROOM"}
                        groupStart={
                          !sameMessageGroup(messages[index - 1], message)
                        }
                        groupEnd={
                          !sameMessageGroup(message, messages[index + 1])
                        }
                        highlighted={highlightedMessageId === message.id}
                        receipt={receipt}
                        onOpenContext={(id) =>
                          openMessageContext({
                            id,
                            conversationId: message.conversationId,
                          })
                        }
                        onForward={() => setTool({ mode: "forward", message })}
                        onPin={() => {
                          void chatFeatures
                            .pin(activeId, message.id, !message.isPinned)
                            .then(() =>
                              queryClient.invalidateQueries({
                                queryKey: ["chat", organizationId],
                              }),
                            )
                            .catch(() => setMessageActionError(true));
                        }}
                        onReceipts={
                          mine
                            ? () => setTool({ mode: "receipts", message })
                            : undefined
                        }
                        onReport={() => setTool({ mode: "report", message })}
                        onReply={() => setReplyingTo(message)}
                        onEdit={(content) =>
                          saveMessageEdit(message.id, content)
                        }
                        onDelete={() => deleteChatMessage(message.id)}
                        onReaction={(emoji, active) =>
                          setReaction(message, emoji, active)
                        }
                      />
                    );
                  })
                )}
                {typingStatus && (
                  <p
                    aria-live="polite"
                    className="text-xs text-gray-500 dark:text-gray-400"
                  >
                    {typingStatus}
                  </p>
                )}
              </div>
              {sendError && (
                <div
                  role="alert"
                  className="border-t border-error-100 bg-error-50 px-4 py-2 text-xs text-error-700 dark:border-error-900 dark:bg-error-950/30 dark:text-error-300"
                >
                  {t("sendError")}
                </div>
              )}
              {messageActionError && (
                <div
                  role="alert"
                  className="border-t border-error-100 bg-error-50 px-4 py-2 text-xs text-error-700 dark:border-error-900 dark:bg-error-950/30 dark:text-error-300"
                >
                  {t("messageActionError")}
                </div>
              )}
              <ChatDraftComposer
                conversationId={activeId}
                organizationId={organizationId}
                members={activeConversation?.members}
                key={activeId}
                isSending={isSending}
                replyContext={
                  replyingTo
                    ? {
                        id: replyingTo.id,
                        name: replyingTo.senderName,
                        text: replyingTo.deletedAt
                          ? t("messageDeleted")
                          : replyingTo.content ||
                            replyingTo.attachments[0]?.name ||
                            t("attachment"),
                      }
                    : null
                }
                onCancelReply={() => setReplyingTo(null)}
                onSend={(content, id, files, mentionUserIds) =>
                  sendMessage(
                    content,
                    id,
                    files,
                    replyingTo?.id,
                    mentionUserIds,
                  )
                }
                onTyping={onComposerTyping}
              />
            </>
          ) : (
            <div className="flex h-full flex-col items-center justify-center px-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                <ChatIcon />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-gray-900 dark:text-white">
                {t("startConversation")}
              </h2>
              <p className="mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
                {t("selectConversation")}
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => toggleCompose("direct")}
                  className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                >
                  {t("newMessage")}
                </button>
              </div>
            </div>
          )}
        </main>
      </div>
      {roomManagementOpen && activeConversation?.type === "ROOM" && (
        <ChatDialog
          side
          title={t("roomSettings")}
          onClose={() => {
            if (!roomMutationPending) setRoomManagementOpen(false);
          }}
        >
          {isRoomOwner ? (
            <form
              className="flex gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                void saveRoomTitle();
              }}
            >
              <label className="min-w-0 flex-1">
                <span className="sr-only">{t("roomTitle")}</span>
                <input
                  value={roomTitleDraft}
                  onChange={(event) => setRoomTitleDraft(event.target.value)}
                  maxLength={80}
                  aria-label={t("roomTitle")}
                  className="h-9 w-full rounded-md border border-gray-200 bg-white px-2.5 text-sm outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900"
                />
              </label>
              <button
                type="submit"
                disabled={
                  roomMutationPending ||
                  !roomTitleDraft.trim() ||
                  roomTitleDraft.trim() === activeConversation.title
                }
                className="rounded-md bg-brand-500 px-3 text-xs font-semibold text-white hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50"
              >
                {t("save")}
              </button>
            </form>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {activeConversation.title}
            </p>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-300">
              {t("members", { count: activeConversation.members.length })}
            </p>
            <ul className="max-h-44 space-y-1.5 overflow-y-auto">
              {activeConversation.members.map((member) => (
                <li
                  key={member.userId}
                  className="flex items-center gap-2.5 rounded-xl border border-gray-100 bg-gray-50/70 px-2.5 py-2 text-xs text-gray-700 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-200"
                >
                  <AvatarText
                    src={member.avatarUrl}
                    name={member.displayName}
                    className="h-8 w-8 shrink-0 text-xs"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-gray-800 dark:text-gray-100">
                    {member.displayName}
                    {member.role === "OWNER" ? (
                      <span className="ms-1.5 rounded-md bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                        {t("owner")}
                      </span>
                    ) : null}
                  </span>
                  {isRoomOwner &&
                    member.role === "MEMBER" &&
                    (removeMemberId === member.userId ? (
                      <span className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={roomMutationPending}
                          onClick={() => void removeRoomMember(member.userId)}
                          className="rounded-md bg-error-50 px-2 py-1 font-semibold text-error-600 hover:bg-error-100 dark:bg-error-500/10 dark:text-error-400"
                        >
                          {t("confirmRemove")}
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoveMemberId("")}
                          className="px-1.5 py-1 text-gray-500 hover:underline"
                        >
                          {t("cancel")}
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRemoveMemberId(member.userId)}
                        className="rounded-md px-2 py-1 text-gray-500 transition hover:bg-error-50 hover:text-error-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:hover:bg-error-500/10 dark:hover:text-error-400"
                      >
                        {t("removeMember")}
                      </button>
                    ))}
                </li>
              ))}
            </ul>
          </div>

          {isRoomOwner && (
            <div className="space-y-2.5 border-t border-gray-200 pt-3.5 dark:border-gray-800">
              <label className="block">
                <span className="sr-only">{t("searchPeople")}</span>
                <input
                  value={personSearch}
                  onChange={(event) => setPersonSearch(event.target.value)}
                  placeholder={t("addRoomMembers")}
                  className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900"
                />
              </label>
              {roomManagementMembers.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t("selectedPeople", {
                      count: roomManagementMembers.length,
                    })}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {roomManagementMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => toggleRoomManagementMember(member)}
                        className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                      >
                        {member.fullName} ×
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50/70 p-1.5 dark:border-gray-800 dark:bg-gray-900/50">
                {candidatesQuery.isError && roomCandidates.length === 0 ? (
                  <p role="alert" className="px-2 py-2 text-xs text-error-600">
                    {t("searchError")}
                  </p>
                ) : candidatesQuery.isFetching &&
                  roomCandidates.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-gray-500">
                    {t("loading")}
                  </p>
                ) : roomCandidates.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-gray-500">
                    {t("noPeople")}
                  </p>
                ) : (
                  roomCandidates.map((candidate) => {
                    const selected = roomManagementMembers.some(
                      (member) => member.id === candidate.id,
                    );
                    const atLimit =
                      activeConversation.members.length +
                        roomManagementMembers.length >=
                      50;
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        onClick={() => toggleRoomManagementMember(candidate)}
                        disabled={
                          roomMutationPending || (!selected && atLimit)
                        }
                        className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start text-xs transition focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 ${
                          selected
                            ? "border border-brand-200 bg-brand-50/80 dark:border-brand-500/30 dark:bg-brand-500/10"
                            : "bg-white hover:bg-gray-100 dark:bg-gray-900 dark:hover:bg-gray-800"
                        }`}
                      >
                        <span className="relative shrink-0">
                          <AvatarText
                            src={candidate.avatarUrl}
                            name={candidate.fullName}
                            className="h-8 w-8 shrink-0 text-xs"
                          />
                          <span
                            className={`absolute end-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-900 ${candidate.isOnline ? "bg-success-500" : "bg-gray-300"}`}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                            {candidate.fullName}
                          </span>
                          {candidate.email && (
                            <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                              {candidate.email}
                            </span>
                          )}
                          <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${candidate.isOnline ? "bg-success-500" : "bg-gray-300"}`}
                            />
                            {candidate.isOnline ? t("online") : t("offline")}
                          </span>
                        </span>
                        <span
                          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                            selected
                              ? "bg-brand-500 text-white"
                              : "border border-gray-200 bg-gray-50 text-brand-600 dark:border-gray-700 dark:bg-gray-800 dark:text-brand-300"
                          }`}
                        >
                          {selected ? "✓" : "+"}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              <button
                type="button"
                onClick={() => void addRoomManagementMembers()}
                disabled={
                  roomMutationPending || roomManagementMembers.length === 0
                }
                className="h-10 w-full rounded-xl bg-brand-500 px-3 text-xs font-semibold text-white hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50"
              >
                {t("addSelectedMembers", {
                  count: roomManagementMembers.length,
                })}
              </button>
            </div>
          )}

          {!isRoomOwner && (
            <div className="border-t border-gray-200 pt-3 dark:border-gray-800">
              {confirmLeaveRoom ? (
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-gray-600 dark:text-gray-300">
                    {t("confirmLeaveRoom")}
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      disabled={roomMutationPending}
                      onClick={() => void leaveRoom()}
                      className="font-semibold text-error-600 hover:underline dark:text-error-400"
                    >
                      {t("leaveRoom")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmLeaveRoom(false)}
                      className="text-gray-500 hover:underline"
                    >
                      {t("cancel")}
                    </button>
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmLeaveRoom(true)}
                  className="text-xs font-medium text-error-600 hover:underline dark:text-error-400"
                >
                  {t("leaveRoom")}
                </button>
              )}
            </div>
          )}
          {roomManagementError && (
            <p
              role="alert"
              className="text-xs text-error-600 dark:text-error-400"
            >
              {t("roomManagementError")}
            </p>
          )}
        </ChatDialog>
      )}
      {composeMode && (
        <ChatDialog
          title={t(composeMode === "room" ? "newRoom" : "newMessage")}
          onClose={() => {
            if (!createDirect.isPending && !createRoom.isPending)
              closeCompose();
          }}
        >
          {composeMode === "room" && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t("createRoomHelp")}
            </p>
          )}
          {composeMode === "room" && (
            <label className="block">
              <span className="sr-only">{t("roomTitle")}</span>
              <input
                value={roomTitle}
                onChange={(event) => setRoomTitle(event.target.value)}
                placeholder={t("roomTitlePlaceholder")}
                maxLength={80}
                className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
          )}
          <label className="block">
            <span className="sr-only">{t("searchPeople")}</span>
            <input
              value={personSearch}
              onChange={(event) => setPersonSearch(event.target.value)}
              placeholder={t("searchPeople")}
              className="h-10 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900"
            />
          </label>
          {composeMode === "room" && (
            <div>
              <p className="mb-1.5 text-xs text-gray-500 dark:text-gray-400">
                {t("selectedPeople", { count: roomMembers.length })}
              </p>
              {roomMembers.length >= 49 && (
                <p className="mb-1.5 text-xs text-warning-600 dark:text-warning-400">
                  {t("roomMemberLimit")}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {roomMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => toggleRoomMember(member)}
                    className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                  >
                    {member.fullName} ×
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <p className="px-1 text-xs font-semibold text-gray-600 dark:text-gray-300">
              {t("organizationMembers") === "chat.organizationMembers"
                ? "Organization members"
                : t("organizationMembers")}
            </p>
            <div className="max-h-56 space-y-1 overflow-y-auto">
              {candidatesQuery.isError && candidateResults.length === 0 ? (
                <p
                  role="alert"
                  className="px-2 py-2 text-xs text-error-600 dark:text-error-400"
                >
                  {t("searchError")}
                </p>
              ) : candidatesQuery.isFetching &&
                candidateResults.length === 0 ? (
                <p className="px-2 py-2 text-xs text-gray-500">
                  {t("connecting")}
                </p>
              ) : candidateResults.length === 0 ? (
                <p className="px-2 py-2 text-xs text-gray-500">
                  {t("noPeople")}
                </p>
              ) : (
                candidateResults.map((candidate) => {
                  const selected = roomMembers.some(
                    (member) => member.id === candidate.id,
                  );
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() =>
                        composeMode === "room"
                          ? toggleRoomMember(candidate)
                          : openDirect(candidate)
                      }
                      disabled={
                        createDirect.isPending ||
                        (composeMode === "room" &&
                          !selected &&
                          roomMembers.length >= 49)
                      }
                      aria-pressed={
                        composeMode === "room" ? selected : undefined
                      }
                      aria-label={
                        composeMode === "room"
                          ? candidate.fullName
                          : t("startChatWith", { name: candidate.fullName })
                      }
                      className="flex w-full items-center gap-3 border-b border-gray-100 px-2 py-2.5 text-start transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 disabled:opacity-50 dark:border-gray-800 dark:hover:bg-gray-800"
                    >
                      <span className="relative shrink-0">
                        <AvatarText
                          src={candidate.avatarUrl}
                          name={candidate.fullName}
                          className="h-9 w-9 shrink-0 text-xs"
                        />
                        <span
                          className={`absolute end-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-900 ${candidate.isOnline ? "bg-success-500" : "bg-gray-300"}`}
                        />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                          {candidate.fullName}
                        </span>
                        {candidate.email && (
                          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                            {candidate.email}
                          </span>
                        )}
                      </span>
                      {composeMode === "room" ? (
                        <span className="flex items-center gap-2">
                          <span className="flex items-center gap-1.5 text-xs text-gray-500">
                            <span
                              className={`h-1.5 w-1.5 rounded-full ${candidate.isOnline ? "bg-success-500" : "bg-gray-300"}`}
                            />
                            {candidate.isOnline ? t("online") : t("offline")}
                          </span>
                          <span
                            className={`text-xs font-semibold ${selected ? "text-brand-600" : "text-gray-400"}`}
                          >
                            {selected ? "✓" : "+"}
                          </span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-xs text-gray-500">
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${candidate.isOnline ? "bg-success-500" : "bg-gray-300"}`}
                          />
                          {candidate.isOnline ? t("online") : t("offline")}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
          {composeMode === "direct" && createDirect.isError && (
            <p
              role="alert"
              className="text-xs text-error-600 dark:text-error-400"
            >
              {t("conversationError")}
            </p>
          )}
          {composeMode === "room" && (
            <>
              {roomError && (
                <p
                  role="alert"
                  className="text-xs text-error-600 dark:text-error-400"
                >
                  {!roomTitle.trim()
                    ? t("roomTitleError")
                    : t("roomSelectionError")}
                </p>
              )}
              {createRoom.isError && (
                <p
                  role="alert"
                  className="text-xs text-error-600 dark:text-error-400"
                >
                  {t("roomError")}
                </p>
              )}
              <button
                type="button"
                onClick={submitRoom}
                disabled={
                  createRoom.isPending ||
                  !roomTitle.trim() ||
                  roomMembers.length === 0
                }
                className="inline-flex h-10 w-full items-center justify-center rounded-xl bg-brand-500 px-3 text-sm font-semibold text-white hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-600 disabled:hover:bg-gray-200 dark:disabled:bg-gray-800 dark:disabled:text-gray-300"
              >
                {t(createRoom.isPending ? "creatingRoom" : "createRoom")}
              </button>
            </>
          )}
        </ChatDialog>
      )}
      {tool && (
        <ChatTools
          key={`${tool.mode}:${activeId}`}
          mode={tool.mode}
          organizationId={organizationId}
          actorId={actorId}
          conversation={tool.global ? undefined : activeConversation}
          message={tool.message}
          onClose={() => setTool(null)}
          onModeChange={(mode) => setTool({ mode })}
          onOpenMessage={openMessageContext}
          onOpenConversation={(conversation) => {
            setActiveId(conversation.id);
            setActiveFallback({
              conversation,
              name: conversationName(conversation, actorId),
              type: conversation.type,
            });
            setMobileListOpen(false);
            setTool(null);
          }}
        />
      )}
      {searchOpen && (
        <ChatDialog
          side
          title={t("searchMessages")}
          onClose={() => setSearchOpen(false)}
        >
          <ChatSearchResults
            search={messageSearch}
            onChange={setMessageSearch}
            results={searchResults}
            loading={
              searchQuery.isFetching ||
              messageSearch.trim() !== debouncedMessageSearch
            }
            error={searchQuery.isError}
            hasMore={Boolean(searchQuery.hasNextPage)}
            onMore={() => void searchQuery.fetchNextPage()}
            onSelect={(message) => {
              setContextMessageId(message.id);
              setSearchOpen(false);
              setMobileListOpen(false);
            }}
          />
        </ChatDialog>
      )}
    </section>
  );
}
