"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type UIEvent,
} from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  CloseLineIcon,
  GroupIcon,
  MaximizeIcon,
  PinStarIcon,
  SearchIcon,
} from "@/icons";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import {
  useChatCandidatesQuery,
  useChatConversationsQuery,
  useCreateDirectMutation,
  type ChatCandidate,
  type ChatConversation,
} from "@/lib/queries/chat/useChat";
import ChatAvatar from "../ChatAvatar";
import { foldSearchText } from "../search-text";
import {
  formatCompactConversationTime,
  getConversationDisplayName,
  getConversationPeer,
  getEffectiveConversationUnreadCount,
} from "./chat-shared-helpers";

export type FloatingChatLauncherPopoverProps = Readonly<{
  organizationId: string;
  actorId: string;
  baseConversations: readonly ChatConversation[];
  isLoadingBase: boolean;
  isBaseError: boolean;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMoreBase?: () => void;
  onRetryBase: () => void;
  isHelpOpen?: boolean;
  triggerRef: RefObject<HTMLButtonElement | null>;
  onSelectConversation: (conversationId: string) => void;
  onClose: () => void;
}>;

export default function FloatingChatLauncherPopover({
  organizationId,
  actorId,
  baseConversations,
  isLoadingBase,
  isBaseError,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMoreBase,
  onRetryBase,
  isHelpOpen = false,
  triggerRef,
  onSelectConversation,
  onClose,
}: FloatingChatLauncherPopoverProps) {
  const t = useTranslations("chat");
  const common = useTranslations("common");
  const dateLocale = common("localeCode") === "vi" ? "vi-VN" : "en-US";
  const panelRef = useRef<HTMLElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pendingCandidateId, setPendingCandidateId] = useState<string | null>(
    null,
  );
  const [directError, setDirectError] = useState(false);

  const createDirect = useCreateDirectMutation(organizationId);

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      ) {
        return;
      }
      onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, triggerRef]);

  const searchConversationsQuery = useChatConversationsQuery(
    organizationId,
    debouncedSearch,
  );
  const candidatesQuery = useChatCandidatesQuery(
    organizationId,
    debouncedSearch,
    true,
  );

  const searchAccessLost = isAccessOrResourceUnavailableError(
    searchConversationsQuery.error,
  );
  const candidatesAccessLost = isAccessOrResourceUnavailableError(
    candidatesQuery.error,
  );

  const trimmedSearch = search.trim();
  const isSearchPending =
    Boolean(trimmedSearch) &&
    (trimmedSearch !== debouncedSearch ||
      searchConversationsQuery.isLoading ||
      candidatesQuery.isLoading);

  const visibleConversations = useMemo(() => {
    if (!trimmedSearch) {
      return [...baseConversations].sort(
        (a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)),
      );
    }
    if (
      trimmedSearch === debouncedSearch &&
      !searchAccessLost &&
      !searchConversationsQuery.isError &&
      searchConversationsQuery.data
    ) {
      const serverItems =
        searchConversationsQuery.data.pages.flatMap((page) => page.data) ?? [];
      return [...serverItems].sort(
        (a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)),
      );
    }
    const tokens = foldSearchText(trimmedSearch)
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return baseConversations
      .filter((conversation) => {
        const foldedLabel = foldSearchText(
          getConversationDisplayName(conversation, actorId),
        );
        return (
          tokens.length === 0 ||
          tokens.every((token) => foldedLabel.includes(token))
        );
      })
      .sort(
        (a, b) => Number(Boolean(b.isPinned)) - Number(Boolean(a.isPinned)),
      );
  }, [
    actorId,
    baseConversations,
    debouncedSearch,
    searchAccessLost,
    searchConversationsQuery.data,
    searchConversationsQuery.isError,
    trimmedSearch,
  ]);

  const directPeerIdsWithExistingChat = useMemo(() => {
    const ids = new Set<string>();
    for (const conv of visibleConversations) {
      if (conv.type === "DIRECT") {
        const peer = getConversationPeer(conv, actorId);
        if (peer) ids.add(peer.userId);
      }
    }
    return ids;
  }, [actorId, visibleConversations]);

  const suggestedCandidates = useMemo(() => {
    if (candidatesAccessLost) return [];
    const list = candidatesQuery.data?.data ?? [];
    const tokens = trimmedSearch
      ? foldSearchText(trimmedSearch).trim().split(/\s+/).filter(Boolean)
      : [];
    return list.filter((candidate) => {
      if (
        candidate.id === actorId ||
        directPeerIdsWithExistingChat.has(candidate.id)
      ) {
        return false;
      }
      if (tokens.length > 0 && trimmedSearch !== debouncedSearch) {
        const foldedCandidate = foldSearchText(
          `${candidate.fullName} ${candidate.email ?? ""}`,
        );
        return tokens.every((token) => foldedCandidate.includes(token));
      }
      return true;
    });
  }, [
    actorId,
    candidatesAccessLost,
    candidatesQuery.data?.data,
    debouncedSearch,
    directPeerIdsWithExistingChat,
    trimmedSearch,
  ]);

  const activeHasNextPage = debouncedSearch
    ? Boolean(searchConversationsQuery.hasNextPage)
    : hasNextPage;
  const activeIsFetchingNextPage = debouncedSearch
    ? searchConversationsQuery.isFetchingNextPage
    : isFetchingNextPage;

  const triggerLoadMore = () => {
    if (!activeHasNextPage || activeIsFetchingNextPage) return;
    if (debouncedSearch) {
      void searchConversationsQuery.fetchNextPage();
    } else {
      onLoadMoreBase?.();
    }
  };

  const handleFeedScroll = (event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    if (target.scrollHeight - target.scrollTop - target.clientHeight <= 64) {
      triggerLoadMore();
    }
  };

  const handleStartDirect = async (candidate: ChatCandidate) => {
    if (pendingCandidateId) return;
    const existing = baseConversations.find(
      (conv) =>
        conv.type === "DIRECT" &&
        conv.members.some((member) => member.userId === candidate.id),
    );
    if (existing) {
      onSelectConversation(existing.id);
      return;
    }

    setPendingCandidateId(candidate.id);
    setDirectError(false);
    try {
      const created = await createDirect.mutateAsync(candidate.id);
      onSelectConversation(created.id);
    } catch {
      setDirectError(true);
    } finally {
      setPendingCandidateId(null);
    }
  };

  const helpShiftClass = isHelpOpen
    ? "lg:-translate-x-80 rtl:lg:translate-x-80 max-lg:pointer-events-none max-lg:opacity-0"
    : "";

  return (
    <section
      ref={panelRef}
      role="dialog"
      aria-label={t("title")}
      data-testid="floating-chat-launcher-popover"
      className={`fixed inset-x-3 bottom-20 z-45 flex max-h-[min(32rem,calc(100dvh-6rem))] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xl transition-transform duration-200 ease-out sm:inset-x-auto sm:end-5 sm:bottom-22 sm:w-88 dark:border-gray-800 dark:bg-gray-900 ${helpShiftClass}`}
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
        <h2 className="text-base font-bold text-gray-900 dark:text-white">
          {t("title")}
        </h2>
        <div className="flex items-center gap-1">
          <Link
            href="/chat"
            onClick={onClose}
            title={t("openInFullChat")}
            aria-label={t("openInFullChat")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            <MaximizeIcon className="h-4 w-4" />
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("close")}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
          >
            <CloseLineIcon className="h-4.5 w-4.5" />
          </button>
        </div>
      </header>

      {/* Search Box */}
      <div className="border-b border-gray-100 px-3 py-2.5 dark:border-gray-800">
        <div className="relative flex items-center">
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute start-3 h-4 w-4 text-gray-400"
          />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("quickSearchPlaceholder")}
            aria-label={t("searchConversations")}
            className="h-9 w-full rounded-xl border border-gray-200 bg-gray-50 ps-9 pe-8 text-xs text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-brand-400 focus:bg-white dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-100 dark:focus:bg-gray-900"
          />
          {search && (
            <button
              type="button"
              aria-label={t("clearSearch")}
              onClick={() => {
                setSearch("");
                searchInputRef.current?.focus();
              }}
              className="absolute end-2 flex h-5 w-5 items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {directError && (
        <p
          role="alert"
          className="border-b border-error-100 bg-error-50 px-3.5 py-2 text-xs text-error-700 dark:border-error-500/20 dark:bg-error-500/10 dark:text-error-300"
        >
          {t("searchError")}
        </p>
      )}

      {/* Conversations & People Feed */}
      <div
        onScroll={handleFeedScroll}
        className="custom-scrollbar min-h-48 flex-1 overflow-y-auto p-2"
      >
        {isLoadingBase && !baseConversations.length ? (
          <p
            role="status"
            className="px-3 py-6 text-center text-xs text-gray-500 dark:text-gray-400"
          >
            {t("loading")}
          </p>
        ) : isBaseError && !baseConversations.length ? (
          <div className="space-y-2 px-3 py-6 text-center">
            <p
              role="alert"
              className="text-xs text-error-600 dark:text-error-400"
            >
              {t("conversationError")}
            </p>
            <button
              type="button"
              onClick={onRetryBase}
              className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {t("retry")}
            </button>
          </div>
        ) : (
          <>
            {visibleConversations.length > 0 && (
              <div>
                <p className="px-2.5 pb-1 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
                  {t("recentConversations")}
                </p>
                <div className="space-y-0.5">
                  {visibleConversations.map((conversation) => {
                    const peer = getConversationPeer(conversation, actorId);
                    const name =
                      getConversationDisplayName(conversation, actorId) ||
                      t("title");
                    const isOnline = Boolean(peer?.isOnline);
                    const rawUnread = conversation.unreadCount ?? 0;
                    const effectiveUnread =
                      getEffectiveConversationUnreadCount(conversation);
                    const timeLabel = formatCompactConversationTime(
                      conversation.lastMessageAt,
                      dateLocale,
                    );

                    return (
                      <button
                        key={conversation.id}
                        type="button"
                        data-testid={`floating-launcher-conv-${conversation.id}`}
                        onClick={() => onSelectConversation(conversation.id)}
                        className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition hover:bg-gray-100/90 dark:hover:bg-gray-800/80"
                      >
                        <div className="relative shrink-0">
                          <ChatAvatar
                            name={name}
                            src={peer?.avatarUrl}
                            className="h-10 w-10 text-xs"
                          />
                          {conversation.type === "ROOM" ? (
                            <span
                              aria-hidden="true"
                              className="absolute -end-0.5 -bottom-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-white bg-brand-50 text-brand-600 dark:border-gray-900 dark:bg-brand-500/20 dark:text-brand-300"
                            >
                              <GroupIcon className="h-2.5 w-2.5" />
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
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`truncate text-sm ${
                                effectiveUnread > 0
                                  ? "font-bold text-gray-900 dark:text-white"
                                  : "font-medium text-gray-800 dark:text-gray-100"
                              }`}
                            >
                              {name}
                            </span>
                            <span className="flex shrink-0 items-center gap-1 text-xs text-gray-400">
                              {conversation.isPinned && (
                                <PinStarIcon className="h-3 w-3 text-brand-500" />
                              )}
                              {timeLabel}
                            </span>
                          </div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <span
                              className={`truncate text-xs ${
                                effectiveUnread > 0
                                  ? "font-semibold text-gray-800 dark:text-gray-200"
                                  : "text-gray-500 dark:text-gray-400"
                              }`}
                            >
                              {conversation.lastMessagePreview ||
                                t("startConversation")}
                            </span>
                            {effectiveUnread > 0 && (
                              <span className="flex h-4.5 min-w-4.5 shrink-0 items-center justify-center rounded-full bg-brand-500 px-1 text-xs font-bold text-white tabular-nums">
                                {rawUnread > 99
                                  ? "99+"
                                  : rawUnread > 0
                                    ? rawUnread
                                    : "•"}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {activeHasNextPage && (
                  <div className="mt-1.5 px-2 text-center">
                    <button
                      type="button"
                      disabled={activeIsFetchingNextPage}
                      onClick={triggerLoadMore}
                      className="w-full rounded-lg border border-gray-200 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                    >
                      {activeIsFetchingNextPage
                        ? t("loadingOperation")
                        : t("loadMoreConversations")}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Organization Members section for quick 1-1 chat */}
            {suggestedCandidates.length > 0 && (
              <div className={visibleConversations.length > 0 ? "mt-3" : ""}>
                <p className="px-2.5 pb-1 text-xs font-semibold tracking-wide text-gray-400 uppercase dark:text-gray-500">
                  {t("organizationMembers")}
                </p>
                <div className="space-y-0.5">
                  {suggestedCandidates.slice(0, 12).map((candidate) => {
                    const isOpening = pendingCandidateId === candidate.id;
                    return (
                      <button
                        key={candidate.id}
                        type="button"
                        disabled={Boolean(pendingCandidateId)}
                        aria-label={t("startChatWith", {
                          name: candidate.fullName,
                        })}
                        onClick={() => void handleStartDirect(candidate)}
                        className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-start transition hover:bg-gray-100/90 disabled:opacity-60 dark:hover:bg-gray-800/80"
                      >
                        <div className="relative shrink-0">
                          <ChatAvatar
                            name={candidate.fullName}
                            src={candidate.avatarUrl}
                            className="h-9 w-9 text-xs"
                          />
                          {candidate.isOnline && (
                            <span
                              aria-hidden="true"
                              className="absolute end-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-success-500 dark:border-gray-900"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-gray-800 dark:text-gray-100">
                            {candidate.fullName}
                          </span>
                          <span className="block truncate text-xs text-gray-500 dark:text-gray-400">
                            {isOpening
                              ? t("startingDirectChat")
                              : candidate.email ||
                                (candidate.isOnline
                                  ? t("online")
                                  : t("offline"))}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {visibleConversations.length === 0 &&
              suggestedCandidates.length === 0 && (
                <p
                  role={isSearchPending ? "status" : undefined}
                  className="px-3 py-8 text-center text-xs text-gray-500 dark:text-gray-400"
                >
                  {isSearchPending
                    ? t("loadingOperation")
                    : trimmedSearch
                      ? t("noConversationMatches")
                      : t("noConversations")}
                </p>
              )}
          </>
        )}
      </div>
    </section>
  );
}
