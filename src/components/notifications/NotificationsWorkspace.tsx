"use client";

import React, { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
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
import { ApiError, isAccessOrResourceUnavailableError } from "@/lib/api-client";
import {
  notificationsApi,
  useInfiniteNotificationsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
  useUnreadNotificationCountQuery,
  type NotificationItem,
} from "@/lib/queries/notifications/useNotifications";
import { useChatNavigation } from "@/stores/chat-navigation";
import { BackgroundRefreshError, UpdatingStatus } from "@/components/ui/loading/AsyncStatus";
import {
  formatRelativeNotificationTime,
  resolveDefaultTargetUrl,
  resolveNotificationCategory,
} from "./notification-utils";

function NotificationCenterIcon({ item }: { item: NotificationItem }) {
  const category = resolveNotificationCategory(item);
  if (item.type === "TASK_DEADLINE_OVERDUE") {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-error-50 text-error-600 dark:bg-error-500/15 dark:text-error-400">
        <AlertIcon className="h-5 w-5" />
      </span>
    );
  }
  if (item.type === "TASK_DEADLINE_APPROACHING") {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400">
        <TimeIcon className="h-5 w-5" />
      </span>
    );
  }
  if (category === "TASK") {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
        <TaskIcon className="h-5 w-5" />
      </span>
    );
  }
  if (category === "WORK_NOTE") {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-500/15 dark:text-purple-400">
        <DocsIcon className="h-5 w-5" />
      </span>
    );
  }
  if (category === "CHAT") {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-light-50 text-blue-light-600 dark:bg-blue-light-500/15 dark:text-blue-light-400">
        <ChatIcon className="h-5 w-5" />
      </span>
    );
  }
  if (category === "PROJECT") {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400">
        <PlatformProjectsIcon className="h-5 w-5" />
      </span>
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
      <PlatformBuildingIcon className="h-5 w-5" />
    </span>
  );
}

