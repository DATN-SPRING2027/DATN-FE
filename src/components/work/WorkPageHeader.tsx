"use client";

import { useState, type ReactNode, type RefObject } from"react";
import { useTranslations } from"next-intl";
import { PlusIcon } from"@/icons";
import { Link } from"@/i18n/navigation";
import type { Project } from"@/lib/queries/projects/useProjects";
import { MonoIcon } from"./WorkMonoIcons";

export type WorkView =
  |"overview"
  |"list"
  |"board"
  |"calendar"
  |"timeline"
  |"development"
  |"forms"
  |"docs"
  |"reports"
  |"work-notes";

function renderTabIcon(view: WorkView): ReactNode {
  switch (view) {
    case"overview":
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
          <circle cx="12"cy="12"r="10"/>
          <line x1="2"y1="12"x2="22"y2="12"/>
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        </svg>
      );
    case"list":
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
          <line x1="8"y1="6"x2="21"y2="6"/>
          <line x1="8"y1="12"x2="21"y2="12"/>
          <line x1="8"y1="18"x2="21"y2="18"/>
          <rect x="3"y="4.5"width="3"height="3"fill="currentColor"/>
          <rect x="3"y="10.5"width="3"height="3"fill="currentColor"/>
          <rect x="3"y="16.5"width="3"height="3"fill="currentColor"/>
        </svg>
      );
    case"board":
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
          <rect x="3"y="3"width="7"height="18"rx="1"/>
          <rect x="14"y="3"width="7"height="12"rx="1"/>
        </svg>
      );
    case"calendar":
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
          <rect x="3"y="4"width="18"height="18"rx="2"/>
          <line x1="16"y1="2"x2="16"y2="6"/>
          <line x1="8"y1="2"x2="8"y2="6"/>
          <line x1="3"y1="10"x2="21"y2="10"/>
        </svg>
      );
    case"timeline":
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
          <line x1="4"y1="6"x2="16"y2="6"/>
          <line x1="8"y1="12"x2="20"y2="12"/>
          <line x1="6"y1="18"x2="18"y2="18"/>
        </svg>
      );
    case"development":
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
          <polyline points="16 18 22 12 16 6"/>
          <polyline points="8 6 2 12 8 18"/>
          <line x1="14"y1="4"x2="10"y2="20"/>
        </svg>
      );
    case"forms":
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
          <rect x="8"y="2"width="8"height="4"rx="1"/>
          <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
          <path d="M9 12h6"/>
          <path d="M9 16h6"/>
          <circle cx="7"cy="12"r="0.6"fill="currentColor"/>
          <circle cx="7"cy="16"r="0.6"fill="currentColor"/>
        </svg>
      );
    case"docs":
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
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
        </svg>
      );
    case"reports":
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
          <path d="M21.21 15.89A10 10 0 1 1 8 2.83"/>
          <path d="M22 12A10 10 0 0 0 12 2v10z"/>
        </svg>
      );
    case"work-notes":
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
          <path d="M12 20h9"/>
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
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
  itemCount,
  hideProjectBanner = false,
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
  itemCount?: number;
  hideProjectBanner?: boolean;
}) {
  const t = useTranslations("work");
  const [copiedLink, setCopiedLink] = useState(false);
  const [automationsOpen, setAutomationsOpen] = useState(false);
  const [customRuleTriggered, setCustomRuleTriggered] = useState(false);
  const [addViewOpen, setAddViewOpen] = useState(false);
  const [previewViewKey, setPreviewViewKey] = useState<WorkView>("list");

  const viewDescriptions: Record<
    WorkView,
    { headline: string; desc: string; category: string }
  > = {
    overview: {
      headline:"Get a high-level summary of your space",
      desc:"Monitor status overview, priority breakdown, recent activity, and team workload at a glance.",
      category:"Recommended",
    },
    list: {
      headline:"Track your work in a structured spreadsheet list",
      desc:"Sort, filter, group, and inline-edit work items and subtasks in a fast spreadsheet grid.",
      category:"Popular",
    },
    board: {
      headline:"Visualize workflow on an Agile Kanban board",
      desc:"Move work items across To Do, In Progress, In Review, and Done columns with WIP limits.",
      category:"Popular",
    },
    calendar: {
      headline:"Schedule work items and sprints on a calendar",
      desc:"Plan due dates, visualize sprint timelines, and drag unscheduled work onto target days.",
      category:"Planning",
    },
    timeline: {
      headline:"Plan Epics and dependencies on a Gantt timeline",
      desc:"Map Epics, child tasks, and sprint bars across weeks, months, or quarters.",
      category:"Planning",
    },
    development: {
      headline:"Connect repositories, pull requests, and CI/CD",
      desc:"Track DORA metrics, PR cycle time, security vulnerabilities, and coding agents.",
      category:"DevOps",
    },
    forms: {
      headline:"Collect structured requests with custom forms",
      desc:"Build drag-and-drop intake forms that automatically create prioritized work items.",
      category:"Intake",
    },
    docs: {
      headline:"Collaborate on SAG-indexed project pages",
      desc:"Author architecture specs, API contracts, and sprint retrospectives linked to tasks.",
      category:"Knowledge",
    },
    reports: {
      headline:"Analyze team velocity, burndown, and cycle time",
      desc:"Explore customizable charts, cumulative flow diagrams, and work distribution.",
      category:"Analytics",
    },
    "work-notes": {
      headline:"Capture personal & shared engineering notes",
      desc:"Draft action items, meeting notes, and AI-assisted checklists inside your workspace.",
      category:"Productivity",
    },
  };

  const tabs: readonly {
    key: WorkView;
    label: string;
  }[] = [
    { key:"overview", label: t("tabs.overview") },
    { key:"list", label: t("tabs.list") },
    { key:"board", label: t("tabs.board") },
    { key:"calendar", label: t("tabs.calendar") },
    { key:"timeline", label: t("tabs.timeline") },
    { key:"reports", label: t("tabs.reports") },
  ];

  function handleShareSpace() {
    if (typeof window !=="undefined") {
      void navigator.clipboard?.writeText(window.location.href);
    }
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  return (
    <header className={hideProjectBanner ? "min-w-0" : "min-w-0 space-y-3"}>
      {/* Hidden visually ONLY in /workspace (hideProjectBanner=true), kept visible in /projects/[projectId]/work */}
      <div className={hideProjectBanner ? "sr-only" : "space-y-3"}>
        <nav
          aria-label={t("breadcrumb")}
          className="flex items-center gap-2 text-xs"
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

        <div className="flex flex-col gap-3 border-b border-gray-200 pb-3 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
          <div className="flex min-w-0 flex-wrap items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded border border-gray-300 bg-gray-100 text-xs font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
              {projectCode.slice(0, 2).toUpperCase() || "PR"}
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                {t("projectSpace")}
              </p>
              <h1 className="truncate text-lg font-semibold text-gray-900 dark:text-white/90">
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
                  className="h-8 cursor-pointer rounded border border-gray-200 bg-white ps-2.5 pe-7 text-xs font-medium text-gray-700 outline-none focus-visible:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                  {projects.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.code})
                    </option>
                  ))}
                </select>
              </label>
            )}
            <span className="hidden shrink-0 rounded border border-gray-300 bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 md:inline-flex dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {t("previewData")}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={handleShareSpace}
              title="Share space"
              className="inline-flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <svg
                width="13"
                height="13"
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
            <button
              type="button"
              onClick={() => setAutomationsOpen(true)}
              title="Automations"
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <MonoIcon name="bolt" size={14} />
            </button>
            {onToggleFullscreen && (
              <button
                type="button"
                onClick={onToggleFullscreen}
                aria-pressed={isFullscreen}
                title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                <MonoIcon name="maximize" size={14} />
              </button>
            )}
            {showCreateButton && (
              <button
                ref={createButtonRef}
                type="button"
                onClick={onCreate}
                className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded bg-brand-600 px-3 text-xs font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
              >
                <PlusIcon
                  viewBox="0 0 12 12"
                  className="h-3.5 w-3.5"
                  aria-hidden="true"
                />
                {t("create")}
              </button>
            )}
          </div>
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
          <div className="w-full max-w-lg rounded-md border border-gray-200 bg-white p-6 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
              <h3 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white">
                <MonoIcon name="bolt" size={16} />
                <span>Jira Automation Rules</span>
              </h3>
              <button
                type="button"
                onClick={() => setAutomationsOpen(false)}
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
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
                  className="flex items-center justify-between gap-3 rounded border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-950/50"
                >
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white/90">
                      {rule.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                      {rule.desc}
                    </p>
                  </div>
                  <span className="shrink-0 rounded bg-gray-200 px-2.5 py-0.5 text-[11px] font-bold text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                    ACTIVE
                  </span>
                </div>
              ))}
            </div>
            {customRuleTriggered && (
              <p className="mt-3 flex items-center gap-1.5 rounded bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                <MonoIcon name="bolt" size={14} />
                <span>
                  Custom automation rule triggered and active for{" "}
                  {projectName || "this workspace"}!
                </span>
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAutomationsOpen(false)}
                className="h-8 cursor-pointer rounded border border-gray-200 bg-white px-3.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => setCustomRuleTriggered(true)}
                className="h-8 cursor-pointer rounded bg-brand-500 px-3.5 text-xs font-semibold text-white hover:bg-brand-600"
              >
                + Create custom rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top-level View Tab Bar (sits flush at the top of the workspace) */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto border-b border-gray-200 dark:border-gray-800">
        <div
          className="flex min-w-max items-center gap-0.5"
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
                className={`inline-flex h-9 cursor-pointer items-center gap-1.5 border-b-2 px-2.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-500 ${
                  active
                    ? "border-brand-500 font-semibold text-brand-600 dark:text-brand-400"
                    : "border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white/90"
                }`}
              >
                {renderTabIcon(key)}
                {label}
              </button>
            );
          })}

          {/* Jira Cloud `+` Add View Trigger */}
          <button
            type="button"
            aria-label="Add view"
            title="Add or explore views"
            aria-expanded={addViewOpen}
            onClick={() => setAddViewOpen((prev) => !prev)}
            className={`ms-1 inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded border text-sm font-semibold transition ${
              addViewOpen
                ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300"
                : "border-transparent text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
            }`}
          >
            <PlusIcon viewBox="0 0 12 12" className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>

        {itemCount !== undefined && (
          <div className="flex shrink-0 items-center gap-2 pe-1">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
              {t("workItemCount", { count: itemCount })}
            </span>
          </div>
        )}
      </div>

      {/* Jira Cloud 2-Column `+ Add view` Split Popover (`navigation-kit-add-tab.ui.popup--container`) */}
      {addViewOpen && (
        <div
          role="dialog"
          aria-label="Add view to navigation"
          className="mt-2 grid max-w-2xl grid-cols-1 overflow-hidden border border-gray-200 bg-white shadow-theme-lg sm:grid-cols-[14rem_minmax(0,1fr)] dark:border-gray-700 dark:bg-gray-900"
        >
          {/* Left Column: View Directory List */}
          <div className="border-b border-gray-100 bg-gray-50/60 p-2 sm:border-b-0 sm:border-e dark:border-gray-800 dark:bg-gray-950/50">
            <div className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
              Views ({tabs.length})
            </div>
            <div className="max-h-64 space-y-0.5 overflow-y-auto">
              {tabs.map((item) => {
                const selected = item.key === previewViewKey;
                return (
                  <button
                    key={`add-view-${item.key}`}
                    type="button"
                    onClick={() => setPreviewViewKey(item.key)}
                    className={`flex w-full cursor-pointer items-center justify-between gap-2 px-2.5 py-1.5 text-start text-xs font-medium transition ${
                      selected
                        ?"bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                        :"text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      {renderTabIcon(item.key)}
                      <span className="truncate">{item.label}</span>
                    </span>
                    <span className="bg-gray-200/70 px-1.5 py-0.5 text-[10px] text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                      {viewDescriptions[item.key].category}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right Column: View Preview Card + Action Button */}
          <div className="flex flex-col justify-between p-5">
            <div>
              <div className="mb-3 flex h-28 items-center justify-center border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-950">
                <div className="flex items-center gap-3 border border-gray-200 bg-white px-4 py-2.5 shadow-theme-xs dark:border-gray-700 dark:bg-gray-800">
                  <span className="flex h-8 w-8 items-center justify-center border border-gray-300 bg-gray-100 text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                    {renderTabIcon(previewViewKey)}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">
                      {tabs.find((tItem) => tItem.key === previewViewKey)?.label}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">
                      Jira Cloud 2026 Workspace View
                    </p>
                  </div>
                </div>
              </div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                {viewDescriptions[previewViewKey].headline}
              </h3>
              <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
                {viewDescriptions[previewViewKey].desc}
              </p>
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
              <button
                type="button"
                onClick={() => setAddViewOpen(false)}
                className="h-8 cursor-pointer border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  onViewChange(previewViewKey);
                  setAddViewOpen(false);
                }}
                className="h-8 cursor-pointer bg-brand-500 px-3.5 text-xs font-semibold text-white hover:bg-brand-600"
              >
                Open view
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
