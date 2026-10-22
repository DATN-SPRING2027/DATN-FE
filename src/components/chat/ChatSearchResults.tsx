"use client";

import type { ChatMessage } from "@/lib/queries/chat/useChat";
import { useTranslations } from "next-intl";
import HighlightedText from "./HighlightedText";

export default function ChatSearchResults({
  search,
  onChange,
  results,
  loading,
  error,
  hasMore,
  onMore,
  onSelect,
}: {
  search: string;
  onChange: (value: string) => void;
  results: readonly ChatMessage[];
  loading: boolean;
  error: boolean;
  hasMore: boolean;
  onMore: () => void;
  onSelect: (message: ChatMessage) => void;
}) {
  const t = useTranslations("chat");
  return (
    <>
      <label className="block">
        <span className="sr-only">{t("searchMessages")}</span>
        <input
          type="search"
          value={search}
          maxLength={80}
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("searchMessages")}
          className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 text-sm outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-950"
        />
      </label>
      <div
        aria-live="polite"
        className="text-sm text-gray-600 dark:text-gray-300"
      >
        {search.trim().length < 2
          ? t("searchHint")
          : loading
            ? t("searchingMessages")
            : error
              ? t("messageSearchError")
              : results.length === 0
                ? t("noMessageMatches")
                : t("messageSearchResults", { count: results.length })}
      </div>
      {search.trim().length >= 2 && !error && (
        <ul className="space-y-2">
          {results.map((message) => (
            <li key={message.id}>
              <button
                type="button"
                onClick={() => onSelect(message)}
                className="w-full space-y-2 rounded-xl border border-gray-200 p-3 text-start transition hover:border-brand-300 hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-800 dark:hover:bg-gray-800"
              >
                <span className="flex flex-wrap items-baseline justify-between gap-1 text-xs text-gray-600 dark:text-gray-400">
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    {message.senderName}
                  </span>
                  <time dateTime={message.createdAt}>
                    {new Date(message.createdAt).toLocaleString()}
                  </time>
                </span>
                <span className="line-clamp-4 block text-sm break-words text-gray-900 dark:text-gray-100">
                  <HighlightedText
                    text={
                      message.content ||
                      message.attachments.map((item) => item.name).join(", ")
                    }
                    query={search}
                  />
                </span>
                <span className="block text-xs font-medium text-brand-600 dark:text-brand-300">
                  {t("viewMessageContext")} →
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {hasMore && (
        <button
          type="button"
          disabled={loading}
          onClick={onMore}
          className="min-h-11 w-full rounded-xl bg-gray-100 text-sm font-medium disabled:opacity-50 dark:bg-gray-800"
        >
          {t("loadEarlier")}
        </button>
      )}
    </>
  );
}
