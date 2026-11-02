"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ChevronLeftIcon,
  CloseLineIcon,
  GroupIcon,
  MinusIcon,
} from "@/icons";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import { chatFeatures } from "@/lib/queries/chat/features";
import {
  chatApi,
  chatKeys,
  useChatMessageContextQuery,
  useChatMessagesQuery,
  type ChatConversation,
  type ChatMessage,
  type ChatPage,
} from "@/lib/queries/chat/useChat";
import { useChatNavigation } from "@/stores/chat-navigation";
import ChatAvatar from "../ChatAvatar";
import ChatDraftComposer from "../ChatDraftComposer";
import ChatMessageBubble from "../ChatMessageBubble";
import { sameMessageGroup } from "../message-layout";
import { hasReadMessage } from "../read-receipt";
import {
  getConversationDisplayName,
  getConversationPeer,
  hasParticipantDelivered,
  mergeChatMessage,
  type FloatingConnectionState,
} from "./chat-shared-helpers";

const EMPTY_TYPING_USERS: Readonly<Record<string, string>> = {};

export type MiniChatWindowProps = Readonly<{
  organizationId: string;
  actorId: string;
  conversationId: string;
  conversation?: ChatConversation;
  highlightedMessageId?: string;
  typingUsers?: Readonly<Record<string, string>>;
  connection: FloatingConnectionState;
  onSendTyping: (conversationId: string, isTyping: boolean) => void;
  onBack: () => void;
  onMinimize: () => void;
  onClose: () => void;
  onClearHighlight: () => void;
}>;

