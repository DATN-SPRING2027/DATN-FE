"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type RefObject,
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
import type { Project } from "@/lib/queries/projects/useProjects";
import { cn } from "@/utils";
import AiChatProjectMenu from "./AiChatProjectMenu";

export const AI_CHAT_MAX_QUERY_LENGTH = 4000;

export interface AiChatComposerProps {
  variant: "hero" | "docked";
  mode: "chat" | "work";
  value: string;
  projectId: string;
  projectCode: string;
  projectName: string;
  projects?: readonly Project[];
  isStreaming: boolean;
  disabled?: boolean;
  validationError: string | null;
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  isProjectMenuOpen?: boolean;
  onProjectMenuOpenChange?: (nextOpen: boolean) => void;
  onSelectProject?: (project: Project) => void;
  onChange: (nextValue: string) => void;
  onSubmit: () => void;
  onStopStreaming: () => void;
}

export default function AiChatComposer({
  variant,
  mode,
  value,
  projectId,
  projectCode,
  projectName,
  projects,
  isStreaming,
  disabled = false,
  validationError,
  inputRef,
  isProjectMenuOpen,
  onProjectMenuOpenChange,
  onSelectProject,
  onChange,
  onSubmit,
  onStopStreaming,
}: AiChatComposerProps) {
  const t = useTranslations("AiChat");
  const internalTextareaRef = useRef<HTMLTextAreaElement | null>(null);
  const plusMenuRef = useRef<HTMLDivElement | null>(null);
  const projectMenuRef = useRef<HTMLDivElement | null>(null);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [uncontrolledProjectMenuOpen, setUncontrolledProjectMenuOpen] =
    useState(false);

  const setTextareaRef = useCallback(
    (node: HTMLTextAreaElement | null) => {
      internalTextareaRef.current = node;
      if (inputRef) {
        inputRef.current = node;
      }
    },
    [inputRef],
  );

  const projectMenuOpen = isProjectMenuOpen ?? uncontrolledProjectMenuOpen;
  const setProjectMenuOpen = useCallback(
    (nextOpen: boolean) => {
      if (isProjectMenuOpen === undefined) {
        setUncontrolledProjectMenuOpen(nextOpen);
      }
      onProjectMenuOpenChange?.(nextOpen);
    },
    [isProjectMenuOpen, onProjectMenuOpenChange],
  );

  useEffect(() => {
    const el = internalTextareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [value]);

  useEffect(() => {
    if (!isPlusMenuOpen && !projectMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        isPlusMenuOpen &&
        plusMenuRef.current &&
        !plusMenuRef.current.contains(target)
      ) {
        setIsPlusMenuOpen(false);
      }
      if (
        projectMenuOpen &&
        projectMenuRef.current &&
        !projectMenuRef.current.contains(target)
      ) {
        setProjectMenuOpen(false);
      }
    };
    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPlusMenuOpen(false);
        setProjectMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isPlusMenuOpen, projectMenuOpen, setProjectMenuOpen]);

  const charCount = value.length;
  const isOverLimit = charCount > AI_CHAT_MAX_QUERY_LENGTH;
  const isMultiline = charCount > 100 || value.includes("\n");
  const showCounter = charCount >= 3200 || isOverLimit;
  const hasText = value.trim().length > 0;
  const canSend = !disabled && !isStreaming && hasText && !isOverLimit;
  const hasProjectSelector = Boolean(
    projects && projects.length > 0 && onSelectProject,
  );
  const hasOpenPopover = isPlusMenuOpen || projectMenuOpen;

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
              onClick={() => {
                setProjectMenuOpen(false);
                setIsPlusMenuOpen((prev) => !prev);
              }}
              className="flex size-8 cursor-pointer items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-200/80 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
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
                    internalTextareaRef.current?.focus();
                  }}
                  className="flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-2.5 py-2 text-start text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-white/10"
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
            ref={setTextareaRef}
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

          {/* Right Controls: Counter (when near limit) + Inline Project Selector + Action Button */}
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

            {hasProjectSelector && projects && onSelectProject && (
              <div
                ref={projectMenuRef}
                className="relative hidden sm:inline-flex"
              >
                <button
                  type="button"
                  data-testid="ai-chat-composer-project-trigger"
                  aria-label={t("composerProjectScopeAriaLabel")}
                  aria-haspopup="listbox"
                  aria-expanded={projectMenuOpen}
                  onClick={() => {
                    setIsPlusMenuOpen(false);
                    setProjectMenuOpen(!projectMenuOpen);
                  }}
                  title={projectName}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-150",
                    projectMenuOpen
                      ? "bg-gray-200/90 text-gray-900 dark:bg-white/15 dark:text-white"
                      : "text-gray-600 hover:bg-gray-200/80 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white",
                  )}
                >
                  <span>{projectCode}</span>
                  <ChevronDownIcon
                    aria-hidden="true"
                    className={cn(
                      "size-3.5 opacity-70 transition-transform duration-200",
                      projectMenuOpen && "rotate-180",
                    )}
                  />
                </button>

                {projectMenuOpen && (
                  <AiChatProjectMenu
                    projects={projects}
                    selectedProjectId={projectId}
                    placement={variant === "docked" ? "top" : "bottom"}
                    testId="ai-chat-composer-project-menu"
                    onSelectProject={(proj) => {
                      setProjectMenuOpen(false);
                      onSelectProject(proj);
                    }}
                  />
                )}
              </div>
            )}

            {isStreaming ? (
              <button
                type="button"
                onClick={onStopStreaming}
                aria-label={t("stopStreaming")}
                className="flex size-8 cursor-pointer items-center justify-center rounded-full bg-gray-900 text-white transition-colors hover:bg-gray-700 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-200"
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
                  canSend
                    ? "cursor-pointer"
                    : "cursor-not-allowed hover:bg-brand-500",
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
    <div
      className={cn(
        "relative shrink-0 bg-white/95 px-4 pt-2 pb-3 backdrop-blur-xs dark:bg-gpt-canvas/95",
        hasOpenPopover ? "z-30" : "z-20",
      )}
    >
      {formNode}
      <p className="mt-2 text-center text-xs text-gray-500 dark:text-gray-400">
        {t("composerDisclaimer", { project: projectName })}
      </p>
    </div>
  );
}
