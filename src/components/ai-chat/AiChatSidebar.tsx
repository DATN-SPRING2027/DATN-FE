"use client";

import { useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  AlertIcon,
  CheckLineIcon,
  CloseLineIcon,
  ComposeChatIcon,
  FolderIcon,
  PencilIcon,
  PinStarIcon,
  SearchIcon,
  SidebarPanelIcon,
  TrashBinIcon,
} from "@/icons";
import type { AiChatThread } from "@/lib/queries/ai-chat/ai-chat.types";
import { cn } from "@/utils";

export interface AiChatSidebarProps {
  projectId: string;
  projectCode: string;
  projectName: string;
  threads: readonly AiChatThread[];
  pinnedThreadIds: ReadonlySet<string>;
  activeThreadId: string | null;
  isLoading: boolean;
  isError: boolean;
  isDesktopOpen: boolean;
  isMobileOpen: boolean;
  isCreatingThread: boolean;
  onStartNewChat: () => void;
  onSelectThread: (threadId: string) => void;
  onTogglePinThread: (threadId: string) => void;
  onRenameThread: (threadId: string, title: string) => Promise<void>;
  onDeleteThread: (threadId: string) => Promise<void>;
  onRetryThreads: () => void;
  onCollapseDesktop: () => void;
  onCloseMobile: () => void;
}

