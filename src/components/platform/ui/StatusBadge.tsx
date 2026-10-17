"use client";

import { cn } from "@/utils";

type StatusBadgeProps = {
  status: string;
  label?: string;
  className?: string;
  size?: "sm" | "md";
};

export default function StatusBadge({
  status,
  label,
  className,
  size = "sm",
}: StatusBadgeProps) {
  const normalized = status.toUpperCase();
  const displayLabel = label ?? status;

  let colorClasses = "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  let dotColor = "bg-gray-400";

  if (["ACTIVE", "HEALTHY", "CONNECTED", "OK", "SUCCESS"].includes(normalized)) {
    colorClasses = "bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20";
    dotColor = "bg-emerald-500";
  } else if (["SUSPENDED", "PENDING", "PENDING_INVITE", "DEGRADED", "WARNING"].includes(normalized)) {
    colorClasses = "bg-amber-50 text-amber-700 border border-amber-200/60 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20";
    dotColor = "bg-amber-500";
  } else if (["ERROR", "FAILED", "REMOVED", "DISCONNECTED", "CRITICAL"].includes(normalized)) {
    colorClasses = "bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20";
    dotColor = "bg-rose-500";
  } else if (["UNAVAILABLE", "DISABLED"].includes(normalized)) {
    colorClasses = "bg-gray-100 text-gray-600 border border-gray-200/70 dark:bg-gray-800/80 dark:text-gray-400 dark:border-gray-700/60";
    dotColor = "bg-gray-400";
  }

  const sizeClasses = size === "sm" ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-xs";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium transition-colors",
        sizeClasses,
        colorClasses,
        className
      )}
    >
      <span className={cn("size-1.5 rounded-full shrink-0", dotColor)} aria-hidden="true" />
      <span>{displayLabel}</span>
    </span>
  );
}
