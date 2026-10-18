"use client";

import { useTranslations } from "next-intl";
import { InfoIcon, LockIcon } from "@/icons/index";
import { cn } from "@/utils";

type CapabilityUnavailableProps = {
  title: string;
  description: string;
  dependency?: string;
  items?: readonly string[];
  partial?: boolean;
  className?: string;
};

export default function CapabilityUnavailable({
  title,
  description,
  dependency,
  items = [],
  partial = false,
  className,
}: CapabilityUnavailableProps) {
  const t = useTranslations("platformConsole.unavailable");

  return (
    <section
      className={cn(
        "rounded-2xl border border-gray-200/80 bg-white p-5 shadow-theme-xs transition-colors dark:border-gray-800 dark:bg-gray-900",
        className
      )}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400">
          {partial ? <InfoIcon className="size-4" /> : <LockIcon className="size-4" />}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                  partial
                    ? "bg-amber-50 text-amber-700 ring-amber-200/60 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20"
                    : "bg-gray-100 text-gray-600 ring-gray-200/70 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700/60"
                )}
              >
                {partial ? t("partialBadge") : t("badge")}
              </span>
            </div>

            <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
            <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {description}
            </p>
          </div>

          {items.length > 0 && (
            <div className="pt-1">
              <ul
                className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3"
                aria-label={t("itemsTitle")}
              >
                {items.map((item) => (
                  <li
                    key={item}
                    className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/50 px-2.5 py-1.5 dark:border-gray-800/80 dark:bg-gray-850/50"
                  >
                    <span className="truncate text-xs text-gray-700 dark:text-gray-300">
                      {item}
                    </span>
                    <span className="shrink-0 rounded-full bg-gray-200/70 px-1.5 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {t("itemStatus")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {dependency && (
            <div className="rounded-lg border border-gray-100 bg-gray-50/60 px-3.5 py-2.5 dark:border-gray-800 dark:bg-gray-800/40">
              <span className="block text-[10px] font-semibold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                {t("dependency")}
              </span>
              <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
                {dependency}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
