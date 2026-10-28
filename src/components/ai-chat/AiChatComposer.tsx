"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  AlertIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  DocsIcon,
  PlusIcon,
  ShootingStarIcon,
  StopSquareIcon,
  TaskIcon,
  VoiceWaveIcon,
} from "@/icons";
import { cn } from "@/utils";

export const AI_CHAT_MAX_QUERY_LENGTH = 4000;

export interface AiChatComposerProps {
  variant: "hero" | "docked";
  mode: "chat" | "work";
  value: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  isStreaming: boolean;
  disabled?: boolean;
  validationError: string | null;
  onChange: (nextValue: string) => void;
  onSubmit: () => void;
  onStopStreaming: () => void;
  onOpenProjectMenu?: () => void;
}

export default function AiChatComposer({
  variant,
  mode,
  value,
  projectId,
  projectCode,
  projectName,
  isStreaming,
  disabled = false,
  validationError,
  onChange,
  onSubmit,
  onStopStreaming,
  onOpenProjectMenu,
}: AiChatComposerProps) {
  const t = useTranslations("AiChat");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const plusMenuRef = useRef<HTMLDivElement | null>(null);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [value]);

  useEffect(() => {
    if (!isPlusMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (
        plusMenuRef.current &&
        !plusMenuRef.current.contains(event.target as Node)
      ) {
        setIsPlusMenuOpen(false);
      }
    };
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPlusMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isPlusMenuOpen]);

  const charCount = value.length;
  const isOverLimit = charCount > AI_CHAT_MAX_QUERY_LENGTH;
  const isMultiline = charCount > 100 || value.includes("\n");
  const showCounter = charCount >= 3200 || isOverLimit;
  const hasText = value.trim().length > 0;
  const canSend = !disabled && !isStreaming && hasText && !isOverLimit;

  const handleFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (isStreaming) return;
    onSubmit();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!isStreaming) {
        onSubmit();
      }
    }
  };

  const formNode = (
    <div
      className={cn(
        "w-full space-y-2",
        variant === "hero" ? "max-w-2xl" : "mx-auto max-w-3xl",
      )}
    >
      {(validationError || isOverLimit) && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-error-200 bg-error-50 px-3.5 py-2 text-xs font-medium text-error-700 dark:border-error-800/60 dark:bg-error-500/10 dark:text-error-300"
        >
          <AlertIcon aria-hidden="true" className="size-4 shrink-0" />
          <span>
            {validationError ??
              t("queryTooLongError", { max: AI_CHAT_MAX_QUERY_LENGTH })}
          </span>
        </div>
      )}

      <form
        onSubmit={handleFormSubmit}
        aria-label={t("composerFormAriaLabel")}
        className="relative w-full"
      >
        <div
          className={cn(
            "relative flex items-center gap-2 rounded-3xl border px-3.5 py-2 transition-all",
            isOverLimit || validationError
              ? "border-error-400 bg-gray-100/90 dark:border-error-500 dark:bg-gpt-composer"
              : "border-gray-200/90 bg-gray-100/90 text-gray-900 shadow-theme-sm focus-within:border-gray-300 focus-within:bg-white focus-within:shadow-theme-md dark:border-white/10 dark:bg-gpt-composer dark:text-gray-100 dark:focus-within:border-white/20 dark:focus-within:bg-gpt-composer-focus",
          )}
        >
          {/* Left "+" ChatGPT Project Knowledge Actions Menu */}
          <div ref={plusMenuRef} className="relative shrink-0">
            <button
              type="button"
              aria-label={t("plusMenuAriaLabel")}
              aria-expanded={isPlusMenuOpen}
              onClick={() => setIsPlusMenuOpen((prev) => !prev)}
              className="flex size-8 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200/80 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
            >
              <PlusIcon aria-hidden="true" className="size-3.5" />
            </button>

            {isPlusMenuOpen && (
              <div
                role="menu"
                aria-label={t("plusMenuAriaLabel")}
                className={cn(
                  "absolute start-0 z-50 w-64 rounded-2xl border border-gray-200 bg-white p-1.5 shadow-theme-lg dark:border-white/10 dark:bg-gpt-popover",
                  variant === "docked" ? "bottom-11" : "top-11",
                )}
              >
                <div className="px-2.5 py-1.5 text-xs font-semibold text-gray-400 dark:text-gray-500">
                  {t("plusMenuHeading")} · {projectCode}
                </div>

                <Link
                  href={`/projects/${encodeURIComponent(projectId)}/documents`}
                  role="menuitem"
                  onClick={() => setIsPlusMenuOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-start text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  <DocsIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-brand-500 dark:text-brand-400"
                  />
                  <span>{t("plusManageDocs")}</span>
                </Link>

                <Link
                  href={`/projects/${encodeURIComponent(projectId)}/work-notes`}
                  role="menuitem"
                  onClick={() => setIsPlusMenuOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-start text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  <TaskIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-success-500 dark:text-success-400"
                  />
                  <span>{t("plusOpenWorkNotes")}</span>
                </Link>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onChange(t("workChip1Prompt"));
                    setIsPlusMenuOpen(false);
                    textareaRef.current?.focus();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-start text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
                >
                  <ShootingStarIcon
                    aria-hidden="true"
                    className="size-4 shrink-0 text-warning-500 dark:text-warning-400"
                  />
                  <span>{t("plusInsertHandover")}</span>
                </button>
              </div>
            )}
          </div>

          {/* Center Auto-Expanding Textarea */}
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            disabled={disabled}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={handleKeyDown}
            aria-label={t("composerAriaLabel")}
            placeholder={
              mode === "work"
                ? t("composerPlaceholderWork", { code: projectCode })
                : t("composerPlaceholderChat")
            }
            className={cn(
              "max-h-36 min-h-6 flex-1 resize-none bg-transparent py-1 text-sm leading-5 text-gray-900 placeholder:text-gray-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:text-gray-100 dark:placeholder:text-gray-400",
              isMultiline ? "overflow-y-auto" : "overflow-y-hidden",
            )}
          />

          {/* Right Controls: Counter (when near limit) + Project Code Pill + Blue Circle Action Button */}
          <div className="flex shrink-0 items-center gap-1.5">
            {showCounter && (
              <span
                className={cn(
                  "px-1 text-xs font-medium tabular-nums",
                  isOverLimit
                    ? "text-error-600 dark:text-error-400"
                    : "text-warning-600 dark:text-warning-400",
                )}
              >
                {t("charCounter", {
                  count: charCount,
                  max: AI_CHAT_MAX_QUERY_LENGTH,
                })}
              </span>
            )}

            {onOpenProjectMenu && (
              <button
                type="button"
                onClick={onOpenProjectMenu}
                title={projectName}
                className="hidden items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200/80 hover:text-gray-900 sm:inline-flex dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
              >
                <span>{projectCode}</span>
                <ChevronDownIcon
                  aria-hidden="true"
                  className="size-3.5 opacity-70"
                />
              </button>
            )}

            {isStreaming ? (
              <button
                type="button"
                onClick={onStopStreaming}
                aria-label={t("stopStreaming")}
                className="flex size-8 items-center justify-center rounded-full bg-gray-900 text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
              >
                <StopSquareIcon aria-hidden="true" className="size-3.5" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!canSend}
                aria-label={t("sendMessage")}
                className={cn(
                  "flex size-8 items-center justify-center rounded-full bg-brand-500 text-white shadow-theme-xs transition-all hover:bg-brand-600 focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:outline-none",
                  !canSend && "cursor-not-allowed hover:bg-brand-500",
                  (isOverLimit || disabled) && "opacity-50",
                )}
              >
                {hasText ? (
                  <ArrowUpIcon aria-hidden="true" className="size-3.5" />
                ) : (
                  <VoiceWaveIcon aria-hidden="true" className="size-4" />
                )}
              </button>
            )}
          </div>
        </div>
      </form>
    </div>
  );

  if (variant === "hero") {
    return formNode;
  }

  return (
    <div className="shrink-0 bg-white/95 px-4 pt-2 pb-3 backdrop-blur-xs dark:bg-gpt-canvas/95">
      {formNode}
      <p className="mt-2 text-center text-xs text-gray-400 dark:text-gray-500">
        {t("composerDisclaimer", { project: projectName })}
      </p>
    </div>
  );
}
