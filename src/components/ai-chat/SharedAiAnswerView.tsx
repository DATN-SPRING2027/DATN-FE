"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  AlertIcon,
  ArrowRightIcon,
  AudioIcon,
  CheckLineIcon,
  ChevronLeftIcon,
  CloseLineIcon,
  CopyIcon,
  DocsIcon,
  LockIcon,
  ShootingStarIcon,
  StopSquareIcon,
} from "@/icons";
import { ApiError } from "@/lib/api-client";
import { useCurrentUserQuery } from "@/lib/queries/auth/useAuth";
import { useSharedAiAnswerQuery } from "@/lib/queries/ai-chat/useAiAnswerActions";
import type { AiChatCitation } from "@/lib/queries/ai-chat/ai-chat.types";
import { cn } from "@/utils";
import { isContinuumDocumentId } from "./citation-utils";
import { useLocalSpeech } from "./useLocalSpeech";

export interface SharedAiAnswerViewProps {
  projectId: string;
  shareId: string;
}

export default function SharedAiAnswerView({
  projectId,
  shareId,
}: SharedAiAnswerViewProps) {
  const t = useTranslations("AiChat");
  const locale = useLocale();
  const currentUserQuery = useCurrentUserQuery();
  const organizationId = currentUserQuery.data?.organizationId ?? "";

  const sharedQuery = useSharedAiAnswerQuery(
    organizationId,
    projectId,
    shareId,
    { enabled: Boolean(organizationId && projectId && shareId) },
  );

  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [inspectedCitation, setInspectedCitation] =
    useState<AiChatCitation | null>(null);

  const { speakingMessageId, speechError, toggleSpeak } =
    useLocalSpeech(locale);

  const backHref = `/ai-chat?projectId=${encodeURIComponent(projectId)}`;

  if (currentUserQuery.isLoading || sharedQuery.isLoading) {
    return (
      <main
        role="status"
        aria-label={t("sharedLoading")}
        className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6"
      >
        <div className="space-y-5 rounded-3xl border border-gray-200/80 bg-white p-6 shadow-theme-xs dark:border-white/10 dark:bg-gpt-canvas">
          <div className="h-6 w-48 animate-pulse rounded-full bg-gray-100 dark:bg-gpt-sidebar" />
          <div className="h-16 w-full animate-pulse rounded-2xl bg-gray-100 dark:bg-gpt-bubble" />
          <div className="h-36 w-full animate-pulse rounded-2xl bg-gray-100 dark:bg-gpt-sidebar" />
        </div>
      </main>
    );
  }

  const queryError = sharedQuery.error ?? currentUserQuery.error;
  if (sharedQuery.isError || !sharedQuery.data) {
    const status = queryError instanceof ApiError ? queryError.status : 500;
    const isAuthRequired = status === 401;
    const isUnavailable = status === 403 || status === 404;

    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div
          role="alert"
          className="w-full rounded-3xl border border-gray-200 bg-white p-7 text-center shadow-theme-sm dark:border-white/10 dark:bg-gpt-canvas"
        >
          <div
            className={cn(
              "mx-auto mb-4 inline-flex size-12 items-center justify-center rounded-2xl",
              isUnavailable
                ? "bg-warning-500/15 text-warning-600 dark:text-warning-300"
                : "bg-error-500/15 text-error-600 dark:text-error-300",
            )}
          >
            {isUnavailable || isAuthRequired ? (
              <LockIcon aria-hidden="true" className="size-6" />
            ) : (
              <AlertIcon aria-hidden="true" className="size-6" />
            )}
          </div>

          <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isAuthRequired
              ? t("sharedSessionExpiredTitle")
              : isUnavailable
                ? t("sharedUnavailableTitle")
                : t("sharedErrorTitle")}
          </h1>

          <p className="mt-2 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
            {isAuthRequired
              ? t("sharedSessionExpiredBody")
              : isUnavailable
                ? t("sharedUnavailableBody")
                : t("sharedErrorBody")}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            {!isUnavailable && !isAuthRequired && (
              <button
                type="button"
                onClick={() => void sharedQuery.refetch()}
                className="inline-flex items-center rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white hover:bg-brand-600"
              >
                {t("retryAction")}
              </button>
            )}
            <Link
              href={backHref}
              className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-white/10 dark:bg-gpt-sidebar dark:text-gray-200 dark:hover:bg-white/10"
            >
              <ChevronLeftIcon aria-hidden="true" className="size-4" />
              <span>{t("sharedBackToChat")}</span>
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const shared = sharedQuery.data;
  const isSpeaking = speakingMessageId === shared.answer.id;
  const parsedSharedDate = new Date(shared.share.createdAt);
  const formattedSharedDate = Number.isNaN(parsedSharedDate.getTime())
    ? "—"
    : new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(parsedSharedDate);

  const handleCopy = async () => {
    setCopyError(null);
    if (!navigator.clipboard?.writeText) {
      setCopyError(t("copyFailedError"));
      return;
    }
    try {
      await navigator.clipboard.writeText(shared.answer.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      setCopyError(t("copyFailedError"));
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/25 bg-brand-500/10 px-3 py-1 text-xs font-semibold text-brand-600 dark:text-brand-300">
            <LockIcon aria-hidden="true" className="size-3.5" />
            <span>{t("sharedPageBadge")}</span>
          </div>
          <h1 className="mt-2.5 text-xl font-semibold text-gray-900 dark:text-white">
            {t("sharedPageTitle")}
          </h1>
          <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            {t("sharedPageSubtitle")}
          </p>
        </div>

        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 shadow-theme-xs transition-colors hover:bg-gray-50 dark:border-white/10 dark:bg-gpt-sidebar dark:text-gray-200 dark:hover:bg-white/10"
        >
          <span>{t("sharedBackToChat")}</span>
          <ArrowRightIcon aria-hidden="true" className="size-3.5" />
        </Link>
      </div>

      <section className="space-y-6 rounded-3xl border border-gray-200/80 bg-white p-5 shadow-theme-xs sm:p-7 dark:border-white/10 dark:bg-gpt-canvas">
        {/* Shared Question */}
        <div className="rounded-2xl border border-gray-200/80 bg-gray-50/90 p-4 dark:border-white/10 dark:bg-gpt-bubble">
          <div className="flex items-center justify-between gap-2 text-[11px] font-semibold tracking-wider text-gray-400 uppercase tabular-nums dark:text-gray-500">
            <span>{t("sharedQuestionHeading")}</span>
            <span>{t("sharedSharedAtLabel", { date: formattedSharedDate })}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed font-medium break-words whitespace-pre-wrap text-gray-900 dark:text-white">
            {shared.question.content}
          </p>
        </div>

        {/* Shared Answer */}
        <article className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-500/25 bg-brand-500/10 px-2.5 py-0.5 text-xs font-medium text-brand-600 dark:text-brand-300">
              <ShootingStarIcon aria-hidden="true" className="size-3" />
              <span>{t("sharedAnswerHeading")}</span>
            </span>
          </div>

          <div className="text-sm leading-7 break-words whitespace-pre-wrap text-gray-800 dark:text-gray-100">
            {shared.answer.content}
          </div>

          {/* Read-only utility bar: Copy + Local Speech */}
          <div className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-3 dark:border-white/10">
            <button
              type="button"
              onClick={() => void handleCopy()}
              aria-label={t("copyAnswer")}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              {copied ? (
                <>
                  <CheckLineIcon
                    aria-hidden="true"
                    className="size-3.5 text-success-500"
                  />
                  <span>{t("copiedAnswer")}</span>
                </>
              ) : (
                <>
                  <CopyIcon aria-hidden="true" className="size-3.5" />
                  <span>{t("copyAnswer")}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                void toggleSpeak(shared.answer.id, shared.answer.content)
              }
              aria-label={
                isSpeaking ? t("stopReadingAction") : t("readAloudAction")
              }
              aria-pressed={isSpeaking}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                isSpeaking
                  ? "bg-brand-500/15 text-brand-600 dark:text-brand-300"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white",
              )}
            >
              {isSpeaking ? (
                <>
                  <StopSquareIcon aria-hidden="true" className="size-3.5" />
                  <span>{t("stopReadingAction")}</span>
                </>
              ) : (
                <>
                  <AudioIcon aria-hidden="true" className="size-3.5" />
                  <span>{t("readAloudAction")}</span>
                </>
              )}
            </button>
          </div>

          {copyError && (
            <p role="alert" className="text-xs text-warning-700 dark:text-warning-300">
              {copyError}
            </p>
          )}
          {speechError?.messageId === shared.answer.id && (
            <p role="alert" className="text-xs text-warning-700 dark:text-warning-300">
              {speechError.kind === "unavailable"
                ? t("speechUnavailableError")
                : t("speechFailedError")}
            </p>
          )}

          {/* Verified Document Citations */}
          {shared.answer.citations.length > 0 && (
            <div className="pt-2">
              <h2 className="mb-2.5 text-xs font-semibold tracking-wider text-gray-400 uppercase tabular-nums dark:text-gray-500">
                {t("documentSourcesHeading", {
                  count: shared.answer.citations.length,
                })}
              </h2>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {shared.answer.citations.map((cit) => {
                  const title =
                    cit.documentName ??
                    cit.sourceName ??
                    cit.label ??
                    cit.documentId;
                  const canDeepLink = isContinuumDocumentId(cit.documentId);
                  return (
                    <div
                      key={`${cit.number}-${cit.sourceId}-${cit.documentId}`}
                      className="flex flex-col justify-between rounded-2xl border border-gray-200/80 bg-gray-50/70 p-3.5 dark:border-white/10 dark:bg-gpt-sidebar"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="inline-flex shrink-0 items-center rounded-md bg-brand-500/15 px-1.5 py-0.5 text-xs font-bold text-brand-600 tabular-nums dark:text-brand-300">
                            [{cit.number}]
                          </span>
                          <span className="truncate text-xs font-semibold text-gray-900 dark:text-white">
                            {title}
                          </span>
                        </div>
                        {cit.snippet && (
                          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                            {cit.snippet}
                          </p>
                        )}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setInspectedCitation(cit)}
                          className="font-medium text-brand-600 hover:underline dark:text-brand-400"
                        >
                          {t("previewExcerptAction")}
                        </button>
                        {canDeepLink && (
                          <Link
                            href={`/projects/${encodeURIComponent(
                              projectId,
                            )}/documents/${encodeURIComponent(cit.documentId)}`}
                            className="inline-flex items-center gap-1 font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                          >
                            <span>{t("openDocumentLink")}</span>
                            <ArrowRightIcon
                              aria-hidden="true"
                              className="size-3"
                            />
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </article>
      </section>

      {inspectedCitation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label={t("closeDialog")}
            onClick={() => setInspectedCitation(null)}
            className="fixed inset-0 bg-gray-950/65 backdrop-blur-xs"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t("citationDialogAriaLabel")}
            className="relative z-10 w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xl dark:border-white/10 dark:bg-gpt-popover"
          >
            <div className="flex items-start justify-between gap-3 border-b border-gray-200 pb-3 dark:border-white/10">
              <div className="flex min-w-0 items-center gap-2">
                <DocsIcon
                  aria-hidden="true"
                  className="size-4 shrink-0 text-brand-600 dark:text-brand-300"
                />
                <h3 className="truncate text-sm font-semibold text-gray-900 dark:text-white">
                  {inspectedCitation.documentName ??
                    inspectedCitation.sourceName ??
                    inspectedCitation.documentId}
                </h3>
              </div>
              <button
                type="button"
                aria-label={t("closeDialog")}
                onClick={() => setInspectedCitation(null)}
                className="inline-flex size-7 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-white/10"
              >
                <CloseLineIcon aria-hidden="true" className="size-4" />
              </button>
            </div>
            <div className="mt-4 max-h-60 overflow-y-auto rounded-xl border border-gray-200 bg-gray-50 p-3.5 text-xs leading-relaxed break-words whitespace-pre-wrap text-gray-800 dark:border-white/10 dark:bg-gpt-sidebar dark:text-gray-200">
              {inspectedCitation.snippet ?? t("excerptNoSnippet")}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
