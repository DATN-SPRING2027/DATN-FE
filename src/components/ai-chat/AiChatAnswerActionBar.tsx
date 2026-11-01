"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertIcon,
  BookOpenIcon,
  BranchIcon,
  CheckLineIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  HorizontaLDots,
  RefreshIcon,
  ShareIcon,
  StopSquareIcon,
  ThumbDownIcon,
  ThumbUpIcon,
  VolumeUpIcon,
} from "@/icons";
import { ApiError } from "@/lib/api-client";
import {
  useAiAnswerFeedbackQuery,
  useCreateAiAnswerShareMutation,
  useDeleteAiAnswerFeedbackMutation,
  useUpsertAiAnswerFeedbackMutation,
  useRevokeAiAnswerShareMutation,
} from "@/lib/queries/ai-chat/useAiAnswerActions";
import type {
  AiAnswerFeedbackInput,
  AiAnswerShare,
  AiChatMessage,
} from "@/lib/queries/ai-chat/ai-chat.types";
import { cn } from "@/utils";
import AiChatDislikeModal from "./AiChatDislikeModal";
import AiChatShareModal from "./AiChatShareModal";
import {
  isHiddenScopeMessage,
  isPersistedMessageId,
} from "./answer-action-utils";
import type { LocalSpeechErrorKind } from "./useLocalSpeech";

function formatTurnTimestamp(iso: string, locale: string): string | null {
  if (!iso) return null;
  const parsed = Date.parse(iso);
  if (!Number.isFinite(parsed)) return null;
  try {
    return new Intl.DateTimeFormat(locale, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(parsed));
  } catch {
    return null;
  }
}

export interface AiChatAnswerActionBarProps {
  organizationId: string;
  projectId: string;
  projectName: string;
  threadId: string | null;
  message: AiChatMessage;
  questionText?: string;
  versionIndex: number;
  versionCount: number;
  isThreadStreaming: boolean;
  isSpeaking: boolean;
  speechError: LocalSpeechErrorKind | null;
  canRegenerate?: boolean;
  isBranching?: boolean;
  onSelectVersionIndex: (nextIndex: number) => void;
  onRegenerate: () => void;
  onToggleSpeak: () => void;
  onOpenSources?: () => void;
  onBranchInNewChat?: () => void;
  onSaveToTaskNote?: () => void;
}

