"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { Link, useRouter } from "@/i18n/navigation";
import {
  AlertIcon,
  ChatIcon,
  CheckCircleIcon,
  CloseIcon,
  DocsIcon,
  PlatformBellIcon,
  PlatformBuildingIcon,
  PlatformProjectsIcon,
  TaskIcon,
  TimeIcon,
} from "@/icons";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import {
  notificationsApi,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useNotificationRealtimeSubscription,
  useNotificationsQuery,
  useUnreadNotificationCountQuery,
  type NotificationItem,
} from "@/lib/queries/notifications/useNotifications";
import { useChatNavigation } from "@/stores/chat-navigation";
import {
  formatRelativeNotificationTime,
  resolveDefaultTargetUrl,
  resolveNotificationCategory,
} from "../notifications/notification-utils";

function NotificationTypeBadge({ item }: { item: NotificationItem }) {
  const category = resolveNotificationCategory(item);
  const isOverdue = item.type === "TASK_DEADLINE_OVERDUE";
  const isApproaching = item.type === "TASK_DEADLINE_APPROACHING";

  if (isOverdue) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400">
        <AlertIcon className="h-4.5 w-4.5" />
      </span>
    );
  }
  if (isApproaching) {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400">
        <TimeIcon className="h-4.5 w-4.5" />
      </span>
    );
  }
  if (category === "TASK") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
        <TaskIcon className="h-4.5 w-4.5" />
      </span>
    );
  }
  if (category === "WORK_NOTE") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400">
        <DocsIcon className="h-4.5 w-4.5" />
      </span>
    );
  }
  if (category === "CHAT") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-light-50 text-blue-light-600 dark:bg-blue-light-500/15 dark:text-blue-light-400">
        <ChatIcon className="h-4.5 w-4.5" />
      </span>
    );
  }
  if (category === "PROJECT") {
    return (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400">
        <PlatformProjectsIcon className="h-4.5 w-4.5" />
      </span>
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
      <PlatformBuildingIcon className="h-4.5 w-4.5" />
    </span>
  );
}

