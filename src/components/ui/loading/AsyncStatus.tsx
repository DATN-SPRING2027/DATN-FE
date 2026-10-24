import type { ReactNode } from "react";

export function UpdatingStatus({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      aria-busy="true"
      className={`inline-flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300 ${className}`}
    >
      <span
        aria-hidden="true"
        className="inline-flex size-3 shrink-0 rounded-full border-2 border-current border-t-transparent motion-safe:animate-spin"
      />
      {children}
    </span>
  );
}

export function BackgroundRefreshError({
  children,
  retryLabel,
  onRetry,
  className = "",
}: {
  children: ReactNode;
  retryLabel: string;
  onRetry: () => void;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={`flex flex-wrap items-center gap-2 rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300 ${className}`}
    >
      <span className="min-w-0 flex-1">{children}</span>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warning-600"
      >
        {retryLabel}
      </button>
    </div>
  );
}
