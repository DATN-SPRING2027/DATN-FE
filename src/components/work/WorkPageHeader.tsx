"use client";

import { useState, type RefObject } from "react";
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
import type { Project } from "@/lib/queries/projects/useProjects";

export type WorkView =
  | "overview"
  | "list"
  | "board"
  | "calendar"
  | "timeline"
  | "development"
  | "forms"
  | "docs"
  | "reports"
  | "work-notes";

export default function WorkPageHeader({
  projectId,
  projectName,
  projectCode,
  projects,
  onProjectChange,
  view,
  onViewChange,
  onCreate,
  createButtonRef,
  showCreateButton = true,
  isFullscreen = false,
  onToggleFullscreen,
}: {
  projectId: string;
  projectName: string;
  projectCode: string;
  projects?: readonly Project[];
  onProjectChange?: (projectId: string) => void;
  view: WorkView;
  onViewChange: (view: WorkView) => void;
  onCreate: () => void;
  createButtonRef: RefObject<HTMLButtonElement | null>;
  showCreateButton?: boolean;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}) {
  const t = useTranslations("work");
  const [copiedLink, setCopiedLink] = useState(false);

  const tabs: readonly {
    key: WorkView;
    label: string;
    icon: typeof GridIcon;
  }[] = [
    { key: "overview", label: t("tabs.overview"), icon: GridIcon },
    { key: "list", label: t("tabs.list"), icon: ListIcon },
    { key: "board", label: t("tabs.board"), icon: TableIcon },
    { key: "calendar", label: t("tabs.calendar"), icon: CalenderIcon },
    { key: "timeline", label: t("tabs.timeline"), icon: CalenderIcon },
    { key: "development", label: t("tabs.development"), icon: GridIcon },
    { key: "forms", label: t("tabs.forms"), icon: DocsIcon },
    { key: "docs", label: t("tabs.docs"), icon: DocsIcon },
    { key: "reports", label: t("tabs.reports"), icon: PieChartIcon },
    { key: "work-notes", label: t("tabs.workNotes"), icon: DocsIcon },
  ];

  function handleShareSpace() {
    if (typeof window !== "undefined") {
      void navigator.clipboard?.writeText(window.location.href);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  return (
    <header className="min-w-0 space-y-5">
      <nav
        aria-label={t("breadcrumb")}
        className="flex items-center gap-2 text-sm"
      >
        <Link
          href="/projects"
          className="text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
        >
          {t("projects")}
        </Link>
        <span aria-hidden="true" className="text-gray-300 dark:text-gray-600">
          /
        </span>
        <Link
          href={`/projects/${encodeURIComponent(projectId)}`}
          className="text-gray-500 hover:text-brand-600 dark:text-gray-400 dark:hover:text-brand-400"
        >
          {projectName}
        </Link>
        <span aria-hidden="true" className="text-gray-300 dark:text-gray-600">
          /
        </span>
        <span
          aria-current="page"
          className="font-medium text-gray-900 dark:text-white/90"
        >
          {t("title")}
        </span>
      </nav>

      <div className="flex flex-col gap-4 border-b border-gray-200 pb-4 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3">
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
          {projects && projects.length > 0 && onProjectChange && (
            <label className="relative min-w-0">
              <span className="sr-only">{t("selectProject")}</span>
              <select
                aria-label={t("selectProject")}
                value={projectId}
                onChange={(event) => onProjectChange(event.target.value)}
                className="h-9 cursor-pointer rounded-xl border border-gray-200 bg-white ps-3 pe-8 text-xs font-medium text-gray-700 shadow-theme-xs outline-none focus-visible:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                {projects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.code})
                  </option>
                ))}
              </select>
            </label>
          )}
          <span className="hidden shrink-0 rounded-full border border-warning-200 bg-warning-50 px-2.5 py-1 text-xs font-medium text-warning-700 md:inline-flex dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-400">
            {t("previewData")}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleShareSpace}
            title="Share project space link"
            className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            {copiedLink ? "✓ Link copied" : "Share space"}
          </button>

          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              aria-pressed={isFullscreen}
              title="Toggle fullscreen workspace"
              className="inline-flex h-10 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            </button>
          )}

          {showCreateButton && (
            <button
              ref={createButtonRef}
              type="button"
              onClick={onCreate}
              className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-500 px-4 text-sm font-medium text-white shadow-theme-xs transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <PlusIcon className="h-4 w-4" aria-hidden="true" />
              {t("create")}
            </button>
          )}
        </div>
      </div>

      <div className="-mb-5 overflow-x-auto">
        <div
          className="flex min-w-max items-center gap-1"
          role="group"
          aria-label={t("viewsLabel")}
        >
          {tabs.map(({ key, label, icon: Icon }) => {
            const active = key === view;
            return (
              <button
                key={key}
                type="button"
                aria-pressed={active}
                onClick={() => onViewChange(key)}
                className={`inline-flex h-10 cursor-pointer items-center gap-2 border-b-2 px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500 ${
                  active
                    ? "border-brand-500 font-medium text-brand-600 dark:text-brand-400"
                    : "border-transparent text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white/90"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
