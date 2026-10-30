"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useTranslations } from"next-intl";

import { Table } from"@/components/ui/table";
import { PlusIcon, SearchIcon } from"@/icons";
import {
  DEFAULT_WORK_LIST_COLUMNS,
  PREVIEW_PEOPLE,
} from"./work-preview-data";
import { MonoIcon, MonoIssueTypeIcon } from"./WorkMonoIcons";
import { WorkDatePickerCell } from "./WorkDatePicker";
import { WorkPriorityLabel, WorkStatusBadge } from"./WorkStatusBadge";
import {
  WORK_STATUS_ORDER,
  type WorkGroupBy,
  type WorkItem,
  type WorkItemGroup,
  type WorkItemType,
  type WorkListColumn,
  type WorkListColumnKey,
  type WorkPerson,
  type WorkPriority,
  type WorkStatus,
  type WorkSubtaskItem,
} from "./work-types";

const UNASSIGNED_PERSON: WorkPerson = {
  id: "unassigned",
  name: "Unassigned",
  initials: "UN",
};

function createdAtTimestamp(value?: string): number {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export default function WorkListView({
  groups,
  allItems: allWorkspaceItems,
  people,
  currentUserPerson,
  totalCount,
  selectedIds,
  allVisibleSelected,
  groupBy = "NONE",
  onGroupByChange,
  showHierarchy = true,
  highlightHighPriority = false,
  highlightDoneRows = false,
  onToggleItem,
  onToggleAll,
  onOpenItem,
  onOpenSubtask,
  onOpenFullPage,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onDueDateChange,
  onToggleFlag,
  onDeleteItem,
  onToggleSubtask,
  onAddSubtask,
  onUpdateSubtask,
  onDeleteSubtask,
  onCloneSubtask,
  onReorderSubtask,
  onConvertSubtaskToTask,
  onMoveSubtaskToParent,
  onInlineCreate,
  onRefresh,
}: {
  groups: readonly WorkItemGroup[];
  allItems?: readonly WorkItem[];
  people?: readonly WorkPerson[];
  currentUserPerson?: WorkPerson | null;
  totalCount?: number;
  selectedIds: ReadonlySet<string>;
  allVisibleSelected: boolean;
  groupBy?: WorkGroupBy;
  onGroupByChange?: (groupBy: WorkGroupBy) => void;
  showHierarchy?: boolean;
  highlightHighPriority?: boolean;
  highlightDoneRows?: boolean;
  onToggleItem: (id: string) => void;
  onToggleAll: () => void;
  onOpenItem: (
    item: WorkItemGroup["items"][number],
    trigger: HTMLButtonElement,
  ) => void;
  onOpenSubtask?: (
    item: WorkItemGroup["items"][number],
    subtaskId: string,
    trigger: HTMLButtonElement,
  ) => void;
  onOpenFullPage?: (
    item: WorkItemGroup["items"][number],
    subtaskId?: string | null,
  ) => void;
  onStatusChange?: (id: string, status: WorkStatus) => void;
  onPriorityChange?: (id: string, priority: WorkPriority) => void;
  onAssigneeChange?: (
    id: string,
    assignee: WorkPerson,
  ) => void | Promise<boolean>;
  onDueDateChange?: (id: string, dueDate: string | null) => void;
  onToggleFlag?: (id: string) => void;
  onDeleteItem?: (id: string) => void;
  onToggleSubtask?: (itemId: string, subtaskId: string) => void;
  onAddSubtask?: (
    itemId: string,
    summary: string,
    options?: {
      assignee?: WorkPerson;
      priority?: WorkPriority;
      status?: WorkStatus;
      dueDate?: string | null;
      description?: string;
      estimate?: string;
    },
  ) => void;
  onUpdateSubtask?: (
    itemId: string,
    subtaskId: string,
    patch: Partial<Omit<WorkSubtaskItem, "id" | "key">>,
  ) => void;
  onDeleteSubtask?: (itemId: string, subtaskId: string) => void;
  onCloneSubtask?: (itemId: string, subtaskId: string) => void;
  onReorderSubtask?: (
    itemId: string,
    subtaskId: string,
    direction: "up" | "down",
  ) => void;
  onConvertSubtaskToTask?: (itemId: string, subtaskId: string) => void;
  onMoveSubtaskToParent?: (
    fromItemId: string,
    subtaskId: string,
    toItemId: string,
  ) => void;
  onInlineCreate?: (
    title: string,
    type?: WorkItemType,
    options?: { dueDate?: string | null; assignee?: WorkPerson },
  ) => void;
  onRefresh?: () => void;
}) {
  const t = useTranslations("work");
  const common = useTranslations("common");
  const isVi = common("localeCode") === "vi";
  const colLabel = (col: WorkListColumn): string => {
    if (col.key === "work") return t("workColumn");
    if (!isVi) return col.label;
    const viMap: Record<string, string> = {
      status: "Trạng thái",
      assignee: "Người thực hiện",
      priority: "Độ ưu tiên",
      due: "Hạn chót",
      parent: "Hạng mục cha",
      created: "Ngày tạo",
      updated: "Cập nhật",
      reporter: "Người tạo",
      resolution: "Kết quả xử lý",
      progress: "∑ Tiến độ",
      labels: "Nhãn",
      storyPoints: "Điểm ước lượng",
      team: "Nhóm",
    };
    return viMap[col.key] ?? col.label;
  };
  const availablePeople = people ?? PREVIEW_PEOPLE;
  const defaultAssignee = availablePeople[0] ?? UNASSIGNED_PERSON;
  const mePerson = currentUserPerson ?? defaultAssignee;
  const allAssigneeChoices = [
    UNASSIGNED_PERSON,
    ...availablePeople.filter((person) => person.id !== UNASSIGNED_PERSON.id),
  ];
  const [columns, setColumns] = useState<WorkListColumn[]>([
    ...DEFAULT_WORK_LIST_COLUMNS,
  ]);
  const [columnPopoverOpen, setColumnPopoverOpen] = useState(false);
  const [columnSearch, setColumnSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
    () => new Set(),
  );
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [inlineCreating, setInlineCreating] = useState(false);
  const [inlineTitle, setInlineTitle] = useState("");
  const [inlineType, setInlineType] = useState<WorkItemType>("TASK");
  const [inlineDueDate, setInlineDueDate] = useState("");
  const [inlineAssigneeId, setInlineAssigneeId] = useState(defaultAssignee.id);
  const [workHeaderMenuOpen, setWorkHeaderMenuOpen] = useState(false);
  const [freezeWorkColumn, setFreezeWorkColumn] = useState(true);
  const [workSortBy, setWorkSortBy] = useState<"none" | "type" | "key" | "summary">("none");

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
  const [activeSubtaskPopoverId, setActiveSubtaskPopoverId] = useState<
    string | null
  >(null);
  const [activeMenuRowId, setActiveMenuRowId] = useState<string | null>(null);
  const [activeSubtaskMenuId, setActiveSubtaskMenuId] = useState<string | null>(
    null,
  );
  const [addingSubtaskParentId, setAddingSubtaskParentId] = useState<
    string | null
  >(null);
  const [newSubtaskSummary, setNewSubtaskSummary] = useState("");
  const [newSubtaskPriority, setNewSubtaskPriority] =
    useState<WorkPriority>("MEDIUM");
  const [newSubtaskAssigneeId, setNewSubtaskAssigneeId] = useState(
    defaultAssignee.id,
  );
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskSummary, setEditingSubtaskSummary] = useState("");
  const [expandedSubtaskDetailIds, setExpandedSubtaskDetailIds] = useState<
    Set<string>
  >(() => new Set());
  const [toastNotice, setToastNotice] = useState<string>("");

  const resizeStartXRef = useRef<number>(0);
  const resizeStartWidthRef = useRef<number>(0);
  const resizeCleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      resizeCleanupRef.current?.();
    };
  }, []);

  const visibleColumns = columns.filter((col) => col.visible);
  const allItems = groups.flatMap((group) => group.items);
  const parentCandidates = [...(allWorkspaceItems ?? allItems)].sort(
    (a, b) =>
      createdAtTimestamp(b.createdAt) - createdAtTimestamp(a.createdAt),
  );
  const expandableIds = allItems
    .filter((item) => (item.subtaskItems?.length ?? 0) > 0)
    .map((item) => item.id);
  const allExpanded =
    expandableIds.length > 0 &&
    expandableIds.every((id) => !collapsedParentIds.has(id));

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
    setActiveSubtaskPopoverId(null);
    setActiveMenuRowId(null);
    setActiveSubtaskMenuId(null);
    setWorkHeaderMenuOpen(false);
    setColumnPopoverOpen(false);
  }

  function toggleExpandRow(id: string) {
    setCollapsedParentIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startAddSubtaskForItem(item: WorkItem) {
    setCollapsedParentIds((current) => {
      const next = new Set(current);
      next.delete(item.id);
      return next;
    });
    setAddingSubtaskParentId(item.id);
    setNewSubtaskSummary("");
    setNewSubtaskPriority(item.priority);
    setNewSubtaskAssigneeId(item.assignee.id);
  }

  function submitInlineSubtask(
    event: FormEvent<HTMLFormElement>,
    parentItem: WorkItem,
  ) {
    event.preventDefault();
    const trimmed = newSubtaskSummary.trim();
    if (!trimmed || !onAddSubtask || parentItem.readOnly) return;
    const assignee =
      allAssigneeChoices.find((p) => p.id === newSubtaskAssigneeId) ??
      parentItem.assignee;
    onAddSubtask(parentItem.id, trimmed, {
      assignee,
      priority: newSubtaskPriority,
      status: "TODO",
      dueDate: parentItem.dueDate,
    });
    setNewSubtaskSummary("");
    setAddingSubtaskParentId(null);
    showNotice(`Created subtask under ${parentItem.key}`);
  }

  function toggleExpandAll() {
    setCollapsedParentIds(allExpanded ? new Set(expandableIds) : new Set());
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
    if (key ==="work") return; // Work column is always visible in Jira
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
    resizeCleanupRef.current?.();
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

    function cleanupResizeListeners() {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", cleanupResizeListeners);
      resizeCleanupRef.current = null;
    }

    resizeCleanupRef.current = cleanupResizeListeners;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", cleanupResizeListeners);
  }

  function submitInlineCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = inlineTitle.trim();
    if (!trimmed || !onInlineCreate) return;
    const selectedAssignee =
      allAssigneeChoices.find((person) => person.id === inlineAssigneeId) ??
      defaultAssignee;
    onInlineCreate(trimmed, inlineType, {
      dueDate: inlineDueDate.trim() ? inlineDueDate.trim() : null,
      assignee: selectedAssignee,
    });
    setInlineTitle("");
    setInlineDueDate("");
    setInlineCreating(false);
    showNotice(`Created work item"${trimmed}"`);
  }

  const filteredConfigColumns = columns.filter((col) =>
    !columnSearch.trim()
      ? true
      : colLabel(col).toLowerCase().includes(columnSearch.trim().toLowerCase()) ||
        col.label.toLowerCase().includes(columnSearch.trim().toLowerCase()),
  );

  const totalColSpan = visibleColumns.length + 2; // Checkbox + visible columns + Config/More col

  return (
    <div className="relative flex min-w-0 flex-col justify-between overflow-hidden border border-gray-300 bg-white shadow-theme-xs dark:border-gray-700 dark:bg-gray-900">
      {/* Column Manager Popover (+ button or [|||] button) */}
      {columnPopoverOpen && (
        <div
          role="dialog"
          aria-label="Configure columns"
          className="absolute end-3 top-11 z-40 w-72 border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
        >
          <div className="relative mb-2.5">
            <SearchIcon
              aria-hidden="true"
              viewBox="0 0 24 24"
              width={14}
              height={14}
              className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              value={columnSearch}
              onChange={(e) => setColumnSearch(e.target.value)}
              placeholder={isVi ? "Tìm cột..." : "Search columns"}
              className="h-8 w-full border border-gray-200 bg-white ps-8 pe-2.5 text-xs text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
            />
          </div>
          <div className="max-h-60 space-y-1 overflow-y-auto pe-1">
            {filteredConfigColumns.map((col) => (
              <label
                key={col.key}
                className="flex cursor-pointer items-center justify-between px-2 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <span className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-200">
                  <input
                    type="checkbox"
                    checked={col.visible}
                    disabled={col.key ==="work"}
                    onChange={() => toggleColumnVisibility(col.key)}
                    className="h-3.5 w-3.5 border-gray-300 text-brand-600"
                  />
                  <span>{colLabel(col)}</span>
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
              {isVi ? "Xong" : "Done"}
            </button>
            <span>
              {isVi
                ? `${visibleColumns.length} / ${columns.length} cột`
                : `${visibleColumns.length} of ${columns.length} columns`}
            </span>
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0 overflow-x-auto">
        <Table className="min-w-max border-collapse text-sm">
          <caption className="sr-only">{t("listCaption")}</caption>
          <thead className="border-b border-gray-300 bg-gray-100/80 dark:border-gray-700 dark:bg-gray-800/80">
            <tr>
              <th
                scope="col"
                className="w-10 border-b border-e border-gray-300 px-3 py-2.5 text-start dark:border-gray-700"
              >
                <input
                  type="checkbox"
                  aria-label={t("selectAllVisible")}
                  checked={allVisibleSelected}
                  onChange={onToggleAll}
                  className="h-4 w-4 cursor-pointer border-gray-300 text-brand-600 focus:ring-brand-500 dark:border-gray-700 dark:bg-gray-950"
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
                  className={`group relative select-none border-b border-e border-gray-300 px-3 py-2 text-start text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200 ${
                    col.key === "work" && freezeWorkColumn
                      ? "sticky start-0 z-10 bg-gray-100 dark:bg-gray-800"
                      : ""
                  }`}
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
                      {onGroupByChange &&
                      (col.key === "status" ||
                        col.key === "assignee" ||
                        col.key === "priority") ? (
                        <button
                          type="button"
                          onClick={() => {
                            const targetGroup: WorkGroupBy =
                              col.key === "status"
                                ? "STATUS"
                                : col.key === "assignee"
                                  ? "ASSIGNEE"
                                  : "PRIORITY";
                            onGroupByChange(
                              groupBy === targetGroup ? "NONE" : targetGroup,
                            );
                          }}
                          title={isVi ? `Nhấn để nhóm theo ${colLabel(col)}` : `Click to group by ${col.label}`}
                          className="inline-flex cursor-pointer items-center gap-1 hover:text-brand-600 dark:hover:text-brand-400"
                        >
                          <span>{colLabel(col)}</span>
                          {((col.key === "status" && groupBy === "STATUS") ||
                            (col.key === "assignee" &&
                              groupBy === "ASSIGNEE") ||
                            (col.key === "priority" &&
                              groupBy === "PRIORITY")) && (
                            <span className="rounded bg-brand-100 px-1 py-0.5 text-[9px] font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                              {isVi ? "Đã nhóm" : "Grouped"}
                            </span>
                          )}
                        </button>
                      ) : (
                        <span>
                          {colLabel(col)}
                        </span>
                      )}
                      {col.key === "work" && workSortBy !== "none" && (
                        <span className="rounded bg-brand-100 px-1 py-0.5 text-[10px] font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                          ↑ {workSortBy}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      {col.key ==="work"&& (
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => {
                              const next = !workHeaderMenuOpen;
                              closeAllCellPopovers();
                              setWorkHeaderMenuOpen(next);
                            }}
                            aria-label="More actions for Work column"
                            title="More actions for Work"
                            className="flex h-5 w-5 cursor-pointer items-center justify-center text-xs font-bold text-gray-500 transition hover:bg-gray-200 hover:text-gray-800 dark:hover:bg-gray-700 dark:hover:text-white"
                          >
                            ···
                          </button>

                          {/* Jira Cloud `More actions for Work` Column Header Menu (`43-list-work-column-header-menu.png`) */}
                          {workHeaderMenuOpen && (
                            <FloatingCellPopover
                              align="end"
                              widthClass="w-52"
                              role="menu"
                              ariaLabel="Work column options"
                              className="py-1.5 text-start font-normal"
                              onClose={() => setWorkHeaderMenuOpen(false)}
                            >
                              <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                                Sort by columns
                              </div>
                              {(
                                [
                                  { id:"type", label:"Sort by Type"},
                                  { id:"key", label:"Sort by Work item key"},
                                  { id:"summary", label:"Sort by Summary"},
                                ] as const
                              ).map((opt) => (
                                <button
                                  key={opt.id}
                                  type="button"
                                  onClick={() => {
                                    setWorkSortBy(
                                      workSortBy === opt.id ?"none": opt.id,
                                    );
                                    setWorkHeaderMenuOpen(false);
                                    showNotice(`Sorted Work column by ${opt.id}`);
                                  }}
                                  className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                >
                                  <span>{opt.label}</span>
                                  {workSortBy === opt.id && (
                                    <span className="font-bold text-brand-600">✓</span>
                                  )}
                                </button>
                              ))}
                              <div className="my-1 border-t border-gray-100 dark:border-gray-800"/>
                              <button
                                type="button"
                                onClick={() => {
                                  setFreezeWorkColumn((prev) => !prev);
                                  setWorkHeaderMenuOpen(false);
                                  showNotice(
                                    freezeWorkColumn
                                      ?"Unfroze Work column"
                                      :"Froze Work column",
                                  );
                                }}
                                className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                              >
                                <span>
                                  {freezeWorkColumn
                                    ?"Unfreeze column"
                                    :"Freeze column"}
                                </span>
                                {freezeWorkColumn && (
                                  <MonoIcon
                                    name="pin"
                                    size={13}
                                    className="text-gray-700 dark:text-gray-300"
                                  />
                                )}
                              </button>
                            </FloatingCellPopover>
                          )}
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const next = !columnPopoverOpen;
                          closeAllCellPopovers();
                          setColumnPopoverOpen(next);
                        }}
                        title="Add or configure column"
                        className="flex h-5 w-5 cursor-pointer items-center justify-center text-xs font-bold text-gray-400 opacity-0 transition group-hover:opacity-100 hover:bg-gray-200 hover:text-gray-700 dark:hover:bg-gray-700 dark:hover:text-gray-200"
                      >
                        +
                      </button>
                    </div>
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
                className="w-11 border-b border-gray-300 px-2 py-2.5 text-center text-xs font-semibold text-gray-500 dark:border-gray-700"
              >
                <button
                  type="button"
                  onClick={() => {
                    const next = !columnPopoverOpen;
                    closeAllCellPopovers();
                    setColumnPopoverOpen(next);
                  }}
                  title="Configure columns"
                  aria-label="Configure columns"
                  className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center border text-xs transition ${
                    columnPopoverOpen
                      ?"border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300"
                      :"border-transparent text-gray-500 hover:border-gray-200 hover:bg-gray-100 dark:hover:border-gray-700 dark:hover:bg-gray-800"
                  }`}
                >
                  |||
                </button>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {groups.map((group) => {
              const isGroupCollapsed = collapsedGroups.has(group.id);
              return (
                <Fragment key={group.id}>
                  {group.label && (
                    <tr
                      key={`${group.id}-heading`}
                      onClick={() => toggleGroupCollapse(group.id)}
                      className="cursor-pointer border-b border-gray-200 bg-gray-100/70 transition hover:bg-gray-200/60 dark:border-gray-700 dark:bg-gray-800/70 dark:hover:bg-gray-800"
                    >
                      <th
                        colSpan={totalColSpan}
                        scope="rowgroup"
                        className="border-b border-gray-200 px-3.5 py-2 text-start text-xs font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-300"
                      >
                        <span className="inline-flex items-center gap-2">
                          <span
                            aria-hidden="true"
                            className="text-[10px] text-gray-500"
                          >
                            {isGroupCollapsed ?"▶":"▼"}
                          </span>
                          <span className="uppercase tracking-wide text-gray-500 dark:text-gray-400">
                            {group.labelKind ==="status"
                              ? `Status: ${t(`statuses.${group.label as WorkStatus}`)}`
                              : group.labelKind ==="priority"
                                ? `Priority: ${t(`priorities.${group.label as WorkPriority}`)}`
                                : `Assignee: ${group.label}`}
                          </span>
                          <span className="bg-gray-200/80 px-2 py-0.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                            {group.items.length}
                          </span>
                        </span>
                      </th>
                    </tr>
                  )}

                  {!isGroupCollapsed &&
                    [...group.items]
                      .sort((a, b) => {
                        if (workSortBy ==="type") {
                          return a.type.localeCompare(b.type);
                        }
                        if (workSortBy ==="key") {
                          return a.key.localeCompare(b.key);
                        }
                        if (workSortBy ==="summary") {
                          return a.title.localeCompare(b.title);
                        }
                        return 0;
                      })
                      .map((item) => {
                      const hasSubtasks = (item.subtaskItems?.length ?? 0) > 0;
                      const isExpanded = showHierarchy
                        ? !collapsedParentIds.has(item.id)
                        : true;
                      const isDone = item.status ==="DONE";
                      const isSelected = selectedIds.has(item.id);

                      const rowBgClass = item.flagged
                        ?"bg-gray-100/80 dark:bg-gray-800/70"
                        : isSelected
                          ?"bg-gray-100/70 dark:bg-gray-800/60"
                          : highlightHighPriority && item.priority ==="HIGH"
                            ?"bg-gray-100/50 dark:bg-gray-800/40"
                            : highlightDoneRows && isDone
                              ?"bg-gray-50/70 dark:bg-gray-800/30"
                              :"hover:bg-gray-50/80 dark:hover:bg-gray-800/40";

                      return (
                        <Fragment key={item.id}>
                          <tr className={`transition-colors ${rowBgClass}`}>
                            {/* Checkbox cell */}
                            <td className="border-b border-e border-gray-200 px-3 py-1.5 align-middle dark:border-gray-700">
                              <input
                                type="checkbox"
                                aria-label={t("selectWorkItem", {
                                  key: item.key,
                                })}
                                checked={isSelected}
                                disabled={item.readOnly}
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
                                className={`border-b border-e border-gray-200 px-3 py-1.5 align-middle dark:border-gray-700 ${
                                  col.key === "work" && freezeWorkColumn
                                    ? "sticky start-0 z-10 bg-white shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] dark:bg-gray-900"
                                    : ""
                                }`}
                              >
                                {renderCellContent({
                                  colKey: col.key,
                                  item,
                                  allAssigneeChoices,
                                  hasSubtasks,
                                  isExpanded,
                                  isDone,
                                  showHierarchy,
                                  activeAssigneeRowId,
                                  activeStatusRowId,
                                  activePriorityRowId,
                                  activeSubtaskPopoverId,
                                  setActiveAssigneeRowId,
                                  setActiveStatusRowId,
                                  setActivePriorityRowId,
                                  setActiveSubtaskPopoverId,
                                  closeAllCellPopovers,
                                  toggleExpandRow,
                                  onStartAddSubtask: onAddSubtask && !item.readOnly
                                    ? () => startAddSubtaskForItem(item)
                                    : undefined,
                                  onOpenItem,
                                  onOpenSubtask,
                                  onOpenFullPage,
                                  onToggleSubtask,
                                  onStatusChange,
                                  onPriorityChange,
                                  onAssigneeChange,
                                  onDueDateChange,
                                  showNotice,
                                  t,
                                })}
                              </td>
                            ))}

                            {/* Rightmost Row Actions (···) — Jira Figure 1 */}
                            <td className="relative border-b border-gray-200 px-2 py-1.5 text-center align-middle dark:border-gray-700">
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
                                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center text-xs font-bold text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-white"
                              >
                                ···
                              </button>

                              {activeMenuRowId === item.id && (
                                <FloatingCellPopover
                                  align="end"
                                  widthClass="w-44"
                                  role="menu"
                                  ariaLabel={`Actions menu for ${item.key}`}
                                  className="py-1.5 text-start"
                                  onClose={() => setActiveMenuRowId(null)}
                                >
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      setActiveMenuRowId(null);
                                      onOpenItem(item, e.currentTarget);
                                    }}
                                    className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                  >
                                    <MonoIcon name="eye"size={13} className="text-gray-500"/>
                                    <span>Open details</span>
                                  </button>
                                  {onAddSubtask && !item.readOnly && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuRowId(null);
                                        startAddSubtaskForItem(item);
                                      }}
                                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                    >
                                      <MonoIssueTypeIcon
                                        type="SUBTASK"
                                        size={12}
                                        className="text-gray-500"
                                      />
                                      <span>Add subtask</span>
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuRowId(null);
                                      if (typeof navigator !=="undefined") {
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
                                    <MonoIcon name="link"size={13} className="text-gray-500"/>
                                    <span>Copy issue link</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveMenuRowId(null);
                                      if (typeof navigator !=="undefined") {
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
                                    <MonoIcon name="copy"size={13} className="text-gray-500"/>
                                    <span>Copy issue key</span>
                                  </button>
                                  <div className="my-1 border-t border-gray-100 dark:border-gray-800"/>
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
                                    <MonoIcon name="flag"size={13} className="text-gray-500"/>
                                    <span>
                                      {item.flagged
                                        ?"Remove flag"
                                        :"Add flag"}
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
                                    <MonoIcon name="clock"size={13} className="text-gray-500"/>
                                    <span>Log work</span>
                                  </button>
                                  {onDeleteItem && !item.readOnly && (
                                    <>
                                      <div className="my-1 border-t border-gray-100 dark:border-gray-800"/>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveMenuRowId(null);
                                          onDeleteItem(item.id);
                                          showNotice(`Deleted ${item.key}`);
                                        }}
                                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                                      >
                                        <MonoIcon name="trash"size={13} className="text-gray-500"/>
                                        <span>Delete</span>
                                      </button>
                                    </>
                                  )}
                                </FloatingCellPopover>
                              )}
                            </td>
                          </tr>

                          {/* Expanded Subtask Hierarchy Rows (`subtask-nested-row`) */}
                          {hasSubtasks &&
                            isExpanded &&
                            item.subtaskItems?.map((sub, subIdx) => {
                              const subAssignee = sub.assignee ?? item.assignee;
                              const subPriority = sub.priority ?? item.priority;
                              const subDueDate = sub.dueDate ?? item.dueDate;
                              const isEditingThisSub =
                                editingSubtaskId === sub.id;
                              const isSubDetailOpen =
                                expandedSubtaskDetailIds.has(sub.id);
                              const subSteps = sub.steps ?? [];
                              const doneStepsCount = subSteps.filter(
                                (st) => st.done,
                              ).length;
                              const subCount = item.subtaskItems?.length ?? 0;

                              return (
                                <Fragment key={sub.id}>
                                  <tr
                                    className={`group/sub hover:bg-gray-100/70 dark:hover:bg-gray-900/60 ${
                                      sub.flagged
                                        ? "bg-gray-100/80 dark:bg-gray-800/70"
                                        : "bg-gray-50/80 dark:bg-gray-950/40"
                                    }`}
                                  >
                                    <td className="border-b border-e border-gray-200 px-3 py-2 align-middle dark:border-gray-700">
                                      <input
                                        type="checkbox"
                                        checked={sub.done}
                                        disabled={sub.readOnly}
                                        onChange={() =>
                                          onToggleSubtask?.(item.id, sub.id)
                                        }
                                        aria-label={`Complete subtask ${sub.key}`}
                                        className="h-3.5 w-3.5 cursor-pointer border-gray-300 text-brand-600"
                                      />
                                    </td>
                                    {visibleColumns.map((col) => (
                                      <td
                                        key={col.key}
                                        className={`border-b border-e border-gray-200 px-3 py-2 align-middle text-xs dark:border-gray-700 ${
                                          col.key === "work" && freezeWorkColumn
                                            ? "sticky start-0 z-10 bg-gray-50 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] dark:bg-gray-950"
                                            : ""
                                        }`}
                                      >
                                        {col.key === "work" ? (
                                          <div className="flex min-w-0 items-center gap-1.5 ps-4">
                                            <span
                                              aria-hidden="true"
                                              className="font-mono text-gray-400"
                                            >
                                              └
                                            </span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setExpandedSubtaskDetailIds(
                                                  (current) => {
                                                    const next = new Set(
                                                      current,
                                                    );
                                                    if (next.has(sub.id)) {
                                                      next.delete(sub.id);
                                                    } else {
                                                      next.add(sub.id);
                                                    }
                                                    return next;
                                                  },
                                                )
                                              }
                                              title={
                                                isSubDetailOpen
                                                  ? "Collapse subtask information layer"
                                                  : "Expand subtask information layer"
                                              }
                                              aria-label={`Toggle details for ${sub.key}`}
                                              className="flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center text-[10px] text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
                                            >
                                              {isSubDetailOpen ? "▾" : "▸"}
                                            </button>
                                            <span
                                              aria-hidden="true"
                                              title="Subtask"
                                              className="flex h-4 w-4 shrink-0 items-center justify-center border border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                            >
                                              <MonoIssueTypeIcon
                                                type="SUBTASK"
                                                size={11}
                                              />
                                            </span>
                                            <button
                                              type="button"
                                              onClick={(e) =>
                                                onOpenSubtask
                                                  ? onOpenSubtask(
                                                      item,
                                                      sub.id,
                                                      e.currentTarget,
                                                    )
                                                  : onOpenItem(
                                                      item,
                                                      e.currentTarget,
                                                    )
                                              }
                                              title={`Open ${sub.key} detail layer`}
                                              className="shrink-0 cursor-pointer font-semibold text-gray-700 hover:underline dark:text-gray-300"
                                            >
                                              {sub.key}
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (
                                                  typeof navigator !==
                                                  "undefined"
                                                ) {
                                                  navigator.clipboard?.writeText(
                                                    `${window.location.origin}${window.location.pathname}#${sub.key}`,
                                                  );
                                                }
                                                showNotice(
                                                  `Copied link to ${sub.key}`,
                                                );
                                              }}
                                              title={`Copy link to ${sub.key}`}
                                              aria-label={`Copy link to ${sub.key}`}
                                              className="invisible inline-flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center text-gray-400 hover:text-gray-800 group-hover/sub:visible dark:hover:text-white"
                                            >
                                              <MonoIcon name="link" size={10} />
                                            </button>
                                            {isEditingThisSub ? (
                                              <form
                                                onSubmit={(e) => {
                                                  e.preventDefault();
                                                  const nextText =
                                                    editingSubtaskSummary.trim();
                                                  if (nextText) {
                                                    onUpdateSubtask?.(
                                                      item.id,
                                                      sub.id,
                                                      { summary: nextText },
                                                    );
                                                    showNotice(
                                                      `Updated ${sub.key}`,
                                                    );
                                                  }
                                                  setEditingSubtaskId(null);
                                                }}
                                                className="flex min-w-0 flex-1 items-center gap-1"
                                              >
                                                <input
                                                  value={editingSubtaskSummary}
                                                  onChange={(e) =>
                                                    setEditingSubtaskSummary(
                                                      e.target.value,
                                                    )
                                                  }
                                                  aria-label={`Edit summary for ${sub.key}`}
                                                  className="h-6 min-w-0 flex-1 border border-brand-400 bg-white px-2 text-xs text-gray-900 outline-none dark:bg-gray-900 dark:text-white"
                                                />
                                                <button
                                                  type="submit"
                                                  className="h-6 cursor-pointer bg-gray-900 px-2 text-[10px] font-semibold text-white dark:bg-gray-100 dark:text-gray-900"
                                                >
                                                  Save
                                                </button>
                                                <button
                                                  type="button"
                                                  onClick={() =>
                                                    setEditingSubtaskId(null)
                                                  }
                                                  className="h-6 cursor-pointer px-1 text-[10px] text-gray-500"
                                                >
                                                  ✕
                                                </button>
                                              </form>
                                            ) : (
                                              <button
                                                type="button"
                                                onClick={(e) =>
                                                  onOpenSubtask
                                                    ? onOpenSubtask(
                                                        item,
                                                        sub.id,
                                                        e.currentTarget,
                                                      )
                                                    : onOpenItem(
                                                        item,
                                                        e.currentTarget,
                                                      )
                                                }
                                                className={`min-w-0 flex-1 cursor-pointer truncate text-start hover:underline ${
                                                  sub.done
                                                    ? "line-through text-gray-400 dark:text-gray-500"
                                                    : "text-gray-800 dark:text-gray-200"
                                                }`}
                                              >
                                                {sub.summary}
                                              </button>
                                            )}
                                            {sub.flagged && (
                                              <span
                                                title="Flagged subtask"
                                                className="shrink-0 text-gray-700 dark:text-gray-300"
                                              >
                                                <MonoIcon
                                                  name="flag"
                                                  size={11}
                                                />
                                              </span>
                                            )}
                                            {subSteps.length > 0 && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  setExpandedSubtaskDetailIds(
                                                    (current) => {
                                                      const next = new Set(
                                                        current,
                                                      );
                                                      if (next.has(sub.id)) {
                                                        next.delete(sub.id);
                                                      } else {
                                                        next.add(sub.id);
                                                      }
                                                      return next;
                                                    },
                                                  )
                                                }
                                                title="Toggle subtask implementation steps"
                                                className="shrink-0 cursor-pointer border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                                              >
                                                {doneStepsCount}/
                                                {subSteps.length} steps
                                              </button>
                                            )}
                                            {!isEditingThisSub &&
                                              !sub.readOnly &&
                                              onUpdateSubtask && (
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setEditingSubtaskId(sub.id);
                                                    setEditingSubtaskSummary(
                                                      sub.summary,
                                                    );
                                                  }}
                                                  title="Edit subtask summary"
                                                  aria-label={`Rename subtask ${sub.key}`}
                                                  className="invisible inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center text-gray-400 hover:bg-gray-200 hover:text-gray-700 group-hover/sub:visible dark:hover:bg-gray-800 dark:hover:text-gray-200"
                                                >
                                                  <MonoIcon
                                                    name="edit"
                                                    size={11}
                                                  />
                                                </button>
                                              )}
                                          </div>
                                        ) : col.key === "assignee" ? (
                                          <label className="relative flex max-w-full cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 transition hover:bg-gray-200/60 dark:hover:bg-gray-800">
                                            <PersonLabel person={subAssignee} />
                                            {!sub.readOnly && onUpdateSubtask && (
                                              <select
                                                aria-label={`Assignee for ${sub.key}`}
                                                value={subAssignee.id}
                                                onChange={(e) => {
                                                  const nextPerson =
                                                    allAssigneeChoices.find(
                                                      (p) =>
                                                        p.id === e.target.value,
                                                    );
                                                  if (nextPerson) {
                                                    onUpdateSubtask(
                                                      item.id,
                                                      sub.id,
                                                      { assignee: nextPerson },
                                                    );
                                                    showNotice(
                                                      `Assigned ${sub.key} to ${nextPerson.name}`,
                                                    );
                                                  }
                                                }}
                                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                              >
                                                {allAssigneeChoices.map((p) => (
                                                  <option key={p.id} value={p.id}>
                                                    {p.name}
                                                  </option>
                                                ))}
                                              </select>
                                            )}
                                          </label>
                                        ) : col.key === "status" ? (
                                          <label className="relative inline-flex cursor-pointer items-center">
                                            <WorkStatusBadge
                                              status={sub.status}
                                              showChevron={Boolean(onUpdateSubtask)}
                                            />
                                            {!sub.readOnly && onUpdateSubtask && (
                                              <select
                                                aria-label={`Status for ${sub.key}`}
                                                value={sub.status}
                                                onChange={(e) => {
                                                  const nextSt = e.target
                                                    .value as WorkStatus;
                                                  onUpdateSubtask(
                                                    item.id,
                                                    sub.id,
                                                    {
                                                      status: nextSt,
                                                    },
                                                  );
                                                  showNotice(
                                                    `Updated ${sub.key} status to ${t(`statuses.${nextSt}`)}`,
                                                  );
                                                }}
                                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                              >
                                                {WORK_STATUS_ORDER.map((st) => (
                                                  <option key={st} value={st}>
                                                    {t(`statuses.${st}`)}
                                                  </option>
                                                ))}
                                              </select>
                                            )}
                                          </label>
                                        ) : col.key === "priority" ? (
                                          <label className="relative inline-flex cursor-pointer items-center rounded px-1 py-0.5 transition hover:bg-gray-200/60 dark:hover:bg-gray-800">
                                            <WorkPriorityLabel
                                              priority={subPriority}
                                            />
                                            {!sub.readOnly && onUpdateSubtask && (
                                              <select
                                                aria-label={`Priority for ${sub.key}`}
                                                value={subPriority}
                                                onChange={(e) => {
                                                  const nextPrio = e.target
                                                    .value as WorkPriority;
                                                  onUpdateSubtask(
                                                    item.id,
                                                    sub.id,
                                                    {
                                                      priority: nextPrio,
                                                    },
                                                  );
                                                  showNotice(
                                                    `Updated ${sub.key} priority to ${nextPrio}`,
                                                  );
                                                }}
                                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                                              >
                                                <option value="HIGH">
                                                  {t("priorities.HIGH")}
                                                </option>
                                                <option value="MEDIUM">
                                                  {t("priorities.MEDIUM")}
                                                </option>
                                                <option value="LOW">
                                                  {t("priorities.LOW")}
                                                </option>
                                              </select>
                                            )}
                                          </label>
                                        ) : col.key === "due" ? (
                                          <WorkDatePickerCell
                                            value={subDueDate}
                                            itemKey={sub.key}
                                            disabled={sub.readOnly || !onUpdateSubtask}
                                            onChange={
                                              onUpdateSubtask
                                                ? (nextDate) => {
                                                    onUpdateSubtask(
                                                      item.id,
                                                      sub.id,
                                                      { dueDate: nextDate },
                                                    );
                                                    showNotice(
                                                      nextDate
                                                        ? `Updated due date for ${sub.key} to ${nextDate}`
                                                        : `Cleared due date for ${sub.key}`,
                                                    );
                                                  }
                                                : undefined
                                            }
                                          />
                                        ) : col.key === "parent" ? (
                                          <span className="inline-flex items-center gap-1 border border-gray-200 bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                            <MonoIssueTypeIcon
                                              type={item.type}
                                              size={11}
                                            />
                                            <span>{item.key}</span>
                                          </span>
                                        ) : col.key === "progress" ? (
                                          <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
                                            {sub.done
                                              ? "100%"
                                              : sub.status === "IN_PROGRESS" ||
                                                  sub.status === "IN_REVIEW"
                                                ? "50%"
                                                : "0%"}
                                          </span>
                                        ) : (
                                          <span className="text-gray-400">
                                            —
                                          </span>
                                        )}
                                      </td>
                                    ))}
                                    <td className="relative border-b border-gray-200 px-2 py-2 text-center align-middle dark:border-gray-700">
                                      <div className="inline-flex items-center justify-center gap-0.5">
                                        <button
                                          type="button"
                                          onClick={(e) =>
                                            onOpenSubtask
                                              ? onOpenSubtask(
                                                  item,
                                                  sub.id,
                                                  e.currentTarget,
                                                )
                                              : onOpenItem(
                                                  item,
                                                  e.currentTarget,
                                                )
                                          }
                                          title={`Open ${sub.key} detail view`}
                                          aria-label={`Open ${sub.key} detail view`}
                                          className="inline-flex h-6 w-6 cursor-pointer items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                                        >
                                          <MonoIcon
                                            name="arrowUpRight"
                                            size={12}
                                          />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const next =
                                              activeSubtaskMenuId === sub.id
                                                ? null
                                                : sub.id;
                                            closeAllCellPopovers();
                                            setActiveSubtaskMenuId(next);
                                          }}
                                          aria-label={`More actions for ${sub.key}`}
                                          title={`More actions for ${sub.key}`}
                                          className="inline-flex h-6 w-6 cursor-pointer items-center justify-center text-xs font-bold text-gray-500 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                                        >
                                          ···
                                        </button>
                                      </div>

                                      {/* Jira Cloud Subtask Row Context Menu (`More actions for <SUBTASK-KEY>`) */}
                                      {activeSubtaskMenuId === sub.id && (
                                        <FloatingCellPopover
                                          align="end"
                                          widthClass="w-48"
                                          role="menu"
                                          ariaLabel={`More actions menu for ${sub.key}`}
                                          className="py-1.5 text-start text-xs"
                                          onClose={() => setActiveSubtaskMenuId(null)}
                                        >
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              setActiveSubtaskMenuId(null);
                                              if (onOpenSubtask) {
                                                onOpenSubtask(
                                                  item,
                                                  sub.id,
                                                  e.currentTarget,
                                                );
                                              } else {
                                                onOpenItem(
                                                  item,
                                                  e.currentTarget,
                                                );
                                              }
                                            }}
                                            className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                          >
                                            <MonoIcon
                                              name="eye"
                                              size={12}
                                              className="text-gray-500"
                                            />
                                            <span>Open subtask detail</span>
                                          </button>
                                          {!sub.readOnly && onUpdateSubtask && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveSubtaskMenuId(null);
                                                setEditingSubtaskId(sub.id);
                                                setEditingSubtaskSummary(
                                                  sub.summary,
                                                );
                                              }}
                                              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                            >
                                              <MonoIcon
                                                name="edit"
                                                size={12}
                                                className="text-gray-500"
                                              />
                                              <span>Edit summary</span>
                                            </button>
                                          )}
                                          {!sub.readOnly && onUpdateSubtask && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveSubtaskMenuId(null);
                                                onUpdateSubtask(
                                                  item.id,
                                                  sub.id,
                                                  {
                                                    assignee: mePerson,
                                                  },
                                                );
                                                showNotice(
                                                  `Assigned ${sub.key} to ${mePerson.name}`,
                                                );
                                              }}
                                              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                            >
                                              <MonoIcon
                                                name="user"
                                                size={12}
                                                className="text-gray-500"
                                              />
                                              <span>Assign to me</span>
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveSubtaskMenuId(null);
                                              if (
                                                typeof navigator !== "undefined"
                                              ) {
                                                navigator.clipboard?.writeText(
                                                  `${window.location.origin}${window.location.pathname}#${sub.key}`,
                                                );
                                              }
                                              showNotice(
                                                `Copied subtask link for ${sub.key}`,
                                              );
                                            }}
                                            className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                          >
                                            <MonoIcon
                                              name="link"
                                              size={12}
                                              className="text-gray-500"
                                            />
                                            <span>Copy subtask link</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setActiveSubtaskMenuId(null);
                                              if (
                                                typeof navigator !== "undefined"
                                              ) {
                                                navigator.clipboard?.writeText(
                                                  sub.key,
                                                );
                                              }
                                              showNotice(
                                                `Copied subtask key ${sub.key}`,
                                              );
                                            }}
                                            className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                          >
                                            <MonoIcon
                                              name="copy"
                                              size={12}
                                              className="text-gray-500"
                                            />
                                            <span>Copy subtask key</span>
                                          </button>
                                          <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                                          {!sub.readOnly && onUpdateSubtask && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveSubtaskMenuId(null);
                                                onUpdateSubtask(
                                                  item.id,
                                                  sub.id,
                                                  {
                                                    flagged: !sub.flagged,
                                                  },
                                                );
                                                showNotice(
                                                  sub.flagged
                                                    ? `Removed flag from ${sub.key}`
                                                    : `Added flag to ${sub.key}`,
                                                );
                                              }}
                                              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                            >
                                              <MonoIcon
                                                name="flag"
                                                size={12}
                                                className="text-gray-500"
                                              />
                                              <span>
                                                {sub.flagged
                                                  ? "Remove flag"
                                                  : "Add flag"}
                                              </span>
                                            </button>
                                          )}
                                          {!sub.readOnly && onUpdateSubtask && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveSubtaskMenuId(null);
                                                onUpdateSubtask(
                                                  item.id,
                                                  sub.id,
                                                  {
                                                    loggedTime: "2h",
                                                  },
                                                );
                                                showNotice(
                                                  `Logged 2h work on ${sub.key}`,
                                                );
                                              }}
                                              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                            >
                                              <MonoIcon
                                                name="clock"
                                                size={12}
                                                className="text-gray-500"
                                              />
                                              <span>Log work (2h)</span>
                                            </button>
                                          )}
                                          {!sub.readOnly && onReorderSubtask && (
                                            <div className="flex items-center justify-between px-3 py-1">
                                              <span className="text-[11px] text-gray-500">
                                                Reorder
                                              </span>
                                              <div className="flex items-center gap-1">
                                                <button
                                                  type="button"
                                                  disabled={subIdx === 0}
                                                  onClick={() => {
                                                    setActiveSubtaskMenuId(
                                                      null,
                                                    );
                                                    onReorderSubtask(
                                                      item.id,
                                                      sub.id,
                                                      "up",
                                                    );
                                                  }}
                                                  className="cursor-pointer border border-gray-200 px-1.5 py-0.5 text-[10px] font-bold hover:bg-gray-100 disabled:opacity-30 dark:border-gray-700"
                                                >
                                                  ↑
                                                </button>
                                                <button
                                                  type="button"
                                                  disabled={
                                                    subIdx >= subCount - 1
                                                  }
                                                  onClick={() => {
                                                    setActiveSubtaskMenuId(
                                                      null,
                                                    );
                                                    onReorderSubtask(
                                                      item.id,
                                                      sub.id,
                                                      "down",
                                                    );
                                                  }}
                                                  className="cursor-pointer border border-gray-200 px-1.5 py-0.5 text-[10px] font-bold hover:bg-gray-100 disabled:opacity-30 dark:border-gray-700"
                                                >
                                                  ↓
                                                </button>
                                              </div>
                                            </div>
                                          )}
                                          {onCloneSubtask && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveSubtaskMenuId(null);
                                                onCloneSubtask(item.id, sub.id);
                                                showNotice(
                                                  `Cloned subtask ${sub.key}`,
                                                );
                                              }}
                                              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                            >
                                              <MonoIcon
                                                name="copy"
                                                size={12}
                                                className="text-gray-500"
                                              />
                                              <span>Clone subtask</span>
                                            </button>
                                          )}
                                          {!sub.readOnly && onConvertSubtaskToTask && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setActiveSubtaskMenuId(null);
                                                onConvertSubtaskToTask(
                                                  item.id,
                                                  sub.id,
                                                );
                                                showNotice(
                                                  `Converted ${sub.key} to Task`,
                                                );
                                              }}
                                              className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                            >
                                              <MonoIcon
                                                name="arrowUpRight"
                                                size={12}
                                                className="text-gray-500"
                                              />
                                              <span>Convert to Task</span>
                                            </button>
                                          )}
                                          {!sub.readOnly && onMoveSubtaskToParent &&
                                            parentCandidates.length > 1 && (
                                              <div className="border-t border-gray-100 px-3 py-1.5 dark:border-gray-800">
                                                <label className="block text-[10px] font-semibold text-gray-400">
                                                  Change parent
                                                </label>
                                                <select
                                                  aria-label={`Change parent for ${sub.key}`}
                                                  value={item.id}
                                                  onChange={(e) => {
                                                    const nextParentId =
                                                      e.target.value;
                                                    if (
                                                      nextParentId &&
                                                      nextParentId !== item.id
                                                    ) {
                                                      setActiveSubtaskMenuId(
                                                        null,
                                                      );
                                                      onMoveSubtaskToParent(
                                                        item.id,
                                                        sub.id,
                                                        nextParentId,
                                                      );
                                                      showNotice(
                                                        `Moved ${sub.key} to new parent`,
                                                      );
                                                    }
                                                  }}
                                                  className="mt-1 h-6 w-full border border-gray-200 bg-white px-1 text-[11px] text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                                                >
                                                  {parentCandidates.map(
                                                    (cand) => (
                                                      <option
                                                        key={cand.id}
                                                        value={cand.id}
                                                      >
                                                        {cand.key} —{" "}
                                                        {cand.title}
                                                      </option>
                                                    ),
                                                  )}
                                                </select>
                                              </div>
                                            )}
                                          {!sub.readOnly && onDeleteSubtask && (
                                            <>
                                              <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setActiveSubtaskMenuId(null);
                                                  onDeleteSubtask(
                                                    item.id,
                                                    sub.id,
                                                  );
                                                  showNotice(
                                                    `Deleted subtask ${sub.key}`,
                                                  );
                                                }}
                                                aria-label={`Delete subtask ${sub.key}`}
                                                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 font-medium text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                                              >
                                                <MonoIcon
                                                  name="trash"
                                                  size={12}
                                                  className="text-gray-500"
                                                />
                                                <span>Delete subtask</span>
                                              </button>
                                            </>
                                          )}
                                        </FloatingCellPopover>
                                      )}
                                    </td>
                                  </tr>

                                  {/* 3RD-LEVEL SUBTASK INFORMATION LAYER IN SPREADSHEET LIST VIEW */}
                                  {isSubDetailOpen && (
                                    <tr className="bg-gray-100/70 dark:bg-gray-900/80">
                                      <td className="border-b border-e border-gray-200 px-3 py-2 dark:border-gray-700" />
                                      <td
                                        colSpan={totalColSpan - 1}
                                        className="border-b border-gray-200 px-4 py-3 text-xs dark:border-gray-700"
                                      >
                                        <div className=" ms-8 space-y-2 border-s-2 border-gray-800 bg-white p-3 dark:border-gray-300 dark:bg-gray-950">
                                          <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-gray-600 dark:text-gray-400">
                                              <span className="inline-flex items-center gap-1 font-semibold text-gray-900 dark:text-white">
                                                <MonoIssueTypeIcon
                                                  type="SUBTASK"
                                                  size={11}
                                                />
                                                <span>
                                                  {sub.key} • Subtask Detail
                                                  Layer
                                                </span>
                                              </span>
                                              <span>
                                                Est:{" "}
                                                <strong>
                                                  {sub.estimate ?? "2h"}
                                                </strong>{" "}
                                                • Logged:{" "}
                                                <strong>
                                                  {sub.loggedTime ?? "0h"}
                                                </strong>
                                              </span>
                                              {subDueDate && (
                                                <span>
                                                  Due:{" "}
                                                  <strong>{subDueDate}</strong>
                                                </span>
                                              )}
                                              <span>
                                                Checklist:{" "}
                                                <strong>
                                                  {doneStepsCount}/
                                                  {subSteps.length} steps
                                                </strong>
                                              </span>
                                            </div>
                                            <button
                                              type="button"
                                              onClick={(e) =>
                                                onOpenSubtask
                                                  ? onOpenSubtask(
                                                      item,
                                                      sub.id,
                                                      e.currentTarget,
                                                    )
                                                  : onOpenItem(
                                                      item,
                                                      e.currentTarget,
                                                    )
                                              }
                                              className="inline-flex cursor-pointer items-center gap-1 border border-gray-800 bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-gray-800 dark:border-gray-200 dark:bg-gray-100 dark:text-gray-900"
                                            >
                                              <span>
                                                Open subtask detail
                                              </span>
                                              <MonoIcon
                                                name="arrowUpRight"
                                                size={11}
                                              />
                                            </button>
                                          </div>

                                          {sub.description && (
                                            <p className="border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                                              {sub.description}
                                            </p>
                                          )}

                                          {subSteps.length > 0 && (
                                            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
                                              {subSteps.map((st, idx) => (
                                                <label
                                                  key={st.id}
                                                  className="flex cursor-pointer items-center gap-2 border border-gray-200 bg-gray-50/70 px-2.5 py-1.5 text-xs hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800"
                                                >
                                                  <input
                                                    type="checkbox"
                                                    checked={st.done}
                                                    onChange={() => {
                                                      if (sub.readOnly || !onUpdateSubtask)
                                                        return;
                                                      const nextSteps =
                                                        subSteps.map((s) =>
                                                          s.id === st.id
                                                            ? {
                                                                ...s,
                                                                done: !s.done,
                                                              }
                                                            : s,
                                                        );
                                                      onUpdateSubtask(
                                                        item.id,
                                                        sub.id,
                                                        { steps: nextSteps },
                                                      );
                                                    }}
                                                    className="h-3.5 w-3.5 shrink-0 cursor-pointer border-gray-300 text-brand-600"
                                                  />
                                                  <span className="font-mono text-[10px] text-gray-400">
                                                    {idx + 1}.
                                                  </span>
                                                  <span
                                                    className={`truncate ${
                                                      st.done
                                                        ? "line-through text-gray-400 dark:text-gray-500"
                                                        : "text-gray-800 dark:text-gray-200"
                                                    }`}
                                                  >
                                                    {st.text}
                                                  </span>
                                                </label>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      </td>
                                    </tr>
                                  )}
                                </Fragment>
                              );
                            })}

                          {/* Inline Subtask Quick-Create Row under Parent (`addingSubtaskParentId === item.id`) */}
                          {addingSubtaskParentId === item.id &&
                            !item.readOnly &&
                            onAddSubtask && (
                              <tr className="bg-white ring-2 ring-inset ring-brand-500 dark:bg-gray-900">
                                <td className="border-b border-e border-gray-200 px-3 py-2 dark:border-gray-700" />
                                <td
                                  colSpan={totalColSpan - 1}
                                  className="border-b border-gray-200 px-3 py-2 dark:border-gray-700"
                                >
                                  <form
                                    onSubmit={(e) =>
                                      submitInlineSubtask(e, item)
                                    }
                                    className="flex flex-wrap items-center gap-2 ps-5"
                                  >
                                    <span
                                      aria-hidden="true"
                                      className="font-mono text-xs text-gray-400"
                                    >
                                      └
                                    </span>
                                    <span className="inline-flex items-center gap-1 border border-gray-300 bg-gray-100 px-2 py-1 text-[11px] font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                      <MonoIssueTypeIcon
                                        type="SUBTASK"
                                        size={11}
                                      />
                                      <span>Subtask for {item.key}</span>
                                    </span>
                                    <input
                                      value={newSubtaskSummary}
                                      onChange={(e) =>
                                        setNewSubtaskSummary(e.target.value)
                                      }
                                      placeholder="What needs to be done for this subtask?"
                                      aria-label={`New subtask summary for ${item.key}`}
                                      className="h-7 min-w-52 flex-1 border border-gray-300 bg-white px-2.5 text-xs text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                    />
                                    <select
                                      aria-label="New subtask priority"
                                      value={newSubtaskPriority}
                                      onChange={(e) =>
                                        setNewSubtaskPriority(
                                          e.target.value as WorkPriority,
                                        )
                                      }
                                      className="h-7 cursor-pointer border border-gray-200 bg-white px-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                                    >
                                      <option value="HIGH">
                                        {t("priorities.HIGH")}
                                      </option>
                                      <option value="MEDIUM">
                                        {t("priorities.MEDIUM")}
                                      </option>
                                      <option value="LOW">
                                        {t("priorities.LOW")}
                                      </option>
                                    </select>
                                    <select
                                      aria-label="New subtask assignee"
                                      value={newSubtaskAssigneeId}
                                      onChange={(e) =>
                                        setNewSubtaskAssigneeId(e.target.value)
                                      }
                                      className="h-7 cursor-pointer border border-gray-200 bg-white px-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                                    >
                                      {allAssigneeChoices.map((person) => (
                                        <option
                                          key={person.id}
                                          value={person.id}
                                        >
                                          {person.name}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="submit"
                                      className="inline-flex h-7 cursor-pointer items-center gap-1 bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700"
                                    >
                                      <span>{isVi ? "Tạo mới" : "Create"}</span>
                                      <span aria-hidden="true">↵</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setAddingSubtaskParentId(null);
                                        setNewSubtaskSummary("");
                                      }}
                                      className="h-7 cursor-pointer px-2 text-xs font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-white"
                                    >
                                      ✕
                                    </button>
                                  </form>
                                </td>
                              </tr>
                            )}
                        </Fragment>
                      );
                    })}
                </Fragment>
              );
            })}

            {/* Inline Spreadsheet Quick Create Row (`13-list-inline-create-active.png` — 2px solid #388BFF) */}
            {inlineCreating && onInlineCreate && (
              <tr className="bg-white ring-2 ring-inset ring-brand-500 dark:bg-gray-900">
                <td className="border-b border-e border-gray-200 px-3 py-2.5 dark:border-gray-700"/>
                <td
                  colSpan={totalColSpan - 1}
                  className="border-b border-gray-200 px-3 py-2 dark:border-gray-700"
                >
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
                      className="h-8 cursor-pointer border border-gray-200 bg-white px-2 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                    >
                      <option value="TASK">Task</option>
                      <option value="STORY">Story</option>
                      <option value="BUG">Bug</option>
                    </select>
                    <input
                      value={inlineTitle}
                      onChange={(event) => setInlineTitle(event.target.value)}
                      placeholder={isVi ? "Cần thực hiện công việc gì?" : "What needs to be done?"}
                      className="h-8 min-w-56 flex-1 border border-brand-300 bg-white px-3 text-xs text-gray-900 outline-none dark:border-brand-500 dark:bg-gray-950 dark:text-white"
                    />
                    <input
                      type="date"
                      aria-label="Inline due date"
                      value={inlineDueDate}
                      onChange={(e) => setInlineDueDate(e.target.value)}
                      className="h-8 border border-gray-200 bg-white px-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                    />
                    <select
                      aria-label="Inline assignee"
                      value={inlineAssigneeId}
                      onChange={(e) => setInlineAssigneeId(e.target.value)}
                      className="h-8 cursor-pointer border border-gray-200 bg-white px-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                    >
                      {allAssigneeChoices.map((person) => (
                        <option key={person.id} value={person.id}>
                          {person.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="inline-flex h-8 cursor-pointer items-center gap-1 bg-brand-600 px-3.5 text-xs font-semibold text-white hover:bg-brand-700"
                    >
                      <span>{isVi ? "Tạo mới" : "Create"}</span>
                      <span aria-hidden="true">↵</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setInlineCreating(false);
                        setInlineTitle("");
                      }}
                      className="h-8 cursor-pointer px-2.5 text-xs font-semibold text-gray-500 hover:text-gray-800 dark:hover:text-white"
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
      <footer className="flex flex-col gap-2 border-t border-gray-300 bg-gray-50/90 px-4 py-2.5 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-400 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          {onInlineCreate && !inlineCreating && (
            <button
              type="button"
              onClick={() => setInlineCreating(true)}
              className="inline-flex h-7 cursor-pointer items-center gap-1.5 border border-transparent px-2 font-semibold text-gray-700 transition hover:border-gray-200 hover:bg-white hover:text-brand-600 dark:text-gray-200 dark:hover:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-brand-400"
            >
              <PlusIcon
                viewBox="0 0 12 12"
                className="h-3.5 w-3.5"
                aria-hidden="true"
              />
              <span>{isVi ? "Tạo mới" : "Create"}</span>
            </button>
          )}
          <span className="hidden text-gray-400 md:inline">
            {t("createHint")}
          </span>
          {toastNotice && (
            <span
              role="status"
              className="bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
            >
              {toastNotice}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-600 dark:text-gray-300">
            {isVi
              ? `${allItems.length} / ${totalCount ?? allItems.length}`
              : `${allItems.length} of ${totalCount ?? allItems.length}`}
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
                showNotice(isVi ? "Đã làm mới danh sách công việc" : "Refreshed work items");
              }}
              title={isVi ? "Làm mới dữ liệu" : "Refresh data"}
              className="inline-flex h-6 w-6 cursor-pointer items-center justify-center text-gray-500 hover:bg-gray-200/70 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-white"
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
  allAssigneeChoices,
  hasSubtasks,
  isExpanded,
  isDone,
  showHierarchy,
  activeAssigneeRowId,
  activeStatusRowId,
  activePriorityRowId,
  activeSubtaskPopoverId,
  setActiveAssigneeRowId,
  setActiveStatusRowId,
  setActivePriorityRowId,
  setActiveSubtaskPopoverId,
  closeAllCellPopovers,
  toggleExpandRow,
  onStartAddSubtask,
  onOpenItem,
  onOpenSubtask,
  onOpenFullPage,
  onToggleSubtask,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onDueDateChange,
  showNotice,
  t,
}: {
  colKey: WorkListColumnKey;
  item: WorkItem;
  allAssigneeChoices: readonly WorkPerson[];
  hasSubtasks: boolean;
  isExpanded: boolean;
  isDone: boolean;
  showHierarchy: boolean;
  activeAssigneeRowId: string | null;
  activeStatusRowId: string | null;
  activePriorityRowId: string | null;
  activeSubtaskPopoverId: string | null;
  setActiveAssigneeRowId: (id: string | null) => void;
  setActiveStatusRowId: (id: string | null) => void;
  setActivePriorityRowId: (id: string | null) => void;
  setActiveSubtaskPopoverId: (id: string | null) => void;
  closeAllCellPopovers: () => void;
  toggleExpandRow: (id: string) => void;
  onStartAddSubtask?: () => void;
  onOpenItem: (item: WorkItem, trigger: HTMLButtonElement) => void;
  onOpenSubtask?: (
    item: WorkItem,
    subtaskId: string,
    trigger: HTMLButtonElement,
  ) => void;
  onOpenFullPage?: (item: WorkItem, subtaskId?: string | null) => void;
  onToggleSubtask?: (itemId: string, subtaskId: string) => void;
  onStatusChange?: (id: string, status: WorkStatus) => void;
  onPriorityChange?: (id: string, priority: WorkPriority) => void;
  onAssigneeChange?: (
    id: string,
    assignee: WorkPerson,
  ) => void | Promise<boolean>;
  onDueDateChange?: (id: string, dueDate: string | null) => void;
  showNotice: (msg: string) => void;
  t: ReturnType<typeof useTranslations<"work">>;
}) {
  if (item.readOnly) {
    onStatusChange = undefined;
    onPriorityChange = undefined;
    onAssigneeChange = undefined;
    onDueDateChange = undefined;
  }
  if (colKey === "work") {
    const isSubtaskPopoverOpen = activeSubtaskPopoverId === item.id;
    return (
      <div className="relative flex min-w-0 items-center gap-2">
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
          title={item.type}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
        >
          <MonoIssueTypeIcon type={item.type} size={12} />
        </span>

        {/* Jira Single-Line Spreadsheet Key + Summary */}
        <button
          type="button"
          onClick={(event) => onOpenItem(item, event.currentTarget)}
          aria-label={t("openWorkItem", {
            key: item.key,
            title: item.title,
          })}
          className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
        >
          <span
            className={`shrink-0 font-mono text-xs font-semibold text-gray-700 hover:underline dark:text-gray-300 ${
              isDone ? "line-through opacity-75" : ""
            }`}
          >
            {item.key}
          </span>
          <span
            className={`truncate text-sm font-medium text-gray-900 hover:text-gray-700 dark:text-white/90 dark:hover:text-gray-200 ${
              isDone ? "line-through opacity-70" : ""
            }`}
          >
            {item.title}
          </span>
        </button>

        {item.flagged && (
          <span
            title="Flagged"
            className="shrink-0 text-gray-600 dark:text-gray-300"
            aria-label="Flagged work item"
          >
            <MonoIcon name="flag" size={13} />
          </span>
        )}

        {item.subtasks.total > 0 && (
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => {
                const next = isSubtaskPopoverOpen ? null : item.id;
                closeAllCellPopovers();
                setActiveSubtaskPopoverId(next);
              }}
              aria-expanded={isSubtaskPopoverOpen}
              title="Click to preview subtasks"
              className={`inline-flex shrink-0 cursor-pointer items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-semibold transition ${
                isSubtaskPopoverOpen
                  ? "border-brand-400 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300"
                  : "border-gray-200 bg-gray-100 text-gray-600 hover:border-gray-300 hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400"
              }`}
            >
              <MonoIssueTypeIcon type="SUBTASK" size={10} />
              <span>
                {item.subtasks.completed}/{item.subtasks.total}
              </span>
            </button>

            {isSubtaskPopoverOpen && (
              <FloatingCellPopover
                align="start"
                widthClass="w-80"
                role="dialog"
                ariaLabel={`Subtasks for ${item.key}`}
                className="rounded-md p-2.5"
                onClose={() => setActiveSubtaskPopoverId(null)}
              >
                <div className="mb-2 flex items-center justify-between border-b border-gray-100 pb-1.5 dark:border-gray-800">
                  <span className="text-[11px] font-semibold text-gray-700 dark:text-gray-200">
                    Subtasks ({item.subtasks.completed}/{item.subtasks.total})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveSubtaskPopoverId(null);
                        toggleExpandRow(item.id);
                      }}
                      className="cursor-pointer text-[11px] font-medium text-brand-600 hover:underline dark:text-brand-400"
                    >
                      {isExpanded ? "Hide in table" : "Show in table"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveSubtaskPopoverId(null)}
                      className="cursor-pointer text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="max-h-52 space-y-1 overflow-y-auto">
                  {(item.subtaskItems ?? []).map((sub) => {
                    const subAssignee = sub.assignee ?? item.assignee;
                    return (
                      <div
                        key={sub.id}
                        className="group/subpop flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/70"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                          <input
                            type="checkbox"
                            checked={sub.done}
                            disabled={sub.readOnly}
                            onChange={() => onToggleSubtask?.(item.id, sub.id)}
                            aria-label={`Complete subtask ${sub.key}`}
                            className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-gray-300 text-brand-600"
                          />
                          <button
                            type="button"
                            onClick={(e) => {
                              setActiveSubtaskPopoverId(null);
                              if (onOpenSubtask) {
                                onOpenSubtask(item, sub.id, e.currentTarget);
                              } else {
                                onOpenItem(item, e.currentTarget);
                              }
                            }}
                            className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-start"
                          >
                            <span className="shrink-0 font-mono text-[11px] font-semibold text-brand-600 hover:underline dark:text-brand-400">
                              {sub.key}
                            </span>
                            <span
                              className={`truncate text-xs ${
                                sub.done
                                  ? "line-through text-gray-400"
                                  : "text-gray-800 dark:text-gray-200"
                              }`}
                            >
                              {sub.summary}
                            </span>
                          </button>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <WorkStatusBadge status={sub.status} />
                          <span
                            title={subAssignee.name}
                            className="flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-gray-100 text-[9px] font-bold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          >
                            {subAssignee.initials}
                          </span>
                          {onOpenFullPage && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveSubtaskPopoverId(null);
                                onOpenFullPage(item, sub.id);
                              }}
                              title={`Open ${sub.key} in full page view`}
                              aria-label={`Open ${sub.key} in full page view`}
                              className="inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-800 dark:hover:bg-gray-700 dark:hover:text-white"
                            >
                              ↗
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </FloatingCellPopover>
            )}
          </div>
        )}

        {onStartAddSubtask && (
          <button
            type="button"
            onClick={onStartAddSubtask}
            title={`Create subtask under ${item.key}`}
            aria-label={`Create subtask under ${item.key}`}
            className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded border border-transparent text-xs font-bold text-gray-400 hover:border-gray-300 hover:bg-gray-100 hover:text-gray-800 dark:hover:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-white"
          >
            +
          </button>
        )}
      </div>
    );
  }

  if (colKey ==="assignee") {
    const isEditing = activeAssigneeRowId === item.id;
    return (
      <div className="relative">
        <button
          type="button"
          disabled={!onAssigneeChange}
          onClick={() => {
            const next = isEditing ? null : item.id;
            closeAllCellPopovers();
            setActiveAssigneeRowId(next);
          }}
          title="Click to change assignee"
          className={`flex w-full cursor-pointer items-center gap-2 px-1.5 py-1 text-start transition ${
            isEditing
              ?"bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-500/15"
              :"hover:bg-gray-100/80 dark:hover:bg-gray-800"
          }`}
        >
          <PersonLabel person={item.assignee} />
        </button>

        {isEditing && onAssigneeChange && (
          <FloatingCellPopover
            align="start"
            widthClass="w-56"
            role="listbox"
            ariaLabel={`Select assignee for ${item.key}`}
            className="py-1.5"
            onClose={() => setActiveAssigneeRowId(null)}
          >
            <div className="border-b border-gray-100 px-3 py-1.5 text-[11px] font-semibold text-gray-400 dark:border-gray-800">
              Assign {item.key}
            </div>
            <div className="max-h-56 overflow-y-auto py-1">
              {allAssigneeChoices.map((person) => {
                const selected =
                  person.id === item.assignee.id ||
                  person.name === item.assignee.name;
                return (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => {
                      const saveResult = onAssigneeChange(item.id, person);
                      setActiveAssigneeRowId(null);
                      const successMessage = `Assigned ${item.key} to ${person.name}`;
                      if (
                        saveResult &&
                        typeof saveResult.then === "function"
                      ) {
                        void saveResult.then((saved) => {
                          if (saved) showNotice(successMessage);
                        });
                      } else {
                        showNotice(successMessage);
                      }
                    }}
                    className={`flex w-full cursor-pointer items-center gap-2.5 px-3 py-1.5 text-start text-xs transition ${
                      selected
                        ?"bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                        :"text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                    }`}
                  >
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center bg-brand-100 text-[10px] font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                      {person.initials}
                    </span>
                    <span className="truncate">{person.name}</span>
                  </button>
                );
              })}
            </div>
          </FloatingCellPopover>
        )}
      </div>
    );
  }

  if (colKey ==="reporter") {
    return <PersonLabel person={item.reporter} />;
  }

  if (colKey ==="priority") {
    const isEditing = activePriorityRowId === item.id;
    const priorities: readonly WorkPriority[] = ["HIGH","MEDIUM","LOW"];
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
          disabled={!onPriorityChange}
          className="cursor-pointer px-1.5 py-1 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <WorkPriorityLabel priority={item.priority} />
        </button>
        {isEditing && onPriorityChange && (
          <FloatingCellPopover
            align="start"
            widthClass="w-40"
            role="listbox"
            ariaLabel={`Select priority for ${item.key}`}
            className="py-1"
            onClose={() => setActivePriorityRowId(null)}
          >
            {priorities.map((prio) => (
              <button
                key={prio}
                type="button"
                onClick={() => {
                  onPriorityChange(item.id, prio);
                  setActivePriorityRowId(null);
                  showNotice(`Updated ${item.key} priority to ${prio}`);
                }}
                className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-start text-xs hover:bg-gray-50 dark:hover:bg-gray-800"
              >
                <WorkPriorityLabel priority={prio} />
                {item.priority === prio && (
                  <span className="text-xs font-bold text-brand-600">✓</span>
                )}
              </button>
            ))}
          </FloatingCellPopover>
        )}
      </div>
    );
  }

  if (colKey ==="status") {
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
          disabled={!onStatusChange}
          className="cursor-pointer"
        >
          <WorkStatusBadge status={item.status} showChevron={Boolean(onStatusChange)} />
        </button>

        {isEditing && onStatusChange && (
          <FloatingCellPopover
            align="start"
            widthClass="w-44"
            role="listbox"
            ariaLabel={`Select status for ${item.key}`}
            className="py-1.5"
            onClose={() => setActiveStatusRowId(null)}
          >
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
          </FloatingCellPopover>
        )}
      </div>
    );
  }

  if (colKey ==="resolution") {
    return (
      <span
        className={`whitespace-nowrap text-xs font-medium ${
          item.resolution ==="RESOLVED"
            ?"text-success-700 dark:text-success-400"
            :"text-gray-500 dark:text-gray-400"
        }`}
      >
        {t(`resolutions.${item.resolution}`)}
      </span>
    );
  }

  if (colKey ==="created") {
    return (
      <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
        {new Intl.DateTimeFormat(typeof document !== "undefined" && document.documentElement.lang === "vi" ? "vi-VN" : "en-US", {
          month:"short",
          day:"2-digit",
          year:"numeric",
          timeZone:"UTC",
        }).format(new Date(item.createdAt))}
      </span>
    );
  }

  if (colKey ==="updated") {
    const raw = item.updatedAt ?? item.createdAt;
    return (
      <span className="whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
        {new Intl.DateTimeFormat(typeof document !== "undefined" && document.documentElement.lang === "vi" ? "vi-VN" : "en-US", {
          month:"short",
          day:"2-digit",
          year:"numeric",
          timeZone:"UTC",
        }).format(new Date(raw))}
      </span>
    );
  }

  if (colKey ==="due") {
    return (
      <WorkDatePickerCell
        value={item.dueDate}
        itemKey={item.key}
        disabled={!onDueDateChange}
        onChange={
          onDueDateChange
            ? (nextDate) => {
                onDueDateChange(item.id, nextDate);
                showNotice(
                  nextDate
                    ? `Updated due date for ${item.key} to ${nextDate}`
                    : `Cleared due date for ${item.key}`,
                );
              }
            : undefined
        }
      />
    );
  }

  if (colKey ==="parent") {
    return item.parent ? (
      <span
        title={`${item.parent.key}: ${item.parent.summary}`}
        className="inline-flex max-w-44 items-center gap-1.5 truncate border border-gray-300 bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        <MonoIssueTypeIcon type="EPIC"size={11} className="shrink-0"/>
        <span className="shrink-0 font-semibold">{item.parent.key}</span>
        <span className="truncate text-gray-500 dark:text-gray-400">
          {item.parent.summary}
        </span>
      </span>
    ) : (
      <span className="text-xs text-gray-400">—</span>
    );
  }

  if (colKey ==="progress") {
    const pct =
      item.subtasks.total > 0
        ? Math.round((item.subtasks.completed / item.subtasks.total) * 100)
        : item.status ==="DONE"
          ? 100
          : item.status ==="IN_PROGRESS"
            ? 50
            : 0;
    return (
      <div className="flex items-center gap-2">
        <div className="h-1.5 w-14 overflow-hidden bg-gray-200 dark:bg-gray-800">
          <div
            style={{ width: `${pct}%` }}
            className="h-full bg-gray-700 dark:bg-gray-300"
          />
        </div>
        <span className="text-[11px] font-medium text-gray-600 dark:text-gray-300">
          {pct}%
        </span>
      </div>
    );
  }

  if (colKey ==="labels") {
    return (
      <div className="flex flex-wrap gap-1">
        {(item.labels ?? ["core-mvp"]).map((lbl) => (
          <span
            key={lbl}
            className="bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
          >
            {lbl}
          </span>
        ))}
      </div>
    );
  }

  if (colKey ==="storyPoints") {
    return (
      <span className="inline-flex h-5 min-w-5 items-center justify-center bg-gray-100 px-1.5 text-[11px] font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-300">
        {item.storyPoints ?? 3}
      </span>
    );
  }

  if (colKey ==="team") {
    return (
      <span className="text-xs text-gray-600 dark:text-gray-300">
        {item.team ??"Core Engineering"}
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
        className="flex h-6 w-6 shrink-0 items-center justify-center border border-gray-300 bg-gray-100 text-[10px] font-bold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        {person.initials}
      </span>
      {person.name}
    </span>
  );
}

