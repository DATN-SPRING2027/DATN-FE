"use client";

import { useState, type ChangeEvent } from"react";
import { useTranslations } from"next-intl";
import { Modal } from"@/components/ui/modal";
import { FilterIcon, GridIcon, SearchIcon } from"@/icons";
import { PREVIEW_PEOPLE } from"./work-preview-data";
import { MonoIcon } from"./WorkMonoIcons";
import type {
  WorkFilterCondition,
  WorkFilterField,
  WorkFilterOperator,
  WorkGroupBy,
  WorkItem,
  WorkPriority,
  WorkStatus,
} from"./work-types";

const FIELD_OPTIONS: ReadonlyArray<{ key: WorkFilterField; label: string }> = [
  { key:"status", label:"Status"},
  { key:"priority", label:"Priority"},
  { key:"assignee", label:"Assignee"},
  { key:"type", label:"Type"},
  { key:"reporter", label:"Reporter"},
];

const OPERATOR_OPTIONS: ReadonlyArray<{
  key: WorkFilterOperator;
  label: string;
}> = [
  { key:"is", label:"equals (=)"},
  { key:"is_not", label:"not equals (≠)"},
  { key:"contains", label:"contains"},
];

const VALUE_SUGGESTIONS: Record<WorkFilterField, readonly string[]> = {
  status: ["TODO","IN_PROGRESS","IN_REVIEW","DONE"],
  priority: ["HIGH","MEDIUM","LOW"],
  assignee: PREVIEW_PEOPLE.map((p) => p.name),
  type: ["TASK","BUG","STORY","SUBTASK"],
  reporter: PREVIEW_PEOPLE.map((p) => p.name),
};

