"use client";

import type { RefObject } from "react";
import { useTranslations } from "next-intl";
import { ChatIcon, CloseLineIcon } from "@/icons";
import type { ChatConversation } from "@/lib/queries/chat/useChat";
import ChatAvatar from "../ChatAvatar";
import {
  getConversationDisplayName,
  getConversationPeer,
  getEffectiveConversationUnreadCount,
} from "./chat-shared-helpers";

export type FloatingChatHeadsRailProps = Readonly<{
  actorId: string;
  isLauncherOpen: boolean;
  hasOpenWindow?: boolean;
  totalUnread: number;
  minimizedConversations: readonly ChatConversation[];
  triggerRef: RefObject<HTMLButtonElement | null>;
  onToggleLauncher: () => void;
  onRestoreHead: (conversationId: string) => void;
  onCloseHead: (conversationId: string) => void;
}>;

export default function FloatingChatHeadsRail({
  actorId,
  isLauncherOpen,
  hasOpenWindow = false,
  totalUnread,
  minimizedConversations,
  triggerRef,
  onToggleLauncher,
  onRestoreHead,
  onCloseHead,
}: FloatingChatHeadsRailProps) {
  const t = useTranslations("chat");

  return (
    <div
      data-testid="floating-chat-heads-rail"
      className={`fixed end-4 bottom-4 z-50 flex-col items-end gap-2.5 sm:end-5 sm:bottom-5 ${
        hasOpenWindow ? "hidden sm:flex" : "flex"
      }`}
    >
      {minimizedConversations.map((conversation) => {
        const peer = getConversationPeer(conversation, actorId);
        const name =
          getConversationDisplayName(conversation, actorId) || t("title");
        const isOnline = Boolean(peer?.isOnline);
        const rawUnread = conversation.unreadCount ?? 0;
        const effectiveUnread = getEffectiveConversationUnreadCount(conversation);

        return (
          <div
            key={conversation.id}
            data-testid={`floating-chat-head-${conversation.id}`}
            className="group relative flex items-center"
          >
            {/* Hover label tooltip on inline-start side */}
            <span className="pointer-events-none invisible absolute end-full me-2.5 max-w-44 truncate rounded-lg border border-gray-200 bg-white/95 px-2.5 py-1 text-xs font-medium text-gray-800 opacity-0 shadow-theme-md backdrop-blur transition-all group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 dark:border-gray-700 dark:bg-gray-900/95 dark:text-gray-100">
              {name}
            </span>

            <button
              type="button"
              aria-label={t("restoreChatWith", { name })}
              onClick={() => onRestoreHead(conversation.id)}
              className="relative flex h-12 w-12 items-center justify-center rounded-full border-2 border-white bg-white shadow-theme-lg transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:bg-gray-900"
            >
              <ChatAvatar
                name={name}
                src={peer?.avatarUrl}
                className="h-11 w-11 text-sm"
              />
              {isOnline && (
                <span
                  aria-hidden="true"
                  className="absolute end-0 bottom-0 h-3 w-3 rounded-full border-2 border-white bg-success-500 dark:border-gray-900"
                />
              )}
              {effectiveUnread > 0 && (
                <span
                  data-testid={`floating-chat-head-unread-${conversation.id}`}
                  className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-error-500 px-1 text-xs font-bold text-white tabular-nums shadow-theme-xs"
                >
                  {rawUnread > 99 ? "99+" : rawUnread > 0 ? rawUnread : "•"}
                </span>
              )}
            </button>

            <button
              type="button"
              aria-label={t("closeChatHead", { name })}
              onClick={(event) => {
                event.stopPropagation();
                onCloseHead(conversation.id);
              }}
              className="invisible absolute -start-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-600 opacity-0 shadow-theme-xs transition hover:bg-gray-100 hover:text-gray-900 focus-visible:visible focus-visible:opacity-100 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
            >
              <CloseLineIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}

      {/* Main Facebook-style Floating Chat Button */}
      <button
        ref={triggerRef}
        type="button"
        data-testid="floating-chat-fab"
        aria-label={
          isLauncherOpen ? t("floatingCloseLauncher") : t("floatingButtonLabel")
        }
        aria-expanded={isLauncherOpen}
        onClick={onToggleLauncher}
        className={`relative flex h-14 w-14 items-center justify-center rounded-full text-white shadow-theme-xl transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
          isLauncherOpen
            ? "bg-gray-800 hover:bg-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600"
            : "bg-brand-600 hover:bg-brand-700"
        }`}
      >
        {isLauncherOpen ? (
          <CloseLineIcon className="h-6 w-6" />
        ) : (
          <ChatIcon className="h-6 w-6" />
        )}
        {!isLauncherOpen && totalUnread > 0 && (
          <span
            data-testid="floating-chat-total-unread"
            className="absolute -end-1 -top-1 flex h-5.5 min-w-5.5 items-center justify-center rounded-full border-2 border-white bg-error-500 px-1 text-xs font-bold text-white tabular-nums shadow-theme-xs dark:border-gray-900"
          >
            {totalUnread > 99 ? "99+" : totalUnread}
          </span>
        )}
      </button>
    </div>
  );
}