export default function AiChatSidebar({
  projectId,
  projectCode,
  projectName,
  threads,
  pinnedThreadIds,
  activeThreadId,
  isLoading,
  isError,
  isDesktopOpen,
  isMobileOpen,
  isCreatingThread,
  onStartNewChat,
  onSelectThread,
  onTogglePinThread,
  onRenameThread,
  onDeleteThread,
  onRetryThreads,
  onCollapseDesktop,
  onCloseMobile,
}: AiChatSidebarProps) {
  const t = useTranslations("AiChat");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [renameError, setRenameError] = useState<string | null>(null);
  const [savingRenameId, setSavingRenameId] = useState<string | null>(null);
  const [deletingThreadId, setDeletingThreadId] = useState<string | null>(null);

  if (!isDesktopOpen && !isMobileOpen) {
    return null;
  }

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredThreads = normalizedQuery
    ? threads.filter((thread) =>
        thread.title.toLowerCase().includes(normalizedQuery),
      )
    : threads;

  const pinnedThreads = filteredThreads.filter((thread) =>
    pinnedThreadIds.has(thread.id),
  );
  const recentThreads = filteredThreads.filter(
    (thread) => !pinnedThreadIds.has(thread.id),
  );

  const beginRename = (thread: AiChatThread) => {
    setEditingThreadId(thread.id);
    setEditingTitle(thread.title);
    setRenameError(null);
  };

  const cancelRename = () => {
    setEditingThreadId(null);
    setEditingTitle("");
    setRenameError(null);
  };

  const submitRename = async (event?: FormEvent) => {
    event?.preventDefault();
    if (!editingThreadId || savingRenameId) return;
    const trimmed = editingTitle.trim();
    if (!trimmed || trimmed.length > 200) {
      setRenameError(t("renameValidation"));
      return;
    }
    setSavingRenameId(editingThreadId);
    setRenameError(null);
    try {
      await onRenameThread(editingThreadId, trimmed);
      setEditingThreadId(null);
      setEditingTitle("");
    } catch {
      setRenameError(t("threadsError"));
    } finally {
      setSavingRenameId(null);
    }
  };

  const handleRenameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelRename();
    }
  };

  const handleDelete = async (threadId: string) => {
    if (deletingThreadId) return;
    setDeletingThreadId(threadId);
    try {
      await onDeleteThread(threadId);
    } finally {
      setDeletingThreadId(null);
    }
  };

  const renderThreadRow = (thread: AiChatThread) => {
    const isActive = thread.id === activeThreadId;
    const isPinned = pinnedThreadIds.has(thread.id);
    const isEditing = editingThreadId === thread.id;
    const isDeleting = deletingThreadId === thread.id;

    if (isEditing) {
      return (
        <li
          key={thread.id}
          className="rounded-lg border border-brand-400 bg-white p-1.5 dark:border-brand-500/60 dark:bg-gpt-composer"
        >
          <form
            onSubmit={(event) => void submitRename(event)}
            className="space-y-1.5"
          >
            <div className="flex items-center gap-1">
              <input
                type="text"
                value={editingTitle}
                onChange={(event) => setEditingTitle(event.target.value)}
                onKeyDown={handleRenameKeyDown}
                aria-label={t("renameInputLabel")}
                maxLength={200}
                autoFocus
                className="h-7 min-w-0 flex-1 rounded bg-transparent px-2 text-xs text-gray-900 focus:outline-none dark:text-gray-100"
              />
              <button
                type="submit"
                aria-label={t("renameSave")}
                disabled={savingRenameId === thread.id}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded bg-brand-500 text-white hover:bg-brand-600"
              >
                <CheckLineIcon aria-hidden="true" className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={cancelRename}
                aria-label={t("renameCancel")}
                className="inline-flex size-6 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
              >
                <CloseLineIcon aria-hidden="true" className="size-3" />
              </button>
            </div>
            {renameError && (
              <p
                role="alert"
                className="px-1 text-xs text-error-600 dark:text-error-400"
              >
                {renameError}
              </p>
            )}
          </form>
        </li>
      );
    }

    return (
      <li key={thread.id}>
        <div
          className={cn(
            "group flex items-center gap-1 rounded-lg px-2.5 py-1.5 transition-colors",
            isActive
              ? "bg-gray-200/90 font-medium text-gray-900 dark:bg-white/10 dark:text-white"
              : "text-gray-700 hover:bg-gray-200/60 dark:text-gray-300 dark:hover:bg-white/6",
          )}
        >
          <button
            type="button"
            onClick={() => {
              onSelectThread(thread.id);
              onCloseMobile();
            }}
            title={thread.title}
            className="min-w-0 flex-1 truncate py-0.5 text-start text-xs leading-5 sm:text-theme-sm"
          >
            {thread.title}
          </button>

          <div
            className={cn(
              "flex shrink-0 items-center gap-0.5 transition-opacity",
              isActive
                ? "opacity-90"
                : "opacity-0 group-hover:opacity-100 focus-within:opacity-100 max-md:opacity-80",
            )}
          >
            <button
              type="button"
              onClick={() => onTogglePinThread(thread.id)}
              aria-label={
                isPinned
                  ? t("unpinThreadNamed", { title: thread.title })
                  : t("pinThreadNamed", { title: thread.title })
              }
              className={cn(
                "inline-flex size-6 items-center justify-center rounded transition-colors",
                isPinned
                  ? "text-warning-500 hover:bg-gray-300/60 dark:text-warning-400 dark:hover:bg-white/10"
                  : "text-gray-400 hover:bg-gray-300/60 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white",
              )}
            >
              <PinStarIcon aria-hidden="true" className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => beginRename(thread)}
              aria-label={t("renameThreadNamed", { title: thread.title })}
              className="inline-flex size-6 items-center justify-center rounded text-gray-400 hover:bg-gray-300/60 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <PencilIcon aria-hidden="true" className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(thread.id)}
              disabled={isDeleting}
              aria-busy={isDeleting}
              aria-label={t("deleteThreadNamed", { title: thread.title })}
              className="inline-flex size-6 items-center justify-center rounded text-gray-400 hover:bg-error-50 hover:text-error-600 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-error-500/15 dark:hover:text-error-400"
            >
              <TrashBinIcon aria-hidden="true" className="size-3.5" />
            </button>
          </div>
        </div>
      </li>
    );
  };

  return (
    <>
      {isMobileOpen && (
        <button
          type="button"
          aria-label={t("closeSidebar")}
          onClick={onCloseMobile}
          className="absolute inset-0 z-30 bg-gray-950/60 backdrop-blur-xs md:hidden"
        />
      )}

      <aside
        aria-label={t("sidebarAriaLabel")}
        className={cn(
          "h-full w-64 shrink-0 flex-col border-e border-gray-200/80 bg-gray-50/95 select-none dark:border-white/10 dark:bg-gpt-sidebar",
          isMobileOpen
            ? "max-md:absolute max-md:inset-y-0 max-md:start-0 max-md:z-40 max-md:flex max-md:shadow-theme-xl"
            : "max-md:hidden",
          isDesktopOpen ? "md:flex" : "md:hidden",
        )}
      >
        {/* ChatGPT Top Row: Flat "New chat" + Search Icon + Sidebar Collapse */}
        <div className="flex h-13 shrink-0 items-center justify-between gap-1 px-2.5">
          <button
            type="button"
            onClick={() => {
              onStartNewChat();
              onCloseMobile();
            }}
            disabled={isCreatingThread}
            aria-busy={isCreatingThread}
            className={cn(
              "inline-flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1.5 text-start text-xs font-medium transition-colors sm:text-theme-sm",
              activeThreadId === null
                ? "bg-gray-200/80 text-gray-900 dark:bg-white/10 dark:text-white"
                : "text-gray-700 hover:bg-gray-200/60 dark:text-gray-200 dark:hover:bg-white/6",
            )}
          >
            <ComposeChatIcon aria-hidden="true" className="size-4 shrink-0" />
            <span className="truncate">
              {isCreatingThread ? t("newChatCreating") : t("newChat")}
            </span>
          </button>

          <div className="flex shrink-0 items-center gap-0.5">
            <button
              type="button"
              aria-label={t("searchThreadsLabel")}
              aria-expanded={isSearchOpen}
              onClick={() => {
                setIsSearchOpen((prev) => {
                  if (prev) setSearchQuery("");
                  return !prev;
                });
              }}
              className={cn(
                "inline-flex size-8 items-center justify-center rounded-lg transition-colors",
                isSearchOpen || normalizedQuery
                  ? "bg-gray-200/80 text-gray-900 dark:bg-white/10 dark:text-white"
                  : "text-gray-500 hover:bg-gray-200/70 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-100",
              )}
            >
              <SearchIcon aria-hidden="true" className="size-4" />
            </button>

            <button
              type="button"
              onClick={onCollapseDesktop}
              aria-label={t("collapseSidebar")}
              className="hidden size-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-200/70 hover:text-gray-900 md:inline-flex dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-100"
            >
              <SidebarPanelIcon aria-hidden="true" className="size-4" />
            </button>

            <button
              type="button"
              onClick={onCloseMobile}
              aria-label={t("closeSidebar")}
              className="inline-flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-200/70 hover:text-gray-900 md:hidden dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-gray-100"
            >
              <CloseLineIcon aria-hidden="true" className="size-4" />
            </button>
          </div>
        </div>

        {/* Collapsible Search Input */}
        {(isSearchOpen || Boolean(normalizedQuery)) && (
          <div className="shrink-0 px-2.5 pb-2">
            <div className="relative flex items-center">
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                aria-label={t("searchThreadsLabel")}
                placeholder={t("searchThreadsPlaceholder")}
                autoFocus
                className="h-8 w-full rounded-lg border border-gray-200 bg-white ps-2.5 pe-7 text-xs text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-white/10 dark:bg-gpt-composer dark:text-gray-100 dark:placeholder:text-gray-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  aria-label={t("clearSearch")}
                  onClick={() => setSearchQuery("")}
                  className="absolute end-1.5 inline-flex size-5 items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                >
                  <CloseLineIcon aria-hidden="true" className="size-3" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Scrollable Pinned & Recent Threads */}
        <div className="no-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-2 py-2">
          {isLoading ? (
            <div
              role="status"
              aria-label={t("threadsLoading")}
              className="space-y-1.5 px-1 py-1"
            >
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-8 animate-pulse rounded-lg bg-gray-200/70 dark:bg-white/6"
                />
              ))}
            </div>
          ) : isError ? (
            <div
              role="alert"
              className="mx-1 mt-2 rounded-xl border border-error-200 bg-error-50 p-3 text-xs text-error-700 dark:border-error-800/60 dark:bg-error-500/10 dark:text-error-300"
            >
              <div className="flex items-start gap-2">
                <AlertIcon
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0"
                />
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="leading-relaxed">{t("threadsError")}</p>
                  <button
                    type="button"
                    onClick={onRetryThreads}
                    className="inline-flex items-center rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-error-700 ring-1 ring-error-200 hover:bg-error-50 dark:bg-gpt-composer dark:text-error-300 dark:ring-error-800"
                  >
                    {t("retryAction")}
                  </button>
                </div>
              </div>
            </div>
          ) : filteredThreads.length === 0 ? (
            <p className="px-2.5 py-6 text-center text-xs text-gray-400 dark:text-gray-500">
              {normalizedQuery ? t("threadsNoMatch") : t("threadsEmpty")}
            </p>
          ) : (
            <>
              {pinnedThreads.length > 0 && (
                <div>
                  <div className="mb-1 px-2.5 text-xs font-medium text-gray-400 dark:text-gray-500">
                    {t("pinnedSectionTitle")}
                  </div>
                  <ul className="space-y-0.5">
                    {pinnedThreads.map((thread) => renderThreadRow(thread))}
                  </ul>
                </div>
              )}

              {recentThreads.length > 0 && (
                <div>
                  <div className="mb-1 px-2.5 text-xs font-medium text-gray-400 dark:text-gray-500">
                    {t("recentSectionTitle")}
                  </div>
                  <ul className="space-y-0.5">
                    {recentThreads.map((thread) => renderThreadRow(thread))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>

        {/* ChatGPT Bottom Project Folder Row (like "DATN_SP27" in ChatGPT sidebar) */}
        <div className="shrink-0 border-t border-gray-200/70 p-2 dark:border-white/8">
          <Link
            href={`/projects/${encodeURIComponent(projectId)}/documents`}
            onClick={onCloseMobile}
            title={projectName}
            className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200/60 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/6 dark:hover:text-white"
          >
            <FolderIcon
              aria-hidden="true"
              className="size-4 shrink-0 text-gray-400 dark:text-gray-400"
            />
            <span className="truncate font-semibold">{projectCode}</span>
            <span className="truncate text-gray-400 dark:text-gray-500">
              · {projectName}
            </span>
          </Link>
        </div>
      </aside>
    </>
  );
}