export default function MiniChatWindow({
  organizationId,
  actorId,
  conversationId,
  conversation,
  highlightedMessageId = "",
  typingUsers = EMPTY_TYPING_USERS,
  connection,
  onSendTyping,
  onBack,
  onMinimize,
  onClose,
  onClearHighlight,
}: MiniChatWindowProps) {
  const t = useTranslations("chat");
  const queryClient = useQueryClient();
  const openFullChatTarget = useChatNavigation((state) => state.open);

  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState(false);
  const [messageActionError, setMessageActionError] = useState(false);
  const [isLoadingEarlier, setIsLoadingEarlier] = useState(false);
  const [olderMessagesError, setOlderMessagesError] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const isLoadingEarlierRef = useRef(false);
  const localTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingUploads = useRef(
    new Map<string, { fingerprint: string; ids: string[] }>(),
  );

  const detailQuery = useQuery({
    queryKey: ["chat", organizationId, "detail", conversationId],
    queryFn: () => chatFeatures.conversation(conversationId),
    enabled: Boolean(!conversation && organizationId && conversationId),
    retry: false,
  });

  const detailAccessLost = isAccessOrResourceUnavailableError(detailQuery.error);
  const activeConversation =
    conversation ?? (detailAccessLost ? undefined : detailQuery.data);

  const messagesQuery = useChatMessagesQuery(organizationId, conversationId);
  const hasHighlightedInRegularPage = Boolean(
    highlightedMessageId &&
      messagesQuery.data?.data.some((m) => m.id === highlightedMessageId),
  );
  const contextQuery = useChatMessageContextQuery(
    organizationId,
    conversationId,
    highlightedMessageId && !hasHighlightedInRegularPage
      ? highlightedMessageId
      : "",
  );

  const useContextFeed = Boolean(
    highlightedMessageId && !hasHighlightedInRegularPage && contextQuery.data,
  );
  const displayedQuery = useContextFeed ? contextQuery : messagesQuery;
  const messagesAccessLost = isAccessOrResourceUnavailableError(
    displayedQuery.error,
  );
  const visibleMessages = messagesAccessLost ? undefined : displayedQuery.data;
  const messages = visibleMessages?.data ?? [];
  const latestMessageId = messages.at(-1)?.id;

  const peer = activeConversation
    ? getConversationPeer(activeConversation, actorId)
    : undefined;
  const displayName =
    getConversationDisplayName(activeConversation, actorId) || t("title");
  const isOnline = Boolean(peer?.isOnline);
  const activeType = activeConversation?.type;

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

  const subtitle = typingStatus
    ? typingStatus
    : activeType === "ROOM"
      ? t("members", { count: activeConversation?.members.length ?? 0 })
      : isOnline
        ? t("online")
        : t("offline");

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
          hasParticipantDelivered(member, latestOwnMessage),
      ).length ?? 0)
    : 0;

  useEffect(() => {
    return () => {
      if (localTypingTimer.current) clearTimeout(localTypingTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!latestMessageId || !conversationId) return;
    void chatApi
      .markDelivered(conversationId, latestMessageId)
      .catch(() => undefined);

    const markVisibleRead = () => {
      if (document.visibilityState !== "visible") return;
      void chatApi
        .markRead(conversationId, latestMessageId)
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
  }, [conversationId, latestMessageId, organizationId, queryClient]);

  useEffect(() => {
    if (!highlightedMessageId) return;
    const element = document.getElementById(
      `chat-message-${highlightedMessageId}`,
    );
    if (!element) return;
    element.scrollIntoView({ block: "center" });
    const timer = setTimeout(() => {
      onClearHighlight();
    }, 3200);
    return () => clearTimeout(timer);
  }, [highlightedMessageId, messages.length, onClearHighlight]);

  useEffect(() => {
    if (!latestMessageId || highlightedMessageId) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [conversationId, highlightedMessageId, latestMessageId]);

  const handleComposerTyping = useCallback(
    (isTyping: boolean) => {
      onSendTyping(conversationId, isTyping);
      if (localTypingTimer.current) clearTimeout(localTypingTimer.current);
      if (isTyping) {
        localTypingTimer.current = setTimeout(() => {
          onSendTyping(conversationId, false);
        }, 1800);
      }
    },
    [conversationId, onSendTyping],
  );

  const loadEarlier = async () => {
    const cursor = visibleMessages?.nextCursor;
    if (!conversationId || !cursor || isLoadingEarlierRef.current) return;
    isLoadingEarlierRef.current = true;
    const container = scrollRef.current;
    const priorHeight = container?.scrollHeight ?? 0;
    const priorTop = container?.scrollTop ?? 0;
    setIsLoadingEarlier(true);
    setOlderMessagesError(false);
    try {
      const older = await chatApi.olderMessages(conversationId, cursor);
      const targetKey = useContextFeed
        ? chatKeys.context(organizationId, conversationId, highlightedMessageId)
        : chatKeys.messages(organizationId, conversationId);
      queryClient.setQueryData<ChatPage<ChatMessage>>(targetKey, (page) => ({
        data: [...older.data, ...(page?.data ?? [])].filter(
          (message, index, all) =>
            all.findIndex((item) => item.id === message.id) === index,
        ),
        nextCursor: older.nextCursor,
      }));
      requestAnimationFrame(() => {
        const current = scrollRef.current;
        if (current) {
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
    if (scrollRef.current && scrollRef.current.scrollTop <= 56) {
      void loadEarlier();
    }
  };

  const sendMessage = async (
    content: string,
    clientMessageId: string,
    files: readonly File[] = [],
    mentionUserIds: readonly string[] = [],
  ): Promise<boolean> => {
    if (!conversationId) return false;
    const replyToMessageId = replyingTo?.id;
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
          conversationId,
          files[pending.ids.length],
        );
        pending.ids.push(uploadId);
      }
      const message = await chatApi.sendMessage(conversationId, {
        clientMessageId,
        content: content.trim(),
        ...(pending.ids.length > 0 ? { attachments: pending.ids } : {}),
        ...(replyToMessageId ? { replyToMessageId } : {}),
        mentionUserIds,
      });
      pendingUploads.current.delete(clientMessageId);
      queryClient.setQueryData<ChatPage<ChatMessage>>(
        chatKeys.messages(organizationId, conversationId),
        (page) => mergeChatMessage(page, message),
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
    if (!conversationId || !content.trim()) return false;
    setMessageActionError(false);
    try {
      const updated = await chatApi.editMessage(
        conversationId,
        messageId,
        content,
        messages
          .find((item) => item.id === messageId)
          ?.mentionUserIds?.filter((id) => {
            const person = activeConversation?.members.find(
              (member) => member.userId === id,
            );
            return person && content.includes(`@${person.displayName}`);
          }),
      );
      queryClient.setQueryData<ChatPage<ChatMessage>>(
        chatKeys.messages(organizationId, conversationId),
        (page) => mergeChatMessage(page, updated),
      );
      await queryClient.invalidateQueries({
        queryKey: chatKeys.messages(organizationId, conversationId),
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
    if (!conversationId) return false;
    setMessageActionError(false);
    try {
      const updated = await chatApi.deleteMessage(conversationId, messageId);
      queryClient.setQueryData<ChatPage<ChatMessage>>(
        chatKeys.messages(organizationId, conversationId),
        (page) => mergeChatMessage(page, updated),
      );
      await queryClient.invalidateQueries({
        queryKey: chatKeys.messages(organizationId, conversationId),
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
    if (!conversationId) return;
    setMessageActionError(false);
    try {
      const updated = await chatApi.setReaction(
        conversationId,
        message.id,
        emoji,
        active,
      );
      queryClient.setQueryData<ChatPage<ChatMessage>>(
        chatKeys.messages(organizationId, conversationId),
        (page) => mergeChatMessage(page, updated),
      );
      await queryClient.invalidateQueries({
        queryKey: chatKeys.messages(organizationId, conversationId),
      });
    } catch {
      setMessageActionError(true);
    }
  };

  const scrollToQuotedMessage = (targetMessageId: string) => {
    const targetEl = document.getElementById(`chat-message-${targetMessageId}`);
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
      targetEl.focus({ preventScroll: true });
    }
  };

  const fullChatHref = `/chat?conversation=${encodeURIComponent(conversationId)}`;

  return (
    <section
      role="dialog"
      aria-label={displayName}
      data-connection={connection}
      data-testid={`mini-chat-window-${conversationId}`}
      className="relative flex h-[min(28rem,calc(100dvh-5rem))] w-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xl sm:w-84 sm:rounded-b-none sm:border-b-0 dark:border-gray-800 dark:bg-gray-900"
    >
      {/* Compact Messenger-style Header */}
      <header className="flex shrink-0 items-center justify-between gap-1 border-b border-gray-100 bg-white px-2 py-2 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <button
            type="button"
            onClick={onBack}
            title={t("backToConversations")}
            aria-label={t("backToConversations")}
            data-testid={`mini-chat-back-${conversationId}`}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-brand-600 transition hover:bg-gray-100 dark:text-brand-400 dark:hover:bg-gray-800"
          >
            <ChevronLeftIcon className="h-5 w-5 rtl:rotate-180" />
          </button>

          <Link
            href={fullChatHref}
            data-testid={`mini-chat-open-full-${conversationId}`}
            title={t("openInFullChat")}
            onClick={() => {
              if (latestMessageId) {
                openFullChatTarget(conversationId, latestMessageId);
              }
            }}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-xl px-1.5 py-1 text-start transition hover:bg-gray-100/80 dark:hover:bg-gray-800/60"
          >
            <div className="relative shrink-0">
              <ChatAvatar
                name={displayName}
                src={peer?.avatarUrl}
                className="h-8 w-8 text-xs"
              />
              {activeType === "ROOM" ? (
                <span
                  aria-hidden="true"
                  className="absolute -end-0.5 -bottom-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-white bg-brand-50 text-brand-600 dark:border-gray-900 dark:bg-brand-500/20 dark:text-brand-300"
                >
                  <GroupIcon className="h-2 w-2" />
                </span>
              ) : (
                isOnline && (
                  <span
                    aria-hidden="true"
                    className="absolute end-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-success-500 dark:border-gray-900"
                  />
                )
              )}
            </div>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-gray-900 dark:text-white">
                {displayName}
              </span>
              <span
                className={`block truncate text-xs ${
                  typingStatus
                    ? "font-medium text-brand-600 dark:text-brand-400"
                    : "text-gray-500 dark:text-gray-400"
                }`}
              >
                {subtitle}
              </span>
            </div>
          </Link>
        </div>

        {/* Right-side Messenger Controls: ONLY Horizontal Minus (—) and Close (×) */}
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            onClick={onMinimize}
            title={t("minimizeChat")}
            aria-label={t("minimizeChat")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-brand-600 transition hover:bg-gray-100 dark:text-brand-400 dark:hover:bg-gray-800"
          >
            <MinusIcon className="h-4.5 w-4.5" />
          </button>
          <button
            type="button"
            onClick={onClose}
            title={t("close")}
            aria-label={t("closeChatWindow", { name: displayName })}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-brand-600 transition hover:bg-gray-100 hover:text-error-600 dark:text-brand-400 dark:hover:bg-gray-800 dark:hover:text-error-400"
          >
            <CloseLineIcon className="h-4.5 w-4.5" />
          </button>
        </div>
      </header>

      {/* Error Banners */}
      {(sendError || messageActionError || olderMessagesError) && (
        <div
          role="alert"
          className="shrink-0 border-b border-error-100 bg-error-50 px-3 py-1.5 text-xs text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-300"
        >
          {sendError
            ? t("sendError")
            : olderMessagesError
              ? t("messageError")
              : t("messageActionError")}
        </div>
      )}

      {/* Scrollable Message Stream */}
      <div
        ref={scrollRef}
        onScroll={handleMessageScroll}
        className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-3 py-2.5"
      >
        {visibleMessages?.nextCursor && (
          <div className="mb-2 text-center">
            <button
              type="button"
              disabled={isLoadingEarlier}
              onClick={() => void loadEarlier()}
              className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-600 transition hover:bg-gray-100 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              {isLoadingEarlier ? t("loadingMessages") : t("loadEarlier")}
            </button>
          </div>
        )}

        {displayedQuery.isLoading && !messages.length ? (
          <p
            role="status"
            className="py-10 text-center text-xs text-gray-500 dark:text-gray-400"
          >
            {t("loadingMessages")}
          </p>
        ) : displayedQuery.isError && !messages.length ? (
          <div className="space-y-2 py-10 text-center">
            <p
              role="alert"
              className="text-xs text-error-600 dark:text-error-400"
            >
              {t("messageError")}
            </p>
            <button
              type="button"
              onClick={() => void displayedQuery.refetch()}
              className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {t("retry")}
            </button>
          </div>
        ) : messages.length === 0 ? (
          <p className="py-10 text-center text-xs text-gray-500 dark:text-gray-400">
            {t("messageEmpty")}
          </p>
        ) : (
          messages.map((message, index) => {
            const mine = message.senderId === actorId;
            const prev = messages[index - 1];
            const next = messages[index + 1];
            const groupStart = !sameMessageGroup(prev, message);
            const groupEnd = !sameMessageGroup(message, next);
            const isLatestOwn = latestOwnMessage?.id === message.id;

            const receipt = isLatestOwn
              ? seenByCount > 0
                ? activeType === "ROOM"
                  ? t("seenBy", { count: seenByCount })
                  : t("seen")
                : deliveredByCount > 0
                  ? activeType === "ROOM"
                    ? t("deliveredBy", { count: deliveredByCount })
                    : t("delivered")
                  : undefined
              : undefined;

            return (
              <ChatMessageBubble
                key={message.id}
                message={message}
                mine={mine}
                showSender={activeType === "ROOM" && !mine}
                groupStart={groupStart}
                groupEnd={groupEnd}
                highlighted={highlightedMessageId === message.id}
                receipt={receipt}
                onOpenContext={scrollToQuotedMessage}
                onReply={() => setReplyingTo(message)}
                onEdit={(content) => saveMessageEdit(message.id, content)}
                onDelete={() => deleteChatMessage(message.id)}
                onReaction={(emoji, active) =>
                  setReaction(message, emoji, active)
                }
              />
            );
          })
        )}
      </div>

      {/* Synced Draft + Compact Message Composer */}
      <ChatDraftComposer
        key={conversationId}
        compact
        organizationId={organizationId}
        conversationId={conversationId}
        isSending={isSending}
        replyContext={
          replyingTo
            ? {
                id: replyingTo.id,
                name: replyingTo.senderName,
                text:
                  replyingTo.deletedAt
                    ? t("messageDeleted")
                    : replyingTo.content || t("attachment"),
              }
            : null
        }
        onCancelReply={() => setReplyingTo(null)}
        members={activeConversation?.members ?? []}
        onTyping={handleComposerTyping}
        onSend={sendMessage}
      />
    </section>
  );
}

