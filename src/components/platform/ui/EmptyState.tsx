"use client";

import { ReactNode } from "react";
import { InfoIcon } from "@/icons/index";
import { cn } from "@/utils";

type EmptyStateProps = {
  title: string;
  body?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
};

export default function EmptyState({
  title,
  body,
  icon,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-6 py-12 text-center",
        className
      )}
    >
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-500 ring-1 ring-gray-200/50 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700/50">
        {icon || <InfoIcon className="size-6" />}
      </div>
      <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-100">{title}</h3>
      {body && (
        <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-gray-500 dark:text-gray-400">
          {body}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