export default function AiChatAnswerActionBar({
  organizationId,
  projectId,
  projectName,
  threadId,
  message,
  questionText = "",
  versionIndex,
  versionCount,
  isThreadStreaming,
  isSpeaking,
  speechError,
  canRegenerate = true,
  isBranching = false,
  onSelectVersionIndex,
  onRegenerate,
  onToggleSpeak,
  onOpenSources,
  onBranchInNewChat,
  onSaveToTaskNote,
}: AiChatAnswerActionBarProps) {
  const t = useTranslations("AiChat");
  const locale = useLocale();
  const isPersisted = Boolean(threadId) && isPersistedMessageId(message.id);
  const isCompletedOk =
    message.status === "ok" &&
    Boolean(message.content.trim()) &&
    !isHiddenScopeMessage(message.content);

  const hasSources =
    Boolean(onOpenSources) &&
    (message.citations.length > 0 || message.sessionCitations.length > 0);
  const canBranch = isPersisted && Boolean(onBranchInNewChat);
  const canSaveToTaskNote = isPersisted && Boolean(onSaveToTaskNote);
  const formattedTimestamp = formatTurnTimestamp(message.createdAt, locale);
  const showMoreMenuTrigger =
    isCompletedOk &&
    (hasSources || canBranch || canSaveToTaskNote || Boolean(formattedTimestamp));

  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [copyErrorState, setCopyErrorState] = useState<{
    messageId: string;
    message: string;
  } | null>(null);
  const [inlineFeedbackErrorState, setInlineFeedbackErrorState] = useState<{
    messageId: string;
    message: string;
    retry: () => Promise<void>;
  } | null>(null);

  const [dislikeOpenMessageId, setDislikeOpenMessageId] = useState<
    string | null
  >(null);
  const [dislikeModalErrorState, setDislikeModalErrorState] = useState<{
    messageId: string;
    message: string;
  } | null>(null);

  const [shareOpenMessageId, setShareOpenMessageId] = useState<string | null>(
    null,
  );
  const [activeShareByMessageId, setActiveShareByMessageId] = useState<
    Record<string, AiAnswerShare | null>
  >({});
  const [shareModalErrorState, setShareModalErrorState] = useState<{
    messageId: string;
    message: string;
  } | null>(null);
  const [shareRevokedMessageId, setShareRevokedMessageId] = useState<
    string | null
  >(null);

  const [moreOpenMessageId, setMoreOpenMessageId] = useState<string | null>(
    null,
  );

  const moreTriggerRef = useRef<HTMLButtonElement | null>(null);
  const moreMenuRef = useRef<HTMLDivElement | null>(null);

  const copied = copiedMessageId === message.id;
  const copyError =
    copyErrorState?.messageId === message.id ? copyErrorState.message : null;
  const inlineFeedbackError =
    inlineFeedbackErrorState?.messageId === message.id
      ? inlineFeedbackErrorState
      : null;
  const isDislikeOpen = dislikeOpenMessageId === message.id;
  const dislikeModalError =
    dislikeModalErrorState?.messageId === message.id
      ? dislikeModalErrorState.message
      : null;
  const isShareOpen = shareOpenMessageId === message.id;
  const shareModalError =
    shareModalErrorState?.messageId === message.id
      ? shareModalErrorState.message
      : null;
  const shareRevokedNotice = shareRevokedMessageId === message.id;
  const isMoreOpen = moreOpenMessageId === message.id;

  const updateMoreMenuPosition = useCallback(() => {
    const triggerEl = moreTriggerRef.current;
    const menuEl = moreMenuRef.current;
    if (!triggerEl || !menuEl || typeof window === "undefined") return;
    const rect = triggerEl.getBoundingClientRect();
    const menuWidth = menuEl.offsetWidth || 224;
    const menuHeight = menuEl.offsetHeight || 118;
    const viewportPadding = 12;
    const gap = 6;
    const isRtl =
      typeof document !== "undefined" && document.documentElement.dir === "rtl";

    const desiredLeft = isRtl ? rect.right - menuWidth : rect.left;
    const maxLeft = Math.max(
      viewportPadding,
      window.innerWidth - menuWidth - viewportPadding,
    );
    const clampedLeft = Math.max(
      viewportPadding,
      Math.min(desiredLeft, maxLeft),
    );

    const canFitAbove = rect.top - menuHeight - gap >= viewportPadding;
    const canFitBelow =
      rect.bottom + gap + menuHeight <= window.innerHeight - viewportPadding;

    let top = rect.top - menuHeight - gap;
    if (!canFitAbove && canFitBelow) {
      top = rect.bottom + gap;
    } else if (!canFitAbove && !canFitBelow) {
      top = Math.max(
        viewportPadding,
        Math.min(
          rect.bottom + gap,
          window.innerHeight - menuHeight - viewportPadding,
        ),
      );
    }

    menuEl.style.top = `${Math.round(top)}px`;
    menuEl.style.left = `${Math.round(clampedLeft)}px`;
    menuEl.style.opacity = "1";
  }, []);

  useLayoutEffect(() => {
    if (!isMoreOpen) return;
    updateMoreMenuPosition();
  }, [isMoreOpen, updateMoreMenuPosition, hasSources, canBranch, canSaveToTaskNote]);

  useEffect(() => {
    if (!isMoreOpen) return;
    const menuEl = moreMenuRef.current;
    const firstItem = menuEl?.querySelector<HTMLButtonElement>(
      '[role="menuitem"]:not(:disabled)',
    );
    firstItem?.focus();

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        moreTriggerRef.current?.contains(target) ||
        moreMenuRef.current?.contains(target)
      ) {
        return;
      }
      setMoreOpenMessageId(null);
    };

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setMoreOpenMessageId(null);
        moreTriggerRef.current?.focus();
      }
    };

    const handleViewportChange = (event: Event) => {
      if (
        event.type === "scroll" &&
        event.target instanceof Node &&
        moreMenuRef.current?.contains(event.target)
      ) {
        return;
      }
      setMoreOpenMessageId(null);
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleViewportChange);
    window.addEventListener("scroll", handleViewportChange, true);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleViewportChange);
      window.removeEventListener("scroll", handleViewportChange, true);
    };
  }, [isMoreOpen]);

  const handleMoreMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      moreMenuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ?? [],
    );
    if (items.length === 0) return;
    const activeIndex = items.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    if (event.key === "ArrowDown") {
      event.preventDefault();
      const nextIdx = activeIndex < 0 ? 0 : (activeIndex + 1) % items.length;
      items[nextIdx]?.focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const prevIdx =
        activeIndex <= 0 ? items.length - 1 : activeIndex - 1;
      items[prevIdx]?.focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0]?.focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1]?.focus();
    }
  };

  const feedbackQuery = useAiAnswerFeedbackQuery(
    organizationId,
    projectId,
    threadId,
    message.id,
    { enabled: isPersisted && isCompletedOk && Boolean(message.content.trim()) },
  );
  const upsertFeedbackMutation = useUpsertAiAnswerFeedbackMutation(
    organizationId,
    projectId,
  );
  const deleteFeedbackMutation = useDeleteAiAnswerFeedbackMutation(
    organizationId,
    projectId,
  );
  const createShareMutation = useCreateAiAnswerShareMutation(
    organizationId,
    projectId,
  );
  const revokeShareMutation = useRevokeAiAnswerShareMutation(
    organizationId,
    projectId,
  );

  const currentFeedback = feedbackQuery.data?.feedback ?? null;
  const currentRating = currentFeedback?.rating ?? null;
  const isFeedbackBusy =
    upsertFeedbackMutation.isPending || deleteFeedbackMutation.isPending;

  const activeShare = activeShareByMessageId[message.id] ?? null;

  const handleCopy = async () => {
    const targetMessageId = message.id;
    setCopyErrorState(null);
    if (!navigator.clipboard?.writeText) {
      setCopiedMessageId(null);
      setCopyErrorState({
        messageId: targetMessageId,
        message: t("copyFailedError"),
      });
      return;
    }
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(targetMessageId);
      window.setTimeout(() => {
        setCopiedMessageId((prev) => (prev === targetMessageId ? null : prev));
      }, 1800);
    } catch {
      setCopiedMessageId(null);
      setCopyErrorState({
        messageId: targetMessageId,
        message: t("copyFailedError"),
      });
    }
  };

  const handleLikeClick = async () => {
    if (!threadId || !isPersisted || isFeedbackBusy) return;
    const targetThreadId = threadId;
    const targetMessageId = message.id;
    const shouldDelete = currentRating === "LIKE";
    setInlineFeedbackErrorState(null);
    const runAction = async () => {
      if (shouldDelete) {
        await deleteFeedbackMutation.mutateAsync({
          threadId: targetThreadId,
          messageId: targetMessageId,
        });
      } else {
        await upsertFeedbackMutation.mutateAsync({
          threadId: targetThreadId,
          messageId: targetMessageId,
          body: { rating: "LIKE" },
        });
      }
      setInlineFeedbackErrorState((prev) =>
        prev?.messageId === targetMessageId ? null : prev,
      );
    };

    try {
      await runAction();
    } catch (error) {
      setInlineFeedbackErrorState({
        messageId: targetMessageId,
        message:
          error instanceof ApiError ? error.message : t("feedbackSaveError"),
        retry: runAction,
      });
    }
  };

  const handleDislikeClick = async () => {
    if (!threadId || !isPersisted || isFeedbackBusy) return;
    const targetThreadId = threadId;
    const targetMessageId = message.id;
    setInlineFeedbackErrorState(null);
    if (currentRating === "DISLIKE") {
      const runDelete = async () => {
        await deleteFeedbackMutation.mutateAsync({
          threadId: targetThreadId,
          messageId: targetMessageId,
        });
        setInlineFeedbackErrorState((prev) =>
          prev?.messageId === targetMessageId ? null : prev,
        );
      };
      try {
        await runDelete();
      } catch (error) {
        setInlineFeedbackErrorState({
          messageId: targetMessageId,
          message:
            error instanceof ApiError ? error.message : t("feedbackSaveError"),
          retry: runDelete,
        });
      }
      return;
    }
    setDislikeModalErrorState(null);
    setDislikeOpenMessageId(targetMessageId);
  };

  const handleDislikeSubmit = async (
    payload: Extract<AiAnswerFeedbackInput, { rating: "DISLIKE" }>,
  ) => {
    if (!threadId) return;
    const targetThreadId = threadId;
    const targetMessageId = message.id;
    setDislikeModalErrorState(null);
    try {
      await upsertFeedbackMutation.mutateAsync({
        threadId: targetThreadId,
        messageId: targetMessageId,
        body: payload,
      });
      setDislikeOpenMessageId((prev) =>
        prev === targetMessageId ? null : prev,
      );
    } catch (error) {
      setDislikeModalErrorState({
        messageId: targetMessageId,
        message:
          error instanceof ApiError ? error.message : t("feedbackSaveError"),
      });
    }
  };

  const handleOpenShare = () => {
    if (!threadId || !isPersisted) return;
    setShareModalErrorState(null);
    setShareRevokedMessageId(null);
    setShareOpenMessageId(message.id);
  };

  const handleCreateShare = async () => {
    if (!threadId) return;
    const targetThreadId = threadId;
    const targetMessageId = message.id;
    setShareModalErrorState(null);
    setShareRevokedMessageId(null);
    try {
      const created = await createShareMutation.mutateAsync({
        threadId: targetThreadId,
        messageId: targetMessageId,
      });
      setActiveShareByMessageId((prev) => ({
        ...prev,
        [targetMessageId]: created,
      }));
    } catch (error) {
      setShareModalErrorState({
        messageId: targetMessageId,
        message:
          error instanceof ApiError ? error.message : t("shareErrorDefault"),
      });
    }
  };

  const handleRevokeShare = async (shareId: string) => {
    const targetMessageId = message.id;
    setShareModalErrorState(null);
    try {
      await revokeShareMutation.mutateAsync({ shareId });
      setActiveShareByMessageId((prev) => ({
        ...prev,
        [targetMessageId]: null,
      }));
      setShareRevokedMessageId(targetMessageId);
    } catch (error) {
      setShareModalErrorState({
        messageId: targetMessageId,
        message:
          error instanceof ApiError ? error.message : t("shareErrorDefault"),
      });
    }
  };

  const actionButtonClass =
    "group/action inline-flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-45 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white";
  const copyLabel = copied ? t("copiedAnswer") : t("copyAnswer");
  const speechLabel = isSpeaking
    ? t("stopReadingAction")
    : t("readAloudAction");

  return (
    <div className="space-y-2 pt-0.5">
      <div className="flex flex-wrap items-center gap-0.5">
        {/* Version Switcher (< 1 / N >) */}
        {versionCount > 1 && (
          <div className="me-1.5 inline-flex h-8 items-center gap-0.5 rounded-lg border border-gray-200/80 bg-gray-50 px-1 text-xs font-medium text-gray-600 tabular-nums dark:border-white/10 dark:bg-gpt-sidebar dark:text-gray-300">
            <button
              type="button"
              disabled={versionIndex <= 0}
              onClick={() => onSelectVersionIndex(versionIndex - 1)}
              aria-label={t("previousVersionAria")}
              title={t("previousVersionAria")}
              className="inline-flex size-6 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-200/70 hover:text-gray-900 disabled:opacity-35 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <ChevronLeftIcon
                aria-hidden="true"
                className="size-3.5 rtl:rotate-180"
              />
            </button>
            <span className="px-1 text-[11px] font-semibold tabular-nums">
              {t("versionIndicator", {
                current: versionIndex + 1,
                total: versionCount,
              })}
            </span>
            <button
              type="button"
              disabled={versionIndex >= versionCount - 1}
              onClick={() => onSelectVersionIndex(versionIndex + 1)}
              aria-label={t("nextVersionAria")}
              title={t("nextVersionAria")}
              className="inline-flex size-6 items-center justify-center rounded-md text-gray-500 transition-colors hover:bg-gray-200/70 hover:text-gray-900 disabled:opacity-35 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <ChevronRightIcon
                aria-hidden="true"
                className="size-3.5 rtl:rotate-180"
              />
            </button>
          </div>
        )}

        {isCompletedOk && (
          <>
            {/* 1. Copy */}
            <button
              type="button"
              onClick={() => void handleCopy()}
              aria-label={copyLabel}
              title={copyLabel}
              className={cn(
                actionButtonClass,
                copied && "text-success-600 dark:text-success-400",
              )}
            >
              {copied ? (
                <CheckLineIcon
                  aria-hidden="true"
                  className="continuum-icon-swap-enter size-4 text-success-500"
                />
              ) : (
                <CopyIcon
                  aria-hidden="true"
                  className="size-4 transition-transform duration-150 group-hover/action:scale-110"
                />
              )}
            </button>

            {/* 2. Like */}
            {isPersisted && (
              <button
                type="button"
                disabled={isFeedbackBusy}
                aria-label={t("likeAction")}
                title={t("likeAction")}
                aria-pressed={currentRating === "LIKE"}
                onClick={() => void handleLikeClick()}
                className={cn(
                  actionButtonClass,
                  currentRating === "LIKE" &&
                    "bg-success-500/15 text-success-700 hover:bg-success-500/20 dark:text-success-300",
                )}
              >
                <ThumbUpIcon
                  aria-hidden="true"
                  className={cn(
                    "size-4 transition-transform duration-150 group-hover/action:-translate-y-0.5 group-hover/action:-rotate-6",
                    currentRating === "LIKE" && "continuum-thumb-pop",
                  )}
                />
              </button>
            )}

            {/* 3. Dislike */}
            {isPersisted && (
              <button
                type="button"
                disabled={isFeedbackBusy}
                aria-label={t("dislikeAction")}
                title={t("dislikeAction")}
                aria-pressed={currentRating === "DISLIKE"}
                onClick={() => void handleDislikeClick()}
                className={cn(
                  actionButtonClass,
                  currentRating === "DISLIKE" &&
                    "bg-error-500/15 text-error-700 hover:bg-error-500/20 dark:text-error-300",
                )}
              >
                <ThumbDownIcon
                  aria-hidden="true"
                  className={cn(
                    "size-4 transition-transform duration-150 group-hover/action:translate-y-0.5 group-hover/action:rotate-6",
                    currentRating === "DISLIKE" && "continuum-thumb-pop",
                  )}
                />
              </button>
            )}

            {/* 4. Read Aloud / Stop (Local Voice Only) */}
            <button
              type="button"
              aria-label={speechLabel}
              title={speechLabel}
              aria-pressed={isSpeaking}
              onClick={onToggleSpeak}
              className={cn(
                actionButtonClass,
                isSpeaking &&
                  "bg-brand-500/15 text-brand-600 hover:bg-brand-500/20 dark:text-brand-300",
              )}
            >
              {isSpeaking ? (
                <StopSquareIcon
                  aria-hidden="true"
                  className="continuum-icon-swap-enter size-4"
                />
              ) : (
                <VolumeUpIcon
                  aria-hidden="true"
                  className="size-4 transition-transform duration-150 group-hover/action:scale-110"
                />
              )}
            </button>

            {/* 5. Share (Project Members Only) */}
            {isPersisted && (
              <button
                type="button"
                aria-label={t("shareAction")}
                title={t("shareAction")}
                onClick={handleOpenShare}
                className={actionButtonClass}
              >
                <ShareIcon
                  aria-hidden="true"
                  className="size-4 transition-transform duration-150 group-hover/action:-translate-y-0.5 group-hover/action:scale-105"
                />
              </button>
            )}
          </>
        )}

        {/* 6. Try Again (Regenerate) */}
        {canRegenerate && (isPersisted || !isCompletedOk) && (
          <button
            type="button"
            disabled={isThreadStreaming}
            aria-label={t("tryAgainAction")}
            title={t("tryAgainAction")}
            onClick={onRegenerate}
            className={actionButtonClass}
          >
            <RefreshIcon
              aria-hidden="true"
              className="size-4 transition-transform duration-200 ease-out group-hover/action:rotate-45 group-active/action:rotate-180"
            />
          </button>
        )}

        {/* 7. More Actions (⋯): Timestamp, sources, Task Note, branch */}
        {showMoreMenuTrigger && (
          <button
            ref={moreTriggerRef}
            type="button"
            data-testid={`ai-chat-more-actions-${message.id}`}
            aria-label={t("moreActionsAria")}
            title={t("moreActionsAria")}
            aria-haspopup="menu"
            aria-expanded={isMoreOpen}
            aria-busy={isBranching || undefined}
            onClick={() => {
              setMoreOpenMessageId((prev) =>
                prev === message.id ? null : message.id,
              );
            }}
            className={cn(
              actionButtonClass,
              isMoreOpen &&
                "bg-gray-100 text-gray-900 dark:bg-white/12 dark:text-white",
            )}
          >
            <HorizontaLDots
              aria-hidden="true"
              className="size-4 transition-transform duration-150 group-hover/action:scale-110"
            />
          </button>
        )}
      </div>

      {isMoreOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={moreMenuRef}
            role="menu"
            aria-label={t("moreActionsAria")}
            data-testid="ai-chat-more-actions-menu"
            onKeyDown={handleMoreMenuKeyDown}
            style={{
              top: "0px",
              left: "0px",
              opacity: 0,
            }}
            className="continuum-popover-enter fixed z-99999 w-max max-w-[min(18.5rem,calc(100vw-1.5rem))] min-w-52 rounded-2xl border border-gray-200/90 bg-white p-1.5 shadow-theme-lg dark:border-white/10 dark:bg-gpt-popover"
          >
            {formattedTimestamp && (
              <div
                data-testid="ai-chat-more-actions-timestamp"
                className="px-3 py-1.5 text-xs font-medium text-gray-500 tabular-nums select-none dark:text-gray-400"
              >
                {formattedTimestamp}
              </div>
            )}

            {hasSources && onOpenSources && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreOpenMessageId(null);
                  onOpenSources();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-xs font-medium text-gray-800 transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none sm:text-theme-sm dark:text-gray-100 dark:hover:bg-white/10 dark:focus-visible:bg-white/10"
              >
                <BookOpenIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-gray-600 dark:text-gray-300"
                />
                <span>{t("viewSourcesAction")}</span>
              </button>
            )}

            {canSaveToTaskNote && onSaveToTaskNote && (
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMoreOpenMessageId(null);
                  onSaveToTaskNote();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-xs font-medium text-gray-800 transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none sm:text-theme-sm dark:text-gray-100 dark:hover:bg-white/10 dark:focus-visible:bg-white/10"
              >
                <CheckLineIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-gray-600 dark:text-gray-300"
                />
                <span>{t("saveAsTaskNoteAction")}</span>
              </button>
            )}

            {canBranch && onBranchInNewChat && (
              <button
                type="button"
                role="menuitem"
                disabled={isThreadStreaming || isBranching}
                aria-busy={isBranching || undefined}
                onClick={() => {
                  setMoreOpenMessageId(null);
                  onBranchInNewChat();
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-start text-xs font-medium text-gray-800 transition-colors hover:bg-gray-100 focus-visible:bg-gray-100 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:text-theme-sm dark:text-gray-100 dark:hover:bg-white/10 dark:focus-visible:bg-white/10"
              >
                <BranchIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-gray-600 dark:text-gray-300"
                />
                <span>
                  {isBranching
                    ? t("branchingInNewChatStatus")
                    : t("branchInNewChatAction")}
                </span>
              </button>
            )}
          </div>,
          document.body,
        )}

      {isSpeaking && (
        <p role="status" className="sr-only">
          {t("readingStatus")}
        </p>
      )}

      {copyError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-warning-200 bg-warning-50 px-3 py-1.5 text-xs text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/15 dark:text-warning-200"
        >
          <AlertIcon aria-hidden="true" className="size-3.5 shrink-0" />
          <span>{copyError}</span>
        </div>
      )}

      {speechError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-xl border border-warning-200 bg-warning-50 px-3 py-1.5 text-xs text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/15 dark:text-warning-200"
        >
          <AlertIcon aria-hidden="true" className="size-3.5 shrink-0" />
          <span>
            {speechError === "unavailable"
              ? t("speechUnavailableError")
              : t("speechFailedError")}
          </span>
        </div>
      )}

      {inlineFeedbackError && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-error-200 bg-error-50 px-3 py-1.5 text-xs text-error-700 dark:border-error-800/60 dark:bg-error-500/10 dark:text-error-300"
        >
          <div className="flex items-center gap-1.5">
            <AlertIcon aria-hidden="true" className="size-3.5 shrink-0" />
            <span>{inlineFeedbackError.message}</span>
          </div>
          <button
            type="button"
            onClick={() => void inlineFeedbackError.retry()}
            className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-semibold text-error-700 ring-1 ring-error-200 hover:bg-error-50 dark:bg-gpt-composer dark:text-error-200 dark:ring-error-700"
          >
            {t("retryAction")}
          </button>
        </div>
      )}

      {isDislikeOpen && (
        <AiChatDislikeModal
          key={message.id}
          isOpen={isDislikeOpen}
          initialCategory={currentFeedback?.reasonCategory ?? "INACCURATE"}
          initialReasonText={currentFeedback?.reasonText ?? ""}
          isSubmitting={upsertFeedbackMutation.isPending}
          errorMessage={dislikeModalError}
          onClose={() => {
            if (!upsertFeedbackMutation.isPending) {
              setDislikeOpenMessageId(null);
            }
          }}
          onSubmit={handleDislikeSubmit}
        />
      )}

      {isShareOpen && (
        <AiChatShareModal
          key={`share-${message.id}`}
          isOpen={isShareOpen}
          projectId={projectId}
          projectName={projectName}
          questionText={questionText}
          answerContent={message.content}
          citationCount={message.citations.length}
          activeShare={activeShare}
          isCreating={createShareMutation.isPending}
          isRevoking={revokeShareMutation.isPending}
          errorMessage={shareModalError}
          revokedNotice={shareRevokedNotice}
          onClose={() => {
            if (
              !createShareMutation.isPending &&
              !revokeShareMutation.isPending
            ) {
              setShareOpenMessageId(null);
            }
          }}
          onCreateShare={handleCreateShare}
          onRevokeShare={handleRevokeShare}
        />
      )}
    </div>
  );
}
