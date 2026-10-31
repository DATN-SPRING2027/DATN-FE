"use client";

import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertIcon,
  CheckLineIcon,
  ChevronDownIcon,
  StopSquareIcon,
} from "@/icons";
import type { AiChatRetrievalStep } from "@/lib/queries/ai-chat/ai-chat.types";
import { cn } from "@/utils";

export interface AiChatActivityProgressProps {
  isStreaming: boolean;
  hasContent: boolean;
  status: "ok" | "failed" | "cancelled";
  steps: readonly AiChatRetrievalStep[];
  startedAt?: number;
  finishedAt?: number;
  defaultExpanded?: boolean;
}

type CanonicalToolKey =
  | "activityToolSearchContext"
  | "activityToolGetEntity"
  | "activityToolSearchTimeline"
  | "activityToolWebSearch"
  | "activityToolOpenUrl";

const CANONICAL_TOOL_LABEL_KEYS: Readonly<Record<string, CanonicalToolKey>> = {
  "Tìm trong kho tri thức": "activityToolSearchContext",
  "Tìm kiếm kho tri thức": "activityToolSearchContext",
  "Knowledge Retrieval": "activityToolSearchContext",
  search_context: "activityToolSearchContext",
  "Tra cứu thực thể": "activityToolGetEntity",
  get_entity: "activityToolGetEntity",
  "Tra cứu thời gian": "activityToolSearchTimeline",
  search_timeline: "activityToolSearchTimeline",
  "Tìm kiếm Internet": "activityToolWebSearch",
  web_search: "activityToolWebSearch",
  "Mở trang web": "activityToolOpenUrl",
  open_url: "activityToolOpenUrl",
};

function ActivityText({ text }: { text: string }) {
  const [characters, setCharacters] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    let count = 0;
    const timer = window.setInterval(() => {
      count = Math.min(text.length, count + 2);
      setCharacters(count);
      if (count === text.length) window.clearInterval(timer);
    }, 24);
    return () => window.clearInterval(timer);
  }, [text]);
  return (
    <span role="status" aria-live="polite" aria-atomic="true">
      <span className="sr-only">{text}</span>
      <span
        aria-hidden="true"
        className="motion-reduce:hidden"
        data-testid="activity-animated-text"
      >
        {text.slice(0, characters)}
        <span className="ms-0.5 inline-block h-3 w-px bg-brand-500 align-middle motion-safe:animate-pulse" />
      </span>
      <span aria-hidden="true" className="hidden motion-reduce:inline">
        {text}
      </span>
    </span>
  );
}

type DisplayStepStatus = "running" | "completed" | "failed" | "stopped";

function resolveEffectiveStepStatus(
  step: AiChatRetrievalStep,
  isStreaming: boolean,
  turnStatus: "ok" | "failed" | "cancelled",
): DisplayStepStatus {
  if (step.status === "failed") return "failed";
  if (step.status === "running") {
    if (isStreaming) return "running";
    if (turnStatus === "failed") return "failed";
    if (turnStatus === "cancelled") return "stopped";
  }
  return "completed";
}

