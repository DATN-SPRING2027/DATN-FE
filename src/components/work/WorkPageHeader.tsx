"use client";

import { useTranslations } from "next-intl";
import {
  CalenderIcon,
  DocsIcon,
  GridIcon,
  ListIcon,
  PieChartIcon,
  PlusIcon,
  TableIcon,
} from "@/icons";
import { Link } from "@/i18n/navigation";
import type { RefObject } from "react";

export type WorkView = "overview" | "list" | "board" | "calendar";

export default function WorkPageHeader({
  projectId,
  projectName,
  projectCode,
  view,
  onViewChange,
  onCreate,
  createButtonRef,
}: {
  projectId: string;
  projectName: string;
  projectCode: string;
  view: WorkView;
  onViewChange: (view: WorkView) => void;
  onCreate: () => void;
  createButtonRef: RefObject<HTMLButtonElement | null>;
}) {
  const t = useTranslations("work");

  const tabs = [
    { key: "overview", label: t("tabs.overview"), icon: GridIcon, disabled: false },
    { key: "list", label: t("tabs.list"), icon: ListIcon, disabled: false },
    { key: "board", label: t("tabs.board"), icon: TableIcon, disabled: false },
    { key: "calendar", label: t("tabs.calendar"), icon: CalenderIcon, disabled: false },
    { key: "timeline", label: t("tabs.timeline"), icon: CalenderIcon, disabled: true },
    { key: "docs", label: t("tabs.docs"), icon: DocsIcon, disabled: true },
    { key: "reports", label: t("tabs.reports"), icon: PieChartIcon, disabled: true },
  ] as const;

  return (
    <header className="min-w-0 space-y-5">
      <nav aria-label={t("breadcrumb")} className="flex items-center gap-2 text-sm">
        <Link href="/projects" className="text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400">
          {t("projects")}
        </Link>
        <span aria-hidden="true" className="text-gray-300 dark:text-gray-600">/</span>
        <Link href={`/projects/${encodeURIComponent(projectId)}`} className="text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400">
          {projectName}
        </Link>
        <span aria-hidden="true" className="text-gray-300 dark:text-gray-600">/</span>
        <span aria-current="page" className="font-medium text-gray-900 dark:text-white/90">
          {t("title")}
        </span>
      </nav>

      <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning-100 text-sm font-semibold text-warning-700 dark:bg-warning-500/15 dark:text-warning-400">
            {projectCode.slice(0, 2).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("projectSpace")}
            </p>
            <h1 className="truncate text-xl font-semibold text-gray-900 dark:text-white/90">
              {projectName}
            </h1>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">
              {projectCode}
            </p>
          </div>
          <span className="hidden shrink-0 rounded-full border border-warning-200 bg-warning-50 px-2.5 py-1 text-xs font-medium text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400 md:inline-flex">
            {t("previewData")}
          </span>
        </div>

        <button
          ref={createButtonRef}
          type="button"
          onClick={onCreate}
          className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white shadow-theme-xs transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          <PlusIcon className="h-4 w-4" aria-hidden="true" />
          {t("create")}
        </button>
      </div>

      <div className="-mb-5 overflow-x-auto">
        <div className="flex min-w-max items-center gap-1" role="group" aria-label={t("viewsLabel")}>
          {tabs.map(({ key, label, icon: Icon, disabled }) => {
            const active = key === view;
            return (
              <button
                key={key}
                type="button"
                disabled={disabled}
                aria-pressed={active}
                title={disabled ? t("comingSoon") : undefined}
                onClick={() => {
                  if (key === "overview" || key === "list" || key === "board" || key === "calendar") {
                    onViewChange(key);
                  }
                }}
                className={`inline-flex h-10 cursor-pointer items-center gap-2 border-b-2 px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50 ${active ? "border-brand-500 text-brand-600 dark:text-brand-400" : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90"}`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
                {disabled && <span className="sr-only">{t("comingSoon")}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
