"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
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

export const AI_CHAT_SIDEBAR_DEFAULT_WIDTH = 260;
export const AI_CHAT_SIDEBAR_MIN_WIDTH = 200;
export const AI_CHAT_SIDEBAR_MAX_WIDTH = 480;
export const AI_CHAT_SIDEBAR_WIDTH_STORAGE_KEY =
  "continuum.aiChat.sidebarWidth";
const SIDEBAR_KEYBOARD_STEP = 16;

function clampSidebarWidth(
  rawWidth: number,
  containerWidth?: number | null,
): number {
  let maxAllowed = AI_CHAT_SIDEBAR_MAX_WIDTH;
  if (typeof containerWidth === "number" && containerWidth > 0) {
    maxAllowed = Math.max(
      AI_CHAT_SIDEBAR_MIN_WIDTH,
      Math.min(AI_CHAT_SIDEBAR_MAX_WIDTH, containerWidth - 340),
    );
  } else if (typeof window !== "undefined" && window.innerWidth >= 768) {
    maxAllowed = Math.max(
      AI_CHAT_SIDEBAR_MIN_WIDTH,
      Math.min(AI_CHAT_SIDEBAR_MAX_WIDTH, Math.floor(window.innerWidth * 0.55)),
    );
  }
  return Math.round(
    Math.min(maxAllowed, Math.max(AI_CHAT_SIDEBAR_MIN_WIDTH, rawWidth)),
  );
}

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

  const [sidebarWidth, setSidebarWidth] = useState<number>(
    AI_CHAT_SIDEBAR_DEFAULT_WIDTH,
  );
  const [isResizing, setIsResizing] = useState(false);
  const asideRef = useRef<HTMLElement | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const isDraggingRef = useRef(false);

  const commitSidebarWidth = useCallback((nextWidth: number) => {
    const parentWidth = asideRef.current?.parentElement?.clientWidth ?? null;
    const clamped = clampSidebarWidth(nextWidth, parentWidth);
    setSidebarWidth(clamped);
    try {
      window.localStorage.setItem(
        AI_CHAT_SIDEBAR_WIDTH_STORAGE_KEY,
        String(clamped),
      );
    } catch {
      // Ignore storage quota / private mode failures
    }
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(
        AI_CHAT_SIDEBAR_WIDTH_STORAGE_KEY,
      );
      if (saved !== null) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed)) {
          const parentWidth =
            asideRef.current?.parentElement?.clientWidth ?? null;
          setSidebarWidth(clampSidebarWidth(parsed, parentWidth));
        }
      }
    } catch {
      // Ignore storage access errors
    }
  }, []);

  useEffect(() => {
    return () => {
      dragCleanupRef.current?.();
    };
  }, []);

  const startResizeAt = (startX: number) => {
    dragCleanupRef.current?.();

    const startWidth = sidebarWidth;
    const isRtl =
      typeof document !== "undefined" && document.documentElement.dir === "rtl";

    isDraggingRef.current = true;
    setIsResizing(true);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const updateFromClientX = (clientX: number) => {
      const delta = isRtl ? startX - clientX : clientX - startX;
      commitSidebarWidth(startWidth + delta);
    };

    const handlePointerMove = (moveEvent: PointerEvent) => {
      updateFromClientX(moveEvent.clientX);
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateFromClientX(moveEvent.clientX);
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", cleanup);
      window.removeEventListener("pointercancel", cleanup);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", cleanup);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      isDraggingRef.current = false;
      setIsResizing(false);
      dragCleanupRef.current = null;
    };

    dragCleanupRef.current = cleanup;
    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", cleanup);
    window.addEventListener("pointercancel", cleanup);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", cleanup);
  };

  const handleResizePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.preventDefault();
    startResizeAt(event.clientX);
  };

  const handleResizeMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 0 || isDraggingRef.current) return;
    event.preventDefault();
    startResizeAt(event.clientX);
  };

  const handleResizeKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const isRtl =
      typeof document !== "undefined" && document.documentElement.dir === "rtl";
    const growKey = isRtl ? "ArrowLeft" : "ArrowRight";
    const shrinkKey = isRtl ? "ArrowRight" : "ArrowLeft";

    if (event.key === growKey) {
      event.preventDefault();
      commitSidebarWidth(sidebarWidth + SIDEBAR_KEYBOARD_STEP);
    } else if (event.key === shrinkKey) {
      event.preventDefault();
      commitSidebarWidth(sidebarWidth - SIDEBAR_KEYBOARD_STEP);
    } else if (event.key === "Home") {
      event.preventDefault();
      commitSidebarWidth(AI_CHAT_SIDEBAR_MIN_WIDTH);
    } else if (event.key === "End") {
      event.preventDefault();
      commitSidebarWidth(AI_CHAT_SIDEBAR_MAX_WIDTH);
    }
  };

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
            "group relative flex items-center rounded-lg transition-colors",
            isActive
              ? "bg-gray-200/85 font-medium text-gray-900 dark:bg-white/10 dark:text-white"
              : "text-gray-700 hover:bg-gray-200/60 dark:text-gray-200 dark:hover:bg-white/6",
          )}
        >
          <button
            type="button"
            onClick={() => {
              onSelectThread(thread.id);
              onCloseMobile();
            }}
            title={thread.title}
            className={cn(
              "chat-sidebar-fade-mask min-w-0 overflow-hidden rounded-lg px-2.5 py-2 text-start text-xs leading-5 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 sm:text-theme-sm",
              isPinned ? "w-[calc(100%-1.5rem)]" : "w-full",
              "group-hover:w-[calc(100%-4.75rem)] group-focus-within:w-[calc(100%-4.75rem)]",
              isActive && "max-md:w-[calc(100%-4.75rem)]",
            )}
          >
            {thread.title}
          </button>

          {isPinned && (
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-y-0 end-2 flex items-center text-warning-500 transition-opacity group-hover:opacity-0 group-focus-within:opacity-0 dark:text-warning-400",
                isActive && "max-md:opacity-0",
              )}
            >
              <PinStarIcon className="size-3.5" />
            </span>
          )}

          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 end-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100",
              isActive && "max-md:pointer-events-auto max-md:opacity-100",
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
              title={
                isPinned
                  ? t("unpinThreadNamed", { title: thread.title })
                  : t("pinThreadNamed", { title: thread.title })
              }
              className={cn(
                "inline-flex size-6 items-center justify-center rounded transition-colors",
                isPinned
                  ? "text-warning-500 hover:bg-gray-300/60 dark:text-warning-400 dark:hover:bg-white/10"
                  : "text-gray-500 hover:bg-gray-300/60 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white",
              )}
            >
              <PinStarIcon aria-hidden="true" className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => beginRename(thread)}
              aria-label={t("renameThreadNamed", { title: thread.title })}
              title={t("renameThreadNamed", { title: thread.title })}
              className="inline-flex size-6 items-center justify-center rounded text-gray-500 hover:bg-gray-300/60 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <PencilIcon aria-hidden="true" className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => void handleDelete(thread.id)}
              disabled={isDeleting}
              aria-busy={isDeleting}
              aria-label={t("deleteThreadNamed", { title: thread.title })}
              title={t("deleteThreadNamed", { title: thread.title })}
              className="inline-flex size-6 items-center justify-center rounded text-gray-500 hover:bg-error-50 hover:text-error-600 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-error-500/15 dark:hover:text-error-400"
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
        ref={asideRef}
        aria-label={t("sidebarAriaLabel")}
        style={{ width: `${sidebarWidth}px` }}
        className={cn(
          "relative h-full shrink-0 flex-col border-e border-gray-200/80 bg-gray-50/95 select-none max-md:w-72! md:z-20 dark:border-white/10 dark:bg-gpt-sidebar",
          isMobileOpen
            ? "max-md:absolute max-md:inset-y-0 max-md:start-0 max-md:z-40 max-md:flex max-md:shadow-theme-xl"
            : "max-md:hidden",
          isDesktopOpen ? "md:flex" : "md:hidden",
        )}
      >
        {/* ChatGPT Top Row: Flat Ghost "New chat" + Search Icon + Sidebar Collapse */}
        <div className="flex h-13 shrink-0 items-center justify-between gap-1 px-2">
          <button
            type="button"
            onClick={() => {
              onStartNewChat();
              onCloseMobile();
            }}
            disabled={isCreatingThread}
            aria-busy={isCreatingThread}
            className="inline-flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2.5 py-2 text-start text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200/65 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 sm:text-theme-sm dark:text-gray-200 dark:hover:bg-white/8 dark:hover:text-white"
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
          <div className="shrink-0 px-2 pb-2">
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

        {/* Scrollable Pinned & Recent Threads (with thin custom scrollbar) */}
        <div className="custom-scrollbar me-0.5 min-h-0 flex-1 space-y-4 overflow-y-auto ps-2 pe-1.5 py-1.5">
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

        {/* ChatGPT Bottom Project Folder Row */}
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

        {/* Desktop Interactive Resize Handle (Drag wider / narrower + Blue Line Indicator) */}
        <div
          role="separator"
          tabIndex={0}
          aria-orientation="vertical"
          aria-label={t("resizeSidebarAriaLabel")}
          aria-valuemin={AI_CHAT_SIDEBAR_MIN_WIDTH}
          aria-valuemax={AI_CHAT_SIDEBAR_MAX_WIDTH}
          aria-valuenow={sidebarWidth}
          onPointerDown={handleResizePointerDown}
          onMouseDown={handleResizeMouseDown}
          onDoubleClick={() => commitSidebarWidth(AI_CHAT_SIDEBAR_DEFAULT_WIDTH)}
          onKeyDown={handleResizeKeyDown}
          className="group/resizer absolute inset-y-0 -end-2 z-20 hidden w-2.5 cursor-col-resize touch-none select-none focus:outline-none md:block"
        >
          <div
            className={cn(
              "pointer-events-none absolute inset-y-0 start-0.5 w-0.5 transition-colors duration-150",
              isResizing
                ? "bg-brand-500"
                : "bg-transparent group-hover/resizer:bg-brand-500/85 group-focus-visible/resizer:bg-brand-500",
            )}
          />
        </div>
      </aside>
    </>
  );
}
