"use client";

import {
  Fragment,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useTranslations } from "next-intl";
import { Table } from "@/components/ui/table";
import { PlusIcon, SearchIcon } from "@/icons";
import {
  DEFAULT_WORK_LIST_COLUMNS,
  PREVIEW_PEOPLE,
} from "./work-preview-data";
import { WorkPriorityLabel, WorkStatusBadge } from "./WorkStatusBadge";
import {
  WORK_STATUS_ORDER,
  type WorkItem,
  type WorkItemGroup,
  type WorkItemType,
  type WorkListColumn,
  type WorkListColumnKey,
  type WorkPerson,
  type WorkPriority,
  type WorkStatus,
} from "./work-types";

const UNASSIGNED_PERSON: WorkPerson = {
  id: "unassigned",
  name: "Unassigned",
  initials: "👤",
};

const AUTOMATIC_PERSON: WorkPerson = {
  id: "automatic",
  name: "Automatic",
  initials: "⚙️",
};

export default function WorkListView({
  groups,
  totalCount,
  selectedIds,
  allVisibleSelected,
  showHierarchy = true,
  highlightHighPriority = false,
  highlightDoneRows = false,
  onToggleItem,
  onToggleAll,
  onOpenItem,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onToggleFlag,
  onDeleteItem,
  onToggleSubtask,
  onInlineCreate,
  onRefresh,
}: {
  groups: readonly WorkItemGroup[];
  totalCount?: number;
  selectedIds: ReadonlySet<string>;
  allVisibleSelected: boolean;
  showHierarchy?: boolean;
  highlightHighPriority?: boolean;
  highlightDoneRows?: boolean;
  onToggleItem: (id: string) => void;
  onToggleAll: () => void;
  onOpenItem: (
    item: WorkItemGroup["items"][number],
    trigger: HTMLButtonElement,
  ) => void;
  onStatusChange?: (id: string, status: WorkStatus) => void;
  onPriorityChange?: (id: string, priority: WorkPriority) => void;
  onAssigneeChange?: (id: string, assignee: WorkPerson) => void;
  onToggleFlag?: (id: string) => void;
  onDeleteItem?: (id: string) => void;
  onToggleSubtask?: (itemId: string, subtaskId: string) => void;
  onInlineCreate?: (title: string, type?: WorkItemType) => void;
  onRefresh?: () => void;
}) {
  const t = useTranslations("work");
  const [columns, setColumns] = useState<WorkListColumn[]>([
    ...DEFAULT_WORK_LIST_COLUMNS,
  ]);
  const [columnPopoverOpen, setColumnPopoverOpen] = useState(false);
  const [columnSearch, setColumnSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(["preview-142"]),
  );
  const [inlineCreating, setInlineCreating] = useState(false);
  const [inlineTitle, setInlineTitle] = useState("");
  const [inlineType, setInlineType] = useState<WorkItemType>("TASK");

  // Interactive cell popovers
  const [activeAssigneeRowId, setActiveAssigneeRowId] = useState<string | null>(
    null,
  );
  const [activeStatusRowId, setActiveStatusRowId] = useState<string | null>(
    null,
  );
  const [activePriorityRowId, setActivePriorityRowId] = useState<string | null>(
    null,
  );
  const [activeMenuRowId, setActiveMenuRowId] = useState<string | null>(null);
  const [toastNotice, setToastNotice] = useState<string>("");

  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(0);

  const visibleColumns = columns.filter((col) => col.visible);
  const allItems = groups.flatMap((group) => group.items);
  const expandableIds = allItems
    .filter((item) => (item.subtaskItems?.length ?? 0) > 0)
    .map((item) => item.id);
  const allExpanded =
    expandableIds.length > 0 &&
    expandableIds.every((id) => expandedIds.has(id));

  function showNotice(msg: string) {
    setToastNotice(msg);
    setTimeout(() => {
      setToastNotice((current) => (current === msg ? "" : current));
    }, 2800);
  }

  function closeAllCellPopovers() {
    setActiveAssigneeRowId(null);
    setActiveStatusRowId(null);
    setActivePriorityRowId(null);
    setActiveMenuRowId(null);
  }

  function toggleExpandRow(id: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleExpandAll() {
    setExpandedIds(allExpanded ? new Set() : new Set(expandableIds));
  }

  function toggleGroupCollapse(groupId: string) {
    setCollapsedGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function toggleColumnVisibility(key: WorkListColumnKey) {
    if (key === "work") return; // Work column is always visible in Jira
    setColumns((current) =>
      current.map((col) =>
        col.key === key ? { ...col, visible: !col.visible } : col,
      ),
    );
  }

  function startColumnResize(
    event: ReactMouseEvent<HTMLSpanElement>,
    colKey: WorkListColumnKey,
    currentWidth: number,
    minWidth: number,
  ) {
    event.preventDefault();
    event.stopPropagation();
    resizeStartXRef.current = event.clientX;
    resizeStartWidthRef.current = currentWidth;

    function handleMouseMove(moveEvent: MouseEvent) {
      const delta = moveEvent.clientX - resizeStartXRef.current;
      const nextWidth = Math.max(minWidth, resizeStartWidthRef.current + delta);
      setColumns((current) =>
        current.map((col) =>
          col.key === colKey ? { ...col, width: nextWidth } : col,
        ),
      );
    }

    function handleMouseUp() {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }

  function submitInlineCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = inlineTitle.trim();
    if (!trimmed || !onInlineCreate) return;
    onInlineCreate(trimmed, inlineType);
    setInlineTitle("");
    setInlineCreating(false);
    showNotice(`Created work item "${trimmed}"`);
  }

  const filteredConfigColumns = columns.filter((col) =>
    !columnSearch.trim()
      ? true
      : col.label.toLowerCase().includes(columnSearch.trim().toLowerCase()),
  );

  const totalColSpan = visibleColumns.length + 2; // Checkbox + visible columns + Config/More col

  return (
    <div className="relative min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
      {/* Column Manager Popover (+ button or [|||] button) */}
      {columnPopoverOpen && (
        <div
          role="dialog"
          aria-label="Configure columns"
          className="absolute end-3 top-11 z-40 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="relative mb-2.5">
            <SearchIcon
              aria-hidden="true"
              className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              value={columnSearch}
              onChange={(e) => setColumnSearch(e.target.value)}
              placeholder="Search columns"
              className="h-8 w-full rounded-lg border border-gray-200 bg-white ps-8 pe-2.5 text-xs text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
            />
          </div>
          <div className="max-h-60 space-y-1 overflow-y-auto pe-1">
            {filteredConfigColumns.map((col) => (
              <label
                key={col.key}
                className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <span className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={col.visible}
                    disabled={col.key === "work"}
                    onChange={() => toggleColumnVisibility(col.key)}
                    className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600"
                  />
                  <span>{col.label}</span>
                </span>
                <span className="text-[10px] text-gray-400">
                  {col.category}
                </span>
              </label>
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-gray-100 pt-2.5 text-[11px] text-gray-500 dark:border-gray-800 dark:text-gray-400">
            <button
              type="button"
              onClick={() => setColumnPopoverOpen(false)}
              className="cursor-pointer font-semibold text-brand-600 hover:underline dark:text-brand-400"
            >
              Done
            </button>
            <span>
              {visibleColumns.length} of {columns.length} columns
            </span>
          </div>
        </div>
      )}

      <div className="min-w-0 overflow-x-auto">
        <Table className="min-w-max border-collapse text-sm">
          <caption className="sr-only">{t("listCaption")}</caption>
          <thead className="border-b border-gray-200 bg-gray-50/90 dark:border-gray-800 dark:bg-gray-800/70">
            <tr>
              <th
                scope="col"
                className="w-10 border-e border-gray-200/70 px-3 py-2.5 text-start dark:border-gray-800"
              >
                <input
                  type="checkbox"
                  aria-label={t("selectAllVisible")}
                  checked={allVisibleSelected}
                  onChange={onToggleAll}
                  className="h-4 w-4 cursor-pointer rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-950"
                />
              </th>

              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={{
                    width: `${col.width}px`,
                    minWidth: `${col.minWidth}px`,
                  }}
                  className="group relative select-none border-e border-gray-200/70 px-3 py-2.5 text-start text-xs font-semibold text-gray-600 dark:border-gray-800 dark:text-gray-300"
                >
                  <div className="flex items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5">
                      {col.key === "work" &&
                        showHierarchy &&
                        expandableIds.length > 0 && (
                          <button
                            type="button"
                            onClick={toggleExpandAll}
                            title="Expand/Collapse all subtasks"
                            aria-label="Expand or collapse all subtasks"
                            className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-gray-500 transition hover:bg-gray-200 dark:hover:bg-gray-700"
                          >
                            {allExpanded ? "▾" : "▸"}
                          </button>
                        )}
                      <span>
                        {col.key === "work" ? t("workColumn") : col.label}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setColumnPopoverOpen((prev) => !prev)}
                      title="Add or configure column"
                      className="flex h-5 w-5 cursor-pointer items-center justify-center rounded text-xs font-bold text-gray-400 opacity-0 transition group-hover:opacity-100 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                    >
                      +
                    </button>
                  </div>

                  {/* Column Resize Handle (Jira Figure 1) */}
                  <span
                    role="separator"
                    aria-orientation="vertical"
                    title="Drag to resize column"
                    onMouseDown={(e) =>
                      startColumnResize(e, col.key, col.width, col.minWidth)
                    }
                    className="absolute end-0 top-0 h-full w-1.5 cursor-col-resize bg-transparent transition hover:bg-brand-500"
                  />
                </th>
              ))}

              {/* Rightmost Configure Columns Header [|||] (Jira Figure 4) */}
              <th
                scope="col"
                className="w-11 px-2 py-2.5 text-center text-xs font-semibold text-gray-500"
              >
                <button
                  type="button"
                  onClick={() => setColumnPopoverOpen((prev) => !prev)}
                  title="Configure columns"
                  aria-label="Configure columns"
                  className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border text-xs transition ${
                    columnPopoverOpen
                      ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300"
                      : "border-transparent text-gray-500 hover:border-gray-200 hover:bg-gray-100 dark:hover:border-gray-700 dark:hover:bg-gray-800"
                  }`}
                >
                  |||
                </button>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {groups.map((group) => {
              const isGroupCollapsed = collapsedGroups.has(group.id);
              return (
                <Fragment key={group.id}>
                  {group.label && (
                    <tr
                      key={`${group.id}-heading`}
                      onClick={() => toggleGroupCollapse(group.id)}
                      className="cursor-pointer bg-gray-50/90 transition hover:bg-gray-100/80 dark:bg-gray-800/50 dark:hover:bg-gray-800"
                    >
                      <th
                        colSpan={totalColSpan}
                        scope="rowgroup"
                        className="px-3.5 py-2 text-start text-xs font-semibold text-gray-700 dark:text-gray-300"
                      >
                        <span className="inline-flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="text-[10px] text-gray-500"
                          >
                            {isGroupCollapsed ? "▶" : "▼"}
                          </span>
                          <span className="uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {group.labelKind === "status"
                              ? `Status: ${t(`statuses.${group.label as WorkStatus}`)}`
                              : group.labelKind === "priority"
                                ? `Priority: ${t(`priorities.${group.label as WorkPriority}`)}`
                                : `Assignee: ${group.label}`}
                          </span>
                          <span className="rounded-full bg-gray-200/80 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            {group.items.length}
                          </span>
                        </span>
                      </th>
                    </tr>
                  )}

                  {!isGroupCollapsed &&
                    group.items.map((item) => {
                      const hasSubtasks = (item.subtaskItems?.length ?? 0) > 0;
                      const isExpanded =
                        showHierarchy && expandedIds.has(item.id);
                      const isDone = item.status === "DONE";
                      const isSelected = selectedIds.has(item.id);

                      const rowBgClass = item.flagged
                        ? "bg-warning-50/50 dark:bg-warning-500/10"
                        : isSelected
                          ? "bg-brand-50/40 dark:bg-brand-500/10"
                          : highlightHighPriority && item.priority === "HIGH"
                            ? "bg-error-50/35 dark:bg-error-500/5"
                            : highlightDoneRows && isDone
                              ? "bg-success-50/35 dark:bg-success-500/5"
                              : "hover:bg-gray-50/80 dark:hover:bg-gray-800/40";

                      return (
                        <Fragment key={item.id}>
                          <tr className={`transition-colors ${rowBgClass}`}>
                            {/* Checkbox cell */}
                            <td className="border-e border-gray-100 px-3 py-2.5 align-middle dark:border-gray-800/70">
                              <input
                                type="checkbox"
                                aria-label={t("selectWorkItem", {
                                  key: item.key,
                                })}
                                checked={isSelected}
                                onChange={() => onToggleItem(item.id)}
                                className="h-4 w-4 cursor-pointer rounded border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-950"
                              />
                            </td>

                            {/* Dynamic Spreadsheet Cells */}
                            {visibleColumns.map((col) => (
                              <td
                                key={col.key}
                                style={{
                                  width: `${col.width}px`,
                                  minWidth: `${col.minWidth}px`,
                                }}
                                className="border-e border-gray-100 px-3 py-2.5 align-middle dark:border-gray-800/70"
                              >
                                {renderCellContent({
                                  colKey: col.key,
                                  item,
                                  hasSubtasks,
                                  isExpanded,
                                  isDone,
                                  showHierarchy,
                                  activeAssigneeRowId,
                                  activeStatusRowId,
                                  activePriorityRowId,
                                  setActiveAssigneeRowId,
                                  setActiveStatusRowId,
                                  setActivePriorityRowId,
                                  closeAllCellPopovers,
                                  toggleExpandRow,
                                  onOpenItem,
                                  onStatusChange,
                                  onPriorityChange,
                                  onAssigneeChange,
                                  showNotice,
                                  t,
                                })}
                              </td>
                            ))}

                            {/* Rightmost Row Actions (···) — Jira Figure 1 */}
                            <td className="relative px-2 py-2.5 text-center align-middle">
                              <button
                                type="button"
                                onClick={() => {
                                  const next =
                                    activeMenuRowId === item.id
                                      ? null
                                      : item.id;
                                  closeAllCellPopovers();
                                  setActiveMenuRowId(next);
                                }}
                                aria-label={`More actions for ${item.key}`}
                                title="More actions"
                                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-xs font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-white"
                              >
                                ···
                              </button>

                              {activeMenuRowId === item.id && (
                                <div
                                  role="menu"
                                  className="absolute end-2 top-full z-40 mt-1 w-44 rounded-xl border border-gray-200 bg-white py-1.5 text-start shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      setActiveMenuRowId(null);
                                      onOpenItem(item, e.currentTarget);
                                    }}
                                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                  >
                                    <span aria-hidden="true">👁</span>
                                    <span>Open details</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuRowId(null);
                                      if (typeof navigator !== "undefined") {
                                        navigator.clipboard?.writeText(
                                          `${window.location.origin}${window.location.pathname}#${item.key}`,
                                        );
                                      }
                                      showNotice(
                                        `Copied issue link for ${item.key}`,
                                      );
                                    }}
                                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                  >
                                    <span aria-hidden="true">🔗</span>
                                    <span>Copy issue link</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuRowId(null);
                                      if (typeof navigator !== "undefined") {
                                        navigator.clipboard?.writeText(
                                          item.key,
                                        );
                                      }
                                      showNotice(
                                        `Copied issue key ${item.key}`,
                                      );
                                    }}
                                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                  >
                                    <span aria-hidden="true">📋</span>
                                    <span>Copy issue key</span>
                                  </button>
                                  <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuRowId(null);
                                      onToggleFlag?.(item.id);
                                      showNotice(
                                        item.flagged
                                          ? `Removed flag from ${item.key}`
                                          : `Added flag to ${item.key}`,
                                      );
                                    }}
                                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                  >
                                    <span aria-hidden="true">🚩</span>
                                    <span>
                                      {item.flagged
                                        ? "Remove flag"
                                        : "Add flag"}
                                    </span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuRowId(null);
                                      showNotice(`Logged 2h work on ${item.key}`);
                                    }}
                                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                  >
                                    <span aria-hidden="true">⏱</span>
                                    <span>Log work</span>
                                  </button>
                                  {onDeleteItem && (
                                    <>
                                      <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveMenuRowId(null);
                                          onDeleteItem(item.id);
                                          showNotice(`Deleted ${item.key}`);
                                        }}
                                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-xs font-medium text-error-600 hover:bg-error-50 dark:text-error-400 dark:hover:bg-error-500/10"
                                      >
                                        <span aria-hidden="true">🗑</span>
                                        <span>Delete</span>
                                      </button>
                                    </>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>

                          {/* Expanded Subtask Hierarchy Rows (`subtask-nested-row`) */}
                          {hasSubtasks &&
                            isExpanded &&
                            item.subtaskItems?.map((sub) => (
                              <tr
                                key={sub.id}
                                className="bg-gray-50/60 dark:bg-gray-950/40"
                              >
                                <td className="border-e border-gray-100 px-3 py-2 align-middle dark:border-gray-800/70">
                                  <input
                                    type="checkbox"
                                    checked={sub.done}
                                    onChange={() =>
                                      onToggleSubtask?.(item.id, sub.id)
                                    }
                                    aria-label={`Complete subtask ${sub.key}`}
                                    className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 text-brand-600"
                                  />
                                </td>
                                {visibleColumns.map((col) => (
                                  <td
                                    key={col.key}
                                    className="border-e border-gray-100 px-3 py-2 align-middle text-xs dark:border-gray-800/70"
                                  >
                                    {col.key === "work" ? (
                                      <div className="flex items-center gap-2 ps-5">
                                        <span
                                          aria-hidden="true"
                                          className="font-mono text-gray-400"
                                        >
                                          └
                                        </span>
                                        <span
                                          aria-hidden="true"
                                          className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-brand-300 bg-brand-50 text-[9px] font-bold text-brand-600 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300"
                                        >
                                          ✓
                                        </span>
                                        <span className="font-semibold text-brand-600 dark:text-brand-400">
                                          {sub.key}
                                        </span>
                                        <span
                                          className={
                                            sub.done
                                              ? "line-through text-gray-400 dark:text-gray-500"
                                              : "text-gray-800 dark:text-gray-200"
                                          }
                                        >
                                          {sub.summary}
                                        </span>
                                      </div>
                                    ) : col.key === "assignee" ? (
                                      <PersonLabel person={item.assignee} />
                                    ) : col.key === "status" ? (
                                      <WorkStatusBadge status={sub.status} />
                                    ) : col.key === "priority" ? (
                                      <WorkPriorityLabel
                                        priority={item.priority}
                                      />
                                    ) : col.key === "parent" ? (
                                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                                        {item.key}
                                      </span>
                                    ) : (
                                      <span className="text-gray-400">—</span>
                                    )}
                                  </td>
                                ))}
                                <td className="px-2 py-2 text-center text-[10px] text-gray-400">
                                  Sub
                                </td>
                              </tr>
                            ))}
                        </Fragment>
                      );
                    })}
                </Fragment>
              );
            })}

            {/* Inline Spreadsheet Quick Create Row (`inlineCreate.js`) */}
            {inlineCreating && onInlineCreate && (
              <tr className="bg-brand-50/30 dark:bg-brand-500/5">
                <td className="border-e border-gray-100 px-3 py-2.5 dark:border-gray-800" />
                <td colSpan={totalColSpan - 1} className="px-3 py-2">
                  <form
                    onSubmit={submitInlineCreate}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <select
                      aria-label="New work item type"
                      value={inlineType}
                      onChange={(e) =>
                        setInlineType(e.target.value as WorkItemType)
                      }
                      className="h-8 cursor-pointer rounded-lg border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                    >
                      <option value="TASK">☑ Task</option>
                      <option value="STORY">🔖 Story</option>
                      <option value="BUG">🐛 Bug</option>
                    </select>
                    <input
                      value={inlineTitle}
                      onChange={(event) => setInlineTitle(event.target.value)}
                      placeholder="What needs to be done? Press Enter to save..."
                      className="h-8 min-w-64 flex-1 rounded-lg border border-brand-300 bg-white px-3 text-xs text-gray-900 outline-none dark:border-brand-500 dark:bg-gray-950 dark:text-white"
                    />
                    <button
                      type="submit"
                      className="h-8 cursor-pointer rounded-lg bg-brand-500 px-3.5 text-xs font-semibold text-white hover:bg-brand-600"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInlineCreating(false);
                        setInlineTitle("");
                      }}
                      className="h-8 cursor-pointer rounded-lg px-2.5 text-xs font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-white"
                    >
                      ✕
                    </button>
                  </form>
                </td>
              </tr>
            )}
          </tbody>
        </Table>
      </div>

      {/* Jira Spreadsheet Sticky Footer (`table-footer`) */}
      <footer className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50/60 px-4 py-2.5 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {onInlineCreate && !inlineCreating && (
            <button
              type="button"
              onClick={() => setInlineCreating(true)}
              className="inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border border-transparent px-2 font-semibold text-gray-700 transition hover:border-gray-200 hover:bg-white hover:text-brand-600 dark:text-gray-200 dark:hover:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-brand-400"
            >
              <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Create</span>
            </button>
          )}
          <span className="hidden text-gray-400 md:inline">
            {t("createHint")}
          </span>
          {toastNotice && (
            <span
              role="status"
              className="rounded-md bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
            >
              {toastNotice}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-600 dark:text-gray-300">
            {allItems.length} of {totalCount ?? allItems.length}
          </span>
          <span className="text-gray-300 dark:text-gray-700">·</span>
          <span>
            {t("workItemCount", {
              count: allItems.length,
            })}
          </span>
          {onRefresh && (
            <button
              type="button"
              onClick={() => {
                onRefresh();
                showNotice("Refreshed work items");
              }}
              title="Refresh data"
              className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded text-gray-500 hover:bg-gray-200/70 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              ↻
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

function renderCellContent({
  colKey,
  item,
  hasSubtasks,
  isExpanded,
  isDone,
  showHierarchy,
  activeAssigneeRowId,
  activeStatusRowId,
  activePriorityRowId,
  setActiveAssigneeRowId,
  setActiveStatusRowId,
  setActivePriorityRowId,
  closeAllCellPopovers,
  toggleExpandRow,
  onOpenItem,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  showNotice,
  t,
}: {
  colKey: WorkListColumnKey;
  item: WorkItem;
  hasSubtasks: boolean;
  isExpanded: boolean;
  isDone: boolean;
  showHierarchy: boolean;
  activeAssigneeRowId: string | null;
  activeStatusRowId: string | null;
  activePriorityRowId: string | null;
  setActiveAssigneeRowId: (id: string | null) => void;
  setActiveStatusRowId: (id: string | null) => void;
  setActivePriorityRowId: (id: string | null) => void;
  closeAllCellPopovers: () => void;
  toggleExpandRow: (id: string) => void;
  onOpenItem: (item: WorkItem, trigger: HTMLButtonElement) => void;
  onStatusChange?: (id: string, status: WorkStatus) => void;
  onPriorityChange?: (id: string, priority: WorkPriority) => void;
  onAssigneeChange?: (id: string, assignee: WorkPerson) => void;
  showNotice: (msg: string) => void;
  t: ReturnType<typeof useTranslations<"work">>;
}) {
  if (colKey === "work") {
    const typeBadge =
      item.type === "BUG"
        ? {
            symbol: "🐛",
            cls: "border-error-200 bg-error-50 text-error-600 dark:border-error-500/30 dark:bg-error-500/15 dark:text-error-400",
          }
        : item.type === "STORY"
          ? {
              symbol: "🔖",
              cls: "border-success-200 bg-success-50 text-success-600 dark:border-success-500/30 dark:bg-success-500/15 dark:text-success-400",
            }
          : {
              symbol: "✓",
              cls: "border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-400",
            };

    return (
      <div className="flex min-w-0 items-center gap-2">
        {showHierarchy && hasSubtasks ? (
          <button
            type="button"
            onClick={() => toggleExpandRow(item.id)}
            aria-label={`Toggle subtasks for ${item.key}`}
            className="flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-xs text-gray-500 hover:bg-gray-200/70 dark:hover:bg-gray-800"
          >
            {isExpanded ? "▾" : "▸"}
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        <span
          aria-hidden="true"
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[10px] font-bold ${typeBadge.cls}`}
        >
          {typeBadge.symbol}
        </span>

        {/* Jira Single-Line Spreadsheet Key + Summary */}
        <button
          type="button"
          onClick={(event) => onOpenItem(item, event.currentTarget)}
          aria-label={t("openWorkItem", {
            key: item.key,
            title: item.title,
          })}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-start focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          <span
            className={`shrink-0 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400 ${
              isDone ? "line-through opacity-75" : ""
            }`}
          >
            {item.key}
          </span>
          <span
            className={`truncate text-sm font-medium text-gray-900 hover:text-brand-600 dark:text-white/90 dark:hover:text-brand-400 ${
              isDone ? "line-through opacity-70" : ""
            }`}
          >
            {item.title}
          </span>
        </button>

        {item.flagged && (
          <span
            title="Flagged"
            className="shrink-0 text-xs"
            aria-label="Flagged work item"
          >
            🚩
          </span>
        )}

        {item.subtasks.total > 0 && (
          <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            {item.subtasks.completed}/{item.subtasks.total}
          </span>
        )}
      </div>
    );
  }

  if (colKey === "assignee") {
    const isEditing = activeAssigneeRowId === item.id;
    const allAssigneeChoices = [
      UNASSIGNED_PERSON,
      AUTOMATIC_PERSON,
      ...PREVIEW_PEOPLE,
    ];
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            const next = isEditing ? null : item.id;
            closeAllCellPopovers();
            setActiveAssigneeRowId(next);
          }}
          title="Click to change assignee"
          className={`flex w-full cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-start transition ${
            isEditing
              ? "bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-500/15"
              : "hover:bg-gray-100/80 dark:hover:bg-gray-800"
          }`}
        >
          <PersonLabel person={item.assignee} />
        </button>

        {isEditing && onAssigneeChange && (
          <div
            role="listbox"
            aria-label={`Select assignee for ${item.key}`}
            className="absolute start-0 top-full z-40 mt-1 w-52 rounded-xl border border-gray-200 bg-white py-1.5 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
          >
            <div className="border-b border-gray-100 px-3 py-1.5 text-[11px] font-semibold text-gray-400 dark:border-gray-800">
              Assign {item.key}
            </div>
            <div className="max-h-52 overflow-y-auto py-1">
              {allAssigneeChoices.map((person) => {
                const selected = person.name === item.assignee.name;
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => {
                      onAssigneeChange(item.id, person);
                      setActiveAssigneeRowId(null);
                      showNotice(`Assigned ${item.key} to ${person.name}`);
                    }}
                    className={`flex w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-start text-xs transition ${
                      selected
                        ? "bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                        : "text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                      {person.initials}
                    </span>
                    <span className="truncate">{person.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (colKey === "reporter") {
    return <PersonLabel person={item.reporter} />;
  }

  if (colKey === "priority") {
    const isEditing = activePriorityRowId === item.id;
    const priorities: readonly WorkPriority[] = ["HIGH", "MEDIUM", "LOW"];
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            if (!onPriorityChange) return;
            const next = isEditing ? null : item.id;
            closeAllCellPopovers();
            setActivePriorityRowId(next);
          }}
          title="Click to change priority"
          className="cursor-pointer rounded-md px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <WorkPriorityLabel priority={item.priority} />
        </button>
        {isEditing && onPriorityChange && (
          <div className="absolute start-0 top-full z-40 mt-1 w-36 rounded-xl border border-gray-200 bg-white py-1 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900">
            {priorities.map((prio) => (
              <button
                key={prio}
                type="button"
                onClick={() => {
                  onPriorityChange(item.id, prio);
                  setActivePriorityRowId(null);
                  showNotice(`Updated ${item.key} priority to ${prio}`);
                }}
                className="flex w-full cursor-pointer items-center px-3 py-1.5 text-start text-xs hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <WorkPriorityLabel priority={prio} />
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (colKey === "status") {
    const isEditing = activeStatusRowId === item.id;
    return (
      <div className="relative flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            if (!onStatusChange) return;
            const next = isEditing ? null : item.id;
            closeAllCellPopovers();
            setActiveStatusRowId(next);
          }}
          title="Click to transition status"
          className="cursor-pointer"
        >
          <WorkStatusBadge status={item.status} />
        </button>

        {isEditing && onStatusChange && (
          <div className="absolute start-0 top-full z-40 mt-1 w-40 rounded-xl border border-gray-200 bg-white py-1.5 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900">
            {WORK_STATUS_ORDER.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => {
                  onStatusChange(item.id, st);
                  setActiveStatusRowId(null);
                  showNotice(
                    `Moved ${item.key} to ${t(`statuses.${st}`)}`,
                  );
                }}
                className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-start text-xs hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <WorkStatusBadge status={st} />
                {item.status === st && (
                  <span className="text-xs font-bold text-brand-600">✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (colKey === "resolution") {
    return (
      <span
        className={`whitespace-nowrap text-xs font-medium ${
          item.resolution === "RESOLVED"
            ? "text-success-700 dark:text-success-400"
            : "text-gray-500 dark:text-gray-400"
        }`}
      >
        {t(`resolutions.${item.resolution}`)}
      </span>
    );
  }

  if (colKey === "created") {
    return (
      <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
        {new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(item.createdAt))}
      </span>
    );
  }

  if (colKey === "updated") {
    const raw = item.updatedAt ?? item.createdAt;
    return (
      <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
        {new Intl.DateTimeFormat("en-US", {
          month: "short",
          day: "2-digit",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(raw))}
      </span>
    );
  }

  if (colKey === "due") {
    return (
      <span className="whitespace-nowrap text-xs text-gray-600 dark:text-gray-300">
        {item.dueDate ?? "None"}
      </span>
    );
  }

  if (colKey === "parent") {
    return item.parent ? (
      <span className="inline-flex items-center gap-1 rounded bg-purple-50 px-2 py-0.5 text-[11px] font-semibold text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
        ⚡ {item.parent.key}
      </span>
    ) : (
      <span className="text-xs text-gray-400">—</span>
    );
  }

  if (colKey === "progress") {
    const pct =
      item.subtasks.total > 0
        ? Math.round((item.subtasks.completed / item.subtasks.total) * 100)
        : item.status === "DONE"
          ? 100
          : item.status === "IN_PROGRESS"
            ? 50
            : 0;
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
          <div
            style={{ width: `${pct}%` }}
            className="h-full bg-success-500"
          />
        </div>
        <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
          {pct}%
        </span>
      </div>
    );
  }

  if (colKey === "labels") {
    return (
      <div className="flex flex-wrap gap-1">
        {(item.labels ?? ["core-mvp"]).map((lbl) => (
          <span
            key={lbl}
            className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            {lbl}
          </span>
        ))}
      </div>
    );
  }

  if (colKey === "storyPoints") {
    return (
      <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-gray-100 px-1.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
        {item.storyPoints ?? 3}
      </span>
    );
  }

  if (colKey === "comments") {
    const count = item.comments?.length ?? 0;
    return (
      <span className="text-xs text-gray-600 dark:text-gray-300">
        💬 {count}
      </span>
    );
  }

  if (colKey === "team") {
    return (
      <span className="text-xs text-gray-600 dark:text-gray-300">
        {item.team ?? "Core Engineering"}
      </span>
    );
  }

  return <span className="text-xs text-gray-400">—</span>;
}

function PersonLabel({
  person,
}: {
  person: { name: string; initials: string };
}) {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-xs font-medium text-gray-700 dark:text-gray-300">
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan-100 text-[10px] font-bold text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300"
      >
        {person.initials}
      </span>
      {person.name}
    </span>
  );
}
