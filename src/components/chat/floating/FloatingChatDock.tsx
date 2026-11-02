"use client";

import { useMemo, useRef } from "react";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import {
  useChatConversationsQuery,
  type ChatConversation,
} from "@/lib/queries/chat/useChat";
import {
  EMPTY_CHAT_IDS,
  MAX_OPEN_CHAT_WINDOWS,
  useFloatingChatStore,
} from "@/stores/floating-chat";
import FloatingChatHeadsRail from "./FloatingChatHeadsRail";
import FloatingChatLauncherPopover from "./FloatingChatLauncherPopover";
import MiniChatWindow from "./MiniChatWindow";
import { useFloatingChatRealtime } from "./useFloatingChatRealtime";

function buildFallbackConversation(id: string): ChatConversation {
  return {
    id,
    type: "DIRECT",
    title: null,
    createdBy: "",
    lastMessageAt: null,
    lastMessagePreview: "",
    lastMessageSenderId: null,
    lastReadMessageId: null,
    lastReadAt: null,
    unreadCount: 0,
    members: [],
  };
}

export default function FloatingChatDock() {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const currentUser = useCurrentUserQuery();
  const currentUserAccessLost = isAccessOrResourceUnavailableError(
    currentUser.error,
  );
  const visibleUser = currentUserAccessLost ? undefined : currentUser.data;
  const actorId = visibleUser?.id ?? "";
  const organizationId =
    visibleUser && "organizationId" in visibleUser
      ? (visibleUser.organizationId ?? "")
      : "";

  const isLauncherOpen = useFloatingChatStore(
    (state) => Boolean(organizationId) && state.launcherOrgId === organizationId,
  );
  const openWindowIds = useFloatingChatStore(
    (state) =>
      (organizationId ? state.openWindowsByOrg[organizationId] : undefined) ??
      EMPTY_CHAT_IDS,
  );
  const minimizedHeadIds = useFloatingChatStore(
    (state) =>
      (organizationId ? state.minimizedHeadsByOrg[organizationId] : undefined) ??
      EMPTY_CHAT_IDS,
  );
  const highlightedMap = useFloatingChatStore(
    (state) => state.highlightedMessageByConv,
  );

  const toggleLauncher = useFloatingChatStore((state) => state.toggleLauncher);
  const closeLauncher = useFloatingChatStore((state) => state.closeLauncher);
  const openConversation = useFloatingChatStore(
    (state) => state.openConversation,
  );
  const minimizeWindow = useFloatingChatStore((state) => state.minimizeWindow);
  const backToLauncher = useFloatingChatStore((state) => state.backToLauncher);
  const closeWindow = useFloatingChatStore((state) => state.closeWindow);
  const closeHead = useFloatingChatStore((state) => state.closeHead);
  const clearHighlight = useFloatingChatStore((state) => state.clearHighlight);

  const conversationsQuery = useChatConversationsQuery(organizationId);
  const conversationsAccessLost =
    currentUserAccessLost ||
    isAccessOrResourceUnavailableError(conversationsQuery.error);

  const conversations = useMemo(
    () =>
      conversationsAccessLost
        ? []
        : (conversationsQuery.data?.pages.flatMap((page) => page.data) ?? []),
    [conversationsAccessLost, conversationsQuery.data],
  );

  const { connection, typingByConversation, sendTyping } =
    useFloatingChatRealtime({
      organizationId,
      actorId,
      openWindowIds,
      conversations,
      refreshCurrentUser: currentUser.refetch,
    });

  const conversationMap = useMemo(() => {
    const map = new Map<string, ChatConversation>();
    for (const conv of conversations) {
      map.set(conv.id, conv);
    }
    return map;
  }, [conversations]);

  const totalUnread = useMemo(
    () =>
      conversations.reduce(
        (sum, conv) => sum + Math.max(0, conv.unreadCount ?? 0),
        0,
      ),
    [conversations],
  );

  const minimizedConversations = useMemo(
    () =>
      minimizedHeadIds.map(
        (id) => conversationMap.get(id) ?? buildFallbackConversation(id),
      ),
    [conversationMap, minimizedHeadIds],
  );

  if (!actorId || !organizationId) {
    return null;
  }

  const handleSelectConversation = (conversationId: string) => {
    const isSmallViewport =
      typeof window !== "undefined" && window.innerWidth < 640;
    openConversation(organizationId, conversationId, {
      maxOpen: isSmallViewport ? 1 : MAX_OPEN_CHAT_WINDOWS,
    });
  };

  return (
    <>
      {/* Open Mini Chat Windows Dock (sits beside the bottom-right Chat FAB rail) */}
      {openWindowIds.length > 0 && (
        <div
          data-testid="floating-chat-windows-dock"
          className="fixed inset-x-3 bottom-3 z-50 flex flex-row-reverse items-end gap-3 sm:inset-x-auto sm:end-22 sm:bottom-0 sm:max-w-[calc(100vw-6rem)]"
        >
          {openWindowIds.map((conversationId, index) => (
            <div
              key={conversationId}
              className={
                index > 0 ? "hidden lg:block" : "w-full sm:w-auto"
              }
            >
              <MiniChatWindow
                organizationId={organizationId}
                actorId={actorId}
                conversationId={conversationId}
                conversation={conversationMap.get(conversationId)}
                highlightedMessageId={highlightedMap[conversationId]}
                typingUsers={typingByConversation[conversationId]}
                connection={connection}
                onSendTyping={sendTyping}
                onBack={() => backToLauncher(organizationId, conversationId)}
                onMinimize={() => minimizeWindow(organizationId, conversationId)}
                onClose={() => closeWindow(organizationId, conversationId)}
                onClearHighlight={() => clearHighlight(conversationId)}
              />
            </div>
          ))}
        </div>
      )}

      {/* Facebook-style Conversation Picker Popover */}
      {isLauncherOpen && (
        <FloatingChatLauncherPopover
          organizationId={organizationId}
          actorId={actorId}
          baseConversations={conversations}
          isLoadingBase={conversationsQuery.isLoading}
          isBaseError={conversationsQuery.isError && !conversationsAccessLost}
          onRetryBase={() => void conversationsQuery.refetch()}
          triggerRef={triggerRef}
          onSelectConversation={handleSelectConversation}
          onClose={closeLauncher}
        />
      )}

      {/* Bottom-right Floating Chat Button & Minimized Chat Heads */}
      <FloatingChatHeadsRail
        actorId={actorId}
        isLauncherOpen={isLauncherOpen}
        totalUnread={totalUnread}
        minimizedConversations={minimizedConversations}
        triggerRef={triggerRef}
        onToggleLauncher={() => toggleLauncher(organizationId)}
        onRestoreHead={handleSelectConversation}
        onCloseHead={(conversationId) =>
          closeHead(organizationId, conversationId)
        }
      />
    </>
  );
}

