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
  const stage = hasContent
    ? t("activityWriting")
    : steps.some((step) => step.kind === "tool")
      ? t("activityToolResults")
      : steps.some((step) => step.kind === "session_context")
        ? t("activityContext")
        : t("activityPreparing");

  return (
    <section
      className="min-w-0 rounded-xl bg-gray-50/80 dark:bg-gpt-sidebar"
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
            className="size-1.5 shrink-0 rounded-full bg-brand-500 motion-safe:animate-pulse"
          />
        ) : status === "failed" ? (
          <AlertIcon
            aria-hidden="true"
            className="size-3.5 shrink-0 text-error-600 dark:text-error-400"
          />
        ) : status === "cancelled" ? (
          <StopSquareIcon aria-hidden="true" className="size-3.5 shrink-0" />
        ) : (
          <CheckLineIcon aria-hidden="true" className="size-3.5 shrink-0" />
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
            "size-3.5 shrink-0 transition-transform motion-reduce:transition-none",
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
          <ol className="space-y-2 border-s border-gray-200 ps-3 dark:border-gray-700">
            {steps.map((step, index) => (
              <li key={`${index}-${step.kind}`} className="min-w-0 space-y-0.5">
                <p className="[overflow-wrap:anywhere] break-words">
                  {step.kind === "thinking"
                    ? t("activityPreparing")
                    : step.label}
                </p>
                <p className="flex flex-wrap gap-x-2 text-xs text-gray-600 tabular-nums dark:text-gray-400">
                  <span>{t("activityStepCompleted")}</span>
                  <span>
                    {t("retrievalStepDuration", { ms: step.durationMs })}
                  </span>
                  {step.count !== undefined && (
                    <span>
                      {t("retrievalStepCount", { count: step.count })}
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ol>
        )}
        {isStreaming && (
          <p className="min-h-6 break-words">
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
