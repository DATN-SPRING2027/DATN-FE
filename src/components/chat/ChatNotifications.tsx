"use client";
import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { chatFeatures } from "@/lib/queries/chat/features";
import { Dropdown } from "@/components/ui/dropdown/Dropdown";
import { useChatNavigation } from "@/stores/chat-navigation";

export default function ChatNotifications() {
  const t = useTranslations("chat");
  const currentUser = useCurrentUserQuery();
  const openMessage = useChatNavigation((state) => state.open);
  const actor = currentUser.data?.id ?? "";
  const org =
    currentUser.data && "organizationId" in currentUser.data
      ? currentUser.data.organizationId
      : "";
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState(false);
  const seen = useRef<Set<string> | null>(null);
  const key = ["chat", org, "notifications", actor];
  const query = useInfiniteQuery({
    queryKey: key,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => chatFeatures.notifications(pageParam),
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled: Boolean(actor && org),
    refetchInterval: 20000,
    retry: false,
  });
  const items = query.data?.pages.flatMap((page) => page.data) ?? [];
  const unread = items.filter((item) => !item.readAt).length;
  useEffect(() => {
    seen.current = null;
  }, [actor, org]);
  useEffect(() => {
    if (!query.data) return;
    const notifications = query.data.pages.flatMap((page) => page.data);
    const previous = seen.current;
    seen.current = new Set(notifications.map((item) => item.id));
    if (
      !previous ||
      typeof Notification === "undefined" ||
      Notification.permission !== "granted" ||
      document.visibilityState === "visible"
    )
      return;
    for (const item of notifications
      .filter((entry) => !entry.readAt && !previous.has(entry.id))
      .slice(0, 3)) {
      // Do not put private message bodies on the operating system's lock screen.
      new Notification(t("newChatNotification"), {
        body: item.senderName,
        tag: `chat-${item.id}`,
      });
    }
  }, [query.data, t]);
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t("chatNotifications")}
        aria-expanded={open}
        className="dropdown-toggle relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-300"
        onClick={() => setOpen(!open)}
      >
        <svg
          aria-hidden="true"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 rounded-full bg-brand-500 px-1.5 text-xs text-white">
            {unread}
          </span>
        )}
      </button>
      <Dropdown
        isOpen={open}
        onClose={() => setOpen(false)}
        className="absolute right-0 mt-3 max-h-[70dvh] w-[min(22rem,90vw)] overflow-auto rounded-xl border border-gray-200 bg-white p-4 shadow-theme-md dark:border-gray-700 dark:bg-gray-900"
      >
        <h2 className="mb-3 font-semibold text-gray-900 dark:text-white">
          {t("chatNotifications")}
        </h2>
        {query.isLoading && <p role="status">{t("loadingOperation")}</p>}
        {(query.isError || error) && (
          <p role="alert">{t("notificationsError")}</p>
        )}
        {query.isSuccess && !items.length && <p>{t("noNotifications")}</p>}
        {items.map((item) => (
          <Link
            key={item.id}
            href={`/chat?conversation=${encodeURIComponent(item.conversationId)}&message=${encodeURIComponent(item.messageId)}`}
            className={`mb-2 block rounded-lg p-3 text-sm ${item.readAt ? "" : "bg-brand-50 dark:bg-brand-500/10"}`}
            onClick={() => {
              openMessage(item.conversationId, item.messageId);
              setOpen(false);
              void chatFeatures
                .readNotification(item.id)
                .then(() => client.invalidateQueries({ queryKey: key }))
                .catch(() => setError(true));
            }}
          >
            <span className="block font-semibold">{item.senderName}</span>
            <span className="line-clamp-2 block">{item.preview}</span>
            <time className="text-xs text-gray-600 dark:text-gray-400">
              {new Date(item.createdAt).toLocaleString()}
            </time>
          </Link>
        ))}
        {query.hasNextPage && (
          <button
            className="my-2 underline"
            disabled={query.isFetchingNextPage}
            onClick={() => void query.fetchNextPage()}
          >
            {t("loadMoreConversations")}
          </button>
        )}
        {typeof Notification !== "undefined" &&
          Notification.permission === "default" && (
            <button
              className="mt-3 block text-sm underline"
              onClick={() => void Notification.requestPermission()}
            >
              {t("enableBrowserNotifications")}
            </button>
          )}
      </Dropdown>
    </div>
  );
}