function FloatingCellPopover({
  align = "start",
  widthClass = "w-48",
  role,
  ariaLabel,
  className = "",
  onClose,
  children,
}: {
  align?: "start" | "end";
  widthClass?: string;
  role?: string;
  ariaLabel?: string;
  className?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);
  const [coords, setCoords] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    function updatePosition(event?: Event) {
      if (
        event?.type === "scroll" &&
        event.target instanceof Node &&
        menuRef.current?.contains(event.target)
      ) {
        return;
      }
      const anchor = anchorRef.current;
      if (!anchor) return;
      const triggerEl =
        (anchor.previousElementSibling as HTMLElement | null) ??
        anchor.parentElement;
      if (!triggerEl) return;

      const rect = triggerEl.getBoundingClientRect();
      const menuEl = menuRef.current;
      const menuWidth = menuEl?.offsetWidth || 200;
      const menuHeight = menuEl?.offsetHeight || 220;
      const viewportW =
        typeof window !== "undefined" ? window.innerWidth : 1280;
      const viewportH =
        typeof window !== "undefined" ? window.innerHeight : 800;

      const shouldFlipUp =
        rect.bottom + menuHeight + 12 > viewportH &&
        rect.top - menuHeight - 8 > 8;
      const top = shouldFlipUp
        ? Math.max(8, rect.top - menuHeight - 4)
        : Math.max(8, rect.bottom + 4);

      const rawLeft =
        align === "end" ? rect.right - menuWidth : rect.left;
      const left = Math.max(
        8,
        Math.min(rawLeft, Math.max(8, viewportW - menuWidth - 8)),
      );

      setCoords((prev) =>
        prev.top === top && prev.left === left ? prev : { top, left },
      );
    }

    updatePosition();
    const rafId =
      typeof window !== "undefined"
        ? window.requestAnimationFrame(() => updatePosition())
        : null;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;
      if (!target) return;
      if (menuRef.current?.contains(target)) return;
      const triggerContainer = anchorRef.current?.parentElement;
      if (triggerContainer?.contains(target)) return;
      onCloseRef.current();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCloseRef.current();
      }
    }

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      if (rafId !== null && typeof window !== "undefined") {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [align]);

  const menuNode = (
    <div
      ref={menuRef}
      role={role}
      aria-label={ariaLabel}
      style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
      className={`fixed z-[80] ${widthClass} border border-gray-200 bg-white shadow-theme-lg dark:border-gray-700 dark:bg-gray-900 ${className}`}
    >
      {children}
    </div>
  );

  return (
    <>
      <span
        ref={anchorRef}
        aria-hidden="true"
        className="pointer-events-none hidden"
      />
      {typeof document !== "undefined"
        ? createPortal(menuNode, document.body)
        : menuNode}
    </>
  );
}
