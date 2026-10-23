"use client";

import { useMemo, useState } from"react";
import { ChevronLeftIcon, PlusIcon, SearchIcon } from"@/icons";
import { INITIAL_TIMELINE_EPICS, PREVIEW_PEOPLE } from"./work-preview-data";
import { MonoIcon, MonoIssueTypeIcon } from"./WorkMonoIcons";
import { WorkStatusBadge } from"./WorkStatusBadge";
import type {
  WorkItem,
  WorkPerson,
  WorkStatus,
  WorkTimelineBarColor,
  WorkTimelineEpic,
} from"./work-types";

type TimeScale ="weeks"|"months"|"quarters";

const BAR_COLOR_STYLES: Record<WorkTimelineBarColor, string> = {
  blue:"bg-brand-500 text-white border-brand-600",
  green:"bg-success-600 text-white border-success-700",
  purple:"bg-purple-600 text-white border-purple-700",
  orange:"bg-warning-500 text-white border-warning-600",
  red:"bg-error-600 text-white border-error-700",
};

export default function WorkTimelineView({
  items,
  people,
  onOpenItem,
  onCreate,
}: {
  items: readonly WorkItem[];
  people?: readonly WorkPerson[];
  onOpenItem: (item: WorkItem, trigger: HTMLButtonElement) => void;
  onCreate: () => void;
}) {
  const [epics, setEpics] = useState<WorkTimelineEpic[]>([
    ...INITIAL_TIMELINE_EPICS,
  ]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("ALL");
  const [sortAsc, setSortAsc] = useState(true);
  const [timeScale, setTimeScale] = useState<TimeScale>("months");
  const [offset, setOffset] = useState(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editStart, setEditStart] = useState("");
  const [editDue, setEditDue] = useState("");
  const [editColor, setEditColor] = useState<WorkTimelineBarColor>("green");
  const [dateError, setDateError] = useState("");
  const [viewSettingsOpen, setViewSettingsOpen] = useState(false);
  const [showSprintsRow, setShowSprintsRow] = useState(true);
  const [showEpicProgressBar, setShowEpicProgressBar] = useState(true);
  const [hideDoneSubtasks, setHideDoneSubtasks] = useState(false);

  const timelineHeaders = useMemo(() => {
    if (timeScale ==="weeks") {
      const baseWeek = 40 + offset;
      return Array.from({ length: 6 }, (_, idx) => {
        const weekNum = baseWeek + idx;
        return {
          label: `Week ${weekNum}`,
          current: weekNum === 43,
        };
      });
    }
    if (timeScale ==="quarters") {
      const quarters = ["Q3 2026","Q4 2026","Q1 2027","Q2 2027"];
      return quarters.map((label, idx) => ({
        label,
        current: idx === 1,
      }));
    }
    const monthsList = [
      "Aug 2026",
      "Sep 2026",
      "Oct 2026",
      "Nov 2026",
      "Dec 2026",
      "Jan 2027",
      "Feb 2027",
      "Mar 2027",
    ];
    const startIdx = Math.max(
      0,
      Math.min(monthsList.length - 6, 1 + offset),
    );
    return Array.from({ length: 6 }, (_, idx) => {
      const label = monthsList[startIdx + idx] ?? `Month ${idx + 1}`;
      return {
        label,
        current: label.includes("Oct 2026"),
      };
    });
  }, [offset, timeScale]);

  const mergedEpics = useMemo(() => {
    const existingKeys = new Set<string>();
    for (const ep of epics) {
      existingKeys.add(ep.key);
      for (const sub of ep.subtasks) {
        existingKeys.add(sub.key);
      }
    }
    const dynamicEpics: WorkTimelineEpic[] = items
      .filter((item) => !existingKeys.has(item.key))
      .map((item, idx) => {
        const startRaw = item.startDate ?? item.createdAt.slice(0, 10);
        const dueRaw = item.dueDate ?? startRaw;
        const subList = item.subtaskItems ?? [];
        const subTotal = subList.length;
        const subDonePct =
          subTotal > 0
            ? Math.round(
                (subList.filter((s) => s.done || s.status === "DONE").length /
                  subTotal) *
                  100,
              )
            : item.status === "DONE"
              ? 100
              : 0;
        const subInProgPct =
          subTotal > 0
            ? Math.round(
                (subList.filter(
                  (s) => !s.done && s.status !== "DONE" && s.status !== "TODO",
                ).length /
                  subTotal) *
                  100,
              )
            : item.status === "IN_PROGRESS" || item.status === "IN_REVIEW"
              ? 50
              : 0;
        const subTodoPct = Math.max(0, 100 - subDonePct - subInProgPct);
        return {
          key: item.key,
          summary: item.title,
          status: item.status,
          assignee: item.assignee,
          progress: {
            done: subDonePct,
            inprog: subInProgPct,
            todo: subTodoPct,
          },
          startLabel: formatShortDate(startRaw) || "Oct 20",
          endLabel: formatShortDate(dueRaw) || "Nov 15",
          startDateRaw: startRaw,
          dueDateRaw: dueRaw,
          barLeft: 18 + (idx % 4) * 8,
          barWidth: 34,
          barColor: item.status === "DONE" ? "green" : "blue",
          expanded: true,
          subtasks: (item.subtaskItems ?? []).map((sub, sIdx) => {
            const subStart = sub.startDate ?? startRaw;
            const subDue = sub.dueDate ?? dueRaw;
            return {
              key: sub.key,
              summary: sub.summary,
              status: sub.status,
              assignee: sub.assignee ?? item.assignee,
              startLabel: formatShortDate(subStart) || "Oct 22",
              endLabel: formatShortDate(subDue) || "Nov 10",
              startDateRaw: subStart,
              dueDateRaw: subDue,
              barLeft: 22 + (sIdx % 4) * 6,
              barWidth: 26,
              barColor: sub.done ? "green" : "purple",
            };
          }),
        };
      });
    return dynamicEpics.length > 0 &&
      !items.some((i) => i.key.startsWith("KNW-"))
      ? dynamicEpics
      : [...dynamicEpics, ...epics];
  }, [epics, items]);

  const filteredEpics = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const list = mergedEpics.filter((epic) => {
      if (selectedAssignee !=="ALL") {
        const matchesEpic =
          epic.assignee.initials === selectedAssignee ||
          epic.assignee.name === selectedAssignee;
        const matchesSub = epic.subtasks.some(
          (sub) =>
            sub.assignee.initials === selectedAssignee ||
            sub.assignee.name === selectedAssignee,
        );
        if (!matchesEpic && !matchesSub) return false;
      }
      if (query) {
        const matchesEpic =
          epic.key.toLowerCase().includes(query) ||
          epic.summary.toLowerCase().includes(query);
        const matchesSub = epic.subtasks.some(
          (sub) =>
            sub.key.toLowerCase().includes(query) ||
            sub.summary.toLowerCase().includes(query),
        );
        if (!matchesEpic && !matchesSub) return false;
      }
      return true;
    });

    return [...list].sort((left, right) => {
      const leftName = left.assignee.name;
      const rightName = right.assignee.name;
      return sortAsc
        ? leftName.localeCompare(rightName)
        : rightName.localeCompare(leftName);
    });
  }, [mergedEpics, searchTerm, selectedAssignee, sortAsc]);

  function toggleEpic(epicKey: string) {
    setEpics((current) =>
      current.map((epic) =>
        epic.key === epicKey ? { ...epic, expanded: !epic.expanded } : epic,
      ),
    );
  }

  function toggleExpandAll() {
    const anyCollapsed = epics.some(
      (epic) => epic.subtasks.length > 0 && !epic.expanded,
    );
    setEpics((current) =>
      current.map((epic) =>
        epic.subtasks.length > 0 ? { ...epic, expanded: anyCollapsed } : epic,
      ),
    );
  }

  function cycleSubtaskStatus(epicKey: string, subtaskKey: string) {
    const nextOrder: Record<WorkStatus, WorkStatus> = {
      TODO:"IN_PROGRESS",
      IN_PROGRESS:"IN_REVIEW",
      IN_REVIEW:"DONE",
      DONE:"TODO",
    };
    setEpics((current) =>
      current.map((epic) =>
        epic.key !== epicKey
          ? epic
          : {
              ...epic,
              subtasks: epic.subtasks.map((sub) =>
                sub.key === subtaskKey
                  ? { ...sub, status: nextOrder[sub.status] }
                  : sub,
              ),
            },
      ),
    );
  }

  function openBarEditor(
    key: string,
    startDateRaw: string,
    dueDateRaw: string,
    barColor: WorkTimelineBarColor,
  ) {
    setEditingKey(key);
    setEditStart(startDateRaw);
    setEditDue(dueDateRaw);
    setEditColor(barColor);
    setDateError("");
  }

  function saveBarChanges() {
    if (!editingKey) return;
    if (editStart && editDue && editStart > editDue) {
      setDateError("Start date cannot be after due date.");
      return;
    }
    const startLabel = formatShortDate(editStart);
    const endLabel = formatShortDate(editDue);
    setEpics((current) =>
      current.map((epic) => {
        if (epic.key === editingKey) {
          return {
            ...epic,
            startDateRaw: editStart,
            dueDateRaw: editDue,
            startLabel: startLabel || epic.startLabel,
            endLabel: endLabel || epic.endLabel,
            barColor: editColor,
          };
        }
        return {
          ...epic,
          subtasks: epic.subtasks.map((sub) =>
            sub.key === editingKey
              ? {
                  ...sub,
                  startDateRaw: editStart,
                  dueDateRaw: editDue,
                  startLabel: startLabel || sub.startLabel,
                  endLabel: endLabel || sub.endLabel,
                  barColor: editColor,
                }
              : sub,
          ),
        };
      }),
    );
    setEditingKey(null);
  }

  function computeBarPosition(barLeft: number, barWidth: number) {
    if (timeScale ==="weeks") {
      return {
        left: `${Math.min(78, Math.max(4, barLeft * 1.3 - offset * 8))}%`,
        width: `${Math.min(70, Math.max(12, barWidth * 1.15))}%`,
      };
    }
    if (timeScale ==="quarters") {
      return {
        left: `${Math.min(80, Math.max(4, barLeft * 0.75 - offset * 6))}%`,
        width: `${Math.min(65, Math.max(10, barWidth * 0.8))}%`,
      };
    }
    return {
      left: `${Math.min(78, Math.max(4, barLeft - offset * 10))}%`,
      width: `${Math.min(70, Math.max(12, barWidth))}%`,
    };
  }

  const todayMarkerLeft =
    timeScale ==="weeks"?"52%": timeScale ==="quarters"?"38%":"30%";

  return (
    <section
      aria-label="Timeline roadmap"
      className="min-w-0 space-y-4"
    >
      {/* Timeline Top Bar */}
      <div className="flex flex-col gap-3 border border-gray-200 bg-white p-3.5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="relative min-w-52 flex-1 sm:flex-initial">
            <span className="sr-only">Search timeline</span>
            <SearchIcon
              aria-hidden="true"
              width={16}
              height={16}
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search timeline epics & tasks…"
              className="h-9 w-full border border-gray-200 bg-white ps-9 pe-3 text-xs text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
            />
          </label>

          <div
            className="flex items-center gap-1"
            role="group"
            aria-label="Filter timeline by assignee"
          >
            <button
              type="button"
              onClick={() => setSelectedAssignee("ALL")}
              aria-pressed={selectedAssignee ==="ALL"}
              className={`h-8 cursor-pointer border px-2.5 text-xs font-semibold transition ${
                selectedAssignee ==="ALL"
                  ?"border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                  :"border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
              }`}
            >
              All
            </button>
            {(people ?? PREVIEW_PEOPLE).map((person) => {
              const active = selectedAssignee === person.initials;
              return (
                <button
                  key={person.id}
                  type="button"
                  title={person.name}
                  aria-pressed={active}
                  onClick={() =>
                    setSelectedAssignee(active ?"ALL": person.initials)
                  }
                  className={`flex h-8 w-8 cursor-pointer items-center justify-center border-2 text-[10px] font-semibold text-white transition ${
                    active
                      ?"border-gray-900 ring-2 ring-brand-500 dark:border-white"
                      :"border-white dark:border-gray-900"
                  } bg-brand-600`}
                >
                  {person.initials}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOffset((prev) => prev - 1)}
              aria-label="Previous time range"
              className="flex h-8 w-8 cursor-pointer items-center justify-center border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >
              <ChevronLeftIcon className="h-4 w-4"aria-hidden="true"/>
            </button>
            <button
              type="button"
              onClick={() => setOffset((prev) => prev + 1)}
              aria-label="Next time range"
              className="flex h-8 w-8 cursor-pointer items-center justify-center border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >
              <ChevronLeftIcon
                className="h-4 w-4 rotate-180"
                aria-hidden="true"
              />
            </button>
          </div>

          <div
            className="inline-flex border border-gray-200 bg-gray-50 p-0.5 dark:border-gray-800 dark:bg-gray-950"
            role="group"
            aria-label="Timeline zoom scale"
          >
            <button
              type="button"
              onClick={() => {
                setTimeScale("months");
                setOffset(0);
              }}
              className="cursor-pointer px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              Today
            </button>
            {(["weeks","months","quarters"] as const).map((scale) => (
              <button
                key={scale}
                type="button"
                aria-pressed={timeScale === scale}
                onClick={() => {
                  setTimeScale(scale);
                  setOffset(0);
                }}
                className={`cursor-pointer px-2.5 py-1 text-xs font-medium capitalize transition ${
                  timeScale === scale
                    ?"bg-white text-brand-600 shadow-theme-xs dark:bg-gray-800 dark:text-brand-400"
                    :"text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
                }`}
              >
                {scale}
              </button>
            ))}
          </div>

          <div className="relative">
            <button
              type="button"
              aria-expanded={viewSettingsOpen}
              onClick={() => setViewSettingsOpen((prev) => !prev)}
              className="inline-flex h-8 cursor-pointer items-center gap-1.5 border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >
              <MonoIcon name="sliders"size={13} />
              <span>View settings</span>
            </button>

            {viewSettingsOpen && (
              <div
                role="dialog"
                aria-label="Timeline view settings"
                className="absolute end-0 top-full z-30 mt-2 w-64 border border-gray-200 bg-white p-3.5 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
              >
                <p className="mb-2 text-xs font-semibold text-gray-900 dark:text-white">
                  Timeline display options
                </p>
                <div className="space-y-2 text-xs">
                  <label className="flex cursor-pointer items-center justify-between text-gray-700 dark:text-gray-300">
                    <span>Show Sprints row</span>
                    <input
                      type="checkbox"
                      checked={showSprintsRow}
                      onChange={(e) => setShowSprintsRow(e.target.checked)}
                      className="h-4 w-4 border-gray-300 text-brand-600"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between text-gray-700 dark:text-gray-300">
                    <span>Epic status progress bar</span>
                    <input
                      type="checkbox"
                      checked={showEpicProgressBar}
                      onChange={(e) => setShowEpicProgressBar(e.target.checked)}
                      className="h-4 w-4 border-gray-300 text-brand-600"
                    />
                  </label>
                  <label className="flex cursor-pointer items-center justify-between text-gray-700 dark:text-gray-300">
                    <span>Hide done subtasks</span>
                    <input
                      type="checkbox"
                      checked={hideDoneSubtasks}
                      onChange={(e) => setHideDoneSubtasks(e.target.checked)}
                      className="h-4 w-4 border-gray-300 text-brand-600"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Inline Bar Editor Banner if active */}
      {editingKey && (
        <div
          role="dialog"
          aria-label={`Schedule editor for ${editingKey}`}
          className="flex flex-wrap items-end justify-between gap-4 border border-brand-200 bg-brand-50/60 p-4 dark:border-brand-500/30 dark:bg-brand-500/10"
        >
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <span className="block text-xs font-semibold text-brand-700 dark:text-brand-300">
                Editing schedule: {editingKey}
              </span>
              {dateError && (
                <span className="mt-0.5 block text-xs text-error-600 dark:text-error-400">
                  {dateError}
                </span>
              )}
            </div>
            <label className="grid gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
              Start date
              <input
                type="date"
                value={editStart}
                onChange={(event) => {
                  setEditStart(event.target.value);
                  setDateError("");
                }}
                className="h-8 border border-gray-200 bg-white px-2.5 text-xs dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
            <label className="grid gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
              Due date
              <input
                type="date"
                value={editDue}
                onChange={(event) => {
                  setEditDue(event.target.value);
                  setDateError("");
                }}
                className="h-8 border border-gray-200 bg-white px-2.5 text-xs dark:border-gray-700 dark:bg-gray-900"
              />
            </label>
            <div className="grid gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">
              <span>Bar color</span>
              <div className="flex items-center gap-1.5">
                {(
                  ["blue","green","purple","orange","red"] as const
                ).map((color) => (
                  <button
                    key={color}
                    type="button"
                    aria-label={`Color ${color}`}
                    onClick={() => setEditColor(color)}
                    className={`h-6 w-6 cursor-pointer border-2 ${
                      BAR_COLOR_STYLES[color]
                    } ${
                      editColor === color
                        ?"ring-2 ring-gray-900 dark:ring-white"
                        :"opacity-75"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setEditingKey(null)}
              className="h-8 cursor-pointer border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={saveBarChanges}
              className="h-8 cursor-pointer bg-brand-500 px-3 text-xs font-semibold text-white hover:bg-brand-600"
            >
              Save schedule
            </button>
          </div>
        </div>
      )}

      {/* Split Gantt Layout */}
      <div className="overflow-hidden rounded-md border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
        <div className="grid min-w-0 lg:grid-cols-[22rem_minmax(0,1fr)]">
          {/* Left Hierarchical Epic Tree */}
          <div className="border-b border-gray-200 lg:border-b-0 lg:border-e dark:border-gray-800">
            <div className="grid grid-cols-[minmax(0,1fr)_6.5rem_5.5rem] items-center gap-2 border-b border-gray-200 bg-gray-50 px-3 py-2.5 text-xs font-semibold text-gray-600 dark:border-gray-800 dark:bg-gray-800/70 dark:text-gray-300">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={toggleExpandAll}
                  title="Expand or collapse all epics"
                  className="flex h-5 w-5 cursor-pointer items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  ▾
                </button>
                <span>Epic / Work item</span>
              </div>
              <span>Status</span>
              <button
                type="button"
                onClick={() => setSortAsc((prev) => !prev)}
                className="cursor-pointer text-start hover:text-brand-600 dark:hover:text-brand-400"
              >
                Assignee {sortAsc ?"↑":"↓"}
              </button>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {/* Jira Cloud Top Sprints Row (`35-timeline-with-epic-and-children.png`) */}
              {showSprintsRow && (
                <div className="grid min-h-10 grid-cols-[minmax(0,1fr)_6.5rem_5.5rem] items-center gap-2 bg-gray-50/90 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:bg-gray-800/60 dark:text-gray-200">
                  <div className="flex items-center gap-2">
                    <MonoIcon name="sync"size={13} className="text-gray-600 dark:text-gray-300"/>
                    <span>Sprints</span>
                  </div>
                  <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
                    Active
                  </span>
                  <span className="text-[11px] text-gray-400">Sprint 1</span>
                </div>
              )}

              {filteredEpics.map((epic) => {
                const totalSub = Math.max(1, epic.subtasks.length);
                const doneSub = epic.subtasks.filter(
                  (s) => s.status ==="DONE",
                ).length;
                const inProgSub = epic.subtasks.filter(
                  (s) =>
                    s.status ==="IN_PROGRESS"|| s.status ==="IN_REVIEW",
                ).length;
                const donePct = Math.round((doneSub / totalSub) * 100);
                const inProgPct = Math.round((inProgSub / totalSub) * 100);

                return (
                  <div key={epic.key}>
                    {/* Epic Row */}
                    <div className="grid min-h-12 grid-cols-[minmax(0,1fr)_6.5rem_5.5rem] items-center gap-2 px-3 py-2 hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                      <div className="flex min-w-0 items-center gap-2">
                        {epic.subtasks.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => toggleEpic(epic.key)}
                            aria-label={`Toggle ${epic.key}`}
                            className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            {epic.expanded ?"▾":"▸"}
                          </button>
                        ) : (
                          <span className="w-5 shrink-0"/>
                        )}
                        <span
                          aria-hidden="true"
                          className="flex h-5 w-5 shrink-0 items-center justify-center border border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                        >
                          <MonoIssueTypeIcon type="EPIC"size={12} />
                        </span>
                        <div className="min-w-0">
                          <span className="block truncate text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {epic.key}
                          </span>
                          <span className="block truncate text-xs font-medium text-gray-900 dark:text-white/90">
                            {epic.summary}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {showEpicProgressBar && epic.subtasks.length > 0 ? (
                          <div
                            title={`${donePct}% Done, ${inProgPct}% In Progress`}
                            className="space-y-1"
                          >
                            <div className="flex h-2 w-20 overflow-hidden bg-gray-200 dark:bg-gray-700">
                              <div
                                style={{ width: `${donePct}%` }}
                                className="bg-success-500"
                              />
                              <div
                                style={{ width: `${inProgPct}%` }}
                                className="bg-brand-500"
                              />
                            </div>
                            <span className="block text-[10px] font-semibold text-gray-500 dark:text-gray-400">
                              {doneSub}/{epic.subtasks.length} Done
                            </span>
                          </div>
                        ) : (
                          <WorkStatusBadge status={epic.status} />
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 truncate text-xs text-gray-700 dark:text-gray-300">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-brand-100 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                          {epic.assignee.initials}
                        </span>
                        <span className="truncate">{epic.assignee.name}</span>
                      </div>
                    </div>

                    {/* Child Subtask Rows */}
                    {epic.expanded &&
                      epic.subtasks
                        .filter((sub) =>
                          hideDoneSubtasks ? sub.status !=="DONE": true,
                        )
                        .map((sub) => {
                          const matchingWorkItem = items.find(
                            (item) => item.key === sub.key,
                          );
                          return (
                            <div
                              key={sub.key}
                              className="grid min-h-11 grid-cols-[minmax(0,1fr)_6.5rem_5.5rem] items-center gap-2 bg-gray-50/40 ps-9 pe-3 py-1.5 hover:bg-gray-50 dark:bg-gray-950/30 dark:hover:bg-gray-800/40"
                            >
                              <div className="flex min-w-0 items-center gap-2">
                                <span
                                  aria-hidden="true"
                                  className="flex h-4 w-4 shrink-0 items-center justify-center border border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                >
                                  <MonoIssueTypeIcon type="TASK"size={11} />
                                </span>
                                {matchingWorkItem ? (
                                  <button
                                    type="button"
                                    onClick={(event) =>
                                      onOpenItem(
                                        matchingWorkItem,
                                        event.currentTarget,
                                      )
                                    }
                                    className="min-w-0 cursor-pointer text-start hover:text-brand-600 dark:hover:text-brand-400"
                                  >
                                    <span className="block truncate text-xs font-semibold text-brand-600 dark:text-brand-400">
                                      {sub.key}
                                    </span>
                                    <span className="block truncate text-xs text-gray-700 dark:text-gray-300">
                                      {sub.summary}
                                    </span>
                                  </button>
                                ) : (
                                  <div className="min-w-0">
                                    <span className="block truncate text-xs font-semibold text-brand-600 dark:text-brand-400">
                                      {sub.key}
                                    </span>
                                    <span className="block truncate text-xs text-gray-700 dark:text-gray-300">
                                      {sub.summary}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    cycleSubtaskStatus(epic.key, sub.key)
                                  }
                                  title="Click to cycle status"
                                  className="cursor-pointer"
                                >
                                  <WorkStatusBadge status={sub.status} />
                                </button>
                              </div>
                              <div className="flex items-center gap-1.5 truncate text-xs text-gray-600 dark:text-gray-400">
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-cyan-100 text-[10px] font-semibold text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300">
                                  {sub.assignee.initials}
                                </span>
                                <span className="truncate">
                                  {sub.assignee.name}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between border-t border-gray-200 px-3 py-2.5 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
              <button
                type="button"
                onClick={onCreate}
                className="inline-flex cursor-pointer items-center gap-1.5 font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
              >
                <PlusIcon className="h-3.5 w-3.5"aria-hidden="true"/>
                Create Epic / Work item
              </button>
              <span>{filteredEpics.length} epics</span>
            </div>
          </div>

          {/* Right Gantt Chart Area */}
          <div className="min-w-0 overflow-x-auto">
            <div className="min-w-[36rem]">
              {/* Timeline Period Headers */}
              <div
                className="grid border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/70"
                style={{
                  gridTemplateColumns: `repeat(${timelineHeaders.length}, minmax(0, 1fr))`,
                }}
              >
                {timelineHeaders.map((col) => (
                  <div
                    key={col.label}
                    className={`border-e border-gray-200 px-3 py-2.5 text-center text-xs font-semibold last:border-e-0 dark:border-gray-800 ${
                      col.current
                        ?"bg-brand-50/70 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                        :"text-gray-600 dark:text-gray-400"
                    }`}
                  >
                    {col.label}
                    {col.current ?"(Current)":""}
                  </div>
                ))}
              </div>

              {/* Gantt Rows Canvas */}
              <div className="relative divide-y divide-gray-100 dark:divide-gray-800">
                {/* Today Vertical Marker */}
                <div
                  aria-hidden="true"
                  style={{ left: todayMarkerLeft }}
                  className="pointer-events-none absolute inset-y-0 z-10 w-0.5 bg-error-500"
                >
                  <span className="absolute -top-0.5 -translate-x-1/2 bg-error-500 px-1.5 py-0.5 text-[9px] font-bold text-white">
                    TODAY
                  </span>
                </div>

                {/* Top Sprint Gantt Bar Row */}
                {showSprintsRow && (
                  <div className="relative flex min-h-10 items-center bg-gray-50/90 px-2 py-1.5 dark:bg-gray-800/60">
                    <div
                      style={{ left:"24%", width:"36%"}}
                      className="relative z-1 flex h-6 items-center justify-between border border-gray-300 bg-gray-100 px-2.5 text-[11px] font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    >
                      <span className="inline-flex items-center gap-1.5 truncate">
                        <MonoIcon name="sync"size={12} />
                        <span>SCRUM Sprint 1 (Oct 15 – Oct 29)</span>
                      </span>
                    </div>
                  </div>
                )}

                {filteredEpics.map((epic) => {
                  const epicPos = computeBarPosition(
                    epic.barLeft,
                    epic.barWidth,
                  );
                  return (
                    <div key={epic.key}>
                      <div className="relative flex min-h-12 items-center px-2 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            openBarEditor(
                              epic.key,
                              epic.startDateRaw,
                              epic.dueDateRaw,
                              epic.barColor,
                            )
                          }
                          style={epicPos}
                          className={`relative z-1 flex h-7 cursor-pointer items-center justify-between border px-2.5 text-[11px] font-semibold shadow-theme-xs transition hover:brightness-105 ${
                            BAR_COLOR_STYLES[epic.barColor]
                          }`}
                        >
                          <span className="truncate">
                            {epic.startLabel} – {epic.endLabel}
                          </span>
                          <span className="ms-1.5 opacity-80">✎</span>
                        </button>
                      </div>

                      {epic.expanded &&
                        epic.subtasks.map((sub) => {
                          const subPos = computeBarPosition(
                            sub.barLeft,
                            sub.barWidth,
                          );
                          const matchingWorkItem = items.find(
                            (item) => item.key === sub.key,
                          );
                          return (
                            <div
                              key={sub.key}
                              className="relative flex min-h-11 items-center bg-gray-50/40 px-2 py-1.5 dark:bg-gray-950/30"
                            >
                              <button
                                type="button"
                                onClick={(event) => {
                                  if (matchingWorkItem) {
                                    onOpenItem(
                                      matchingWorkItem,
                                      event.currentTarget,
                                    );
                                  } else {
                                    openBarEditor(
                                      sub.key,
                                      sub.startDateRaw,
                                      sub.dueDateRaw,
                                      sub.barColor,
                                    );
                                  }
                                }}
                                style={subPos}
                                className={`relative z-1 flex h-6 cursor-pointer items-center justify-between rounded border px-2 text-[11px] font-medium shadow-theme-xs transition hover:brightness-105 ${
                                  BAR_COLOR_STYLES[sub.barColor]
                                }`}
                              >
                                <span className="truncate">
                                  {sub.startLabel} – {sub.endLabel}
                                </span>
                                <span
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openBarEditor(
                                      sub.key,
                                      sub.startDateRaw,
                                      sub.dueDateRaw,
                                      sub.barColor,
                                    );
                                  }}
                                  title="Edit schedule dates"
                                  className="ms-1.5 rounded px-0.5 opacity-80 hover:bg-black/15"
                                >
                                  ✎
                                </span>
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>

              {/* Jira Bottom Floating Zoom Widget Pill */}
              <div className="flex items-center justify-end border-t border-gray-100 bg-gray-50/60 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-950/40">
                <div className="inline-flex items-center gap-1 border border-gray-200 bg-white px-2 py-1 shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
                  <button
                    type="button"
                    onClick={() => {
                      setTimeScale("months");
                      setOffset(0);
                    }}
                    className="cursor-pointer px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    Today
                  </button>
                  <span className="h-3.5 w-px bg-gray-200 dark:bg-gray-700"/>
                  {(["weeks","months","quarters"] as const).map((scale) => (
                    <button
                      key={`floating-${scale}`}
                      type="button"
                      onClick={() => {
                        setTimeScale(scale);
                        setOffset(0);
                      }}
                      className={`cursor-pointer px-2.5 py-1 text-xs font-semibold capitalize transition ${
                        timeScale === scale
                          ?"bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"
                          :"text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
                      }`}
                    >
                      {scale}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function formatShortDate(isoStr: string): string {
  if (!isoStr) return"";
  const parts = isoStr.split("-");
  if (parts.length < 3) return isoStr;
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthIdx = Number.parseInt(parts[1], 10) - 1;
  return `${parts[2]} ${months[monthIdx] ?? parts[1]}`;
}
