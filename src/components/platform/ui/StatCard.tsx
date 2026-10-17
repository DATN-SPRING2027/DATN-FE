"use client";

import { Link } from "@/i18n/navigation";
import { ReactNode } from "react";
import Button from "@/components/ui/button/Button";
import { cn } from "@/utils";

type StatCardProps = {
  label: string;
  value: ReactNode;
  detail?: string;
  icon?: ReactNode;
  href?: string;
  actionText?: string;
  onRetry?: () => void;
  retryText?: string;
  statusBadge?: ReactNode;
  className?: string;
};

export default function StatCard({
  label,
  value,
  detail,
  icon,
  href,
  actionText = "Open",
  onRetry,
  retryText = "Try again",
  statusBadge,
  className,
}: StatCardProps) {
  return (
    <article
      className={cn(
        "group relative flex flex-col justify-between rounded-2xl border border-gray-200/80 bg-white p-5 shadow-theme-xs transition-all hover:border-gray-300 hover:shadow-theme-sm dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700",
        className
      )}
    >
      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {icon && (
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-700 ring-1 ring-gray-200/60 dark:bg-gray-800/80 dark:text-gray-300 dark:ring-gray-700/60">
                {icon}
              </span>
            )}
            <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          </div>
          {statusBadge}
        </div>

        <div className="mt-4 flex items-baseline justify-between gap-2">
          <div className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">
            {value}
          </div>
        </div>

        {detail && (
          <p className="mt-1.5 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
            {detail}
          </p>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-3 dark:border-gray-800/80">
        {href ? (
          <Link
            href={href}
            className="inline-flex items-center text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:text-brand-300"
          >
            {actionText} →
          </Link>
        ) : (
          <span />
        )}

        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry} className="h-7 px-2.5 text-xs">
            {retryText}
          </Button>
        )}
      </div>
    </article>
  );
}
