"use client";

import { cn } from "@/utils";

export function MetricCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col justify-between rounded-2xl border border-gray-200/80 bg-white p-5 shadow-theme-xs motion-safe:animate-pulse dark:border-gray-800 dark:bg-gray-900",
        className
      )}
    >
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-gray-200 dark:bg-gray-800" />
            <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-800" />
          </div>
        </div>
        <div className="mt-4 h-8 w-20 rounded bg-gray-200 dark:bg-gray-800" />
        <div className="mt-2 h-3 w-40 rounded bg-gray-100 dark:bg-gray-800/60" />
      </div>
      <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800/80">
        <div className="h-3 w-16 rounded bg-gray-200 dark:bg-gray-800" />
      </div>
    </div>
  );
}

export function TableSkeleton({
  rows = 4,
  columns = 4,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden divide-y divide-gray-100 dark:divide-gray-800 motion-safe:animate-pulse", className)}>
      <div className="flex bg-gray-50/75 px-5 py-3 dark:bg-gray-800/40">
        {Array.from({ length: columns }).map((_, i) => (
          <div
            key={i}
            className="flex-1 pr-4"
          >
            <div className="h-3 w-20 rounded bg-gray-200 dark:bg-gray-700" />
          </div>
        ))}
      </div>
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex items-center px-5 py-4">
          {Array.from({ length: columns }).map((_, colIdx) => (
            <div key={colIdx} className="flex-1 pr-4">
              <div
                className={cn(
                  "h-3.5 rounded bg-gray-200 dark:bg-gray-800",
                  colIdx === 0 ? "w-3/4" : colIdx === columns - 1 ? "w-1/2 ms-auto" : "w-2/3"
                )}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function DetailSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-4 p-5 motion-safe:animate-pulse", className)}>
      <div className="h-5 w-48 rounded bg-gray-200 dark:bg-gray-800" />
      <div className="h-3.5 w-72 rounded bg-gray-100 dark:bg-gray-800/60" />
      <div className="grid grid-cols-2 gap-4 pt-4">
        <div className="h-10 rounded-lg bg-gray-100 dark:bg-gray-800" />
        <div className="h-10 rounded-lg bg-gray-100 dark:bg-gray-800" />
      </div>
    </div>
  );
}
