"use client";

import { useTranslations } from "next-intl";

type PlatformUnavailablePageProps = Readonly<{
  title: string;
  description: string;
  dependency: string;
  items: readonly string[];
  partial?: boolean;
}>;

export default function PlatformUnavailablePage({
  title,
  description,
  dependency,
  items,
  partial = false,
}: PlatformUnavailablePageProps) {
  const t = useTranslations("platformConsole.unavailable");
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start gap-4">
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-warning-50 text-lg font-semibold text-warning-800 dark:bg-warning-500/10 dark:text-warning-300">—</span>
        <div className="min-w-0">
          <span className="inline-flex rounded-full border border-warning-200 bg-warning-50 px-2.5 py-1 text-xs font-medium text-warning-800 dark:border-warning-500/20 dark:bg-warning-500/10 dark:text-warning-300">{partial ? t("partialBadge") : t("badge")}</span>
          <h3 className="mt-3 text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-300">{description}</p>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2" aria-label={t("itemsTitle")}>
            {items.map((item) => <li key={item} className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2.5 dark:border-gray-800"><span className="text-sm leading-5 text-gray-700 dark:text-gray-300">{item}</span><span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">{t("itemStatus")}</span></li>)}
          </ul>
          <div className="mt-4 rounded-lg bg-gray-50 px-4 py-3 dark:bg-gray-800/60">
            <p className="text-xs font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">{t("dependency")}</p>
            <p className="mt-1 text-sm leading-6 text-gray-600 dark:text-gray-300">{dependency}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
