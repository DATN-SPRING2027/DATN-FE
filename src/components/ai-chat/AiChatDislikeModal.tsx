"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { AlertIcon, CloseLineIcon } from "@/icons";
import type {
  AiAnswerFeedbackInput,
  AiDislikeReasonCategory,
} from "@/lib/queries/ai-chat/ai-chat.types";
import { cn } from "@/utils";
import {
  DISLIKE_REASON_CATEGORIES,
  MAX_DISLIKE_REASON_LENGTH,
  buildDislikeFeedbackPayload,
  validateDislike,
} from "./answer-action-utils";

export interface AiChatDislikeModalProps {
  isOpen: boolean;
  initialCategory?: AiDislikeReasonCategory;
  initialReasonText?: string;
  isSubmitting: boolean;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (
    payload: Extract<AiAnswerFeedbackInput, { rating: "DISLIKE" }>,
  ) => Promise<void>;
}

export default function AiChatDislikeModal({
  isOpen,
  initialCategory = "INACCURATE",
  initialReasonText = "",
  isSubmitting,
  errorMessage,
  onClose,
  onSubmit,
}: AiChatDislikeModalProps) {
  const t = useTranslations("AiChat");
  const [selectedCategory, setSelectedCategory] =
    useState<AiDislikeReasonCategory>(initialCategory);
  const [reasonText, setReasonText] = useState(initialReasonText);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  const isTooLong = reasonText.length > MAX_DISLIKE_REASON_LENGTH;
  const isMissingOtherReason =
    selectedCategory === "OTHER" && !/\S/.test(reasonText);
  const isValid = validateDislike(selectedCategory, reasonText);

  const categoryLabel = (category: AiDislikeReasonCategory): string => {
    switch (category) {
      case "INACCURATE":
        return t("dislikeCategoryINACCURATE");
      case "OUTDATED":
        return t("dislikeCategoryOUTDATED");
      case "IRRELEVANT_CITATION":
        return t("dislikeCategoryIRRELEVANT_CITATION");
      case "INCOMPLETE":
        return t("dislikeCategoryINCOMPLETE");
      case "OTHER":
        return t("dislikeCategoryOTHER");
    }
  };

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValid || isSubmitting) return;
    await onSubmit(buildDislikeFeedbackPayload(selectedCategory, reasonText));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={t("closeDialog")}
        disabled={isSubmitting}
        onClick={onClose}
        className="fixed inset-0 bg-gray-950/65 backdrop-blur-xs"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("dislikeDialogTitle")}
        className="relative z-10 w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-5 shadow-theme-xl dark:border-white/10 dark:bg-gpt-popover"
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-200 pb-3.5 dark:border-white/10">
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">
              {t("dislikeDialogTitle")}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {t("dislikeDialogSubtitle")}
            </p>
          </div>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            aria-label={t("closeDialog")}
            className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <CloseLineIcon aria-hidden="true" className="size-4" />
          </button>
        </div>

        <form onSubmit={(ev) => void handleFormSubmit(ev)} className="mt-4 space-y-4">
          <fieldset>
            <legend className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-200">
              {t("dislikeReasonCategoryLabel")}
            </legend>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {DISLIKE_REASON_CATEGORIES.map((category) => {
                const checked = selectedCategory === category;
                return (
                  <label
                    key={category}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-xs font-medium transition-colors",
                      checked
                        ? "border-brand-500 bg-brand-50/80 text-brand-700 dark:border-brand-400 dark:bg-brand-500/15 dark:text-brand-200"
                        : "border-gray-200 bg-gray-50/60 text-gray-700 hover:bg-gray-100 dark:border-white/10 dark:bg-gpt-sidebar dark:text-gray-200 dark:hover:bg-white/10",
                    )}
                  >
                    <input
                      type="radio"
                      name="dislike-reason-category"
                      value={category}
                      checked={checked}
                      disabled={isSubmitting}
                      onChange={() => setSelectedCategory(category)}
                      className="size-3.5 text-brand-600 focus:ring-brand-500"
                    />
                    <span>{categoryLabel(category)}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label
                htmlFor="ai-dislike-reason-input"
                className="text-xs font-semibold text-gray-700 dark:text-gray-200"
              >
                {t("dislikeReasonTextLabel")}
              </label>
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  selectedCategory === "OTHER"
                    ? "bg-warning-500/15 text-warning-700 dark:text-warning-300"
                    : "bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-gray-400",
                )}
              >
                {selectedCategory === "OTHER"
                  ? t("dislikeReasonRequiredBadge")
                  : t("dislikeReasonOptionalBadge")}
              </span>
            </div>

            <textarea
              id="ai-dislike-reason-input"
              rows={3}
              value={reasonText}
              disabled={isSubmitting}
              onChange={(ev) => setReasonText(ev.target.value)}
              placeholder={
                selectedCategory === "OTHER"
                  ? t("dislikeReasonPlaceholderOther")
                  : t("dislikeReasonPlaceholderOptional")
              }
              className="w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-relaxed text-gray-900 placeholder:text-gray-400 focus:border-brand-500 focus:outline-none dark:border-white/10 dark:bg-gpt-sidebar dark:text-gray-100 dark:placeholder:text-gray-500"
            />

            <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
              <span
                className={cn(
                  isTooLong || isMissingOtherReason
                    ? "text-error-600 dark:text-error-300"
                    : "text-gray-400 dark:text-gray-500",
                )}
              >
                {isTooLong
                  ? t("dislikeValidationLength", {
                      max: MAX_DISLIKE_REASON_LENGTH,
                    })
                  : isMissingOtherReason && reasonText.length > 0
                    ? t("dislikeValidationOther")
                    : ""}
              </span>
              <span
                className={cn(
                  "tabular-nums",
                  isTooLong
                    ? "font-semibold text-error-600 dark:text-error-300"
                    : "text-gray-400 dark:text-gray-500",
                )}
              >
                {t("charCounter", {
                  count: reasonText.length,
                  max: MAX_DISLIKE_REASON_LENGTH,
                })}
              </span>
            </div>
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-xl border border-error-200 bg-error-50 px-3 py-2 text-xs text-error-700 dark:border-error-800/60 dark:bg-error-500/10 dark:text-error-300"
            >
              <AlertIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={onClose}
              className="rounded-full border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:bg-gpt-composer dark:text-gray-200 dark:hover:bg-white/10"
            >
              {t("dislikeCancelAction")}
            </button>
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="rounded-full bg-brand-500 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting
                ? t("dislikeSubmittingAction")
                : t("dislikeSubmitAction")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
