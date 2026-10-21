"use client";

import { useTranslations } from "next-intl";
import { FilterIcon, GridIcon, SearchIcon } from "@/icons";
import { PREVIEW_PEOPLE } from "./work-preview-data";
import type {
  WorkGroupBy,
  WorkPriority,
  WorkStatus,
} from "./work-types";

export default function WorkToolbar({
  query,
  status,
  priority,
  assigneeId,
  groupBy,
  onQueryChange,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onGroupByChange,
  onClearFilters,
  onOpenAiCopilot,
  onExportCsv,
}: {
  query: string;
  status: WorkStatus | "ALL";
  priority: WorkPriority | "ALL";
  assigneeId: string | "ALL";
  groupBy: WorkGroupBy;
  onQueryChange: (query: string) => void;
  onStatusChange: (status: WorkStatus | "ALL") => void;
  onPriorityChange: (priority: WorkPriority | "ALL") => void;
  onAssigneeChange: (assigneeId: string | "ALL") => void;
  onGroupByChange: (groupBy: WorkGroupBy) => void;
  onClearFilters: () => void;
  onOpenAiCopilot?: () => void;
  onExportCsv?: () => void;
}) {
  const t = useTranslations("work");
  const activeFilterCount =
    Number(status !== "ALL") +
    Number(priority !== "ALL") +
    Number(assigneeId !== "ALL");
  const hasActiveCriteria = activeFilterCount > 0 || query.trim().length > 0;

  return (
    <section
      aria-label={t("toolbarLabel")}
      className="flex min-w-0 flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 sm:p-4"
    >
      <div className="flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center">
        {onOpenAiCopilot && (
          <button
            type="button"
            onClick={onOpenAiCopilot}
            className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3.5 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
          >
            <span aria-hidden="true">✨</span>
            <span>Ask AI</span>
          </button>
        )}

        <label className="relative min-w-0 flex-1 xl:max-w-80">
          <span className="sr-only">{t("searchLabel")}</span>
          <SearchIcon
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-10 w-full rounded-lg border border-gray-200 bg-white ps-9 pe-3 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder:text-gray-500"
          />
        </label>

        <div
          className="flex items-center gap-1.5"
          role="group"
          aria-label={t("quickAssigneeFilter")}
        >
          {PREVIEW_PEOPLE.map((person) => {
            const active = assigneeId === person.id;
            return (
              <button
                key={person.id}
                type="button"
                aria-label={t("filterAssignee", { name: person.name })}
                aria-pressed={active}
                title={person.name}
                onClick={() =>
                  onAssigneeChange(active ? "ALL" : person.id)
                }
                className={`flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 text-[10px] font-semibold text-white transition hover:z-1 hover:scale-105 focus-visible:z-1 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${active ? "border-gray-900 ring-2 ring-brand-500 dark:border-white" : "border-white dark:border-gray-900"} ${person.id === "minh-anh" ? "bg-brand-600" : person.id === "thu-ha" ? "bg-cyan-600" : person.id === "quang-huy" ? "bg-purple-600" : person.id === "hoang-nam" ? "bg-teal-600" : "bg-blue-700"}`}
              >
                {person.initials}
              </button>
            );
          })}
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-2 xl:ms-auto">
          <details className="group relative">
            <summary className="inline-flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800">
              <FilterIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
              {t("filter")}
              {activeFilterCount > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-50 px-1 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  {activeFilterCount}
                </span>
              )}
            </summary>
            <div className="absolute start-0 top-full z-20 mt-2 grid w-64 gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900">
              <label className="grid gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                {t("priority")}
                <select
                  value={priority}
                  onChange={(event) =>
                    onPriorityChange(event.target.value as WorkPriority | "ALL")
                  }
                  className="h-9 cursor-pointer rounded-lg border border-gray-200 bg-white px-2.5 text-sm font-normal text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                >
                  <option value="ALL">{t("allPriorities")}</option>
                  <option value="HIGH">{t("priorities.HIGH")}</option>
                  <option value="MEDIUM">{t("priorities.MEDIUM")}</option>
                  <option value="LOW">{t("priorities.LOW")}</option>
                </select>
              </label>
              <label className="grid gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                {t("assignee")}
                <select
                  value={assigneeId}
                  onChange={(event) => onAssigneeChange(event.target.value)}
                  className="h-9 cursor-pointer rounded-lg border border-gray-200 bg-white px-2.5 text-sm font-normal text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                >
                  <option value="ALL">{t("allAssignees")}</option>
                  {PREVIEW_PEOPLE.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </details>

          <label className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            <GridIcon className="h-4 w-4 text-gray-500 dark:text-gray-400" aria-hidden="true" />
            <span>{t("group")}</span>
            <span className="sr-only">{t("groupByLabel")}</span>
            <select
              value={groupBy}
              onChange={(event) =>
                onGroupByChange(event.target.value as WorkGroupBy)
              }
              aria-label={t("groupByLabel")}
              className="max-w-32 cursor-pointer bg-transparent text-sm text-gray-700 outline-none dark:text-gray-300"
            >
              <option value="STATUS">{t("groupBy.status")}</option>
              <option value="ASSIGNEE">{t("groupBy.assignee")}</option>
              <option value="PRIORITY">{t("groupBy.priority")}</option>
              <option value="NONE">{t("groupBy.none")}</option>
            </select>
          </label>

          <label className="sr-only" htmlFor="work-status-scope">
            {t("statusScope")}
          </label>
          <select
            id="work-status-scope"
            value={status}
            onChange={(event) => onStatusChange(event.target.value as WorkStatus | "ALL")}
            className="h-10 min-w-28 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-700 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            <option value="ALL">{t("allStatuses")}</option>
            <option value="TODO">{t("statuses.TODO")}</option>
            <option value="IN_PROGRESS">{t("statuses.IN_PROGRESS")}</option>
            <option value="IN_REVIEW">{t("statuses.IN_REVIEW")}</option>
            <option value="DONE">{t("statuses.DONE")}</option>
          </select>

          {onExportCsv && (
            <button
              type="button"
              onClick={onExportCsv}
              className="h-10 cursor-pointer rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Export CSV
            </button>
          )}

          {hasActiveCriteria && (
            <button
              type="button"
              onClick={onClearFilters}
              className="h-9 cursor-pointer rounded-lg px-2 text-sm font-medium text-brand-600 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:bg-brand-500/10"
            >
              {t("clearFilters")}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