export default function NotificationsWorkspace() {
  const t = useTranslations("header.notifications");
  const common = useTranslations("common");
  const router = useRouter();
  const openChatMessage = useChatNavigation((state) => state.open);
  const currentUser = useCurrentUserQuery();
  const currentUserAccessLost = isAccessOrResourceUnavailableError(currentUser.error);
  const userId = currentUserAccessLost ? null : currentUser.data?.id ?? null;

  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [unavailableMessage, setUnavailableMessage] = useState<string | null>(
    null,
  );
  const [resolveErrorItem, setResolveErrorItem] =
    useState<NotificationItem | null>(null);

  const isUnreadOnly = filter === "unread";
  const unreadQuery = useUnreadNotificationCountQuery(Boolean(userId));
  const infiniteQuery = useInfiniteNotificationsQuery({
    unreadOnly: isUnreadOnly,
    limit: 20,
    enabled: Boolean(userId),
  });
  const markReadMutation = useMarkNotificationReadMutation();
  const markAllReadMutation = useMarkAllNotificationsReadMutation();

  const notificationsAccessLost = currentUserAccessLost || isAccessOrResourceUnavailableError(infiniteQuery.error);
  const unreadAccessLost = currentUserAccessLost || isAccessOrResourceUnavailableError(unreadQuery.error);
  const pages = notificationsAccessLost ? [] : (infiniteQuery.data?.pages ?? []);
  const items = pages.flatMap((page) => page?.items ?? []);
  const unreadCount =
    (unreadAccessLost ? undefined : unreadQuery.data?.count) ?? pages[0]?.unreadCount ?? 0;

  async function handleOpenNotification(item: NotificationItem) {
    setUnavailableMessage(null);
    setResolveErrorItem(null);
    if (!item.readAt) {
      void markReadMutation.mutateAsync(item.id).catch(() => undefined);
    }

    try {
      const resolution = await notificationsApi.resolveTarget(item.id);
      if (!resolution.available) {
        setUnavailableMessage(t("contentUnavailableTitle"));
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
      router.push(url);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("continuum:deep-link", { detail: { url } }),
        );
      }
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.status === 403 || error.status === 404 || error.status === 410)
      ) {
        setUnavailableMessage(t("contentUnavailableTitle"));
        return;
      }
      setResolveErrorItem(item);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xs sm:p-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex items-center gap-3.5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-400">
            <PlatformBellIcon className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-lg font-semibold text-gray-900 sm:text-xl dark:text-white">
                {t("title")}
              </h1>
              {unreadCount > 0 && (
                <span
                  data-testid="notifications-page-unread-badge"
                  className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-600 tabular-nums dark:bg-brand-500/15 dark:text-brand-400"
                >
                  {t("unreadBadge", { count: unreadCount })}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-xs text-gray-500 sm:text-sm dark:text-gray-400">
              {t("subtitle")}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            role="tablist"
            className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-800/70"
          >
            <button
              type="button"
              role="tab"
              aria-selected={filter === "all"}
              onClick={() => setFilter("all")}
              data-testid="notifications-filter-all"
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                filter === "all"
                  ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-900 dark:text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              {t("filterAll")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === "unread"}
              onClick={() => setFilter("unread")}
              data-testid="notifications-filter-unread"
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                filter === "unread"
                  ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-900 dark:text-white"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
              }`}
            >
              <span>{t("filterUnread")}</span>
              <span className="rounded-full bg-brand-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-brand-600 tabular-nums dark:text-brand-400">
                {unreadCount}
              </span>
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={() => void markAllReadMutation.mutateAsync()}
              disabled={markAllReadMutation.isPending}
              data-testid="notifications-page-mark-all-read"
              className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
            >
              {t("markAllRead")}
            </button>
          )}
        </div>
      </div>

      {/* Safe Deleted / Forbidden Resource Fallback Notice */}
      {unavailableMessage && (
        <div
          role="alert"
          data-testid="notifications-page-unavailable-banner"
          className="flex items-start justify-between gap-3 rounded-2xl border border-warning-200 bg-warning-50 p-4 text-sm text-warning-900 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200"
        >
          <div className="flex items-start gap-3">
            <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-warning-600 dark:text-warning-400" />
            <div>
              <p className="font-semibold">{unavailableMessage}</p>
              <p className="mt-0.5 text-xs text-warning-700 dark:text-warning-300">
                {t("contentUnavailableDescription")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setUnavailableMessage(null)}
            aria-label={t("dismissNotice")}
            className="text-warning-700 hover:text-warning-900 dark:text-warning-300"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {resolveErrorItem && (
        <div
          role="alert"
          data-testid="notifications-page-resolve-error-banner"
          className="flex items-start justify-between gap-3 rounded-2xl border border-error-200 bg-error-50 p-4 text-sm text-error-900 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-200"
        >
          <div className="flex items-start gap-3">
            <AlertIcon className="mt-0.5 h-5 w-5 shrink-0 text-error-600 dark:text-error-400" />
            <div>
              <p className="font-semibold">{t("errorTitle")}</p>
              <p className="mt-0.5 text-xs text-error-700 dark:text-error-300">
                {t("errorDescription")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleOpenNotification(resolveErrorItem)}
            data-testid="notifications-page-resolve-retry"
            className="shrink-0 rounded-xl border border-error-300 bg-white px-3 py-1.5 text-xs font-medium text-error-700 hover:bg-error-100 dark:border-error-500/40 dark:bg-gray-900 dark:text-error-300"
          >
            {t("retry")}
          </button>
        </div>
      )}

      {/* Notification List */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        {!notificationsAccessLost && infiniteQuery.isFetching && items.length > 0 && (
          <div className="border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <UpdatingStatus>{common("updating")}</UpdatingStatus>
          </div>
        )}
        {!notificationsAccessLost && infiniteQuery.isRefetchError && items.length > 0 && (
          <div className="border-b border-gray-100 p-3 dark:border-gray-800">
            <BackgroundRefreshError
              retryLabel={common("retry")}
              onRetry={() => void infiniteQuery.refetch()}
            >
              {common("updateFailed")}
            </BackgroundRefreshError>
          </div>
        )}
        {infiniteQuery.isLoading ? (
          <div
            role="status"
            data-testid="notifications-page-loading"
            className="divide-y divide-gray-100 dark:divide-gray-800"
          >
            {[0, 1, 2, 3].map((idx) => (
              <div key={idx} className="flex items-start gap-3.5 p-4 sm:p-5">
                <div className="h-10 w-10 shrink-0 motion-safe:animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 motion-safe:animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                  <div className="h-3.5 w-3/4 motion-safe:animate-pulse rounded bg-gray-100 dark:bg-gray-800" />
                </div>
              </div>
            ))}
          </div>
        ) : infiniteQuery.isError && items.length === 0 ? (
          <div
            role="alert"
            data-testid="notifications-page-error"
            className="flex flex-col items-center justify-center px-6 py-14 text-center"
          >
            <AlertIcon className="mb-3 h-7 w-7 text-error-500" />
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {t("errorTitle")}
            </h2>
            <p className="mt-1 max-w-md text-xs text-gray-500 sm:text-sm dark:text-gray-400">
              {t("errorDescription")}
            </p>
            <button
              type="button"
              onClick={() => void infiniteQuery.refetch()}
              className="mt-4 rounded-xl border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t("retry")}
            </button>
          </div>
        ) : items.length === 0 ? (
          <div
            data-testid="notifications-page-empty"
            className="flex flex-col items-center justify-center px-6 py-16 text-center"
          >
            <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <CheckCircleIcon className="h-6 w-6" />
            </span>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">
              {isUnreadOnly ? t("emptyUnreadTitle") : t("emptyTitle")}
            </h2>
            <p className="mt-1 max-w-md text-xs text-gray-500 sm:text-sm dark:text-gray-400">
              {isUnreadOnly
                ? t("emptyUnreadDescription")
                : t("emptyDescription")}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item) => {
              const isUnread = !item.readAt;
              const category = resolveNotificationCategory(item);
              return (
                <li
                  key={item.id}
                  className={`flex items-start justify-between gap-4 p-4 transition-colors sm:p-5 ${
                    isUnread
                      ? "bg-brand-50/40 hover:bg-brand-50/70 dark:bg-brand-500/5 dark:hover:bg-brand-500/10"
                      : "hover:bg-gray-50 dark:hover:bg-white/[0.02]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => void handleOpenNotification(item)}
                    data-testid={`notifications-page-item-${item.id}`}
                    className="flex min-w-0 flex-1 items-start gap-3.5 text-start"
                  >
                    <NotificationCenterIcon item={item} />

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                          {t(`categories.${category}`)}
                        </span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                          {item.title}
                        </span>
                        {isUnread && (
                          <span
                            aria-hidden="true"
                            className="h-2 w-2 rounded-full bg-brand-500"
                          />
                        )}
                      </div>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {item.message}
                      </p>
                      <span className="mt-1.5 block text-xs text-gray-500 tabular-nums dark:text-gray-400">
                        {formatRelativeNotificationTime(item.createdAt, t)}
                      </span>
                    </div>
                  </button>

                  {isUnread && (
                    <button
                      type="button"
                      onClick={() => void markReadMutation.mutateAsync(item.id)}
                      data-testid={`notifications-page-mark-read-${item.id}`}
                      className="shrink-0 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                    >
                      {t("markRead")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {infiniteQuery.hasNextPage && (
          <div className="border-t border-gray-100 p-4 text-center dark:border-gray-800">
            <button
              type="button"
              onClick={() => void infiniteQuery.fetchNextPage()}
              disabled={infiniteQuery.isFetchingNextPage}
              className="rounded-xl border border-gray-200 px-4 py-2 text-xs font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {t("loadMore")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
