"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useOptionalSidebar } from "@/context/SidebarContext";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import {
  useChatConversationsQuery,
  type ChatConversation,
} from "@/lib/queries/chat/useChat";
import {
  EMPTY_CHAT_IDS,
  MAX_MINIMIZED_CHAT_HEADS,
  TWO_WINDOW_MIN_VIEWPORT_PX,
  resolveMaxOpenChatWindows,
  useFloatingChatStore,
} from "@/stores/floating-chat";
import { getEffectiveConversationUnreadCount } from "./chat-shared-helpers";
import FloatingChatHeadsRail from "./FloatingChatHeadsRail";
import FloatingChatLauncherPopover from "./FloatingChatLauncherPopover";
import MiniChatWindow from "./MiniChatWindow";
import { useFloatingChatRealtime } from "./useFloatingChatRealtime";

const IS_TEST_ENV = Boolean(
  process.env.VITEST || process.env.NODE_ENV === "test",
);

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
  const lastActorIdRef = useRef<string | null>(null);
  const sidebar = useOptionalSidebar();
  const isHelpOpen = Boolean(sidebar?.isHelpOpen);

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

  const [viewportWidth, setViewportWidth] = useState<number>(() =>
    typeof window !== "undefined" && window.innerWidth > 0
      ? window.innerWidth
      : TWO_WINDOW_MIN_VIEWPORT_PX,
  );
  const maxVisibleWindows = resolveMaxOpenChatWindows(viewportWidth);

  useEffect(() => {
    const syncViewportLimit = () => {
      if (window.innerWidth > 0) {
        setViewportWidth(window.innerWidth);
      }
    };
    syncViewportLimit();
    window.addEventListener("resize", syncViewportLimit);
    return () => window.removeEventListener("resize", syncViewportLimit);
  }, []);

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
  const contextMap = useFloatingChatStore(
    (state) => state.contextMessageByConv,
  );

  const setActiveOrg = useFloatingChatStore((state) => state.setActiveOrg);
  const toggleLauncher = useFloatingChatStore((state) => state.toggleLauncher);
  const closeLauncher = useFloatingChatStore((state) => state.closeLauncher);
  const openConversation = useFloatingChatStore(
    (state) => state.openConversation,
  );
  const clampOpenWindows = useFloatingChatStore(
    (state) => state.clampOpenWindows,
  );
  const minimizeWindow = useFloatingChatStore((state) => state.minimizeWindow);
  const backToLauncher = useFloatingChatStore((state) => state.backToLauncher);
  const closeWindow = useFloatingChatStore((state) => state.closeWindow);
  const closeHead = useFloatingChatStore((state) => state.closeHead);
  const removeConversation = useFloatingChatStore(
    (state) => state.removeConversation,
  );
  const focusMessageContext = useFloatingChatStore(
    (state) => state.focusMessageContext,
  );
  const clearContextMessage = useFloatingChatStore(
    (state) => state.clearContextMessage,
  );
  const clearHighlight = useFloatingChatStore((state) => state.clearHighlight);
  const resetStore = useFloatingChatStore((state) => state.reset);

  // Defensive identity isolation if user changes in-place without full reload,
  // and synchronize activeOrgId so ContinuumAiCompanion offsets match the current org.
  useEffect(() => {
    if (currentUserAccessLost) {
      lastActorIdRef.current = null;
      resetStore();
      return;
    }
    if (
      actorId &&
      lastActorIdRef.current &&
      lastActorIdRef.current !== actorId
    ) {
      resetStore();
    }
    if (actorId) {
      lastActorIdRef.current = actorId;
    }
    setActiveOrg(organizationId || null);
  }, [
    actorId,
    currentUserAccessLost,
    organizationId,
    resetStore,
    setActiveOrg,
  ]);

  // Overflow excess open windows into minimized chat heads on <1024px viewports
  // so a hidden window never vanishes or marks incoming messages as read unseen.
  useEffect(() => {
    if (!organizationId || openWindowIds.length <= maxVisibleWindows) return;
    clampOpenWindows(organizationId, maxVisibleWindows);
  }, [clampOpenWindows, maxVisibleWindows, openWindowIds.length, organizationId]);

  const effectiveVisibleWindowLimit =
    (isLauncherOpen && viewportWidth < 1360) ||
    (isHelpOpen && viewportWidth < 1600)
      ? 1
      : maxVisibleWindows;

  const visibleOpenWindowIds = useMemo(
    () => openWindowIds.slice(0, effectiveVisibleWindowLimit),
    [effectiveVisibleWindowLimit, openWindowIds],
  );

  const conversationsQuery = useChatConversationsQuery(organizationId, "", {
    refetchInterval: IS_TEST_ENV ? false : 15_000,
    refetchIntervalInBackground: false,
  });
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
      openWindowIds: visibleOpenWindowIds,
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
        (sum, conv) => sum + getEffectiveConversationUnreadCount(conv),
        0,
      ),
    [conversations],
  );

  const effectiveMinimizedHeadIds = useMemo(() => {
    const overflowOpenWindowIds = openWindowIds.slice(effectiveVisibleWindowLimit);
    if (overflowOpenWindowIds.length === 0) return minimizedHeadIds;
    return [
      ...overflowOpenWindowIds,
      ...minimizedHeadIds.filter((id) => !overflowOpenWindowIds.includes(id)),
    ].slice(0, MAX_MINIMIZED_CHAT_HEADS);
  }, [effectiveVisibleWindowLimit, minimizedHeadIds, openWindowIds]);

  const minimizedConversations = useMemo(
    () =>
      effectiveMinimizedHeadIds.map(
        (id) => conversationMap.get(id) ?? buildFallbackConversation(id),
      ),
    [conversationMap, effectiveMinimizedHeadIds],
  );

  if (!actorId || !organizationId) {
    return null;
  }

  const handleSelectConversation = (conversationId: string) => {
    openConversation(organizationId, conversationId, {
      maxOpen: resolveMaxOpenChatWindows(),
    });
  };

  const helpShiftClass = isHelpOpen
    ? "lg:-translate-x-80 rtl:lg:translate-x-80 max-lg:pointer-events-none max-lg:opacity-0"
    : "";

  const windowsDockPositionClass = isLauncherOpen
    ? "hidden lg:inset-x-auto lg:end-96 lg:bottom-0 lg:flex lg:max-w-[calc(100vw-25rem)]"
    : "flex sm:inset-x-auto sm:end-22 sm:bottom-0 sm:max-w-[calc(100vw-6rem)]";

  return (
    <>
      {/* Open Mini Chat Windows Dock (z-40 sits cleanly beneath AppHeader z-50 dropdowns) */}
      {visibleOpenWindowIds.length > 0 && (
        <div
          data-testid="floating-chat-windows-dock"
          className={`fixed inset-x-3 bottom-3 z-40 flex-row-reverse items-end gap-3 transition-transform duration-200 ease-out ${windowsDockPositionClass} ${helpShiftClass}`}
        >
          {visibleOpenWindowIds.map((conversationId) => (
            <div key={conversationId} className="w-full sm:w-auto">
              <MiniChatWindow
                organizationId={organizationId}
                actorId={actorId}
                conversationId={conversationId}
                conversation={conversationMap.get(conversationId)}
                highlightedMessageId={highlightedMap[conversationId]}
                contextMessageId={contextMap[conversationId]}
                typingUsers={typingByConversation[conversationId]}
                connection={connection}
                onSendTyping={sendTyping}
                onBack={() => backToLauncher(organizationId, conversationId)}
                onMinimize={() => minimizeWindow(organizationId, conversationId)}
                onClose={() => closeWindow(organizationId, conversationId)}
                onRemoveUnavailable={() =>
                  removeConversation(organizationId, conversationId)
                }
                onFocusMessageContext={(messageId) =>
                  focusMessageContext(conversationId, messageId)
                }
                onExitContext={() => clearContextMessage(conversationId)}
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
          hasNextPage={Boolean(conversationsQuery.hasNextPage)}
          isFetchingNextPage={conversationsQuery.isFetchingNextPage}
          onLoadMoreBase={() => void conversationsQuery.fetchNextPage()}
          onRetryBase={() => void conversationsQuery.refetch()}
          isHelpOpen={isHelpOpen}
          triggerRef={triggerRef}
          onSelectConversation={handleSelectConversation}
          onClose={closeLauncher}
        />
      )}

      {/* Bottom-right Floating Chat Button & Minimized Chat Heads */}
      <FloatingChatHeadsRail
        actorId={actorId}
        isLauncherOpen={isLauncherOpen}
        hasOpenWindow={visibleOpenWindowIds.length > 0}
        isHelpOpen={isHelpOpen}
        totalUnread={totalUnread}
        minimizedConversations={minimizedConversations}
        triggerRef={triggerRef}
        onToggleLauncher={() => toggleLauncher(organizationId)}
        onRestoreHead={handleSelectConversation}
        onCloseHead={(conversationId) => {
          if (openWindowIds.includes(conversationId)) {
            closeWindow(organizationId, conversationId);
          } else {
            closeHead(organizationId, conversationId);
          }
        }}
      />
    </>
  );
}
