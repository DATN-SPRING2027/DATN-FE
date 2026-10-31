"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";
import { CheckCircleIcon, CloseLineIcon } from "@/icons";

export type CreatedTaskToastData = Readonly<{
  id: string;
  key: string;
}>;

const AUTO_DISMISS_MS = 7000;

export function WorkCreatedTaskToast({
  toast,
  onViewTask,
  onDismiss,
}: {
  toast: CreatedTaskToastData | null;
  onViewTask: (taskId: string) => void;
  onDismiss: () => void;
}) {
  const t = useTranslations("work");
  const prefersReducedMotion = useReducedMotion();
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (!toast || isPaused) return;
    const timer = window.setTimeout(() => {
      onDismiss();
    }, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [isPaused, onDismiss, toast]);

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <AnimatePresence>
      {toast && (
        <motion.div
          key={toast.id}
          role="status"
          aria-live="polite"
          data-testid="created-task-toast"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocus={() => setIsPaused(true)}
          onBlur={() => setIsPaused(false)}
          initial={
            prefersReducedMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 16, scale: 0.97 }
          }
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={
            prefersReducedMotion
              ? { opacity: 0 }
              : { opacity: 0, y: 10, scale: 0.98 }
          }
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-4 bottom-5 z-[95] rounded-lg border border-gray-200 border-s-4 border-s-success-500 bg-white p-3.5 shadow-theme-xl sm:inset-x-auto sm:bottom-6 sm:start-6 sm:w-80 lg:start-[16.5rem] dark:border-gray-700 dark:border-s-success-500 dark:bg-gray-900"
        >
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400"
            >
              <CheckCircleIcon
                viewBox="0 0 20 20"
                className="h-4 w-4"
                aria-hidden="true"
              />
            </span>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-900 tabular-nums dark:text-white/95">
                {t("createdToast.title", { key: toast.key })}
              </p>
              <button
                type="button"
                data-testid="created-task-toast-view"
                onClick={() => onViewTask(toast.id)}
                className="mt-1.5 inline-flex cursor-pointer items-center gap-1 rounded text-xs font-semibold text-brand-600 tabular-nums transition hover:text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:text-brand-300"
              >
                {t("createdToast.viewAction", { key: toast.key })}
              </button>
            </div>

            <button
              type="button"
              onClick={onDismiss}
              aria-label={t("createdToast.dismiss")}
              className="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <CloseLineIcon
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
