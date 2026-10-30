"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertIcon,
  CheckLineIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
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
  useRevokeAiAnswerShareMutation,
  useUpsertAiAnswerFeedbackMutation,
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
  onSelectVersionIndex: (nextIndex: number) => void;
  onRegenerate: () => void;
  onToggleSpeak: () => void;
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
  onSelectVersionIndex,
  onRegenerate,
  onToggleSpeak,
}: AiChatAnswerActionBarProps) {
  const t = useTranslations("AiChat");
  const isPersisted =
    Boolean(threadId) && isPersistedMessageId(message.id);
  const isCompletedOk =
    message.status === "ok" &&
    Boolean(message.content.trim()) &&
    !isHiddenScopeMessage(message.content);

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

  const feedbackQuery = useAiAnswerFeedbackQuery(
    organizationId,
    projectId,
    threadId,
    message.id,
    { enabled: isPersisted && isCompletedOk },
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
    "inline-flex size-8 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 disabled:cursor-not-allowed disabled:opacity-45 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white";
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
                  className="size-4 text-success-500"
                />
              ) : (
                <CopyIcon aria-hidden="true" className="size-4" />
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
                <ThumbUpIcon aria-hidden="true" className="size-4" />
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
                <ThumbDownIcon aria-hidden="true" className="size-4" />
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
                <StopSquareIcon aria-hidden="true" className="size-4" />
              ) : (
                <VolumeUpIcon aria-hidden="true" className="size-4" />
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
                <ShareIcon aria-hidden="true" className="size-4" />
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
            <RefreshIcon aria-hidden="true" className="size-4" />
          </button>
        )}
      </div>

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