export default function WorkToolbar({
  query,
  status,
  priority,
  assigneeId,
  groupBy,
  filterConditions = [],
  hideDone = false,
  showHierarchy = true,
  highlightHighPriority = false,
  highlightDoneRows = false,
  items = [],
  onQueryChange,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onGroupByChange,
  onClearFilters,
  onAddFilterCondition,
  onRemoveFilterCondition,
  onToggleHideDone,
  onToggleShowHierarchy,
  onToggleHighlightHighPriority,
  onToggleHighlightDoneRows,
  onOpenAiCopilot,
  onExportCsv,
  onImportCsvItem,
  onBulkSelectAll,
  onGoToReports,
  onRefresh,
}: {
  query: string;
  status: WorkStatus |"ALL";
  priority: WorkPriority |"ALL";
  assigneeId: string |"ALL";
  groupBy: WorkGroupBy;
  filterConditions?: readonly WorkFilterCondition[];
  hideDone?: boolean;
  showHierarchy?: boolean;
  highlightHighPriority?: boolean;
  highlightDoneRows?: boolean;
  items?: readonly WorkItem[];
  onQueryChange: (query: string) => void;
  onStatusChange: (status: WorkStatus |"ALL") => void;
  onPriorityChange: (priority: WorkPriority |"ALL") => void;
  onAssigneeChange: (assigneeId: string |"ALL") => void;
  onGroupByChange: (groupBy: WorkGroupBy) => void;
  onClearFilters: () => void;
  onAddFilterCondition?: (
    field: WorkFilterField,
    operator: WorkFilterOperator,
    value: string,
  ) => void;
  onRemoveFilterCondition?: (id: string) => void;
  onToggleHideDone?: (next: boolean) => void;
  onToggleShowHierarchy?: (next: boolean) => void;
  onToggleHighlightHighPriority?: (next: boolean) => void;
  onToggleHighlightDoneRows?: (next: boolean) => void;
  onOpenAiCopilot?: () => void;
  onExportCsv?: (allFields?: boolean) => void;
  onImportCsvItem?: (fileName: string) => void;
  onBulkSelectAll?: () => void;
  onGoToReports?: () => void;
  onRefresh?: () => void;
}) {
  const t = useTranslations("work");
  const [builderField, setBuilderField] = useState<WorkFilterField>("status");
  const [builderOp, setBuilderOp] = useState<WorkFilterOperator>("is");
  const [builderVal, setBuilderVal] = useState<string>(
    VALUE_SUGGESTIONS.status[0],
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [exportSubOpen, setExportSubOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [askAiInlineOpen, setAskAiInlineOpen] = useState(false);
  const [askAiPrompt, setAskAiPrompt] = useState(
    'Find work items in this project that are assigned to me or High priority',
  );
  const [filterPanelCategory, setFilterPanelCategory] = useState<
    "status"|"priority"|"assignee"|"builder"
  >("status");

  function handleRunAiNaturalLanguageFilter() {
    const text = askAiPrompt.trim().toLowerCase();
    if (!text) return;
    if (text.includes("high")) {
      onPriorityChange("HIGH");
    } else if (text.includes("done")) {
      onStatusChange("DONE");
    } else if (text.includes("progress")) {
      onStatusChange("IN_PROGRESS");
    } else if (text.includes("assigned to me") || text.includes("minh anh")) {
      onAssigneeChange(PREVIEW_PEOPLE[0].id);
    } else {
      onQueryChange(askAiPrompt.trim());
    }
    setAskAiInlineOpen(false);
  }

  // Settings menu modals
  const [chartModalOpen, setChartModalOpen] = useState(false);
  const [formatRulesModalOpen, setFormatRulesModalOpen] = useState(false);
  const [importCsvModalOpen, setImportCsvModalOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [csvFileName, setCsvFileName] = useState("");
  const [feedbackStars, setFeedbackStars] = useState(5);
  const [feedbackText, setFeedbackText] = useState("");

  const activeFilterCount =
    Number(status !=="ALL") +
    Number(priority !=="ALL") +
    Number(assigneeId !=="ALL") +
    filterConditions.length +
    Number(hideDone);
  const hasActiveCriteria = activeFilterCount > 0 || query.trim().length > 0;

  function handleFieldChange(nextField: WorkFilterField) {
    setBuilderField(nextField);
    setBuilderVal(VALUE_SUGGESTIONS[nextField][0] ??"");
  }

  function handleAddCondition() {
    const trimmed = builderVal.trim();
    if (!trimmed || !onAddFilterCondition) return;
    onAddFilterCondition(builderField, builderOp, trimmed);
  }

  function triggerRefresh() {
    setIsRefreshing(true);
    onRefresh?.();
    setTimeout(() => setIsRefreshing(false), 350);
  }

  function handleCsvFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setCsvFileName(file.name);
    }
  }

  const doneCount = items.filter((i) => i.status ==="DONE").length;
  const inProgCount = items.filter(
    (i) => i.status ==="IN_PROGRESS"|| i.status ==="IN_REVIEW",
  ).length;
  const todoCount = items.filter((i) => i.status ==="TODO").length;
  const totalCount = Math.max(1, items.length);

  return (
    <section
      aria-label={t("toolbarLabel")}
      className="flex min-w-0 flex-col gap-2 py-1"
    >
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        {onOpenAiCopilot && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onOpenAiCopilot}
              className="inline-flex h-8 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded border border-gray-300 bg-gray-100 px-2.5 text-xs font-semibold text-gray-800 transition hover:bg-gray-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <MonoIcon name="sparkle" size={13} />
              <span>Ask AI</span>
            </button>
            <button
              type="button"
              onClick={() => setAskAiInlineOpen((prev) => !prev)}
              aria-pressed={askAiInlineOpen}
              title="Toggle AI natural language filter bar"
              className="inline-flex h-8 cursor-pointer items-center justify-center rounded border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              AI Search
            </button>
          </div>
        )}

        <label className="relative min-w-[12rem] flex-1 sm:max-w-64">
          <span className="sr-only">{t("searchLabel")}</span>
          <SearchIcon
            aria-hidden="true"
            viewBox="0 0 24 24"
            width={15}
            height={15}
            className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-8 w-full rounded border border-gray-200 bg-white ps-8 pe-2.5 text-xs text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder:text-gray-500"
          />
        </label>

        {/* Quick Assignee Avatars Stack */}
        <div
          className="flex items-center -space-x-1"
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
                className={`flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border-2 text-[10px] font-semibold transition hover:z-10 hover:scale-105 focus-visible:z-10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                  active
                    ? "z-10 border-brand-500 bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                    : "border-white bg-gray-100 text-gray-700 dark:border-gray-900 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                {person.initials}
              </button>
            );
          })}
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-1.5 ms-auto">
          {/* Jira Filter Popover + Multi-Condition Filter Builder */}
          <details className="group relative">
            <summary
              className={`inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded border px-2.5 text-xs font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 ${
                activeFilterCount > 0
                  ? "border-brand-300 bg-brand-50/70 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              <FilterIcon
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 text-current"
                aria-hidden="true"
              />
              {t("filter")}
              {activeFilterCount > 0 && (
                <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-600 px-1 text-[10px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </summary>
            <div className="absolute start-0 top-full z-30 mt-2 w-[26rem] max-w-[92vw] overflow-hidden border border-gray-200 bg-white shadow-theme-lg dark:border-gray-700 dark:bg-gray-900">
              {/* Jira Cloud 2-Column Split Filter Popover */}
              <div className="grid grid-cols-[9.5rem_minmax(0,1fr)]">
                {/* Left Column: Field Categories */}
                <div className="flex flex-col justify-between border-e border-gray-100 bg-gray-50/70 p-2 dark:border-gray-800 dark:bg-gray-950/60">
                  <div className="space-y-0.5">
                    {(
                      [
                        {
                          id:"status",
                          label:"Status",
                          active: status !=="ALL",
                        },
                        {
                          id:"priority",
                          label: t("priority"),
                          active: priority !=="ALL",
                        },
                        {
                          id:"assignee",
                          label: t("assignee"),
                          active: assigneeId !=="ALL",
                        },
                        {
                          id:"builder",
                          label:"+ Add field",
                          active: filterConditions.length > 0,
                        },
                      ] as const
                    ).map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setFilterPanelCategory(cat.id)}
                        className={`flex w-full cursor-pointer items-center justify-between px-2.5 py-1.5 text-start text-xs font-medium transition ${
                          filterPanelCategory === cat.id
                            ?"bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                            :"text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                        }`}
                      >
                        <span>{cat.label}</span>
                        {cat.active && (
                          <span className="h-2 w-2 bg-brand-600"/>
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={onClearFilters}
                    className="mt-3 w-full cursor-pointer px-2.5 py-1.5 text-start text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800"
                  >
                    Clear all
                  </button>
                </div>

                {/* Right Column: Field Options & Quick Selects */}
                <div className="space-y-3 p-3.5">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2 dark:border-gray-800">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      {filterPanelCategory ==="status"
                        ?"Filter by Status"
                        : filterPanelCategory ==="priority"
                          ?"Filter by Priority"
                          : filterPanelCategory ==="assignee"
                            ?"Filter by Assignee"
                            :"Condition Builder"}
                    </span>
                  </div>

                  {filterPanelCategory ==="status"&& (
                    <div className="space-y-1.5">
                      {(
                        [
                          { key:"ALL", label: t("allStatuses") },
                          { key:"TODO", label: t("statuses.TODO") },
                          {
                            key:"IN_PROGRESS",
                            label: t("statuses.IN_PROGRESS"),
                          },
                          { key:"IN_REVIEW", label: t("statuses.IN_REVIEW") },
                          { key:"DONE", label: t("statuses.DONE") },
                        ] as const
                      ).map((st) => (
                        <label
                          key={st.key}
                          className="flex cursor-pointer items-center gap-2 px-2 py-1 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                        >
                          <input
                            type="radio"
                            name="toolbar-status-radio"
                            checked={status === st.key}
                            onChange={() => onStatusChange(st.key)}
                            className="h-3.5 w-3.5 text-brand-600"
                          />
                          <span>{st.label}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    <label className="grid gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                      {t("priority")}
                      <select
                        value={priority}
                        onChange={(event) =>
                          onPriorityChange(
                            event.target.value as WorkPriority |"ALL",
                          )
                        }
                        className="h-8 cursor-pointer border border-gray-200 bg-white px-2 text-xs font-normal text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                      >
                        <option value="ALL">{t("allPriorities")}</option>
                        <option value="HIGH">{t("priorities.HIGH")}</option>
                        <option value="MEDIUM">{t("priorities.MEDIUM")}</option>
                        <option value="LOW">{t("priorities.LOW")}</option>
                      </select>
                    </label>
                    <label className="grid gap-1 text-xs font-medium text-gray-600 dark:text-gray-300">
                      {t("assignee")}
                      <select
                        value={assigneeId}
                        onChange={(event) =>
                          onAssigneeChange(event.target.value)
                        }
                        className="h-8 cursor-pointer border border-gray-200 bg-white px-2 text-xs font-normal text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
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

                  {onAddFilterCondition && (
                    <div className="space-y-2.5 border-t border-gray-100 pt-2.5 dark:border-gray-800">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Jira Condition Builder
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <label className="grid gap-1 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                          Field
                          <select
                            value={builderField}
                            onChange={(e) =>
                              handleFieldChange(
                                e.target.value as WorkFilterField,
                              )
                            }
                            className="h-8 border border-gray-200 bg-white px-2 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                          >
                            {FIELD_OPTIONS.map((f) => (
                              <option key={f.key} value={f.key}>
                                {f.label}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="grid gap-1 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                          Operator
                          <select
                            value={builderOp}
                            onChange={(e) =>
                              setBuilderOp(e.target.value as WorkFilterOperator)
                            }
                            className="h-8 border border-gray-200 bg-white px-2 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                          >
                            {OPERATOR_OPTIONS.map((op) => (
                              <option key={op.key} value={op.key}>
                                {op.label}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label className="grid gap-1 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                        Value
                        <select
                          value={builderVal}
                          onChange={(e) => setBuilderVal(e.target.value)}
                          className="h-8 border border-gray-200 bg-white px-2 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                        >
                          {VALUE_SUGGESTIONS[builderField].map((val) => (
                            <option key={val} value={val}>
                              {val}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        onClick={handleAddCondition}
                        className="h-8 w-full cursor-pointer bg-brand-500 px-3 text-xs font-semibold text-white hover:bg-brand-600"
                      >
                        + Add filter condition
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Jira Filter Popover Footer (`Shift + F` shortcut hint) */}
              <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/80 px-3.5 py-2 text-[11px] text-gray-500 dark:border-gray-800 dark:bg-gray-950">
                <button
                  type="button"
                  onClick={() => setFeedbackModalOpen(true)}
                  className="inline-flex cursor-pointer items-center gap-1.5 font-medium hover:text-gray-800 dark:hover:text-gray-200"
                >
                  <MonoIcon name="comment"size={12} />
                  <span>Give feedback</span>
                </button>
                <span>
                  Press{""}
                  <kbd className="border border-gray-300 bg-white px-1 py-0.5 text-[10px] font-semibold dark:border-gray-700 dark:bg-gray-800">
                    Shift
                  </kbd>{""}
                  +{""}
                  <kbd className="border border-gray-300 bg-white px-1 py-0.5 text-[10px] font-semibold dark:border-gray-700 dark:bg-gray-800">
                    F
                  </kbd>{""}
                  to open
                </span>
              </div>
            </div>
          </details>

          {/* Group By Selector */}
          <label className="inline-flex h-8 items-center gap-1.5 rounded border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
            <GridIcon
              viewBox="0 0 24 24"
              className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400"
              aria-hidden="true"
            />
            <span>{t("group")}:</span>
            <span className="sr-only">{t("groupByLabel")}</span>
            <select
              value={groupBy}
              onChange={(event) =>
                onGroupByChange(event.target.value as WorkGroupBy)
              }
              aria-label={t("groupByLabel")}
              className="max-w-28 cursor-pointer bg-transparent text-xs font-semibold text-gray-800 outline-none dark:text-gray-200"
            >
              <option value="NONE">{t("groupBy.none")}</option>
              <option value="STATUS">{t("groupBy.status")}</option>
              <option value="ASSIGNEE">{t("groupBy.assignee")}</option>
              <option value="PRIORITY">{t("groupBy.priority")}</option>
            </select>
          </label>

          {/* Status Scope Select */}
          <label className="sr-only" htmlFor="work-status-scope">
            {t("statusScope")}
          </label>
          <select
            id="work-status-scope"
            value={status}
            onChange={(event) =>
              onStatusChange(event.target.value as WorkStatus | "ALL")
            }
            className="h-8 min-w-28 cursor-pointer rounded border border-gray-200 bg-white px-2.5 text-xs text-gray-700 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            <option value="ALL">{t("allStatuses")}</option>
            <option value="TODO">{t("statuses.TODO")}</option>
            <option value="IN_PROGRESS">{t("statuses.IN_PROGRESS")}</option>
            <option value="IN_REVIEW">{t("statuses.IN_REVIEW")}</option>
            <option value="DONE">{t("statuses.DONE")}</option>
          </select>

          {hasActiveCriteria && (
            <button
              type="button"
              onClick={onClearFilters}
              className="h-8 cursor-pointer rounded px-2 text-xs font-medium text-brand-600 hover:bg-brand-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:bg-brand-500/10"
            >
              {t("clearFilters")}
            </button>
          )}

          {/* Right-side Jira Square Toolbar Buttons: Refresh [🔄] & View Settings [···] */}
          <button
            type="button"
            onClick={triggerRefresh}
            title="Refresh work items"
            aria-label="Refresh work items"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <span
              aria-hidden="true"
              className={`inline-block text-sm transition-transform ${
                isRefreshing ? "rotate-180" : ""
              }`}
            >
              ↻
            </span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setSettingsOpen((prev) => !prev)}
              aria-expanded={settingsOpen}
              aria-label="View options"
              title="View options"
              className={`inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded border text-sm font-bold transition ${
                settingsOpen
                  ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300"
                  : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              ···
            </button>

            {settingsOpen && (
              <div
                role="menu"
                aria-label="List view settings"
                className="absolute end-0 top-full z-40 mt-2 w-72 border border-gray-200 bg-white py-2 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
              >
                {/* Top Notice Card (Jira Figure 2) */}
                <div className="mx-2.5 mb-2 border border-brand-100 bg-brand-50/60 p-2.5 dark:border-brand-500/20 dark:bg-brand-500/10">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white/90">
                    Apply settings from the old List view
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                    This includes the filters, groups, and columns you&apos;ve set
                  </p>
                </div>

                <div className="my-1 border-t border-gray-100 dark:border-gray-800"/>

                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    setChartModalOpen(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2 text-start text-xs font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <MonoIcon name="chart"size={14} className="text-gray-500"/>
                  <span>View work items as a chart</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    setFormatRulesModalOpen(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2.5 px-3.5 py-2 text-start text-xs font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <MonoIcon name="sliders"size={14} className="text-gray-500"/>
                  <span>Format rules</span>
                </button>

                <div className="my-1 border-t border-gray-100 dark:border-gray-800"/>

                {/* Toggle: Hide done work items */}
                <label className="flex cursor-pointer items-center justify-between px-3.5 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
                    Hide done work items
                  </span>
                  <input
                    type="checkbox"
                    checked={hideDone}
                    onChange={(e) => onToggleHideDone?.(e.target.checked)}
                    className="h-4 w-4 cursor-pointer border-gray-300 text-brand-600"
                  />
                </label>

                {/* Toggle: Show hierarchy */}
                <label className="flex cursor-pointer items-center justify-between px-3.5 py-2 hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div>
                    <span className="block text-xs font-medium text-gray-700 dark:text-gray-200">
                      Show hierarchy
                    </span>
                    <span className="block text-[10px] text-gray-400">
                      Expandable parent &amp; child rows
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={showHierarchy}
                    onChange={(e) => onToggleShowHierarchy?.(e.target.checked)}
                    className="h-4 w-4 cursor-pointer border-gray-300 text-brand-600"
                  />
                </label>

                <div className="my-1 border-t border-gray-100 dark:border-gray-800"/>

                {/* Export Submenu */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setExportSubOpen((prev) => !prev)}
                    className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2 text-start text-xs font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <span>Export</span>
                    <span aria-hidden="true">{exportSubOpen ?"▾":"▸"}</span>
                  </button>
                  {exportSubOpen && (
                    <div className="bg-gray-50/80 py-1 ps-4 dark:bg-gray-950/60">
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsOpen(false);
                          onExportCsv?.(true);
                        }}
                        className="block w-full cursor-pointer px-3 py-1.5 text-start text-xs text-gray-700 hover:text-brand-600 dark:text-gray-300"
                      >
                        Export Excel CSV (all fields)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsOpen(false);
                          onExportCsv?.(false);
                        }}
                        className="block w-full cursor-pointer px-3 py-1.5 text-start text-xs text-gray-700 hover:text-brand-600 dark:text-gray-300"
                      >
                        Export Excel CSV (current fields)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSettingsOpen(false);
                          if (typeof window !=="undefined") window.print();
                        }}
                        className="block w-full cursor-pointer px-3 py-1.5 text-start text-xs text-gray-700 hover:text-brand-600 dark:text-gray-300"
                      >
                        Print details
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    setImportCsvModalOpen(true);
                  }}
                  className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2 text-start text-xs font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <span>Import work items from CSV</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    onBulkSelectAll?.();
                  }}
                  className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2 text-start text-xs font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <span>Bulk change work items</span>
                </button>

                <div className="my-1 border-t border-gray-100 dark:border-gray-800"/>

                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    onClearFilters();
                    onToggleHideDone?.(false);
                  }}
                  className="flex w-full cursor-pointer items-center justify-between px-3.5 py-2 text-start text-xs font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <span>Go to all work items</span>
                </button>

                <div className="my-1 border-t border-gray-100 dark:border-gray-800"/>

                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    setFeedbackModalOpen(true);
                  }}
                  className="flex w-full cursor-pointer items-center gap-2 px-3.5 py-2 text-start text-xs font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                  <MonoIcon name="comment"size={14} className="text-gray-500"/>
                  <span>Give feedback</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Jira Cloud 2026 `Ask AI` Monochrome-Bordered Natural Language Query Bar */}
      {askAiInlineOpen && (
        <div
          aria-label="Ask AI natural language search bar"
          className="border-2 border-gray-800 bg-white dark:border-gray-300 dark:bg-gray-950"
        >
          <div className="flex flex-wrap items-center gap-2 bg-white px-3 py-1.5 dark:bg-gray-950">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-800 dark:text-gray-200">
              <MonoIcon name="sparkle"size={13} />
              <span>AI JQL</span>
            </span>
            <input
              type="text"
              value={askAiPrompt}
              onChange={(e) => setAskAiPrompt(e.target.value)}
              placeholder='Find work items in project"SCRUM"that are assigned to me'
              className="h-8 min-w-52 flex-1 bg-transparent px-2 text-xs text-gray-900 outline-none dark:text-white"
            />
            <button
              type="button"
              onClick={handleRunAiNaturalLanguageFilter}
              className="inline-flex h-7 cursor-pointer items-center gap-1 bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700"
            >
              <span>Go</span>
              <span aria-hidden="true">↵</span>
            </button>
            <button
              type="button"
              onClick={() => setAskAiInlineOpen(false)}
              aria-label="Close AI search bar"
              className="inline-flex h-7 w-7 cursor-pointer items-center justify-center text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Active Filter Chips Bar (Jira Cloud List Filter Bar) */}
      {(filterConditions.length > 0 ||
        hideDone ||
        status !=="ALL"||
        priority !=="ALL"||
        assigneeId !=="ALL"||
        query.trim().length > 0) && (
        <div
          aria-label="Active filter chips"
          className="flex flex-wrap items-center gap-1.5 border-t border-gray-100 pt-2.5 dark:border-gray-800"
        >
          {query.trim().length > 0 && (
            <span className="inline-flex items-center gap-1.5 border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300">
              <span>
                Keyword: <strong>&ldquo;{query.trim()}&rdquo;</strong>
              </span>
              <button
                type="button"
                onClick={() => onQueryChange("")}
                aria-label="Remove keyword filter"
                className="cursor-pointer font-bold hover:text-brand-900"
              >
                ✕
              </button>
            </span>
          )}

          {status !=="ALL"&& (
            <span className="inline-flex items-center gap-1.5 border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300">
              <span>
                Status = <strong>{t(`statuses.${status}`)}</strong>
              </span>
              <button
                type="button"
                onClick={() => onStatusChange("ALL")}
                aria-label="Remove status filter"
                className="cursor-pointer font-bold hover:text-brand-900"
              >
                ✕
              </button>
            </span>
          )}

          {priority !=="ALL"&& (
            <span className="inline-flex items-center gap-1.5 border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300">
              <span>
                Priority = <strong>{t(`priorities.${priority}`)}</strong>
              </span>
              <button
                type="button"
                onClick={() => onPriorityChange("ALL")}
                aria-label="Remove priority filter"
                className="cursor-pointer font-bold hover:text-brand-900"
              >
                ✕
              </button>
            </span>
          )}

          {assigneeId !=="ALL"&& (
            <span className="inline-flex items-center gap-1.5 border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300">
              <span>
                Assignee ={""}
                <strong>
                  {PREVIEW_PEOPLE.find((p) => p.id === assigneeId)?.name ??
                    assigneeId}
                </strong>
              </span>
              <button
                type="button"
                onClick={() => onAssigneeChange("ALL")}
                aria-label="Remove assignee filter"
                className="cursor-pointer font-bold hover:text-brand-900"
              >
                ✕
              </button>
            </span>
          )}

          {hideDone && (
            <span className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
              <span>Hide Done items</span>
              <button
                type="button"
                onClick={() => onToggleHideDone?.(false)}
                aria-label="Show done items"
                className="cursor-pointer font-bold"
              >
                ✕
              </button>
            </span>
          )}

          {filterConditions.map((cond) => (
            <span
              key={cond.id}
              className="inline-flex items-center gap-1.5 rounded border border-gray-300 bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <span>
                {cond.field}{""}
                {cond.operator ==="is"
                  ?"="
                  : cond.operator ==="is_not"
                    ?"≠"
                    :"contains"}{""}
                <strong>{cond.value}</strong>
              </span>
              <button
                type="button"
                onClick={() => onRemoveFilterCondition?.(cond.id)}
                aria-label={`Remove condition ${cond.field}`}
                className="cursor-pointer font-bold"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 1. Work Items Overview Chart Modal */}
      <Modal
        isOpen={chartModalOpen}
        onClose={() => setChartModalOpen(false)}
        backdropClassName="bg-gray-900/15 backdrop-blur-[1px]"
        showCloseButton={false}
        className="mx-4 max-w-lg p-5 shadow-theme-lg"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
            <h3 className="flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white/90">
              <MonoIcon name="chart"size={16} />
              <span>Work Items Overview Chart</span>
            </h3>
            <button
              type="button"
              onClick={() => setChartModalOpen(false)}
              className="cursor-pointer text-sm text-gray-400 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            <div className="border border-gray-200 p-3 text-center dark:border-gray-800">
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {items.length}
              </p>
              <p className="text-[11px] text-gray-500">Total Items</p>
            </div>
            <div className="border border-success-200 bg-success-50/50 p-3 text-center dark:border-success-500/30 dark:bg-success-500/10">
              <p className="text-lg font-bold text-success-700 dark:text-success-400">
                {doneCount}
              </p>
              <p className="text-[11px] text-success-700 dark:text-success-400">
                Done
              </p>
            </div>
            <div className="border border-brand-200 bg-brand-50/50 p-3 text-center dark:border-brand-500/30 dark:bg-brand-500/10">
              <p className="text-lg font-bold text-brand-700 dark:text-brand-300">
                {inProgCount}
              </p>
              <p className="text-[11px] text-brand-700 dark:text-brand-300">
                In Progress
              </p>
            </div>
            <div className="border border-warning-200 bg-warning-50/50 p-3 text-center dark:border-warning-500/30 dark:bg-warning-500/10">
              <p className="text-lg font-bold text-warning-700 dark:text-warning-400">
                {todoCount}
              </p>
              <p className="text-[11px] text-warning-700 dark:text-warning-400">
                To Do
              </p>
            </div>
          </div>
          <div className="border border-gray-200 bg-gray-50 p-3.5 dark:border-gray-800 dark:bg-gray-950">
            <p className="mb-2 text-xs font-semibold text-gray-700 dark:text-gray-300">
              Distribution Breakdown
            </p>
            <div className="flex h-4 overflow-hidden bg-gray-200 dark:bg-gray-800">
              <div
                style={{ width: `${Math.round((doneCount / totalCount) * 100)}%` }}
                className="bg-success-500"
              />
              <div
                style={{
                  width: `${Math.round((inProgCount / totalCount) * 100)}%`,
                }}
                className="bg-brand-500"
              />
              <div
                style={{ width: `${Math.round((todoCount / totalCount) * 100)}%` }}
                className="bg-warning-500"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setChartModalOpen(false)}
              className="h-9 cursor-pointer border border-gray-200 px-3.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
            >
              Close
            </button>
            {onGoToReports && (
              <button
                type="button"
                onClick={() => {
                  setChartModalOpen(false);
                  onGoToReports();
                }}
                className="h-9 cursor-pointer bg-brand-500 px-3.5 text-xs font-semibold text-white hover:bg-brand-600"
              >
                Go to Reports View
              </button>
            )}
          </div>
        </div>
      </Modal>

      {/* 2. Format Rules Modal */}
      <Modal
        isOpen={formatRulesModalOpen}
        onClose={() => setFormatRulesModalOpen(false)}
        backdropClassName="bg-gray-900/15 backdrop-blur-[1px]"
        showCloseButton={false}
        className="mx-4 max-w-md p-5 shadow-theme-lg"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">
              Format rules
            </h3>
            <button
              type="button"
              onClick={() => setFormatRulesModalOpen(false)}
              className="cursor-pointer text-sm text-gray-400 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Apply custom highlight colors to spreadsheet rows based on work item
            status or priority.
          </p>
          <div className="space-y-2.5">
            <label className="flex cursor-pointer items-center justify-between border border-gray-200 p-3 dark:border-gray-800">
              <div>
                <span className="bg-error-50 px-2 py-0.5 text-xs font-semibold text-error-700 dark:bg-error-500/15 dark:text-error-400">
                  High Priority
                </span>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                  Highlight row with soft red accent when Priority is High
                </p>
              </div>
              <input
                type="checkbox"
                checked={highlightHighPriority}
                onChange={(e) =>
                  onToggleHighlightHighPriority?.(e.target.checked)
                }
                className="h-4 w-4 cursor-pointer border-gray-300 text-brand-600"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between border border-gray-200 p-3 dark:border-gray-800">
              <div>
                <span className="bg-success-50 px-2 py-0.5 text-xs font-semibold text-success-700 dark:bg-success-500/15 dark:text-success-400">
                  Done Tasks
                </span>
                <p className="mt-1 text-xs text-gray-600 dark:text-gray-300">
                  Apply soft green indicator for resolved items
                </p>
              </div>
              <input
                type="checkbox"
                checked={highlightDoneRows}
                onChange={(e) => onToggleHighlightDoneRows?.(e.target.checked)}
                className="h-4 w-4 cursor-pointer border-gray-300 text-brand-600"
              />
            </label>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setFormatRulesModalOpen(false)}
              className="h-9 cursor-pointer bg-brand-500 px-4 text-xs font-semibold text-white hover:bg-brand-600"
            >
              Save rules
            </button>
          </div>
        </div>
      </Modal>

      {/* 3. Import CSV Modal */}
      <Modal
        isOpen={importCsvModalOpen}
        onClose={() => setImportCsvModalOpen(false)}
        backdropClassName="bg-gray-900/15 backdrop-blur-[1px]"
        showCloseButton={false}
        className="mx-4 max-w-md p-5 shadow-theme-lg"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">
              Import work items from CSV
            </h3>
            <button
              type="button"
              onClick={() => setImportCsvModalOpen(false)}
              className="cursor-pointer text-sm text-gray-400 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <label className="flex cursor-pointer flex-col items-center justify-center border-2 border-dashed border-gray-300 bg-gray-50 p-6 text-center hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900/50">
            <MonoIcon name="document"size={24} className="text-gray-500"/>
            <span className="mt-2 text-xs font-semibold text-gray-800 dark:text-gray-200">
              {csvFileName
                ? `Selected: ${csvFileName}`
                :"Click to choose a CSV file or drag it here"}
            </span>
            <span className="mt-1 text-[11px] text-gray-500">
              Max file size: 10MB (.csv)
            </span>
            <input
              type="file"
              accept=".csv"
              onChange={handleCsvFileSelect}
              className="hidden"
            />
          </label>
          <div className="flex items-center justify-between text-xs">
            <button
              type="button"
              onClick={() => onExportCsv?.(false)}
              className="cursor-pointer font-medium text-brand-600 hover:underline dark:text-brand-400"
            >
              Download sample CSV template
            </button>
            <button
              type="button"
              onClick={() => setCsvFileName("sprint-backlog-import.csv")}
              className="cursor-pointer text-gray-500 hover:text-gray-800 dark:hover:text-gray-200"
            >
              Use demo CSV file
            </button>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setImportCsvModalOpen(false)}
              className="h-9 cursor-pointer border border-gray-200 px-3.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!csvFileName}
              onClick={() => {
                onImportCsvItem?.(csvFileName);
                setCsvFileName("");
                setImportCsvModalOpen(false);
              }}
              className="h-9 cursor-pointer bg-brand-500 px-4 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
            >
              Import
            </button>
          </div>
        </div>
      </Modal>

      {/* 4. Feedback Modal */}
      <Modal
        isOpen={feedbackModalOpen}
        onClose={() => setFeedbackModalOpen(false)}
        backdropClassName="bg-gray-900/15 backdrop-blur-[1px]"
        showCloseButton={false}
        className="mx-4 max-w-md p-5 shadow-theme-lg"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-gray-800">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">
              Help us improve Continuum AI Workspace
            </h3>
            <button
              type="button"
              onClick={() => setFeedbackModalOpen(false)}
              className="cursor-pointer text-sm text-gray-400 hover:text-gray-700"
            >
              ✕
            </button>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-300">
            How satisfied are you with this Jira List workspace experience?
          </p>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setFeedbackStars(star)}
                className={`cursor-pointer text-2xl ${
                  star <= feedbackStars ?"text-warning-500":"text-gray-300"
                }`}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            rows={3}
            value={feedbackText}
            onChange={(e) => setFeedbackText(e.target.value)}
            placeholder="Share your thoughts or suggestions..."
            className="w-full border border-gray-200 p-2.5 text-xs text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setFeedbackModalOpen(false)}
              className="h-9 cursor-pointer border border-gray-200 px-3.5 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setFeedbackText("");
                setFeedbackModalOpen(false);
              }}
              className="h-9 cursor-pointer bg-brand-500 px-4 text-xs font-semibold text-white hover:bg-brand-600"
            >
              Send feedback
            </button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