export default function AiChatActivityProgress({
  isStreaming,
  hasContent,
  status,
  steps,
  startedAt,
  finishedAt,
  defaultExpanded = false,
}: AiChatActivityProgressProps) {
  const t = useTranslations("AiChat");
  const panelId = useId();
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const isOpen = expanded ?? (isStreaming || defaultExpanded);

  useEffect(() => {
    if (!isStreaming || startedAt === undefined) return;
    const timer = window.setInterval(() => {
      setElapsedMs(Math.max(0, Date.now() - startedAt));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isStreaming, startedAt]);

  if (!isStreaming && steps.length === 0 && startedAt === undefined)
    return null;

  const resolveStepTitle = (step: AiChatRetrievalStep): string => {
    if (step.kind === "thinking") return t("activityStepThinking");
    if (step.kind === "session_context") return t("activityStepSessionContext");
    if (step.kind === "answer") return t("activityStepAnswer");
    const canonicalKey = CANONICAL_TOOL_LABEL_KEYS[step.label.trim()];
    return canonicalKey ? t(canonicalKey) : step.label;
  };

  const seconds = Math.floor(
    (finishedAt !== undefined && startedAt !== undefined
      ? Math.max(0, finishedAt - startedAt)
      : elapsedMs) / 1000,
  );
  const title =
    status === "failed"
      ? t("statusFailed")
      : status === "cancelled"
        ? t("statusCancelled")
        : isStreaming
          ? t("activityThinking")
          : startedAt !== undefined
            ? t("activityProcessed")
            : t("activityHistory");

  const activeRunningStep = isStreaming
    ? [...steps].reverse().find((step) => step.status === "running")
    : undefined;

  const stage = hasContent
    ? t("activityWriting")
    : activeRunningStep?.kind === "tool"
      ? t("activityRunningTool", { tool: resolveStepTitle(activeRunningStep) })
      : activeRunningStep?.kind === "answer"
        ? t("activitySynthesizing")
        : activeRunningStep?.kind === "thinking"
          ? t("activityPlanning")
          : steps.some((step) => step.kind === "answer")
            ? t("activitySynthesizing")
            : steps.some((step) => step.kind === "tool")
              ? t("activityToolResults")
              : steps.some((step) => step.kind === "session_context")
                ? t("activityContext")
                : t("activityPreparing");

  return (
    <section
      className="min-w-0 rounded-xl border border-gray-200/70 bg-gray-50/80 dark:border-white/10 dark:bg-gpt-sidebar"
      aria-label={t("activityAriaLabel")}
      aria-busy={isStreaming}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={panelId}
        onClick={() => setExpanded(!isOpen)}
        className="flex min-h-10 w-full items-center gap-2 rounded-xl px-3 py-2 text-start text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-200 dark:hover:bg-white/5"
      >
        {isStreaming ? (
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full bg-brand-500 motion-safe:animate-pulse dark:bg-brand-400"
          />
        ) : status === "failed" ? (
          <AlertIcon
            aria-hidden="true"
            className="size-3.5 shrink-0 text-error-600 dark:text-error-400"
          />
        ) : status === "cancelled" ? (
          <StopSquareIcon
            aria-hidden="true"
            className="size-3.5 shrink-0 text-gray-500 dark:text-gray-400"
          />
        ) : (
          <CheckLineIcon
            aria-hidden="true"
            className="size-3.5 shrink-0 text-success-600 dark:text-success-400"
          />
        )}
        <span>{title}</span>
        {startedAt !== undefined && (
          <span className="text-gray-600 tabular-nums dark:text-gray-300">
            {t("activityElapsed", { seconds })}
          </span>
        )}
        <ChevronDownIcon
          aria-hidden="true"
          className={cn(
            "ms-auto size-3.5 shrink-0 text-gray-500 transition-transform motion-reduce:transition-none dark:text-gray-400",
            isOpen && "rotate-180",
          )}
        />
      </button>
      <div
        id={panelId}
        hidden={!isOpen}
        className="min-w-0 space-y-3 px-4 pt-1 pb-3 text-sm leading-6 text-gray-700 dark:text-gray-300"
      >
        {steps.length > 0 && (
          <ol className="space-y-2.5 border-s border-gray-200 ps-3.5 dark:border-white/10">
            {steps.map((step, index) => {
              const stepStatus = resolveEffectiveStepStatus(
                step,
                isStreaming,
                status,
              );
              const stepTitle = resolveStepTitle(step);
              const showDuration =
                stepStatus !== "running" || step.durationMs > 0;

              return (
                <li
                  key={step.id ?? `${index}-${step.kind}`}
                  data-step-status={stepStatus}
                  className="min-w-0"
                >
                  <div className="flex items-start gap-2">
                    {stepStatus === "running" ? (
                      <span
                        aria-hidden="true"
                        className="mt-1.5 inline-block size-2 shrink-0 rounded-full bg-brand-500 ring-4 ring-brand-500/15 motion-safe:animate-pulse dark:bg-brand-400 dark:ring-brand-400/20"
                      />
                    ) : stepStatus === "failed" ? (
                      <AlertIcon
                        aria-hidden="true"
                        className="mt-0.5 size-3.5 shrink-0 text-error-600 dark:text-error-400"
                      />
                    ) : stepStatus === "stopped" ? (
                      <StopSquareIcon
                        aria-hidden="true"
                        className="mt-0.5 size-3.5 shrink-0 text-gray-500 dark:text-gray-400"
                      />
                    ) : (
                      <CheckLineIcon
                        aria-hidden="true"
                        className="mt-1 size-3.5 shrink-0 text-success-600 dark:text-success-400"
                      />
                    )}
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p
                        className={cn(
                          "[overflow-wrap:anywhere] break-words text-sm leading-5 font-medium",
                          stepStatus === "running"
                            ? "text-gray-900 dark:text-white"
                            : stepStatus === "failed"
                              ? "text-error-700 dark:text-error-300"
                              : "text-gray-800 dark:text-gray-200",
                        )}
                      >
                        {stepTitle}
                      </p>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs leading-4 text-gray-600 tabular-nums dark:text-gray-400">
                        <span
                          className={cn(
                            stepStatus === "running" &&
                              "font-medium text-brand-600 dark:text-brand-300",
                            stepStatus === "failed" &&
                              "font-medium text-error-600 dark:text-error-400",
                          )}
                        >
                          {stepStatus === "running"
                            ? t("activityStepRunning")
                            : stepStatus === "failed"
                              ? t("activityStepFailed")
                              : stepStatus === "stopped"
                                ? t("statusCancelled")
                                : t("activityStepCompleted")}
                        </span>
                        {showDuration && (
                          <span>
                            {t("retrievalStepDuration", {
                              ms: step.durationMs,
                            })}
                          </span>
                        )}
                        {step.count !== undefined && (
                          <span>
                            {t("retrievalStepCount", { count: step.count })}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
        {isStreaming && (
          <p
            className={cn(
              "min-h-6 break-words text-xs font-medium text-gray-600 dark:text-gray-300",
              steps.length > 0 &&
                "border-t border-gray-200/60 pt-2 dark:border-white/8",
            )}
          >
            <ActivityText key={stage} text={stage} />
          </p>
        )}
        {!isStreaming && steps.length === 0 && (
          <p>
            {t(
              status === "failed"
                ? "activityFailed"
                : status === "cancelled"
                  ? "activityStopped"
                  : "activityNoSteps",
            )}
          </p>
        )}
      </div>
    </section>
  );
}
