"use client";

import { useState, type ReactNode, type RefObject } from "react";
import { useTranslations } from "next-intl";
import { PlusIcon } from "@/icons";
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

function renderTabIcon(view: WorkView): ReactNode {
  switch (view) {
    case "overview":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="2" y1="12" x2="22" y2="12" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      );
    case "list":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <line x1="8" y1="6" x2="21" y2="6" />
          <line x1="8" y1="12" x2="21" y2="12" />
          <line x1="8" y1="18" x2="21" y2="18" />
          <rect x="3" y="4.5" width="3" height="3" fill="currentColor" />
          <rect x="3" y="10.5" width="3" height="3" fill="currentColor" />
          <rect x="3" y="16.5" width="3" height="3" fill="currentColor" />
        </svg>
      );
    case "board":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="7" height="18" rx="1" />
          <rect x="14" y="3" width="7" height="12" rx="1" />
        </svg>
      );
    case "calendar":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case "timeline":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <line x1="4" y1="6" x2="16" y2="6" />
          <line x1="8" y1="12" x2="20" y2="12" />
          <line x1="6" y1="18" x2="18" y2="18" />
        </svg>
      );
    case "development":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
          <line x1="14" y1="4" x2="10" y2="20" />
        </svg>
      );
    case "forms":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <rect x="8" y="2" width="8" height="4" rx="1" />
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          <path d="M9 12h6" />
          <path d="M9 16h6" />
          <circle cx="7" cy="12" r="0.6" fill="currentColor" />
          <circle cx="7" cy="16" r="0.6" fill="currentColor" />
        </svg>
      );
    case "docs":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case "reports":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
          <path d="M22 12A10 10 0 0 0 12 2v10z" />
        </svg>
      );
    case "work-notes":
      return (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4 shrink-0"
          aria-hidden="true"
        >
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      );
  }
}

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
  const [automationsOpen, setAutomationsOpen] = useState(false);
  const [customRuleTriggered, setCustomRuleTriggered] = useState(false);

  const tabs: readonly {
    key: WorkView;
    label: string;
  }[] = [
    { key: "overview", label: t("tabs.overview") },
    { key: "list", label: t("tabs.list") },
    { key: "board", label: t("tabs.board") },
    { key: "calendar", label: t("tabs.calendar") },
    { key: "timeline", label: t("tabs.timeline") },
    { key: "development", label: t("tabs.development") },
    { key: "forms", label: t("tabs.forms") },
    { key: "docs", label: t("tabs.docs") },
    { key: "reports", label: t("tabs.reports") },
    { key: "work-notes", label: t("tabs.workNotes") },
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
            {projectCode.slice(0, 2).toUpperCase() || "PR"}
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

        <div className="flex flex-wrap items-center gap-1.5">
          {/* Share Space */}
          <button
            type="button"
            onClick={handleShareSpace}
            title="Share space"
            className="inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span className="hidden sm:inline">
              {copiedLink ? "✓ Link copied" : "Share space"}
            </span>
          </button>

          {/* Automations Lightning Button */}
          <button
            type="button"
            onClick={() => setAutomationsOpen(true)}
            title="Automations"
            className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
            </svg>
          </button>

          {/* Fullscreen Toggle */}
          {onToggleFullscreen && (
            <button
              type="button"
              onClick={onToggleFullscreen}
              aria-pressed={isFullscreen}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          )}

          {showCreateButton && (
            <button
              ref={createButtonRef}
              type="button"
              onClick={onCreate}
              className="inline-flex h-9 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand-500 px-3.5 text-sm font-medium text-white shadow-theme-xs transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
            >
              <PlusIcon
                viewBox="0 0 12 12"
                className="h-4 w-4"
                aria-hidden="true"
              />
              {t("create")}
            </button>
          )}
        </div>
      </div>

      {/* Jira Automation Rules Modal */}
      {automationsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Jira Automation Rules"
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-[1px]"
        >
          <div className="w-full max-w-lg rounded-2xl border border-gray-200 bg-white p-6 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
              <h3 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
                <span>⚡</span> Jira Automation Rules
              </h3>
              <button
                type="button"
                onClick={() => setAutomationsOpen(false)}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                ✕
              </button>
            </div>
            <p className="mt-2.5 text-xs text-gray-500 dark:text-gray-400">
              Automate repetitive workflow steps across your Continuum AI
              project workspace.
            </p>
            <div className="mt-4 space-y-2.5">
              {[
                {
                  title: "When Pull Request is merged → Move issue to DONE",
                  desc: "Triggered by GitHub / GitLab webhook integration.",
                },
                {
                  title: "When all subtasks are DONE → Transition parent issue",
                  desc: "Keeps Epics and Stories synchronized automatically.",
                },
                {
                  title: "Auto-assign new Bugs to QA / Triage Lead",
                  desc: "Routes incoming bug reports to Thu Hà.",
                },
              ].map((rule) => (
                <div
                  key={rule.title}
                  className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-950/50"
                >
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white/90">
                      {rule.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                      {rule.desc}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-success-50 px-2.5 py-0.5 text-[11px] font-bold text-success-700 dark:bg-success-500/15 dark:text-success-400">
                    ACTIVE
                  </span>
                </div>
              ))}
            </div>
            {customRuleTriggered && (
              <p className="mt-3 rounded-lg bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                ⚡ Custom automation rule triggered and active for{" "}
                {projectName || "this workspace"}!
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAutomationsOpen(false)}
                className="h-9 cursor-pointer rounded-lg border border-gray-200 bg-white px-3.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setCustomRuleTriggered(true)}
                className="h-9 cursor-pointer rounded-lg bg-brand-500 px-3.5 text-xs font-semibold text-white hover:bg-brand-600"
              >
                + Create custom rule
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="-mb-5 overflow-x-auto">
        <div
          className="flex min-w-max items-center gap-1"
          role="group"
          aria-label={t("viewsLabel")}
        >
          {tabs.map(({ key, label }) => {
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
                {renderTabIcon(key)}
                {label}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}
