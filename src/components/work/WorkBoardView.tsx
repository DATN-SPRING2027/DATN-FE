"use client";

import { useState, type FormEvent } from"react";
import { useTranslations } from"next-intl";
import { PlusIcon } from"@/icons";
import { PREVIEW_PEOPLE } from"./work-preview-data";
import {
  WORK_STATUS_ORDER,
  type WorkItem,
  type WorkPerson,
  type WorkStatus,
  type WorkSubtaskItem,
} from"./work-types";
import { MonoIcon, MonoIssueTypeIcon } from"./WorkMonoIcons";

const WIP_LIMIT_IN_PROGRESS = 4;
const UNASSIGNED_PERSON: WorkPerson = {
  id: "unassigned",
  name: "Unassigned",
  initials: "UN",
};

export default function WorkBoardView({
  items,
  people,
  activeSprintName,
  activeSprintCounts,
  isSprintLoading,
  isSprintError,
  onCompleteSprint,
  onOpenItem,
  onOpenSubtask,
  onStatusChange,
  onToggleSubtask,
  onAddSubtask,
  onUpdateSubtask,
  onDeleteSubtask,
  onCloneSubtask,
  onConvertSubtaskToTask,
  onQuickCreate,
}: {
  items: readonly WorkItem[];
  people?: readonly WorkPerson[];
  activeSprintName: string | null;
  activeSprintCounts?: {
    totalTasks: number;
    doneTasks: number;
    inProgressTasks: number;
    todoTasks: number;
  } | null;
  isSprintLoading: boolean;
  isSprintError: boolean;
  onCompleteSprint?: () => Promise<void>;
  onOpenItem: (item: WorkItem, trigger: HTMLButtonElement) => void;
  onOpenSubtask?: (
    item: WorkItem,
    subtaskId: string,
    trigger: HTMLButtonElement,
  ) => void;
  onStatusChange?: (id: string, status: WorkStatus) => void;
  onToggleSubtask?: (itemId: string, subtaskId: string) => void;
  onAddSubtask?: (itemId: string, summary: string) => void;
  onUpdateSubtask?: (
    itemId: string,
    subtaskId: string,
    patch: Partial<Omit<WorkSubtaskItem, "id" | "key">>,
  ) => void;
  onDeleteSubtask?: (itemId: string, subtaskId: string) => void;
  onCloneSubtask?: (itemId: string, subtaskId: string) => void;
  onConvertSubtaskToTask?: (itemId: string, subtaskId: string) => void;
  onQuickCreate?: (title: string, status: WorkStatus) => void;
}) {
  const t = useTranslations("work");
  const [dragOverColumn, setDragOverColumn] = useState<WorkStatus | null>(null);
  const [quickCreateColumn, setQuickCreateColumn] =
    useState<WorkStatus | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [collapsedColumns, setCollapsedColumns] = useState<Set<WorkStatus>>(
    () => new Set(),
  );
  const [insightsOpen, setInsightsOpen] = useState(false);
  const [viewSettingsOpen, setViewSettingsOpen] = useState(false);
  const [completeSprintOpen, setCompleteSprintOpen] = useState(false);
  const [sprintCompletedNotice, setSprintCompletedNotice] = useState(false);
  const [completeSprintError, setCompleteSprintError] = useState<string | null>(null);
  const [isCompletingSprint, setIsCompletingSprint] = useState(false);
  const [showEpicBadge, setShowEpicBadge] = useState(true);
  const [showDueDate, setShowDueDate] = useState(true);
  const [showStoryPoints, setShowStoryPoints] = useState(true);
  const [showSubtasks, setShowSubtasks] = useState(true);

  const totalSprintTasks = activeSprintCounts?.totalTasks ?? items.length;
  const doneItemsCount =
    activeSprintCounts?.doneTasks ??
    items.filter((i) => i.status ==="DONE").length;
  const incompleteItemsCount = Math.max(0, totalSprintTasks - doneItemsCount);
  const completionPct =
    totalSprintTasks === 0
      ? 0
      : Math.round((doneItemsCount / totalSprintTasks) * 100);
  const sprintLabel = activeSprintName
    ? t("activeSprint", { name: activeSprintName })
    : isSprintLoading
      ? t("loadingSprint")
      : isSprintError
        ? t("sprintLoadFailed")
        : t("noActiveSprint");

  async function handleCompleteSprint() {
    if (!onCompleteSprint || isCompletingSprint) return;
    setIsCompletingSprint(true);
    setCompleteSprintError(null);
    try {
      await onCompleteSprint();
      setCompleteSprintOpen(false);
      setSprintCompletedNotice(true);
    } catch {
      setCompleteSprintError(t("completeSprintFailed"));
    } finally {
      setIsCompletingSprint(false);
    }
  }

  function toggleColumnCollapse(status: WorkStatus) {
    setCollapsedColumns((current) => {
      const next = new Set(current);
      if (next.has(status)) next.delete(status);
      else next.add(status);
      return next;
    });
  }

  function handleQuickCreate(
    event: FormEvent<HTMLFormElement>,
    status: WorkStatus,
  ) {
    event.preventDefault();
    const trimmed = quickTitle.trim();
    if (!trimmed || !onQuickCreate) return;
    onQuickCreate(trimmed, status);
    setQuickTitle("");
    setQuickCreateColumn(null);
  }

  return (
    <div className="min-w-0 space-y-3.5 pb-2">
      {/* Jira Cloud 2026 Board Sprint Header & Controls (`25-tab-board.png`, `27-board-insights-drawer.png`, `28-board-view-settings-drawer.png`) */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border border-gray-200 bg-white px-4 py-2.5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="inline-flex items-center gap-1.5 border border-gray-300 bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
            <MonoIcon name="sync"size={13} />
            <span>{sprintLabel}</span>
          </span>
          {sprintCompletedNotice && (
            <span className="inline-flex items-center gap-1.5 border border-gray-300 bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
              <MonoIcon name="check"size={13} />
              <span>{t("sprintCompleted")}</span>
            </span>
          )}
        </div>

        <div className="relative flex flex-wrap items-center gap-2">
          {onCompleteSprint && <button
            type="button"
            disabled={!activeSprintName || !onCompleteSprint || isCompletingSprint}
            onClick={() => {
              setCompleteSprintError(null);
              setCompleteSprintOpen(true);
            }}
            className="h-8 cursor-pointer border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            {t("completeSprint")}
          </button>}

          <button
            type="button"
            aria-pressed={insightsOpen}
            onClick={() => setInsightsOpen((prev) => !prev)}
            className={`inline-flex h-8 cursor-pointer items-center gap-1.5 border px-3 text-xs font-semibold transition ${
              insightsOpen
                ?"border-gray-800 bg-gray-100 text-gray-900 dark:border-gray-400 dark:bg-gray-800 dark:text-white"
                :"border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            }`}
          >
            <MonoIcon name="chart"size={13} />
            <span>Insights</span>
          </button>

          <button
            type="button"
            aria-expanded={viewSettingsOpen}
            onClick={() => setViewSettingsOpen((prev) => !prev)}
            className={`inline-flex h-8 cursor-pointer items-center gap-1.5 border px-3 text-xs font-semibold transition ${
              viewSettingsOpen
                ?"border-gray-800 bg-gray-100 text-gray-900 dark:border-gray-400 dark:bg-gray-800 dark:text-white"
                :"border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            }`}
          >
            <MonoIcon name="sliders"size={13} />
            <span>View settings</span>
          </button>

          {viewSettingsOpen && (
            <div
              role="dialog"
              aria-label="Board view settings"
              className="absolute end-0 top-full z-30 mt-2 w-64 border border-gray-200 bg-white p-3.5 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
            >
              <p className="mb-2 text-xs font-semibold text-gray-900 dark:text-white">
                Card layout fields
              </p>
              <div className="space-y-2 text-xs">
                <label className="flex cursor-pointer items-center justify-between text-gray-700 dark:text-gray-300">
                  <span>Parent Epic lozenge</span>
                  <input
                    type="checkbox"
                    checked={showEpicBadge}
                    onChange={(e) => setShowEpicBadge(e.target.checked)}
                    className="h-4 w-4 border-gray-300 text-brand-600"
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between text-gray-700 dark:text-gray-300">
                  <span>Due date chip</span>
                  <input
                    type="checkbox"
                    checked={showDueDate}
                    onChange={(e) => setShowDueDate(e.target.checked)}
                    className="h-4 w-4 border-gray-300 text-brand-600"
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between text-gray-700 dark:text-gray-300">
                  <span>Story point estimate</span>
                  <input
                    type="checkbox"
                    checked={showStoryPoints}
                    onChange={(e) => setShowStoryPoints(e.target.checked)}
                    className="h-4 w-4 border-gray-300 text-brand-600"
                  />
                </label>
                <label className="flex cursor-pointer items-center justify-between text-gray-700 dark:text-gray-300">
                  <span>Subtasks progress</span>
                  <input
                    type="checkbox"
                    checked={showSubtasks}
                    onChange={(e) => setShowSubtasks(e.target.checked)}
                    className="h-4 w-4 border-gray-300 text-brand-600"
                  />
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Board Insights Drawer (`27-board-insights-drawer.png`) */}
      {insightsOpen && (
        <div
          role="region"
          aria-label="Sprint insights"
          className="grid grid-cols-1 gap-3 border border-brand-200 bg-brand-50/40 p-4 sm:grid-cols-3 dark:border-brand-500/30 dark:bg-brand-500/10"
        >
          <div className="border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-semibold text-gray-900 dark:text-white">
              Sprint progress ({completionPct}%)
            </p>
            <div className="mt-2 h-2 overflow-hidden bg-gray-100 dark:bg-gray-800">
              <div
                style={{ width: `${completionPct}%` }}
                className="h-full bg-success-500"
              />
            </div>
            <p className="mt-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              {doneItemsCount} Done • {incompleteItemsCount} Remaining
            </p>
          </div>
          <div className="border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-semibold text-gray-900 dark:text-white">
              Epic progress
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-gray-700 dark:text-gray-300">
              <MonoIssueTypeIcon type="EPIC"size={12} />
              <span>Epic 1: Core Workspace UI &amp; Design System</span>
            </p>
            <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
              {items.length} linked sprint items tracked
            </p>
          </div>
          <div className="border border-gray-200 bg-white p-3 dark:border-gray-800 dark:bg-gray-900">
            <p className="text-xs font-semibold text-gray-900 dark:text-white">
              Work in progress limit
            </p>
            <p className="mt-1 text-xs text-gray-700 dark:text-gray-300">
              Max {WIP_LIMIT_IN_PROGRESS} items in In Progress column
            </p>
          </div>
        </div>
      )}

      {/* Complete Sprint Modal */}
      {completeSprintOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("completeSprintDialog")}
          className="border border-gray-200 bg-white p-4 shadow-theme-md dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                {t("completeSprintTitle", { sprintName: activeSprintName ?? "" })}
              </h3>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {t("incompleteItemsMove", { count: incompleteItemsCount })}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isCompletingSprint}
                onClick={() => setCompleteSprintOpen(false)}
                className="h-8 cursor-pointer border border-gray-200 px-3 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300"
              >
                {t("cancel")}
              </button>
              <button
                type="button"
                disabled={isCompletingSprint}
                onClick={() => void handleCompleteSprint()}
                className="h-8 cursor-pointer bg-brand-600 px-3.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60"
              >
                {isCompletingSprint ? t("completingSprint") : t("completeSprint")}
              </button>
            </div>
          </div>
          {completeSprintError && (
            <p role="alert" className="mt-3 text-xs text-error-600 dark:text-error-400">
              {completeSprintError}
            </p>
          )}
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 items-start gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {WORK_STATUS_ORDER.map((status) => {
          const columnItems = items.filter((item) => item.status === status);
          const columnSubtasks = showSubtasks
            ? items.flatMap((parent) =>
                (parent.subtaskItems ?? [])
                  .filter((sub) => sub.status === status)
                  .map((sub) => ({ parent, sub })),
              )
            : [];
          const totalColumnCards = columnItems.length + columnSubtasks.length;
          const isWipExceeded =
            status ==="IN_PROGRESS"&&
            columnItems.length > WIP_LIMIT_IN_PROGRESS;
          const isDragOver = dragOverColumn === status;
          const isCollapsed = collapsedColumns.has(status);

          return (
            <section
              key={status}
              aria-labelledby={`work-column-${status}`}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverColumn(status);
              }}
              onDragLeave={() => setDragOverColumn(null)}
              onDrop={(event) => {
                event.preventDefault();
                setDragOverColumn(null);
                const draggedId = event.dataTransfer.getData("text/plain");
                if (draggedId.startsWith("subtask:")) {
                  const [, parentId, subId] = draggedId.split(":");
                  const subtask = items.find((item) => item.id === parentId)?.subtaskItems?.find((sub) => sub.id === subId);
                  if (subtask && !subtask.readOnly && onUpdateSubtask) {
                    onUpdateSubtask(parentId, subId, {
                      status,
                      done: status === "DONE",
                    });
                  }
                  return;
                }
                const task = items.find((item) => item.id === draggedId);
                if (task && !task.readOnly && onStatusChange) {
                  onStatusChange(draggedId, status);
                }
              }}
              className={`min-w-0 rounded-lg p-2.5 transition ${
                isDragOver
                  ? "bg-brand-50/70 ring-2 ring-brand-500 dark:bg-brand-500/15"
                  : isWipExceeded
                    ? "bg-error-50/60 ring-1 ring-error-300 dark:bg-error-500/10"
                    : "bg-gray-100/80 dark:bg-gray-800/60"
              }`}
            >
              <div className="flex items-center justify-between px-1 pb-2">
                <h2
                  id={`work-column-${status}`}
                  className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300"
                >
                  <span>{t(`statuses.${status}`)}</span>
                  <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-900 dark:text-gray-300">
                    {totalColumnCards}
                  </span>
                  {status === "IN_PROGRESS" && (
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                        isWipExceeded
                          ? "bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-300"
                          : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300"
                      }`}
                    >
                      MAX {WIP_LIMIT_IN_PROGRESS}
                    </span>
                  )}
                </h2>
                <button
                  type="button"
                  onClick={() => toggleColumnCollapse(status)}
                  title={isCollapsed ? "Expand column" : "Collapse column"}
                  aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${t(`statuses.${status}`)} column`}
                  className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded text-[11px] font-bold text-gray-500 hover:bg-gray-200/80 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                  {isCollapsed ? "↔" : "><"}
                </button>
              </div>

              {!isCollapsed && (
                <>
                  <ul className="flex max-h-[calc(100vh-14rem)] min-h-32 flex-col gap-2 overflow-y-auto pe-0.5">
                    {totalColumnCards === 0 ? (
                      <li className="flex min-h-20 items-center justify-center rounded-md border border-dashed border-gray-300 px-3 text-center text-xs text-gray-500 dark:border-gray-700 dark:text-gray-400">
                        {t("emptyColumn")}
                      </li>
                    ) : (
                      <>
                        {columnItems.map((item) => (
                          <WorkCard
                            key={item.id}
                            item={item}
                            people={people}
                            status={status}
                            showEpicBadge={showEpicBadge}
                            showDueDate={showDueDate}
                            showStoryPoints={showStoryPoints}
                            showSubtasks={showSubtasks}
                            onOpenItem={onOpenItem}
                            onOpenSubtask={onOpenSubtask}
                            onStatusChange={item.readOnly ? undefined : onStatusChange}
                            onToggleSubtask={onToggleSubtask}
                            onAddSubtask={item.readOnly ? undefined : onAddSubtask}
                            onUpdateSubtask={onUpdateSubtask}
                            onDeleteSubtask={onDeleteSubtask}
                            onCloneSubtask={onCloneSubtask}
                            onConvertSubtaskToTask={onConvertSubtaskToTask}
                          />
                        ))}
                        {columnSubtasks.map(({ parent, sub }) => {
                          const subAssignee = sub.assignee ?? parent.assignee;
                          const subDue = sub.dueDate ?? parent.dueDate;
                          return (
                            <li
                              key={`subcard-${parent.id}-${sub.id}`}
                              draggable={!sub.readOnly && Boolean(onUpdateSubtask)}
                              onDragStart={(event) => {
                                if (sub.readOnly || !onUpdateSubtask) {
                                  event.preventDefault();
                                  return;
                                }
                                event.dataTransfer.setData(
                                  "text/plain",
                                  `subtask:${parent.id}:${sub.id}`,
                                );
                                event.dataTransfer.effectAllowed = "move";
                              }}
                            >
                              <article className="group relative rounded-md border border-dashed border-brand-200 bg-white/95 p-2.5 shadow-theme-xs transition-colors hover:border-brand-400 dark:border-brand-500/30 dark:bg-gray-900/90 dark:hover:border-brand-400">
                                <div className="mb-1 flex items-center justify-between gap-1.5">
                                  <span className="inline-flex max-w-full items-center gap-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                    <MonoIssueTypeIcon
                                      type={parent.type}
                                      size={9}
                                    />
                                    <span className="truncate">
                                      Parent: {parent.key}
                                    </span>
                                  </span>
                                  {showDueDate && subDue && (
                                    <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                      {subDue}
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={(event) =>
                                    onOpenSubtask
                                      ? onOpenSubtask(
                                          parent,
                                          sub.id,
                                          event.currentTarget,
                                        )
                                      : onOpenItem(parent, event.currentTarget)
                                  }
                                  className="block w-full cursor-pointer text-start"
                                >
                                  <span
                                    className={`line-clamp-2 text-xs font-medium leading-4 ${
                                      sub.done
                                        ? "line-through text-gray-400 dark:text-gray-500"
                                        : "text-gray-900 dark:text-white/90"
                                    }`}
                                  >
                                    {sub.summary}
                                  </span>
                                </button>
                                <div className="mt-2 flex items-center justify-between gap-2">
                                  <button
                                    type="button"
                                    onClick={(event) =>
                                      onOpenSubtask
                                        ? onOpenSubtask(
                                            parent,
                                            sub.id,
                                            event.currentTarget,
                                          )
                                        : onOpenItem(
                                            parent,
                                            event.currentTarget,
                                          )
                                    }
                                    className="inline-flex cursor-pointer items-center gap-1 font-mono text-[11px] font-semibold text-brand-700 hover:underline dark:text-brand-300"
                                  >
                                    <span className="flex h-4 w-4 items-center justify-center rounded border border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300">
                                      <MonoIssueTypeIcon
                                        type="SUBTASK"
                                        size={9}
                                      />
                                    </span>
                                    <span>{sub.key}</span>
                                  </button>
                                  <span
                                    title={subAssignee.name}
                                    className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-50 text-[9px] font-bold text-brand-700 ring-1 ring-brand-200 dark:bg-brand-500/20 dark:text-brand-300"
                                  >
                                    {subAssignee.initials}
                                  </span>
                                </div>
                              </article>
                            </li>
                          );
                        })}
                      </>
                    )}
                  </ul>

                  {onQuickCreate && (
                    <div className="mt-2.5">
                      {quickCreateColumn === status ? (
                        <form
                          onSubmit={(event) => handleQuickCreate(event, status)}
                          className="space-y-2 bg-white p-2.5 ring-2 ring-brand-500 dark:bg-gray-900"
                        >
                          <input
                            value={quickTitle}
                            onChange={(event) =>
                              setQuickTitle(event.target.value)
                            }
                            placeholder="What needs to be done?"
                            className="h-8 w-full border border-gray-200 bg-white px-2 text-xs text-gray-900 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                          />
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="inline-flex items-center gap-1 border border-gray-300 bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                              <MonoIssueTypeIcon type="TASK"size={11} />
                              <span>Task ▾</span>
                            </span>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setQuickCreateColumn(null);
                                  setQuickTitle("");
                                }}
                                className="h-7 cursor-pointer px-2 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                              >
                                Cancel
                              </button>
                              <button
                                type="submit"
                                className="inline-flex h-7 cursor-pointer items-center gap-1 bg-brand-600 px-2.5 text-xs font-semibold text-white hover:bg-brand-700"
                              >
                                <span>Create</span>
                                <span aria-hidden="true">↵</span>
                              </button>
                            </div>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setQuickCreateColumn(status);
                            setQuickTitle("");
                          }}
                          className="inline-flex w-full cursor-pointer items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-200/70 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700/60 dark:hover:text-white"
                        >
                          <PlusIcon
                            viewBox="0 0 12 12"
                            className="h-3.5 w-3.5"
                            aria-hidden="true"
                          />
                          Create issue
                        </button>
                      )}
                    </div>
                  )}
                </>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function WorkCard({
  item,
  people,
  status,
  showEpicBadge = true,
  showDueDate = true,
  showStoryPoints = true,
  showSubtasks = true,
  onOpenItem,
  onOpenSubtask,
  onStatusChange,
  onToggleSubtask,
  onAddSubtask,
  onUpdateSubtask,
  onDeleteSubtask,
  onCloneSubtask,
  onConvertSubtaskToTask,
}: {
  item: WorkItem;
  people?: readonly WorkPerson[];
  status: WorkStatus;
  showEpicBadge?: boolean;
  showDueDate?: boolean;
  showStoryPoints?: boolean;
  showSubtasks?: boolean;
  onOpenItem: (item: WorkItem, trigger: HTMLButtonElement) => void;
  onOpenSubtask?: (
    item: WorkItem,
    subtaskId: string,
    trigger: HTMLButtonElement,
  ) => void;
  onStatusChange?: (id: string, status: WorkStatus) => void;
  onToggleSubtask?: (itemId: string, subtaskId: string) => void;
  onAddSubtask?: (itemId: string, summary: string) => void;
  onUpdateSubtask?: (
    itemId: string,
    subtaskId: string,
    patch: Partial<Omit<WorkSubtaskItem, "id" | "key">>,
  ) => void;
  onDeleteSubtask?: (itemId: string, subtaskId: string) => void;
  onCloneSubtask?: (itemId: string, subtaskId: string) => void;
  onConvertSubtaskToTask?: (itemId: string, subtaskId: string) => void;
}) {
  const t = useTranslations("work");
  const assignee = item.assignee;
  const isDone = status ==="DONE";
  const [subtasksExpanded, setSubtasksExpanded] = useState(false);
  const [addingCardSubtask, setAddingCardSubtask] = useState(false);
  const [isDraggingCard, setIsDraggingCard] = useState(false);
  const [cardSubtaskSummary, setCardSubtaskSummary] = useState("");
  const subtaskPct =
    item.subtasks.total === 0
      ? 0
      : Math.round((item.subtasks.completed / item.subtasks.total) * 100);

  return (
    <li
      draggable={Boolean(onStatusChange)}
      onDragStart={(event) => {
        setIsDraggingCard(true);
        event.dataTransfer.setData("text/plain", item.id);
        event.dataTransfer.effectAllowed ="move";
      }}
      onDragEnd={() => setIsDraggingCard(false)}
    >
      <article
        className={`group relative rounded-md border border-gray-200 bg-white p-2.5 shadow-theme-xs transition-all duration-150 ease-out hover:-translate-y-[1px] hover:border-brand-300 hover:shadow-theme-sm dark:border-gray-700 dark:bg-gray-900 dark:hover:border-brand-500 ${
          isDraggingCard ? "scale-[1.02] rotate-[1.5deg] opacity-90 shadow-theme-lg ring-2 ring-brand-500/30" : ""
        }`}
      >
        <button
          type="button"
          onClick={(event) => onOpenItem(item, event.currentTarget)}
          aria-label={t("openWorkItem", { key: item.key, title: item.title })}
          className="block w-full cursor-pointer text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          <span className="line-clamp-2 text-sm font-medium leading-5 text-gray-900 dark:text-white/90">
            {item.title}
          </span>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {showDueDate && item.dueDate && (
              <span className="inline-flex items-center rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {item.dueDate}
              </span>
            )}
            {showEpicBadge && item.parent && (
              <span className="inline-flex max-w-full items-center gap-1 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                <MonoIssueTypeIcon type="EPIC" size={10} className="shrink-0 text-gray-500 dark:text-gray-400" />
                <span className="truncate">{item.parent.summary}</span>
              </span>
            )}
          </div>
        </button>

        {/* Compact Bottom Metadata Row (Key + Subtask Badge + Priority/SP + Avatar) */}
        <div className="mt-2.5 flex items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={(event) => onOpenItem(item, event.currentTarget)}
            className={`inline-flex cursor-pointer items-center gap-1.5 font-mono text-xs font-semibold text-gray-600 hover:underline dark:text-gray-300 ${
              isDone ? "line-through opacity-75" : ""
            }`}
          >
            <span
              aria-hidden="true"
              className="flex h-4 w-4 items-center justify-center rounded border border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              <MonoIssueTypeIcon type={item.type} size={10} />
            </span>
            <span>{item.key}</span>
          </button>

          <div className="flex items-center gap-1.5">
            {showSubtasks && item.subtasks.total > 0 && (
              <button
                type="button"
                onClick={() => setSubtasksExpanded((prev) => !prev)}
                aria-expanded={subtasksExpanded}
                title="View subtasks"
                className="inline-flex cursor-pointer items-center gap-1 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                <MonoIssueTypeIcon type="SUBTASK" size={10} />
                <span>
                  {item.subtasks.completed}/{item.subtasks.total}
                </span>
              </button>
            )}
            {showStoryPoints && (
              <span
                title="Story point estimate"
                className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-100 px-1.5 text-[10px] font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                {item.storyPoints ?? 3}
              </span>
            )}
            {assignee && (
              <span
                aria-label={t("assignedTo", { name: assignee.name })}
                title={assignee.name}
                className="flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 bg-gray-100 text-[10px] font-bold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                {assignee.initials}
              </span>
            )}
          </div>
        </div>

        {/* Expandable Subtasks Drawer inside Kanban Card */}
        {showSubtasks && subtasksExpanded && (
          <div className="mt-2.5 space-y-2 border-t border-gray-100 pt-2.5 text-xs dark:border-gray-800">
            {item.subtasks.total > 0 && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden bg-gray-200 dark:bg-gray-800">
                  <div
                    className="h-full bg-gray-900 transition-all dark:bg-gray-100"
                    style={{ width: `${subtaskPct}%` }}
                  />
                </div>
                <span className="text-[10px] font-semibold text-gray-500">
                  {subtaskPct}%
                </span>
              </div>
            )}

            {item.subtasks.total > 0 &&
              item.subtasks.completed === item.subtasks.total &&
              status !== "DONE" &&
              onStatusChange && (
                <div className="flex items-center justify-between gap-1.5 border border-gray-800 bg-gray-100 px-2 py-1 text-[10px] dark:border-gray-300 dark:bg-gray-800">
                  <span className="font-semibold text-gray-800 dark:text-gray-200">
                    ✓ All subtasks Done
                  </span>
                  <button
                    type="button"
                    onClick={() => onStatusChange(item.id, "DONE")}
                    className="cursor-pointer bg-gray-900 px-1.5 py-0.5 font-semibold text-white dark:bg-gray-100 dark:text-gray-900"
                  >
                    Move card Done
                  </button>
                </div>
              )}

            {item.subtaskItems && item.subtaskItems.length > 0 ? (
              <ul className="space-y-1">
                {item.subtaskItems.map((sub) => (
                  <li
                    key={sub.id}
                    className="flex items-center justify-between gap-1.5 border border-gray-100 bg-gray-50 px-2 py-1 dark:border-gray-800 dark:bg-gray-950"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={sub.done}
                        disabled={sub.readOnly}
                        onChange={() => onToggleSubtask?.(item.id, sub.id)}
                        className="h-3.5 w-3.5 shrink-0 cursor-pointer border-gray-300 text-brand-600"
                      />
                      <button
                        type="button"
                        onClick={(e) =>
                          onOpenSubtask
                            ? onOpenSubtask(item, sub.id, e.currentTarget)
                            : onOpenItem(item, e.currentTarget)
                        }
                        title={`Open ${sub.key} detail layer`}
                        className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-start hover:underline"
                      >
                        <span className="shrink-0 font-semibold text-gray-700 dark:text-gray-300">
                          {sub.key}
                        </span>
                        <span
                          className={`truncate ${
                            sub.done
                              ? "line-through text-gray-400 dark:text-gray-500"
                              : "text-gray-800 dark:text-gray-200"
                          }`}
                        >
                          {sub.summary}
                        </span>
                      </button>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {!sub.readOnly && onUpdateSubtask && (
                        <select
                          aria-label={`Assignee for ${sub.key}`}
                          value={(sub.assignee ?? item.assignee).id}
                          onChange={(e) => {
                            const choices = [
                              UNASSIGNED_PERSON,
                              ...(people ?? PREVIEW_PEOPLE).filter(
                                (p) => p.id !== UNASSIGNED_PERSON.id,
                              ),
                            ];
                            const nextP = choices.find(
                              (p) => p.id === e.target.value,
                            );
                            if (nextP) {
                              onUpdateSubtask(item.id, sub.id, {
                                assignee: nextP,
                              });
                            }
                          }}
                          className="h-5 w-14 cursor-pointer border border-gray-200 bg-white px-0.5 text-[10px] text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                        >
                          {[
                            UNASSIGNED_PERSON,
                            ...(people ?? PREVIEW_PEOPLE).filter(
                              (p) => p.id !== UNASSIGNED_PERSON.id,
                            ),
                          ].map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.initials} • {p.name}
                            </option>
                          ))}
                        </select>
                      )}
                      {!sub.readOnly && onUpdateSubtask ? (
                        <select
                          aria-label={`Status for ${sub.key}`}
                          value={sub.status}
                          onChange={(e) =>
                            onUpdateSubtask(item.id, sub.id, {
                              status: e.target.value as WorkStatus,
                            })
                          }
                          className="h-5 cursor-pointer border border-gray-200 bg-white px-1 text-[10px] font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                        >
                          {WORK_STATUS_ORDER.map((st) => (
                            <option key={st} value={st}>
                              {t(`statuses.${st}`)}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-[10px] font-semibold text-gray-500">
                          {sub.status}
                        </span>
                      )}
                      {onCloneSubtask && (
                        <button
                          type="button"
                          onClick={() => onCloneSubtask(item.id, sub.id)}
                          title={`Clone ${sub.key}`}
                          aria-label={`Clone ${sub.key}`}
                          className="inline-flex h-5 w-5 cursor-pointer items-center justify-center text-gray-400 hover:text-gray-800 dark:hover:text-white"
                        >
                          <MonoIcon name="copy" size={10} />
                        </button>
                      )}
                      {!sub.readOnly && onConvertSubtaskToTask && (
                        <button
                          type="button"
                          onClick={() =>
                            onConvertSubtaskToTask(item.id, sub.id)
                          }
                          title={`Convert ${sub.key} to Task`}
                          aria-label={`Convert ${sub.key} to Task`}
                          className="inline-flex h-5 w-5 cursor-pointer items-center justify-center text-gray-400 hover:text-gray-800 dark:hover:text-white"
                        >
                          <MonoIcon name="arrowUpRight" size={10} />
                        </button>
                      )}
                      {!sub.readOnly && onDeleteSubtask && (
                        <button
                          type="button"
                          onClick={() => onDeleteSubtask(item.id, sub.id)}
                          title={`Delete ${sub.key}`}
                          aria-label={`Delete ${sub.key}`}
                          className="inline-flex h-5 w-5 cursor-pointer items-center justify-center text-gray-400 hover:text-gray-800 dark:hover:text-white"
                        >
                          <MonoIcon name="trash" size={10} />
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[11px] text-gray-400">No subtasks yet.</p>
            )}

            {onAddSubtask &&
              (addingCardSubtask ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const trimmed = cardSubtaskSummary.trim();
                    if (!trimmed) return;
                    onAddSubtask(item.id, trimmed);
                    setCardSubtaskSummary("");
                    setAddingCardSubtask(false);
                  }}
                  className="flex items-center gap-1 pt-1"
                >
                  <input
                    value={cardSubtaskSummary}
                    onChange={(e) => setCardSubtaskSummary(e.target.value)}
                    placeholder="Subtask summary…"
                    className="h-6 min-w-0 flex-1 border border-gray-300 bg-white px-2 text-[11px] text-gray-900 outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                  />
                  <button
                    type="submit"
                    className="h-6 cursor-pointer bg-gray-900 px-2 text-[10px] font-semibold text-white dark:bg-gray-100 dark:text-gray-900"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingCardSubtask(false);
                      setCardSubtaskSummary("");
                    }}
                    className="h-6 cursor-pointer px-1 text-[10px] text-gray-500"
                  >
                    ✕
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  onClick={() => setAddingCardSubtask(true)}
                  className="inline-flex cursor-pointer items-center gap-1 text-[11px] font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                >
                  <span>+</span>
                  <span>Add subtask</span>
                </button>
              ))}
          </div>
        )}
      </article>
    </li>
  );
}
