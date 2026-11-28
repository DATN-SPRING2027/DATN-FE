"use client";

import { useId, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  AlertCircleIcon,
  AlertIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  DocsIcon,
  InfoIcon,
  LockIcon,
  RefreshIcon,
  ShootingStarIcon,
} from "@/icons";
import { formatCitationSnippetPreview } from "@/components/ai-chat/answer-prose-utils";
import type {
  ChatAssistantJobState,
  ChatAssistantSourceReference,
  ChatMessage,
} from "@/lib/queries/chat/useChat";
import { cn } from "@/utils";
import AssistantMarkdownContent from "./AssistantMarkdownContent";

function formatShortTimestamp(iso: string): string {
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return "";
  return new Date(parsed).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function resolveAggregateFlags(
  message: ChatMessage,
): { hasEdited: boolean; hasDeleted: boolean } {
  const refs = message.sourceReferences ?? [];
  const metaState = message.assistantMeta?.sourceState;
  const hasEdited =
    metaState === "HAS_EDITED" ||
    metaState === "HAS_EDITED_AND_DELETED" ||
    refs.some((ref) => ref.status === "EDITED");
  const hasDeleted =
    metaState === "HAS_DELETED" ||
    metaState === "HAS_EDITED_AND_DELETED" ||
    refs.some((ref) => ref.status === "DELETED");
  return { hasEdited, hasDeleted };
}

export function AssistantSourceChips({
  sources,
  onOpenContext,
  compact = false,
  hasEdited = false,
  hasDeleted = false,
  trailingNote,
}: Readonly<{
  sources: readonly ChatAssistantSourceReference[];
  onOpenContext?: (messageId: string) => void;
  compact?: boolean;
  hasEdited?: boolean;
  hasDeleted?: boolean;
  trailingNote?: ReactNode;
}>) {
  const t = useTranslations("chat");
  const [expanded, setExpanded] = useState(false);
  const panelId = useId();

  if (sources.length === 0) {
    return trailingNote ? (
      <div className={cn(compact ? "mt-2" : "mt-2.5")}>{trailingNote}</div>
    ) : null;
  }

  return (
    <div
      className={cn(
        "border-t border-gray-100 dark:border-gray-800/90",
        compact ? "mt-2 pt-2" : "mt-3 pt-2.5",
      )}
      onKeyDown={(event) => {
        if (event.key === "Escape" && expanded) {
          event.stopPropagation();
          setExpanded(false);
        }
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <button
          type="button"
          data-testid="assistant-sources-toggle"
          aria-expanded={expanded}
          aria-controls={panelId}
          onClick={() => setExpanded((current) => !current)}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-full border text-xs font-medium tabular-nums transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500",
            compact ? "px-2.5 py-1" : "px-2.5 py-1",
            expanded
              ? "border-brand-300 bg-brand-50/90 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200"
              : "border-gray-200/90 bg-gray-50/90 text-gray-700 hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700 dark:border-gray-700/80 dark:bg-gray-800/80 dark:text-gray-200 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/15 dark:hover:text-brand-200",
          )}
        >
          <DocsIcon
            aria-hidden="true"
            className={cn(
              "h-3.5 w-3.5 shrink-0",
              expanded
                ? "text-brand-600 dark:text-brand-300"
                : "text-brand-600/90 dark:text-brand-400",
            )}
          />
          <span>{t("assistantSourcesHeading", { count: sources.length })}</span>
          {(hasDeleted || hasEdited) && (
            <span
              aria-hidden="true"
              className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                hasDeleted ? "bg-error-500" : "bg-warning-500",
              )}
            />
          )}
          <ChevronDownIcon
            aria-hidden="true"
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform duration-150 dark:text-gray-400",
              expanded && "rotate-180 text-brand-600 dark:text-brand-300",
            )}
          />
        </button>
        {trailingNote}
      </div>

      {expanded && (
        <div
          id={panelId}
          data-testid="assistant-source-list"
          className={cn(
            "cu-ai-evidence-panel mt-2 rounded-xl border border-gray-200/90 bg-gray-50/80 dark:border-gray-800 dark:bg-gray-950/60",
            compact ? "p-1.5" : "p-2",
          )}
        >
          <div className="flex max-h-60 flex-col gap-1.5 overflow-y-auto overscroll-contain pe-0.5">
            {sources.map((source) => {
              const isDeleted = source.status === "DELETED";
              const isEdited = source.status === "EDITED";
              const isClickable = !isDeleted && Boolean(onOpenContext);
              const formattedTime = formatShortTimestamp(source.createdAt);
              const snippet = isDeleted
                ? ""
                : formatCitationSnippetPreview(
                    source.quoteSnippet,
                    compact ? 72 : 120,
                  );

              return (
                <button
                  key={`${source.refId}-${source.messageId}`}
                  type="button"
                  data-testid={`assistant-source-chip-${source.refId}`}
                  data-source-status={source.status}
                  disabled={!isClickable}
                  aria-disabled={!isClickable ? "true" : undefined}
                  aria-label={
                    isDeleted
                      ? t("assistantSourceDeletedAria", {
                          refId: source.refId,
                          sender: source.senderName,
                        })
                      : t("assistantSourceOpenAria", {
                          refId: source.refId,
                          sender: source.senderName,
                        })
                  }
                  onClick={() => {
                    if (isClickable && onOpenContext) {
                      onOpenContext(source.messageId);
                    }
                  }}
                  className={cn(
                    "group/chip flex w-full min-w-0 items-start justify-between gap-2 rounded-lg border text-start transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500",
                    compact ? "px-2 py-1.5" : "px-2.5 py-2",
                    isDeleted
                      ? "cursor-not-allowed border-dashed border-gray-300/90 bg-gray-100/90 text-gray-700 dark:border-gray-700 dark:bg-gray-900/70 dark:text-gray-300"
                      : isEdited
                        ? "cursor-pointer border-warning-200/90 bg-warning-50/70 text-gray-900 hover:border-warning-300 hover:bg-warning-50 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-gray-100 dark:hover:bg-warning-500/15"
                        : "cursor-pointer border-gray-200/90 bg-white text-gray-900 hover:border-brand-300 hover:bg-brand-50/45 dark:border-gray-700/80 dark:bg-gray-900/80 dark:text-gray-100 dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10",
                  )}
                >
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          "font-mono inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-xs font-semibold tabular-nums",
                          isDeleted
                            ? "bg-gray-200 text-gray-800 line-through dark:bg-gray-800 dark:text-gray-200"
                            : isEdited
                              ? "bg-warning-100 text-warning-800 dark:bg-warning-500/20 dark:text-warning-200"
                              : "bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200",
                        )}
                      >
                        [{source.refId}]
                      </span>
                      <span className="min-w-0 truncate text-xs font-semibold text-gray-900 dark:text-white">
                        {source.senderName}
                      </span>
                      {formattedTime && (
                        <time
                          dateTime={source.createdAt}
                          className="shrink-0 text-xs text-gray-600 tabular-nums dark:text-gray-400"
                        >
                          {formattedTime}
                        </time>
                      )}
                      {isEdited && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-warning-100 px-2 py-0.5 text-xs font-medium text-warning-800 dark:bg-warning-500/20 dark:text-warning-200">
                          {t("assistantSourceEdited")}
                        </span>
                      )}
                      {isDeleted && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-error-50 px-2 py-0.5 text-xs font-medium text-error-700 ring-1 ring-error-200/80 dark:bg-error-500/20 dark:text-error-200 dark:ring-error-500/30">
                          {t("assistantSourceDeleted")}
                        </span>
                      )}
                    </div>
                    {snippet && (
                      <p
                        className={cn(
                          "text-xs leading-4.5 break-words text-gray-600 dark:text-gray-300",
                          compact ? "line-clamp-1" : "line-clamp-2",
                        )}
                      >
                        {snippet}
                      </p>
                    )}
                  </div>
                  {isClickable && (
                    <ArrowRightIcon
                      aria-hidden="true"
                      className="mt-1 h-3.5 w-3.5 shrink-0 text-gray-500 transition-colors duration-150 group-hover/chip:text-brand-600 rtl:rotate-180 dark:text-gray-400 dark:group-hover/chip:text-brand-300"
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function AssistantBubbleBody({
  message,
  compact = false,
  onOpenContext,
  actionButton,
}: Readonly<{
  message: ChatMessage;
  compact?: boolean;
  onOpenContext?: (messageId: string) => void;
  actionButton?: ReactNode;
}>) {
  const t = useTranslations("chat");
  const isInsufficient = message.assistantStatus === "INSUFFICIENT_EVIDENCE";
  const sources = message.sourceReferences ?? [];
  const { hasEdited, hasDeleted } = resolveAggregateFlags(message);
  const formattedTime = formatShortTimestamp(message.createdAt);

  return (
    <div data-testid="assistant-message-card" className="min-w-0">
      <div
        className={cn(
          "flex items-start justify-between gap-2",
          compact ? "mb-1.5" : "mb-2",
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ring-1",
              isInsufficient
                ? "bg-gray-100 text-gray-600 ring-gray-200/80 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700"
                : "bg-brand-50 text-brand-600 ring-brand-200/70 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/25",
            )}
          >
            <ShootingStarIcon className="h-3.5 w-3.5" />
          </span>
          <span className="text-xs font-semibold tracking-tight text-gray-900 dark:text-white">
            {t("assistantBadge")}
          </span>
          {isInsufficient && (
            <span
              data-testid="assistant-insufficient-badge"
              className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <InfoIcon aria-hidden="true" className="h-3 w-3 shrink-0" />
              {t("assistantStatusInsufficientBadge")}
            </span>
          )}
          {hasEdited && (
            <span
              data-testid="assistant-source-edited-badge"
              className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-xs font-medium text-warning-800 ring-1 ring-warning-200 dark:bg-warning-500/20 dark:text-warning-200 dark:ring-warning-500/35"
            >
              <AlertIcon aria-hidden="true" className="h-3 w-3 shrink-0" />
              {t("assistantSourceEdited")}
            </span>
          )}
          {hasDeleted && (
            <span
              data-testid="assistant-source-deleted-badge"
              className="inline-flex items-center gap-1 rounded-full bg-error-50 px-2 py-0.5 text-xs font-medium text-error-700 ring-1 ring-error-200 dark:bg-error-500/20 dark:text-error-200 dark:ring-error-500/35"
            >
              <AlertCircleIcon aria-hidden="true" className="h-3 w-3 shrink-0" />
              {t("assistantSourceDeleted")}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1 pt-0.5">
          {formattedTime && (
            <time
              dateTime={message.createdAt}
              className="shrink-0 text-xs text-gray-600 tabular-nums dark:text-gray-400"
            >
              {formattedTime}
            </time>
          )}
          {actionButton}
        </div>
      </div>

      {message.replyTo && (
        <button
          type="button"
          onClick={() => onOpenContext?.(message.replyTo!.id)}
          aria-label={t("viewMessageContext")}
          className={cn(
            "group/quote flex w-full min-w-0 cursor-pointer items-center gap-1.5 border-s-2 border-brand-300/90 ps-2 text-start text-xs transition-colors duration-150 hover:border-brand-500 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 dark:border-brand-500/50 dark:hover:border-brand-400",
            compact ? "mb-1.5" : "mb-2.5",
          )}
        >
          <span className="shrink-0 font-medium text-gray-700 dark:text-gray-300">
            {message.replyTo.senderName}:
          </span>
          <span className="min-w-0 flex-1 truncate text-gray-600 group-hover/quote:text-gray-900 dark:text-gray-400 dark:group-hover/quote:text-gray-200">
            {message.replyTo.deleted
              ? t("messageDeleted")
              : message.replyTo.preview || t("attachment")}
          </span>
        </button>
      )}

      {message.isPinned && (
        <p className="mb-1.5 text-xs font-medium text-brand-700 dark:text-brand-300">
          {t("pinnedMessages")}
        </p>
      )}

      <AssistantMarkdownContent
        content={message.content}
        sourceReferences={sources}
        onJumpToSource={onOpenContext}
        compact={compact}
      />

      {message.assistantMeta?.partialCoverage &&
        message.assistantMeta.coverageNote && (
          <div
            className={cn(
              "flex items-start gap-2 rounded-xl border border-brand-200/70 bg-brand-25/80 text-xs leading-4.5 text-brand-800 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-200",
              compact ? "mt-2 px-2.5 py-1.5" : "mt-2.5 px-2.5 py-2",
            )}
          >
            <InfoIcon
              aria-hidden="true"
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
            />
            <p className="min-w-0 break-words">
              {message.assistantMeta.coverageNote}
            </p>
          </div>
        )}

      {isInsufficient && (
        <div
          data-testid="assistant-insufficient-callout"
          className={cn(
            "flex items-start gap-2 text-xs leading-4.5 text-gray-700 dark:text-gray-300",
            compact
              ? "mt-2 border-t border-gray-200/80 pt-2 dark:border-gray-700/80"
              : "mt-2.5 rounded-xl border border-gray-200/90 bg-white/90 px-2.5 py-2 dark:border-gray-700 dark:bg-gray-900/70",
          )}
        >
          <InfoIcon
            aria-hidden="true"
            className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gray-600 dark:text-gray-400"
          />
          <p className="min-w-0 break-words">
            {t("assistantStatusInsufficientHint")}
          </p>
        </div>
      )}

      <AssistantSourceChips
        sources={sources}
        onOpenContext={onOpenContext}
        compact={compact}
        hasEdited={hasEdited}
        hasDeleted={hasDeleted}
        trailingNote={
          hasEdited || hasDeleted ? (
            <p className="text-xs text-gray-600 dark:text-gray-400">
              {t("assistantHistoricalNote")}
            </p>
          ) : undefined
        }
      />
    </div>
  );
}

function ThinkingWaveDots() {
  return (
    <span
      data-testid="assistant-thinking-dots"
      aria-hidden="true"
      className="inline-flex items-center gap-1 pt-0.5"
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          style={{ "--dot-i": index } as CSSProperties}
          className="cu-ai-wave-dot inline-block h-1.5 w-1.5 rounded-full bg-brand-500 dark:bg-brand-400"
        />
      ))}
    </span>
  );
}

export function AssistantTriggerStatusCard({
  message,
  assistantState,
  mine,
  compact = false,
  onRetry,
}: Readonly<{
  message: ChatMessage;
  assistantState: ChatAssistantJobState;
  mine: boolean;
  compact?: boolean;
  onRetry?: (triggerMessage: ChatMessage) => Promise<boolean>;
}>) {
  const t = useTranslations("chat");
  const [retrying, setRetrying] = useState(false);

  if (
    assistantState.status === "COMPLETED" ||
    assistantState.status === "INSUFFICIENT_EVIDENCE"
  ) {
    return null;
  }

  const handleRetry = async () => {
    if (!onRetry || retrying) return;
    setRetrying(true);
    try {
      await onRetry(message);
    } finally {
      setRetrying(false);
    }
  };

  if (
    assistantState.status === "PENDING" ||
    assistantState.status === "PROCESSING"
  ) {
    return (
      <div
        role="status"
        aria-live="polite"
        data-testid={`assistant-trigger-status-${assistantState.status.toLowerCase()}`}
        className={cn(
          "mt-1.5 inline-flex w-fit max-w-full items-center gap-2 rounded-2xl rounded-es-md border border-brand-200/75 bg-white text-start shadow-theme-xs dark:border-brand-500/25 dark:bg-gray-900/95",
          mine ? "self-end" : "self-start",
          compact ? "px-2.5 py-1.5" : "px-3 py-2",
        )}
      >
        <span
          aria-hidden="true"
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 ring-1 ring-brand-200/70 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/25"
        >
          <ShootingStarIcon className="h-3 w-3" />
        </span>
        <span className="min-w-0 truncate text-xs font-medium text-gray-700 dark:text-gray-200">
          {t(
            assistantState.status === "PENDING"
              ? "assistantStatusPending"
              : "assistantStatusProcessing",
          )}
        </span>
        <ThinkingWaveDots />
      </div>
    );
  }

  if (assistantState.status === "CANCELLED") {
    const code = assistantState.failureCode;
    const isAccessRevoked = code === "ACCESS_REVOKED";
    const isTriggerDeleted = code === "TRIGGER_DELETED";
    const isSourceChanged =
      code === "SOURCE_CHANGED" || (!isAccessRevoked && !isTriggerDeleted);

    const titleKey = isAccessRevoked
      ? "assistantCancelledAccessRevokedTitle"
      : isTriggerDeleted
        ? "assistantCancelledTriggerDeletedTitle"
        : "assistantCancelledSourceChangedTitle";
    const bodyKey = isAccessRevoked
      ? "assistantCancelledAccessRevokedBody"
      : isTriggerDeleted
        ? "assistantCancelledTriggerDeletedBody"
        : "assistantCancelledSourceChangedBody";

    return (
      <div
        role="status"
        data-testid={`assistant-trigger-status-cancelled-${(code ?? "unknown").toLowerCase()}`}
        className={cn(
          "mt-1.5 w-full max-w-sm rounded-2xl border px-3 py-2.5 text-start shadow-theme-xs",
          isAccessRevoked
            ? "border-gray-200 bg-gray-50 text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            : "border-warning-200/90 bg-warning-50/90 text-warning-900 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-100",
          mine ? "self-end" : "self-start",
          compact && "max-w-full px-2.5 py-2",
        )}
      >
        <div className="flex items-start gap-2">
          <span aria-hidden="true" className="mt-0.5 shrink-0">
            {isAccessRevoked ? (
              <LockIcon className="h-4 w-4 text-gray-600 dark:text-gray-400" />
            ) : (
              <AlertIcon className="h-4 w-4 text-warning-600 dark:text-warning-400" />
            )}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-xs font-semibold">{t(titleKey)}</p>
            <p
              className={cn(
                "text-xs leading-4.5",
                isAccessRevoked
                  ? "text-gray-700 dark:text-gray-300"
                  : "text-warning-800 dark:text-warning-200",
              )}
            >
              {t(bodyKey)}
            </p>
            {isSourceChanged && onRetry && (
              <button
                type="button"
                disabled={retrying}
                aria-busy={retrying}
                onClick={() => void handleRetry()}
                className="mt-1 inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-warning-300 bg-white px-2.5 py-1 text-xs font-semibold text-warning-800 transition hover:bg-warning-100/70 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-warning-500/40 dark:bg-gray-900 dark:text-warning-200 dark:hover:bg-warning-500/20"
              >
                <RefreshIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                {t(retrying ? "assistantRetrying" : "assistantRetryAction")}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // FAILED state
  const code = assistantState.failureCode;
  const titleKey =
    code === "TIMEOUT"
      ? "assistantFailedTimeoutTitle"
      : code === "INVALID_MODEL_OUTPUT"
        ? "assistantFailedInvalidOutputTitle"
        : "assistantFailedUnavailableTitle";
  const bodyKey =
    code === "TIMEOUT"
      ? "assistantFailedTimeoutBody"
      : code === "INVALID_MODEL_OUTPUT"
        ? "assistantFailedInvalidOutputBody"
        : "assistantFailedUnavailableBody";

  return (
    <div
      role="alert"
      data-testid={`assistant-trigger-status-failed-${(code ?? "service_unavailable").toLowerCase()}`}
      className={cn(
        "mt-1.5 w-full max-w-sm rounded-2xl border border-error-200/90 bg-error-50/90 px-3 py-2.5 text-start text-error-900 shadow-theme-xs dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-100",
        mine ? "self-end" : "self-start",
        compact && "max-w-full px-2.5 py-2",
      )}
    >
      <div className="flex items-start gap-2">
        <AlertCircleIcon
          aria-hidden="true"
          className="mt-0.5 h-4 w-4 shrink-0 text-error-600 dark:text-error-400"
        />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-semibold">{t(titleKey)}</p>
          <p className="text-xs leading-4.5 text-error-800 dark:text-error-200">
            {t(bodyKey)}
          </p>
          {onRetry && (
            <button
              type="button"
              disabled={retrying}
              aria-busy={retrying}
              onClick={() => void handleRetry()}
              className="mt-1 inline-flex min-h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-error-300 bg-white px-2.5 py-1 text-xs font-semibold text-error-700 transition hover:bg-error-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-60 dark:border-error-500/40 dark:bg-gray-900 dark:text-error-200 dark:hover:bg-error-500/20"
            >
              <RefreshIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
              {t(retrying ? "assistantRetrying" : "assistantRetryAction")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
