"use client";

import type { ReactNode } from "react";
import Button from "@/components/ui/button/Button";

type RetryAction = {
  label: string;
  onRetry: () => void;
};

export type TeamContentStateProps =
  | { state: "loading"; message: ReactNode }
  | { state: "empty"; title: ReactNode; message: ReactNode }
  | { state: "denied"; title: ReactNode; message: ReactNode }
  | {
      state: "error";
      title: ReactNode;
      message: ReactNode;
      retry?: RetryAction;
    }
  | { state: "content"; children: ReactNode };

const panelClassName =
  "rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-gray-900";

/**
 * Presentation-only states for future Team screens. This component does not
 * define Team fields, API behavior, lifecycle actions, authorization, or when
 * retrying a request is safe; the caller supplies approved copy and actions.
 */
export default function TeamContentState(props: TeamContentStateProps) {
  switch (props.state) {
    case "loading":
      return (
        <div
          role="status"
          aria-live="polite"
          className={`${panelClassName} flex items-center gap-3 text-sm text-gray-600 dark:text-gray-300`}
        >
          <span
            aria-hidden="true"
            className="size-4 animate-spin rounded-full border-2 border-gray-300 border-t-brand-500 dark:border-gray-700 dark:border-t-brand-400"
          />
          {props.message}
        </div>
      );
    case "empty":
      return (
        <section
          role="status"
          className={`${panelClassName} text-gray-600 dark:text-gray-300`}
        >
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90">
            {props.title}
          </h2>
          <p className="mt-1 text-sm">{props.message}</p>
        </section>
      );
    case "denied":
      return (
        <section
          role="alert"
          className="rounded-xl border border-error-500 bg-error-50 p-5 dark:border-error-500/30 dark:bg-error-500/15"
        >
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90">
            {props.title}
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {props.message}
          </p>
        </section>
      );
    case "error":
      return (
        <section
          role="alert"
          className="rounded-xl border border-error-500 bg-error-50 p-5 dark:border-error-500/30 dark:bg-error-500/15"
        >
          <h2 className="text-sm font-semibold text-gray-800 dark:text-white/90">
            {props.title}
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
            {props.message}
          </p>
          {props.retry && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={props.retry.onRetry}
              className="mt-4"
            >
              {props.retry.label}
            </Button>
          )}
        </section>
      );
    case "content":
      return props.children;
  }
}