export default function NotificationDropdown() {
  const t = useTranslations("header.notifications");
  const router = useRouter();
  const openChatMessage = useChatNavigation((state) => state.open);
  const currentUser = useCurrentUserQuery();
  const userId = currentUser.data?.id ?? null;
  const organizationId =
    currentUser.data && "organizationId" in currentUser.data
      ? (currentUser.data.organizationId ?? null)
      : null;

  useNotificationRealtimeSubscription(userId, organizationId);

  const [isOpen, setIsOpen] = useState(false);
  const [unavailableNotice, setUnavailableNotice] = useState<string | null>(
    null,
  );

  const isAuthenticated = Boolean(userId);
  const unreadQuery = useUnreadNotificationCountQuery(isAuthenticated);
  const listQuery = useNotificationsQuery({
    limit: 12,
    enabled: isAuthenticated,
  });
  const markReadMutation = useMarkNotificationReadMutation();
  const markAllReadMutation = useMarkAllNotificationsReadMutation();

  const items = listQuery.data?.items ?? [];
  const unreadCount =
    unreadQuery.data?.count ?? listQuery.data?.unreadCount ?? 0;

  function toggleDropdown() {
    setIsOpen((prev) => !prev);
    setUnavailableNotice(null);
  }

  function closeDropdown() {
    setIsOpen(false);
  }

  async function handleNotificationClick(item: NotificationItem) {
    setUnavailableNotice(null);
    if (!item.readAt) {
      void markReadMutation.mutateAsync(item.id).catch(() => undefined);
    }

    try {
      const resolution = await notificationsApi.resolveTarget(item.id);
      if (!resolution.available) {
        setUnavailableNotice(t("contentUnavailableTitle"));
        return;
      }
      const target = resolution.target ?? item.target;
      const url =
        resolution.url ?? target?.url ?? resolveDefaultTargetUrl(item);
      if (
        target?.kind === "CHAT" &&
        target.conversationId &&
        target.messageId
      ) {
        openChatMessage(target.conversationId, target.messageId);
      }
      closeDropdown();
      router.push(url);
    } catch {
      const fallbackUrl = resolveDefaultTargetUrl(item);
      closeDropdown();
      router.push(fallbackUrl);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        className="dropdown-toggle relative flex h-11 w-11 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={toggleDropdown}
        aria-label={t("title")}
        aria-expanded={isOpen}
        data-testid="notification-bell-button"
      >
        {unreadCount > 0 && (
          <span
            data-testid="notification-unread-badge"
            className="absolute -top-1 -end-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500 px-1 text-[11px] font-semibold text-white tabular-nums shadow-theme-xs"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
        <PlatformBellIcon className="h-5 w-5" />
      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute end-0 mt-[17px] flex max-h-[520px] w-[360px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg sm:w-[390px] dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="mb-2.5 flex items-center justify-between border-b border-gray-100 pb-2.5 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <h5 className="text-base font-semibold text-gray-800 dark:text-white/90">
              {t("title")}
            </h5>
            {unreadCount > 0 && (
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600 tabular-nums dark:bg-brand-500/15 dark:text-brand-400">
                {t("unreadBadge", { count: unreadCount })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllReadMutation.mutateAsync()}
                disabled={markAllReadMutation.isPending}
                data-testid="notification-mark-all-read"
                className="text-xs font-medium text-brand-600 transition hover:text-brand-700 disabled:opacity-50 dark:text-brand-400 dark:hover:text-brand-300"
              >
                {t("markAllRead")}
              </button>
            )}
            <button
              type="button"
              onClick={closeDropdown}
              aria-label={t("dismissNotice")}
              className="text-gray-500 transition hover:text-gray-700 dark:text-gray-400 dark:hover:text-white"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        {unavailableNotice && (
          <div
            role="alert"
            data-testid="notification-unavailable-alert"
            className="mb-2.5 flex items-start justify-between gap-2 rounded-xl border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300"
          >
            <div>
              <p className="font-semibold">{unavailableNotice}</p>
              <p className="mt-0.5 text-warning-700 dark:text-warning-400">
                {t("contentUnavailableDescription")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUnavailableNotice(null)}
              className="shrink-0 text-warning-700 hover:text-warning-900 dark:text-warning-300"
              aria-label={t("dismissNotice")}
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className="custom-scrollbar flex-1 overflow-y-auto">
          {listQuery.isLoading ? (
            <div
              role="status"
              data-testid="notification-loading-state"
              className="space-y-2 py-2"
            >
              {[0, 1, 2].map((idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 rounded-xl p-3"
                >
                  <div className="h-9 w-9 shrink-0 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 w-2/3 animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                    <div className="h-3 w-full animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                  </div>
                </div>
              ))}
            </div>
          ) : listQuery.isError ? (
            <div
              role="alert"
              data-testid="notification-error-state"
              className="flex flex-col items-center justify-center px-4 py-8 text-center"
            >
              <AlertIcon className="mb-2 h-6 w-6 text-error-500" />
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {t("errorTitle")}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("errorDescription")}
              </p>
              <button
                type="button"
                onClick={() => void listQuery.refetch()}
                className="mt-3 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {t("retry")}
              </button>
            </div>
          ) : items.length === 0 ? (
            <div
              data-testid="notification-empty-state"
              className="flex flex-col items-center justify-center px-4 py-10 text-center"
            >
              <span className="mb-2.5 flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                <CheckCircleIcon className="h-5 w-5" />
              </span>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {t("emptyTitle")}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {t("emptyDescription")}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-1">
              {items.map((item) => {
                const isUnread = !item.readAt;
                return (
                  <li key={item.id}>
                    <div
                      className={`group flex items-start gap-3 rounded-xl p-2.5 transition-colors ${
                        isUnread
                          ? "bg-brand-50/60 hover:bg-brand-50 dark:bg-brand-500/10 dark:hover:bg-brand-500/15"
                          : "hover:bg-gray-50 dark:hover:bg-white/5"
                      }`}
                    >
                      <NotificationTypeBadge item={item} />

                      <button
                        type="button"
                        onClick={() => void handleNotificationClick(item)}
                        data-testid={`notification-item-${item.id}`}
                        className="min-w-0 flex-1 text-start"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-semibold text-gray-800 dark:text-white/90">
                            {item.title}
                          </span>
                          <span className="shrink-0 text-[11px] text-gray-500 tabular-nums dark:text-gray-400">
                            {formatRelativeNotificationTime(item.createdAt, t)}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-xs text-gray-600 dark:text-gray-300">
                          {item.message}
                        </p>
                      </button>

                      {isUnread && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            void markReadMutation.mutateAsync(item.id);
                          }}
                          title={t("markRead")}
                          aria-label={t("markRead")}
                          data-testid={`notification-mark-read-${item.id}`}
                          className="mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-brand-500 hover:bg-brand-100 dark:hover:bg-brand-500/20"
                        >
                          <span className="h-2 w-2 rounded-full bg-brand-500" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <Link
          href="/notifications"
          onClick={closeDropdown}
          data-testid="notification-view-all-link"
          className="mt-2.5 block rounded-xl border border-gray-200 bg-white px-4 py-2 text-center text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          {t("viewAll")}
        </Link>
      </Dropdown>
    </div>
  );
}
