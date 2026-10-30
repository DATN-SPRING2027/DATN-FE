"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertIcon,
  CheckLineIcon,
  CloseLineIcon,
  CopyIcon,
  DocsIcon,
  LockIcon,
  ShareIcon,
  TrashBinIcon,
} from "@/icons";
import type { AiAnswerShare } from "@/lib/queries/ai-chat/ai-chat.types";

export interface AiChatShareModalProps {
  isOpen: boolean;
  projectId: string;
  projectName: string;
  questionText: string;
  answerContent: string;
  citationCount: number;
  activeShare: AiAnswerShare | null;
  isCreating: boolean;
  isRevoking: boolean;
  errorMessage: string | null;
  revokedNotice: boolean;
  onClose: () => void;
  onCreateShare: () => Promise<void>;
  onRevokeShare: (shareId: string) => Promise<void>;
}

export default function AiChatShareModal({
  isOpen,
  projectId,
  projectName,
  questionText,
  answerContent,
  citationCount,
  activeShare,
  isCreating,
  isRevoking,
  errorMessage,
  revokedNotice,
  onClose,
  onCreateShare,
  onRevokeShare,
}: AiChatShareModalProps) {
  const t = useTranslations("AiChat");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isCreating && !isRevoking) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isCreating, isOpen, isRevoking, onClose]);

  if (!isOpen) return null;

  const relativeSharePath = activeShare
    ? `/projects/${encodeURIComponent(projectId)}/ai-chat/shares/${encodeURIComponent(activeShare.id)}`
    : "";
  const fullShareUrl =
    activeShare && typeof window !== "undefined"
      ? `${window.location.origin}${relativeSharePath}`
      : relativeSharePath;

  const handleCopyUrl = async () => {
    if (!fullShareUrl) return;
    setCopyError(null);
    if (!navigator.clipboard?.writeText) {
      setCopyError(t("copyFailedError"));
      return;
    }
    try {
      await navigator.clipboard.writeText(fullShareUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 2000);
    } catch {
      setCopiedLink(false);
      setCopyError(t("copyFailedError"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("closeDialog")}
        disabled={isCreating || isRevoking}
        onClick={onClose}
        className="fixed inset-0 bg-gray-950/65 backdrop-blur-xs"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("shareDialogTitle")}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xl dark:border-white/10 dark:bg-gpt-popover"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 pb-3.5 dark:border-white/10">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {t("shareDialogTitle")}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {t("shareDialogSubtitle", { project: projectName })}
            </p>
          </div>
          <button
            type="button"
            disabled={isCreating || isRevoking}
            onClick={onClose}
            aria-label={t("closeDialog")}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <CloseLineIcon aria-hidden="true" className="size-4" />
          </button>
        </div>

        <div className="mt-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-success-500/25 bg-success-50/70 px-3 py-2 text-xs text-success-700 dark:bg-success-500/10 dark:text-success-300">
            <span className="inline-flex items-center gap-1.5 font-medium">
              <LockIcon aria-hidden="true" className="size-3.5 shrink-0" />
              <span>{t("shareScopeBadge", { project: projectName })}</span>
            </span>
            {citationCount > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold tabular-nums">
                <DocsIcon aria-hidden="true" className="size-3.5" />
                <span>{t("sourcesCountBadge", { count: citationCount })}</span>
              </span>
            )}
          </div>

          <div className="max-h-56 space-y-2.5 overflow-y-auto rounded-2xl border border-gray-200 bg-gray-50/80 p-3.5 text-xs dark:border-white/10 dark:bg-gpt-sidebar">
            {questionText && (
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                  {t("sharePreviewQuestionLabel")}
                </p>
                <p className="mt-1 font-medium break-words whitespace-pre-wrap text-gray-900 dark:text-white">
                  {questionText}
                </p>
              </div>
            )}
            <div className={questionText ? "border-t border-gray-200/80 pt-2.5 dark:border-white/10" : ""}>
              <p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                {t("sharePreviewAnswerLabel")}
              </p>
              <p className="mt-1 line-clamp-5 leading-relaxed break-words whitespace-pre-wrap text-gray-700 dark:text-gray-200">
                {answerContent}
              </p>
            </div>
          </div>

          {activeShare ? (
            <div className="space-y-2.5">
              <label
                htmlFor="ai-share-link-input"
                className="block text-xs font-semibold text-gray-700 dark:text-gray-200"
              >
                {t("shareLinkLabel")}
              </label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="ai-share-link-input"
                  type="text"
                  readOnly
                  value={fullShareUrl}
                  onFocus={(ev) => ev.currentTarget.select()}
                  className="font-mono h-9 min-w-0 flex-1 rounded-xl border border-gray-200 bg-gray-50 px-3 text-xs text-gray-800 focus:border-brand-500 focus:outline-none dark:border-white/10 dark:bg-gpt-composer dark:text-gray-100"
                />
                <button
                  type="button"
                  onClick={() => void handleCopyUrl()}
                  className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3.5 text-xs font-semibold text-white transition-colors hover:bg-brand-600"
                >
                  {copiedLink ? (
                    <>
                      <CheckLineIcon aria-hidden="true" className="size-3.5" />
                      <span>{t("shareCopiedLinkAction")}</span>
                    </>
                  ) : (
                    <>
                      <CopyIcon aria-hidden="true" className="size-3.5" />
                      <span>{t("shareCopyLinkAction")}</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  disabled={isRevoking}
                  onClick={() => void onRevokeShare(activeShare.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-error-200 bg-error-50 px-3.5 py-1.5 text-xs font-semibold text-error-700 transition-colors hover:bg-error-100 disabled:opacity-50 dark:border-error-800/60 dark:bg-error-500/15 dark:text-error-300"
                >
                  <TrashBinIcon aria-hidden="true" className="size-3.5" />
                  <span>
                    {isRevoking
                      ? t("shareRevokingAction")
                      : t("shareRevokeAction")}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-white/10 dark:bg-gpt-composer dark:text-gray-200"
                >
                  {t("closeDialog")}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={isCreating}
                onClick={onClose}
                className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-gpt-composer dark:text-gray-200"
              >
                {t("dislikeCancelAction")}
              </button>
              <button
                type="button"
                disabled={isCreating}
                onClick={() => void onCreateShare()}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:opacity-50"
              >
                <ShareIcon aria-hidden="true" className="size-3.5" />
                <span>
                  {isCreating
                    ? t("shareCreatingAction")
                    : t("shareCreateAction")}
                </span>
              </button>
            </div>
          )}

          {revokedNotice && !activeShare && (
            <p
              role="status"
              className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 dark:border-white/10 dark:bg-gpt-sidebar dark:text-gray-300"
            >
              {t("shareRevokedNotice")}
            </p>
          )}

          {(errorMessage || copyError) && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-error-200 bg-error-50 px-3 py-2 text-xs text-error-700 dark:border-error-800/60 dark:bg-error-500/10 dark:text-error-300"
            >
              <AlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{errorMessage ?? copyError}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
