"use client";

import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from"react";
import { useLocale, useTranslations } from"next-intl";
import { CloseLineIcon, TaskIcon } from"@/icons";
import { Modal } from"@/components/ui/modal";
import { PREVIEW_PEOPLE } from"./work-preview-data";
import { WorkDatePickerCell } from "./WorkDatePicker";
import { MonoIcon, MonoIssueTypeIcon } from"./WorkMonoIcons";
import { WorkPriorityLabel, WorkStatusBadge } from"./WorkStatusBadge";
import {
  WORK_STATUS_ORDER,
  type WorkItem,
  type WorkPerson,
  type WorkPriority,
  type WorkStatus,
  type WorkSubtaskItem,
} from"./work-types";

type ActivityTab ="all"|"comments"|"history"|"worklog";

type SubtaskSortBy =
  | "default"
  | "priority"
  | "status"
  | "assignee"
  | "due"
  | "key";

type ExistingTaskCandidate = Readonly<{
  id: string;
  key: string;
  summary: string;
  createdAt?: string;
  parentId: string | null;
  hasChildren: boolean;
}>;

function createdAtTimestamp(value?: string): number {
  const timestamp = Date.parse(value ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

const UNASSIGNED_PERSON: WorkPerson = {
  id: "unassigned",
  name: "Unassigned",
  initials: "UN",
};

export default function WorkItemDetailDialog({
  item,
  allItems = [],
  people,
  currentUserPerson,
  initialSubtaskId = null,
  mode = "modal",
  isSkeletonLoading = false,
  onOpenFullPage,
  onSelectSubtask,
  onClose,
  onStatusChange,
  onPriorityChange,
  onAssigneeChange,
  onDueDateChange,
  onToggleSubtask,
  onAddSubtask,
  onAddExistingTaskAsSubtask,
  onUpdateSubtask,
  onDeleteSubtask,
  onCloneSubtask,
  onReorderSubtask,
  onConvertSubtaskToTask,
  onMoveSubtaskToParent,
  onBulkUpdateSubtasks,
  onAddComment,
  onAddWorklog,
}: {
  item: WorkItem | null;
  allItems?: readonly WorkItem[];
  people?: readonly WorkPerson[];
  currentUserPerson?: WorkPerson | null;
  initialSubtaskId?: string | null;
  mode?: "modal" | "page";
  isSkeletonLoading?: boolean;
  onOpenFullPage?: (subtaskId?: string | null) => void;
  onSelectSubtask?: (subtaskId: string | null) => void;
  onClose: () => void;
  onStatusChange?: (id: string, status: WorkStatus) => void;
  onPriorityChange?: (id: string, priority: WorkPriority) => void;
  onAssigneeChange?: (id: string, assignee: WorkPerson) => void;
  onDueDateChange?: (id: string, dueDate: string | null) => void;
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
  onAddExistingTaskAsSubtask?: (parentId: string, taskId: string) => void;
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
  onBulkUpdateSubtasks?: (
    itemId: string,
    subtaskIds: readonly string[],
    patch: Partial<Omit<WorkSubtaskItem, "id" | "key">>,
  ) => void;
  onAddComment?: (itemId: string, text: string) => void;
  onAddWorklog?: (itemId: string, timeSpent: string, note: string) => void;
}) {
  const t = useTranslations("work");
  const locale = useLocale();
  const availablePeople = people ?? PREVIEW_PEOPLE;
  const assigneeChoices =
    people !== undefined
      ? [
          UNASSIGNED_PERSON,
          ...availablePeople.filter((p) => p.id !== UNASSIGNED_PERSON.id),
        ]
      : availablePeople;
  const defaultAssignee = availablePeople[0] ?? UNASSIGNED_PERSON;
  const mePerson = currentUserPerson ?? defaultAssignee;
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const [subtaskInput, setSubtaskInput] = useState("");
  const [subtaskDescInput, setSubtaskDescInput] = useState("");
  const [subtaskEstimateInput, setSubtaskEstimateInput] = useState("2h");
  const [subtaskDueDateInput, setSubtaskDueDateInput] = useState("");
  const [subtaskPriority, setSubtaskPriority] =
    useState<WorkPriority>("MEDIUM");
  const [subtaskAssigneeId, setSubtaskAssigneeId] = useState(
    defaultAssignee.id,
  );
  const [addingSubtask, setAddingSubtask] = useState(false);
  const [selectingExistingSubtask, setSelectingExistingSubtask] =
    useState(false);
  const [existingSubtaskTaskId, setExistingSubtaskTaskId] = useState("");
  const [editingSubtaskId, setEditingSubtaskId] = useState<string | null>(null);
  const [editingSubtaskSummary, setEditingSubtaskSummary] = useState("");
  // Jira Cloud collapsible sections (Image 4)
  const [descSectionCollapsed, setDescSectionCollapsed] = useState(false);
  const [subtasksSectionCollapsed, setSubtasksSectionCollapsed] =
    useState(false);
  const [detailsSectionCollapsed, setDetailsSectionCollapsed] = useState(false);
  const [isSubtaskTransitioning, setIsSubtaskTransitioning] = useState(false);
  const [subtasksMenuOpen, setSubtasksMenuOpen] = useState(false);
  const [subtaskColsMenuOpen, setSubtaskColsMenuOpen] = useState(false);
  const [subtaskSortBy, setSubtaskSortBy] = useState<SubtaskSortBy>("default");
  const [subtaskSortAsc, setSubtaskSortAsc] = useState(true);
  const [hideDoneSubtasks, setHideDoneSubtasks] = useState(false);
  const [subtaskCols, setSubtaskCols] = useState({
    priority: true,
    assignee: true,
    due: false,
    estimate: false,
    status: true,
  });
  const [activeSubtaskRowMenuId, setActiveSubtaskRowMenuId] = useState<
    string | null
  >(null);
  const [subtaskHeaderMenuOpen, setSubtaskHeaderMenuOpen] = useState(false);
  const [subtaskActivityTab, setSubtaskActivityTab] =
    useState<ActivityTab>("all");
  const [subtaskWorklogTime, setSubtaskWorklogTime] = useState("");
  const [subtaskWorklogNote, setSubtaskWorklogNote] = useState("");
  const [subtaskNotice, setSubtaskNotice] = useState<string | null>(null);
  // Inline expandable subtask detail rows inside parent's Subtasks table (default flat)
  const [expandedSubtaskIds, setExpandedSubtaskIds] = useState<Set<string>>(
    () => new Set(),
  );
  // 4th-level full Subtask Detail drill-down state
  const [subtaskIdOverride, setSubtaskIdOverride] = useState<{
    itemId: string | undefined;
    initialId: string | null;
    value: string | null;
  } | null>(null);
  const internalSubtaskId =
    subtaskIdOverride &&
    subtaskIdOverride.itemId === item?.id &&
    subtaskIdOverride.initialId === (initialSubtaskId ?? null)
      ? subtaskIdOverride.value
      : (initialSubtaskId ?? null);
  const [newStepTextBySubtask, setNewStepTextBySubtask] = useState<
    Record<string, string>
  >({});
  const [subtaskCommentInput, setSubtaskCommentInput] = useState("");
  const [editingSubtaskDesc, setEditingSubtaskDesc] = useState(false);
  const [subtaskDescDraft, setSubtaskDescDraft] = useState("");
  const [quickAddMenuOpen, setQuickAddMenuOpen] = useState(false);
  const [commentInput, setCommentInput] = useState("");
  const [branchCreated, setBranchCreated] = useState(false);
  const [commitCopied, setCommitCopied] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [watching, setWatching] = useState(true);
  const [activityTab, setActivityTab] = useState<ActivityTab>("all");
  const [aiEnhancedDesc, setAiEnhancedDesc] = useState<string | null>(null);
  const [worklogTime, setWorklogTime] = useState("");
  const [worklogNote, setWorklogNote] = useState("");
  const [automationRan, setAutomationRan] = useState(false);

  function showSubtaskFeedback(msg: string) {
    setSubtaskNotice(msg);
    setTimeout(() => {
      setSubtaskNotice((cur) => (cur === msg ? null : cur));
    }, 2400);
  }

  useEffect(() => {
    if (item && mode === "modal") {
      closeButtonRef.current?.focus();
    }
  }, [item, mode]);

  function selectSubtaskLayer(nextSubtaskId: string | null) {
    setIsSubtaskTransitioning(true);
    setSubtaskIdOverride({
      itemId: item?.id,
      initialId: initialSubtaskId ?? null,
      value: nextSubtaskId,
    });
    setEditingSubtaskDesc(false);
    onSelectSubtask?.(nextSubtaskId);
    setTimeout(() => {
      setIsSubtaskTransitioning(false);
    }, 160);
  }

  function toggleInlineSubtaskExpand(subtaskId: string) {
    setExpandedSubtaskIds((current) => {
      const next = new Set(current);
      if (next.has(subtaskId)) next.delete(subtaskId);
      else next.add(subtaskId);
      return next;
    });
  }

  function handleToggleSubtaskStep(
    sub: WorkSubtaskItem,
    stepId: string,
  ) {
    if (!item || !onUpdateSubtask) return;
    const currentSteps = sub.steps ?? [];
    const nextSteps = currentSteps.map((st) =>
      st.id === stepId ? { ...st, done: !st.done } : st,
    );
    onUpdateSubtask(item.id, sub.id, { steps: nextSteps });
  }

  function handleAddSubtaskStep(
    event: FormEvent<HTMLFormElement>,
    sub: WorkSubtaskItem,
  ) {
    event.preventDefault();
    if (!item || !onUpdateSubtask) return;
    const raw = (newStepTextBySubtask[sub.id] ?? "").trim();
    if (!raw) return;
    const currentSteps = sub.steps ?? [];
    const nextSteps = [
      ...currentSteps,
      {
        id: `${sub.id}-step-${currentSteps.length + 1}`,
        text: raw,
        done: false,
      },
    ];
    onUpdateSubtask(item.id, sub.id, { steps: nextSteps });
    setNewStepTextBySubtask((prev) => ({ ...prev, [sub.id]: "" }));
  }

  function handleDeleteSubtaskStep(sub: WorkSubtaskItem, stepId: string) {
    if (!item || !onUpdateSubtask) return;
    const nextSteps = (sub.steps ?? []).filter((st) => st.id !== stepId);
    onUpdateSubtask(item.id, sub.id, { steps: nextSteps });
  }

  function handleAddSubtaskComment(
    event: FormEvent<HTMLFormElement>,
    sub: WorkSubtaskItem,
  ) {
    event.preventDefault();
    if (!item || !onUpdateSubtask) return;
    const trimmed = subtaskCommentInput.trim();
    if (!trimmed) return;
    const nextComments = [
      ...(sub.comments ?? []),
      {
        id: `${sub.id}-c-${Date.now()}`,
        author: mePerson.name,
        initials: mePerson.initials,
        text: trimmed,
        createdAt: formatCommentTimestamp(new Date()),
      },
    ];
    onUpdateSubtask(item.id, sub.id, { comments: nextComments });
    setSubtaskCommentInput("");
  }

  function trapDialogFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !=="Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleAddSubtask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item || !onAddSubtask) return;
    const trimmed = subtaskInput.trim();
    if (!trimmed) return;
    const assignee =
      assigneeChoices.find((p) => p.id === subtaskAssigneeId) ?? item.assignee;
    onAddSubtask(item.id, trimmed, {
      assignee,
      priority: subtaskPriority,
      status: "TODO",
      dueDate: subtaskDueDateInput || item.dueDate,
      description: subtaskDescInput.trim() || undefined,
      estimate: subtaskEstimateInput.trim() || "2h",
    });
    setSubtaskInput("");
    setSubtaskDescInput("");
    setSubtaskDueDateInput("");
    setAddingSubtask(false);
    showSubtaskFeedback("Created new subtask");
  }

  function openExistingSubtaskPicker() {
    if (!onAddExistingTaskAsSubtask) {
      setAddingSubtask(true);
      return;
    }
    setAddingSubtask(false);
    setExistingSubtaskTaskId("");
    setSelectingExistingSubtask(true);
  }

  function handleAddExistingTaskAsSubtask() {
    if (!item || !onAddExistingTaskAsSubtask) return;
    const selectedTask = existingTaskCandidates.find(
      (candidate) => candidate.id === existingSubtaskTaskId,
    );
    if (!selectedTask || selectedTask.hasChildren) return;

    onAddExistingTaskAsSubtask(item.id, selectedTask.id);
    setExistingSubtaskTaskId("");
    setSelectingExistingSubtask(false);
    showSubtaskFeedback(
      t("existingTaskAdded", { key: selectedTask.key, parent: item.key }),
    );
  }

  function handleAddSubtaskWorklog(
    event: FormEvent<HTMLFormElement>,
    sub: WorkSubtaskItem,
  ) {
    event.preventDefault();
    if (!item || !onUpdateSubtask) return;
    const spent = subtaskWorklogTime.trim();
    if (!spent) return;
    const nextWorklogs = [
      ...(sub.worklogs ?? []),
      {
        id: `${sub.id}-wl-${Date.now()}`,
        author: mePerson.name,
        timeSpent: spent,
        note:
          subtaskWorklogNote.trim() ||
          `Logged engineering progress on ${sub.key}.`,
        createdAt: formatCommentTimestamp(new Date()),
      },
    ];
    onUpdateSubtask(item.id, sub.id, {
      loggedTime: spent,
      worklogs: nextWorklogs,
    });
    setSubtaskWorklogTime("");
    setSubtaskWorklogNote("");
    showSubtaskFeedback(`Logged ${spent} on ${sub.key}`);
  }

  function handleAddComment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item || !onAddComment) return;
    const trimmed = commentInput.trim();
    if (!trimmed) return;
    onAddComment(item.id, trimmed);
    setCommentInput("");
  }

  function handleAddWorklog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item || !worklogTime.trim()) return;
    onAddWorklog?.(item.id, worklogTime.trim(), worklogNote.trim());
    setWorklogTime("");
    setWorklogNote("");
  }

  function handleImproveTaskWithAi() {
    if (!item) return;
    const base = item.description ?? t("noDescription");
    setAiEnhancedDesc(
      `${base}\n\n[AI Copilot Acceptance Criteria (Given/When/Then)]:\n• Given an authenticated MEMBER in project ${item.projectName}\n• When executing ${item.key} (${item.title})\n• Then RBAC permissions, source citations, and RFC-7807 error contracts are strictly verified.`,
    );
  }

  const subtaskList = item?.subtaskItems ?? [];
  const parentCandidatesNewestFirst = useMemo(
    () =>
      [...allItems].sort(
        (a, b) =>
          createdAtTimestamp(b.createdAt) - createdAtTimestamp(a.createdAt),
      ),
    [allItems],
  );
  const existingTaskCandidates: ExistingTaskCandidate[] = (() => {
    if (!item) return [];

    const candidates = allItems.flatMap((parent) => [
      {
        id: parent.id,
        key: parent.key,
        summary: parent.title,
        createdAt: parent.createdAt,
        parentId: null,
        hasChildren: parent.subtasks.total > 0,
      },
      ...(parent.subtaskItems ?? []).map((subtask) => ({
        id: subtask.id,
        key: subtask.key,
        summary: subtask.summary,
        createdAt: subtask.createdAt,
        parentId: parent.id,
        hasChildren: false,
      })),
    ]);

    return candidates
      .filter(
        (candidate) =>
          candidate.id !== item.id && candidate.parentId !== item.id,
      )
      .sort((a, b) => {
        return (
          createdAtTimestamp(b.createdAt) - createdAtTimestamp(a.createdAt)
        );
      });
  })();
  const selectedExistingTask = existingTaskCandidates.find(
    (candidate) => candidate.id === existingSubtaskTaskId,
  );
  const displayedSubtasks = (() => {
    const filtered = hideDoneSubtasks
      ? subtaskList.filter((s) => !s.done)
      : [...subtaskList];
    if (subtaskSortBy === "default") {
      return subtaskSortAsc ? filtered : [...filtered].reverse();
    }
    const prioOrder: Record<WorkPriority, number> = {
      HIGH: 0,
      MEDIUM: 1,
      LOW: 2,
    };
    const dir = subtaskSortAsc ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (subtaskSortBy === "priority") {
        const pa = prioOrder[a.priority ?? item?.priority ?? "MEDIUM"];
        const pb = prioOrder[b.priority ?? item?.priority ?? "MEDIUM"];
        return (pa - pb) * dir;
      }
      if (subtaskSortBy === "status") {
        return (
          (WORK_STATUS_ORDER.indexOf(a.status) -
            WORK_STATUS_ORDER.indexOf(b.status)) *
          dir
        );
      }
      if (subtaskSortBy === "assignee") {
        const na = (a.assignee ?? item?.assignee)?.name ?? "";
        const nb = (b.assignee ?? item?.assignee)?.name ?? "";
        return na.localeCompare(nb) * dir;
      }
      if (subtaskSortBy === "due") {
        const da = a.dueDate ?? item?.dueDate ?? "9999-12-31";
        const db = b.dueDate ?? item?.dueDate ?? "9999-12-31";
        return da.localeCompare(db) * dir;
      }
      return a.key.localeCompare(b.key) * dir;
    });
  })();
  const activeSubtaskIndex = internalSubtaskId
    ? subtaskList.findIndex((s) => s.id === internalSubtaskId)
    : -1;
  const activeSubtask =
    activeSubtaskIndex >= 0 ? subtaskList[activeSubtaskIndex] : null;
  const allSubtasksInlineExpanded =
    subtaskList.length > 0 &&
    subtaskList.every((s) => expandedSubtaskIds.has(s.id));

  const showSkeletonOverlay = isSkeletonLoading || isSubtaskTransitioning;

  const detailContent = item ? (
    <div
      ref={dialogRef}
      role={mode === "modal" ? "dialog" : "region"}
      aria-modal={mode === "modal" ? "true" : undefined}
      aria-labelledby="work-detail-title"
      aria-describedby="work-detail-description"
      onKeyDown={mode === "modal" ? trapDialogFocus : undefined}
      className={
        mode === "page"
          ? "relative min-w-0 rounded-md border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
          : "relative max-h-[92vh] overflow-y-auto bg-white dark:bg-gray-900"
      }
    >
      {/* 2-Column Jira Skeleton Loading Overlay */}
      {showSkeletonOverlay && (
        <div
          aria-hidden="true"
          data-testid="work-detail-skeleton"
          className=" absolute inset-0 z-40 grid min-h-[28rem] grid-cols-1 bg-white/95 backdrop-blur-[1px] lg:grid-cols-[minmax(0,1fr)_22rem] dark:bg-gray-900/95"
        >
          <div className="animate-pulse space-y-5 p-6">
            <div className="h-3.5 w-48 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="h-7 w-3/4 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="flex gap-2">
              <div className="h-7 w-20 rounded bg-gray-100 dark:bg-gray-800" />
              <div className="h-7 w-24 rounded bg-gray-100 dark:bg-gray-800" />
            </div>
            <div className="space-y-2 pt-2">
              <div className="h-4 w-28 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-20 w-full rounded bg-gray-100 dark:bg-gray-800/70" />
            </div>
            <div className="space-y-2 pt-2">
              <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-2 w-full rounded bg-gray-200 dark:bg-gray-800" />
              <div className="h-9 w-full rounded bg-gray-100 dark:bg-gray-800/70" />
              <div className="h-9 w-full rounded bg-gray-100 dark:bg-gray-800/70" />
            </div>
          </div>
          <div className="animate-pulse space-y-4 border-t border-gray-200 bg-gray-50/50 p-6 lg:border-s lg:border-t-0 dark:border-gray-800 dark:bg-gray-950/40">
            <div className="h-8 w-28 rounded bg-gray-200 dark:bg-gray-800" />
            <div className="space-y-3 rounded-md border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
              <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-800" />
              {Array.from({ length: 6 }, (_, idx) => (
                <div key={idx} className="grid grid-cols-[6rem_1fr] items-center gap-3">
                  <div className="h-3.5 w-16 rounded bg-gray-200 dark:bg-gray-800" />
                  <div className="h-5 w-full rounded bg-gray-100 dark:bg-gray-800/70" />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {subtaskNotice && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between border-b border-gray-800 bg-gray-900 px-5 py-2 text-xs font-semibold text-white dark:border-gray-700 dark:bg-gray-800"
        >
          <span>✓ {subtaskNotice}</span>
          <button
            type="button"
            onClick={() => setSubtaskNotice(null)}
            className="cursor-pointer text-gray-300 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}
      <header className="flex items-center justify-between gap-4 border-b border-gray-200 px-5 py-3 sm:px-6 dark:border-gray-800">
        <div className="min-w-0">
          <nav
            aria-label={t("detailBreadcrumb")}
            className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400"
          >
            {mode === "page" && (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="me-1.5 inline-flex h-7 cursor-pointer items-center gap-1 rounded border border-gray-200 bg-gray-50 px-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                >
                  <span>←</span>
                  <span>Back to workspace</span>
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer hover:text-gray-900 hover:underline dark:hover:text-white"
                >
                  Spaces
                </button>
                <span aria-hidden="true">/</span>
              </>
            )}
            <button
              type="button"
              onClick={mode === "page" ? onClose : undefined}
              className={`inline-flex items-center gap-1.5 ${
                mode === "page" ? "cursor-pointer hover:text-gray-900 hover:underline dark:hover:text-white" : ""
              }`}
            >
              <TaskIcon
                viewBox="0 0 24 24"
                className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400"
                aria-hidden="true"
              />
              <span>{item.projectName}</span>
            </button>
            {item.parent && (
              <>
                <span aria-hidden="true">/</span>
                <span className="inline-flex items-center gap-1 font-medium text-gray-700 dark:text-gray-300">
                  <MonoIssueTypeIcon
                    type="EPIC"
                    className="h-3.5 w-3.5 text-gray-600 dark:text-gray-400"
                  />
                  <span>{item.parent.key}</span>
                </span>
              </>
            )}
            <span aria-hidden="true">/</span>
            {activeSubtask ? (
              <>
                <button
                  type="button"
                  onClick={() => selectSubtaskLayer(null)}
                  title={`Back to parent ${item.key}`}
                  className="inline-flex cursor-pointer items-center gap-1 font-semibold text-brand-600 hover:underline dark:text-brand-400"
                >
                  <MonoIssueTypeIcon
                    type={item.type}
                    className="h-3.5 w-3.5"
                  />
                  <span>{item.key}</span>
                </button>
                <span aria-hidden="true">/</span>
                <span className="inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono font-semibold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                  <MonoIssueTypeIcon
                    type="SUBTASK"
                    className="h-3 w-3 text-gray-700 dark:text-gray-300"
                  />
                  <span>{activeSubtask.key}</span>
                </span>
              </>
            ) : (
              <span className="font-mono font-semibold text-gray-900 dark:text-white">
                {item.key}
              </span>
            )}
          </nav>
          <p id="work-detail-description" className="sr-only">
            {activeSubtask
              ? `Subtask detail layer • Child of ${item.key} (${item.title})`
              : t("detailPreviewHint")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {activeSubtask && (
            <div className="me-1 flex items-center gap-1">
              <button
                type="button"
                onClick={() => selectSubtaskLayer(null)}
                className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded border border-gray-300 bg-gray-100 px-2.5 text-xs font-semibold text-gray-800 hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <span>←</span>
                <span>Back to {item.key}</span>
              </button>
              <div className="inline-flex h-8 items-center rounded border border-gray-200 bg-white text-xs dark:border-gray-700 dark:bg-gray-900">
                <button
                  type="button"
                  disabled={activeSubtaskIndex <= 0}
                  onClick={() => {
                    if (activeSubtaskIndex > 0) {
                      selectSubtaskLayer(
                        subtaskList[activeSubtaskIndex - 1].id,
                      );
                    }
                  }}
                  title="Previous subtask"
                  aria-label="Previous subtask"
                  className="h-full cursor-pointer px-2 font-bold text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  ‹
                </button>
                <span className="border-x border-gray-200 px-2 font-mono text-[11px] text-gray-600 dark:border-gray-700 dark:text-gray-300">
                  {activeSubtaskIndex + 1}/{subtaskList.length}
                </span>
                <button
                  type="button"
                  disabled={activeSubtaskIndex >= subtaskList.length - 1}
                  onClick={() => {
                    if (activeSubtaskIndex < subtaskList.length - 1) {
                      selectSubtaskLayer(
                        subtaskList[activeSubtaskIndex + 1].id,
                      );
                    }
                  }}
                  title="Next subtask"
                  aria-label="Next subtask"
                  className="h-full cursor-pointer px-2 font-bold text-gray-600 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  ›
                </button>
              </div>
            </div>
          )}

          {/* Share / Copy Link Button */}
          <button
            type="button"
            onClick={() => {
              const targetKey = activeSubtask
                ? activeSubtask.key
                : item.key;
              if (typeof navigator !== "undefined") {
                navigator.clipboard?.writeText(
                  `${window.location.origin}${window.location.pathname}#${targetKey}`,
                );
              }
              showSubtaskFeedback(`Copied link to ${targetKey}`);
            }}
            title="Copy link"
            aria-label="Copy link"
            className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <MonoIcon name="link" className="h-3.5 w-3.5" />
          </button>

          {/* Subtask Header More Actions Menu (`···`) when in 4th-level Subtask Detail */}
          {activeSubtask && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setSubtaskHeaderMenuOpen((prev) => !prev)}
                aria-label={`More actions for subtask ${activeSubtask.key}`}
                title="Subtask actions"
                className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
              >
                ···
              </button>
              {subtaskHeaderMenuOpen && (
                <div
                  role="menu"
                  aria-label="Subtask header actions"
                  className="absolute end-0 top-full z-40 mt-1 w-52 rounded-md border border-gray-200 bg-white py-1.5 text-xs shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
                >
                  {onUpdateSubtask && (
                    <button
                      type="button"
                      onClick={() => {
                        setSubtaskHeaderMenuOpen(false);
                        onUpdateSubtask(item.id, activeSubtask.id, {
                          assignee: mePerson,
                        });
                        showSubtaskFeedback(
                          `Assigned ${activeSubtask.key} to ${mePerson.name}`,
                        );
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-start text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <MonoIcon name="user" size={12} />
                      <span>Assign to me ({mePerson.name})</span>
                    </button>
                  )}
                  {onUpdateSubtask && (
                    <button
                      type="button"
                      onClick={() => {
                        setSubtaskHeaderMenuOpen(false);
                        onUpdateSubtask(item.id, activeSubtask.id, {
                          flagged: !activeSubtask.flagged,
                        });
                        showSubtaskFeedback(
                          activeSubtask.flagged
                            ? `Removed flag from ${activeSubtask.key}`
                            : `Flagged ${activeSubtask.key}`,
                        );
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-start text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <MonoIcon name="flag" size={12} />
                      <span>
                        {activeSubtask.flagged ? "Remove flag" : "Add flag"}
                      </span>
                    </button>
                  )}
                  {onCloneSubtask && (
                    <button
                      type="button"
                      onClick={() => {
                        setSubtaskHeaderMenuOpen(false);
                        onCloneSubtask(item.id, activeSubtask.id);
                        showSubtaskFeedback(
                          `Cloned subtask ${activeSubtask.key}`,
                        );
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-start text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <MonoIcon name="copy" size={12} />
                      <span>Clone subtask</span>
                    </button>
                  )}
                  {onConvertSubtaskToTask && (
                    <button
                      type="button"
                      onClick={() => {
                        setSubtaskHeaderMenuOpen(false);
                        onConvertSubtaskToTask(item.id, activeSubtask.id);
                        showSubtaskFeedback(
                          `Converted ${activeSubtask.key} to standalone Task`,
                        );
                      }}
                      className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-start text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <MonoIcon name="arrowUpRight" size={12} />
                      <span>Convert to standalone Task</span>
                    </button>
                  )}
                  {onDeleteSubtask && (
                    <>
                      <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                      <button
                        type="button"
                        onClick={() => {
                          setSubtaskHeaderMenuOpen(false);
                          onDeleteSubtask(item.id, activeSubtask.id);
                          selectSubtaskLayer(null);
                        }}
                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-start font-medium text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        <MonoIcon name="trash" size={12} />
                        <span>Delete subtask</span>
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Watch Counter Toggle */}
          <button
            type="button"
            onClick={() => setWatching((prev) => !prev)}
            title="Watch issue"
            className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded border px-2.5 text-xs font-semibold transition ${
              watching
                ? "border-gray-300 bg-gray-100 text-gray-800 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-200"
                : "border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300"
            }`}
          >
            <MonoIcon name="eye" className="h-3.5 w-3.5" />
            <span>{watching ? 2 : 1}</span>
          </button>

          {/* Open in Full Page View (Image 4) or Maximize Modal */}
          {mode === "modal" && (
            <button
              type="button"
              onClick={() => {
                if (onOpenFullPage) {
                  onOpenFullPage(internalSubtaskId);
                } else {
                  setIsMaximized((prev) => !prev);
                }
              }}
              title={
                onOpenFullPage
                  ? "Open in full page view"
                  : isMaximized
                    ? "Restore modal size"
                    : "Full page view"
              }
              aria-label="Open in full page view"
              className="inline-flex h-8 cursor-pointer items-center gap-1 rounded border border-gray-200 px-2 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <MonoIcon name="maximize" className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Full view</span>
            </button>
          )}

          {/* Close Button */}
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label={t("closeDetails")}
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
          >
            <CloseLineIcon
              viewBox="0 0 17 16"
              className="h-4 w-4"
              aria-hidden="true"
            />
          </button>
        </div>
      </header>

      {activeSubtask ? (
        /* =====================================================================
         * 4TH-LEVEL FULL SUBTASK DETAIL LAYER (DRILL-DOWN VIEW — IMAGE 4 STYLE)
         * ===================================================================== */
        <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
          <main
            className={`min-w-0 space-y-5 px-5 py-5 sm:px-7 sm:py-6 ${
              mode === "page" ? "lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto" : ""
            }`}
          >
                {/* Subtask Status, Type & Parent Context Strip */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <WorkStatusBadge status={activeSubtask.status} />
                    <span className="inline-flex items-center gap-1.5 border border-gray-300 bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                      <MonoIssueTypeIcon type="SUBTASK" size={12} />
                      <span>Subtask • {activeSubtask.key}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => selectSubtaskLayer(null)}
                      className="inline-flex cursor-pointer items-center gap-1.5 border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                    >
                      <MonoIssueTypeIcon type={item.type} size={11} />
                      <span>Parent: {item.key}</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onToggleSubtask?.(item.id, activeSubtask.id)}
                    className={`inline-flex h-8 cursor-pointer items-center gap-1.5 border px-3 text-xs font-semibold transition ${
                      activeSubtask.done
                        ? "border-gray-900 bg-gray-900 text-white dark:border-gray-100 dark:bg-gray-100 dark:text-gray-900"
                        : "border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                    }`}
                  >
                    <MonoIcon name="check" size={12} />
                    <span>
                      {activeSubtask.done ? "Completed" : "Mark subtask done"}
                    </span>
                  </button>
                </div>

                {/* Subtask Title with inline rename */}
                <div>
                  {editingSubtaskId === activeSubtask.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const trimmed = editingSubtaskSummary.trim();
                        if (trimmed && onUpdateSubtask) {
                          onUpdateSubtask(item.id, activeSubtask.id, {
                            summary: trimmed,
                          });
                        }
                        setEditingSubtaskId(null);
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        value={editingSubtaskSummary}
                        onChange={(e) =>
                          setEditingSubtaskSummary(e.target.value)
                        }
                        className="h-9 flex-1 border border-gray-300 bg-white px-3 text-base font-semibold text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                      />
                      <button
                        type="submit"
                        className="h-9 cursor-pointer bg-gray-900 px-3 text-xs font-semibold text-white dark:bg-gray-100 dark:text-gray-900"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingSubtaskId(null)}
                        className="h-9 cursor-pointer border border-gray-200 px-2.5 text-xs text-gray-600 dark:border-gray-700 dark:text-gray-300"
                      >
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div className="flex items-start justify-between gap-3">
                      <h2
                        id="work-detail-title"
                        className={`text-xl font-semibold leading-7 sm:text-2xl ${
                          activeSubtask.done
                            ? "line-through text-gray-400 dark:text-gray-500"
                            : "text-gray-900 dark:text-white/90"
                        }`}
                      >
                        {activeSubtask.summary}
                      </h2>
                      {onUpdateSubtask && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSubtaskId(activeSubtask.id);
                            setEditingSubtaskSummary(activeSubtask.summary);
                          }}
                          title="Edit subtask title"
                          className="inline-flex h-8 shrink-0 cursor-pointer items-center gap-1 border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                        >
                          <MonoIcon name="edit" size={12} />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Subtask Description Section (Image 4 clean white collapsible section) */}
                <section
                  aria-label="Subtask description"
                  className="space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setDescSectionCollapsed((prev) => !prev)}
                      className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-gray-800 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
                    >
                      <span aria-hidden="true" className="text-xs">
                        {descSectionCollapsed ? "▸" : "▾"}
                      </span>
                      <span>{t("description")}</span>
                    </button>
                    {onUpdateSubtask && !editingSubtaskDesc && (
                      <button
                        type="button"
                        onClick={() => {
                          setDescSectionCollapsed(false);
                          setSubtaskDescDraft(activeSubtask.description ?? "");
                          setEditingSubtaskDesc(true);
                        }}
                        className="inline-flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
                      >
                        <MonoIcon name="edit" size={11} />
                        <span>Edit</span>
                      </button>
                    )}
                  </div>

                  {!descSectionCollapsed &&
                    (editingSubtaskDesc ? (
                      <form
                        onSubmit={(e) => {
                          e.preventDefault();
                          onUpdateSubtask?.(item.id, activeSubtask.id, {
                            description: subtaskDescDraft.trim(),
                          });
                          setEditingSubtaskDesc(false);
                        }}
                        className="space-y-2 ps-4"
                      >
                        <textarea
                          rows={4}
                          value={subtaskDescDraft}
                          onChange={(e) => setSubtaskDescDraft(e.target.value)}
                          placeholder="Add a description…"
                          className="w-full rounded border border-gray-300 bg-white p-3 text-sm text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="submit"
                            className="h-8 cursor-pointer rounded bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingSubtaskDesc(false)}
                            className="h-8 cursor-pointer rounded px-3 text-xs font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <p
                        onClick={() => {
                          if (!onUpdateSubtask) return;
                          setSubtaskDescDraft(activeSubtask.description ?? "");
                          setEditingSubtaskDesc(true);
                        }}
                        className="cursor-text whitespace-pre-line rounded px-4 py-2 text-sm leading-6 text-gray-700 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/40"
                      >
                        {activeSubtask.description || "Add a description..."}
                      </p>
                    ))}
                </section>

                {/* Subtask Implementation Steps / Acceptance Checklist Layer (clean unboxed Jira checklist) */}
                <section
                  aria-label="Subtask implementation steps"
                  className="space-y-2.5 pt-2"
                >
                  {(() => {
                    const steps = activeSubtask.steps ?? [];
                    const completedSteps = steps.filter((s) => s.done).length;
                    const stepPct =
                      steps.length === 0
                        ? activeSubtask.done
                          ? 100
                          : 0
                        : Math.round((completedSteps / steps.length) * 100);
                    return (
                      <>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span aria-hidden="true" className="text-xs text-gray-500">
                              ▾
                            </span>
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                              Checklist
                            </h3>
                            <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                              {stepPct}% Done
                            </span>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {completedSteps}/{steps.length}
                          </span>
                        </div>

                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                          <div
                            className="h-full bg-success-500 transition-all"
                            style={{ width: `${stepPct}%` }}
                          />
                        </div>

                        {steps.length > 0 ? (
                          <ul className="divide-y divide-gray-100 border-y border-gray-100 dark:divide-gray-800 dark:border-gray-800">
                            {steps.map((st, idx) => (
                              <li
                                key={st.id}
                                className="flex items-center justify-between gap-3 px-2 py-1.5 text-xs hover:bg-gray-50 dark:hover:bg-gray-800/50"
                              >
                                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                                  <input
                                    type="checkbox"
                                    checked={st.done}
                                    onChange={() =>
                                      handleToggleSubtaskStep(
                                        activeSubtask,
                                        st.id,
                                      )
                                    }
                                    className="h-3.5 w-3.5 shrink-0 cursor-pointer rounded border-gray-300 text-brand-600"
                                  />
                                  <span className="font-mono text-[11px] text-gray-400">
                                    {idx + 1}.
                                  </span>
                                  <span
                                    className={
                                      st.done
                                        ? "line-through text-gray-400 dark:text-gray-500"
                                        : "font-medium text-gray-800 dark:text-gray-200"
                                    }
                                  >
                                    {st.text}
                                  </span>
                                </label>
                                {onUpdateSubtask && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleDeleteSubtaskStep(
                                        activeSubtask,
                                        st.id,
                                      )
                                    }
                                    title="Remove step"
                                    aria-label={`Remove step ${st.text}`}
                                    className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-white"
                                  >
                                    <MonoIcon name="trash" size={11} />
                                  </button>
                                )}
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="ps-4 text-xs text-gray-500 dark:text-gray-400">
                            No checklist items yet.
                          </p>
                        )}

                        {onUpdateSubtask && (
                          <form
                            onSubmit={(e) =>
                              handleAddSubtaskStep(e, activeSubtask)
                            }
                            className="flex items-center gap-2 pt-1"
                          >
                            <input
                              value={
                                newStepTextBySubtask[activeSubtask.id] ?? ""
                              }
                              onChange={(e) =>
                                setNewStepTextBySubtask((prev) => ({
                                  ...prev,
                                  [activeSubtask.id]: e.target.value,
                                }))
                              }
                              placeholder="Add checklist item…"
                              className="h-8 flex-1 rounded border border-gray-200 bg-white px-3 text-xs text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                            />
                            <button
                              type="submit"
                              className="h-8 cursor-pointer rounded bg-gray-100 px-3 text-xs font-semibold text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200"
                            >
                              + Add
                            </button>
                          </form>
                        )}
                      </>
                    );
                  })()}
                </section>

                {/* Subtask Comments & Activity Section with 4 Jira Tabs (`All`, `Comments`, `History`, `Work log`) */}
                <section
                  aria-label="Subtask activity and comments"
                  className="space-y-3 border-t border-gray-100 pt-5 dark:border-gray-800"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                      ▾ Activity
                    </h3>
                    <div className="inline-flex rounded border border-gray-200 bg-gray-50 p-0.5 text-xs dark:border-gray-800 dark:bg-gray-950">
                      {(
                        [
                          { id: "all", label: "All" },
                          { id: "comments", label: "Comments" },
                          { id: "history", label: "History" },
                          { id: "worklog", label: "Work log" },
                        ] as const
                      ).map((tab) => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setSubtaskActivityTab(tab.id)}
                          className={`cursor-pointer rounded px-2.5 py-1 font-medium transition ${
                            subtaskActivityTab === tab.id
                              ? "bg-white text-brand-600 shadow-theme-xs dark:bg-gray-800 dark:text-brand-400"
                              : "text-gray-600 hover:text-gray-900 dark:text-gray-400"
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {(subtaskActivityTab === "all" ||
                    subtaskActivityTab === "comments") && (
                    <>
                      {onUpdateSubtask && (
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {[
                              "Implementation verified",
                              "Ready for code review",
                              "Blocked by dependency",
                            ].map((chip) => (
                              <button
                                key={chip}
                                type="button"
                                onClick={() => setSubtaskCommentInput(chip)}
                                className="cursor-pointer rounded border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                              >
                                {chip}
                              </button>
                            ))}
                          </div>
                          <form
                            onSubmit={(e) =>
                              handleAddSubtaskComment(e, activeSubtask)
                            }
                            className="flex items-start gap-2"
                          >
                            <input
                              value={subtaskCommentInput}
                              onChange={(e) =>
                                setSubtaskCommentInput(e.target.value)
                              }
                              placeholder="Add a comment…"
                              className="h-9 flex-1 rounded border border-gray-200 bg-white px-3 text-xs text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                            />
                            <button
                              type="submit"
                              className="h-9 cursor-pointer rounded bg-brand-600 px-3.5 text-xs font-semibold text-white hover:bg-brand-700"
                            >
                              Comment
                            </button>
                          </form>
                        </div>
                      )}

                      {activeSubtask.comments &&
                      activeSubtask.comments.length > 0 ? (
                        <ul className="space-y-2">
                          {activeSubtask.comments.map((c) => (
                            <li
                              key={c.id}
                              className="rounded border border-gray-100 bg-gray-50/60 p-3 text-xs dark:border-gray-800 dark:bg-gray-900"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-gray-900 dark:text-white">
                                  {c.author}
                                </span>
                                <span className="tabular-nums text-gray-400">
                                  {formatCommentTimestamp(c.createdAt)}
                                </span>
                              </div>
                              <p className="mt-1 text-gray-700 dark:text-gray-300">
                                {c.text}
                              </p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          No comments on this subtask yet.
                        </p>
                      )}
                    </>
                  )}

                  {subtaskActivityTab === "history" && (
                    <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                      <li className="rounded border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-gray-900">
                        <strong>
                          {(activeSubtask.assignee ?? item.assignee).name}
                        </strong>{" "}
                        updated subtask status to{" "}
                        <strong>{activeSubtask.status}</strong> • Today
                      </li>
                      {(activeSubtask.history ?? []).map((h) => (
                        <li
                          key={h.id}
                          className="rounded border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-gray-900"
                        >
                          <strong>{h.author}</strong> {h.action} • {h.createdAt}
                        </li>
                      ))}
                      <li className="rounded border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-gray-900">
                        <strong>
                          {(activeSubtask.reporter ?? item.reporter).name}
                        </strong>{" "}
                        created subtask <strong>{activeSubtask.key}</strong>{" "}
                        under parent <strong>{item.key}</strong>
                      </li>
                    </ul>
                  )}

                  {subtaskActivityTab === "worklog" && (
                    <div className="space-y-3">
                      {onUpdateSubtask && (
                        <form
                          onSubmit={(e) =>
                            handleAddSubtaskWorklog(e, activeSubtask)
                          }
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input
                            value={subtaskWorklogTime}
                            onChange={(e) =>
                              setSubtaskWorklogTime(e.target.value)
                            }
                            placeholder="Time spent (e.g. 1h 30m)"
                            aria-label="Subtask worklog time spent"
                            className="h-8 w-40 rounded border border-gray-200 bg-white px-2.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                          />
                          <input
                            value={subtaskWorklogNote}
                            onChange={(e) =>
                              setSubtaskWorklogNote(e.target.value)
                            }
                            placeholder="Subtask work log note…"
                            aria-label="Subtask worklog note"
                            className="h-8 flex-1 rounded border border-gray-200 bg-white px-2.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                          />
                          <button
                            type="submit"
                            className="h-8 cursor-pointer rounded bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700"
                          >
                            + Log subtask work
                          </button>
                        </form>
                      )}
                      {activeSubtask.worklogs &&
                      activeSubtask.worklogs.length > 0 ? (
                        <ul className="space-y-2 text-xs">
                          {activeSubtask.worklogs.map((wl) => (
                            <li
                              key={wl.id}
                              className="rounded border border-gray-100 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-gray-900"
                            >
                              <div className="flex items-center justify-between font-semibold text-gray-900 dark:text-white">
                                <div className="flex items-center gap-2">
                                  <span>{wl.author}</span>
                                  {wl.createdAt && (
                                    <span className="tabular-nums font-normal text-gray-400">
                                      {formatCommentTimestamp(wl.createdAt)}
                                    </span>
                                  )}
                                </div>
                                <span className="inline-flex items-center gap-1 tabular-nums text-gray-700 dark:text-gray-300">
                                  <MonoIcon name="clock" className="h-3.5 w-3.5" />
                                  <span>{wl.timeSpent}</span>
                                </span>
                              </div>
                              {wl.note && (
                                <p className="mt-1 text-gray-600 dark:text-gray-300">
                                  {wl.note}
                                </p>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          No work logged on this subtask yet.
                        </p>
                      )}
                    </div>
                  )}
                </section>
              </main>

              {/* Right Sidebar for Subtask Detail Layer (Image 4 Jira Cloud Details Card) */}
              <aside
                className={`min-w-0 space-y-4 border-t border-gray-200 bg-white px-5 py-5 sm:px-6 lg:border-s lg:border-t-0 dark:border-gray-800 dark:bg-gray-900 ${
                  mode === "page" ? "lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto" : ""
                }`}
              >
                {/* Top Status Transition Selector (Image 4) */}
                <div className="flex items-center justify-between gap-2">
                  <label className="relative inline-flex cursor-pointer items-center">
                    <WorkStatusBadge status={activeSubtask.status} showChevron />
                    {onUpdateSubtask && (
                      <select
                        aria-label={`Update status for ${activeSubtask.key}`}
                        value={activeSubtask.status}
                        onChange={(e) =>
                          onUpdateSubtask(item.id, activeSubtask.id, {
                            status: e.target.value as WorkStatus,
                          })
                        }
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
                </div>

                {/* Collapsible Details Card (Image 4) */}
                <section className="rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
                    <button
                      type="button"
                      onClick={() =>
                        setDetailsSectionCollapsed((prev) => !prev)
                      }
                      aria-expanded={!detailsSectionCollapsed}
                      className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200"
                    >
                      <span aria-hidden="true">
                        {detailsSectionCollapsed ? "▸" : "▾"}
                      </span>
                      <span>{t("details")}</span>
                    </button>
                    <MonoIcon
                      name="sliders"
                      size={13}
                      className="text-gray-400"
                    />
                  </div>

                  {!detailsSectionCollapsed && (
                    <dl className="space-y-3 p-4">
                      <DetailField label={t("assignee")}>
                        <div className="space-y-1">
                          <label className="relative flex cursor-pointer items-center rounded px-1.5 py-1 transition hover:bg-gray-50 dark:hover:bg-gray-800">
                            <PersonValue
                              person={activeSubtask.assignee ?? item.assignee}
                            />
                            {onUpdateSubtask && (
                              <select
                                aria-label={`Reassign ${activeSubtask.key}`}
                                value={
                                  (activeSubtask.assignee ?? item.assignee).id
                                }
                                onChange={(e) => {
                                  const nextPerson = assigneeChoices.find(
                                    (p) => p.id === e.target.value,
                                  );
                                  if (nextPerson) {
                                    onUpdateSubtask(item.id, activeSubtask.id, {
                                      assignee: nextPerson,
                                    });
                                  }
                                }}
                                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                              >
                                {assigneeChoices.map((person) => (
                                  <option key={person.id} value={person.id}>
                                    {person.name}
                                  </option>
                                ))}
                              </select>
                            )}
                          </label>
                          {onUpdateSubtask && (
                            <button
                              type="button"
                              onClick={() => {
                                onUpdateSubtask(item.id, activeSubtask.id, {
                                  assignee: mePerson,
                                });
                                showSubtaskFeedback(
                                  `Assigned ${activeSubtask.key} to ${mePerson.name}`,
                                );
                              }}
                              className="cursor-pointer ps-1.5 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                            >
                              Assign to me
                            </button>
                          )}
                        </div>
                      </DetailField>

                      <DetailField label={t("priority")}>
                        <label className="relative inline-flex cursor-pointer items-center rounded px-1.5 py-1 transition hover:bg-gray-50 dark:hover:bg-gray-800">
                          <WorkPriorityLabel
                            priority={activeSubtask.priority ?? item.priority}
                          />
                          {onUpdateSubtask && (
                            <select
                              aria-label={`Update priority for ${activeSubtask.key}`}
                              value={activeSubtask.priority ?? item.priority}
                              onChange={(e) =>
                                onUpdateSubtask(item.id, activeSubtask.id, {
                                  priority: e.target.value as WorkPriority,
                                })
                              }
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            >
                              <option value="HIGH">{t("priorities.HIGH")}</option>
                              <option value="MEDIUM">
                                {t("priorities.MEDIUM")}
                              </option>
                              <option value="LOW">{t("priorities.LOW")}</option>
                            </select>
                          )}
                        </label>
                      </DetailField>

                      <DetailField label="Parent">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => selectSubtaskLayer(null)}
                            className="inline-flex min-w-0 cursor-pointer items-center gap-1.5 rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-start text-xs font-medium text-brand-600 hover:underline dark:border-gray-700 dark:bg-gray-800 dark:text-brand-400"
                          >
                            <MonoIssueTypeIcon type={item.type} size={11} />
                            <span className="truncate">
                              {item.key} {item.title}
                            </span>
                          </button>
                          {onMoveSubtaskToParent && allItems.length > 1 && (
                            <select
                              aria-label={`Change parent for ${activeSubtask.key}`}
                              value={item.id}
                              onChange={(e) => {
                                const nextParentId = e.target.value;
                                if (nextParentId && nextParentId !== item.id) {
                                  onMoveSubtaskToParent(
                                    item.id,
                                    activeSubtask.id,
                                    nextParentId,
                                  );
                                  showSubtaskFeedback(
                                    `Moved subtask ${activeSubtask.key} to new parent`,
                                  );
                                }
                              }}
                              className="sr-only"
                            >
                              {parentCandidatesNewestFirst.map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  Parent: {candidate.key} ({candidate.title})
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </DetailField>

                      <DetailField label={t("dueDate")}>
                        <WorkDatePickerCell
                          value={activeSubtask.dueDate ?? item.dueDate ?? null}
                          itemKey={activeSubtask.key}
                          placeholder={t("noDueDate")}
                          disabled={!onUpdateSubtask}
                          onChange={
                            onUpdateSubtask
                              ? (nextDate) => {
                                  onUpdateSubtask(item.id, activeSubtask.id, {
                                    dueDate: nextDate,
                                  });
                                  showSubtaskFeedback(
                                    nextDate
                                      ? `Updated due date for ${activeSubtask.key} to ${nextDate}`
                                      : `Cleared due date for ${activeSubtask.key}`,
                                  );
                                }
                              : undefined
                          }
                        />
                      </DetailField>

                      <DetailField label="Time tracking">
                        <div className="flex items-center gap-1.5 px-1.5 text-xs text-gray-700 dark:text-gray-300">
                          <span>{activeSubtask.loggedTime ?? "0h"}</span>
                          <span className="text-gray-400">/</span>
                          <span>{activeSubtask.estimate ?? "2h"}</span>
                        </div>
                      </DetailField>

                      <DetailField label={t("reporter")}>
                        <div className="px-1.5">
                          <PersonValue
                            person={activeSubtask.reporter ?? item.reporter}
                          />
                        </div>
                      </DetailField>
                    </dl>
                  )}
                </section>

                {/* Subtask Development Git Card */}
                <section className="rounded-md border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900">
                  <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Development
                  </h3>
                  <div className="mt-2.5 space-y-1.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setBranchCreated(true)}
                      className="flex w-full cursor-pointer items-center justify-between rounded px-2 py-1.5 font-medium text-brand-600 hover:bg-gray-50 dark:text-brand-400 dark:hover:bg-gray-800"
                    >
                      <span className="truncate font-mono text-[11px]">
                        {branchCreated
                          ? `✓ feat/${activeSubtask.key.toLowerCase().replace(".", "-")}`
                          : "Create branch"}
                      </span>
                      <MonoIcon
                        name="arrowUpRight"
                        className="h-3.5 w-3.5 shrink-0"
                      />
                    </button>
                  </div>
                </section>
              </aside>
            </div>
          ) : (
            <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_24rem]">
            {/* Left Main Content */}
            <main
              className={`min-w-0 space-y-5 px-5 py-5 sm:px-7 sm:py-6 ${
                mode === "page" ? "lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto" : ""
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <WorkStatusBadge status={item.status} />
                  <span className="border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    {t(`types.${item.type}`)}
                  </span>
                  {item.labels?.map((lbl) => (
                    <span
                      key={lbl}
                      className="bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                    >
                      #{lbl}
                    </span>
                  ))}
                </div>

                {/* Improve Task AI Copilot Button */}
                <button
                  type="button"
                  onClick={handleImproveTaskWithAi}
                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 border border-gray-200 bg-gray-50 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  <MonoIcon name="sparkle"className="h-3.5 w-3.5"/>
                  <span>Improve Task</span>
                </button>
              </div>

              <h2
                id="work-detail-title"
                className="text-xl font-semibold leading-7 text-gray-900 sm:text-2xl dark:text-white/90"
              >
                {item.title}
              </h2>

              {/* Jira Cloud Quick Action Bar under Title (`19-task-detail-view-open.png`, `24a-task-detail-plus-add-dropdown.png`) */}
              <div className="relative flex flex-wrap items-center gap-1.5">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setQuickAddMenuOpen((prev) => !prev)}
                    aria-label="Add child or linked work"
                    title="Add subtask, linked work item, or web link"
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                  >
                    <span>+</span>
                    <span>Add</span>
                    <span className="text-[10px]">▾</span>
                  </button>
                  {quickAddMenuOpen && (
                    <div
                      role="menu"
                      aria-label="Quick add menu"
                      className="absolute start-0 top-full z-30 mt-1 w-48 border border-gray-200 bg-white py-1 shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setQuickAddMenuOpen(false);
                          openExistingSubtaskPicker();
                        }}
                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-start text-xs font-medium text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        <MonoIssueTypeIcon type="SUBTASK" size={12} />
                        <span>Subtask</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setQuickAddMenuOpen(false);
                          setAddingSubtask(true);
                        }}
                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-start text-xs font-medium text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        <MonoIcon name="link" size={12} />
                        <span>Linked work item</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setQuickAddMenuOpen(false);
                          setWorklogNote("Attached Confluence specification");
                        }}
                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-start text-xs font-medium text-gray-800 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
                      >
                        <MonoIcon name="document" size={12} />
                        <span>Confluence page</span>
                      </button>
                    </div>
                  )}
                </div>

                {onAddSubtask && (
                  <button
                    type="button"
                    onClick={openExistingSubtaskPicker}
                    className="inline-flex h-8 cursor-pointer items-center gap-1.5 border border-gray-200 bg-gray-50 px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                  >
                    <MonoIssueTypeIcon type="SUBTASK" size={12} />
                    <span>+ Add subtask</span>
                  </button>
                )}
              </div>

              <section
                aria-labelledby="work-detail-description-heading"
                className="space-y-2"
              >
                <button
                  type="button"
                  onClick={() => setDescSectionCollapsed((prev) => !prev)}
                  aria-expanded={!descSectionCollapsed}
                  className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-gray-800 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
                >
                  <span aria-hidden="true" className="text-xs">
                    {descSectionCollapsed ? "▸" : "▾"}
                  </span>
                  <span id="work-detail-description-heading">
                    {t("description")}
                  </span>
                </button>
                {!descSectionCollapsed && (
                  <p className="whitespace-pre-line rounded px-4 py-2 text-sm leading-6 text-gray-700 transition hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-800/40">
                    {aiEnhancedDesc ?? item.description ?? t("noDescription")}
                  </p>
                )}
              </section>

              {/* Child Work Items / Subtasks Section (Jira Cloud Subtasks Table + Expandable Subtask Detail Layer + Full Drill-Down) */}
              <section
                aria-labelledby="work-detail-subtasks-heading"
                className="space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setSubtasksSectionCollapsed((prev) => !prev)
                      }
                      aria-expanded={!subtasksSectionCollapsed}
                      className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-gray-800 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
                    >
                      <span aria-hidden="true" className="text-xs">
                        {subtasksSectionCollapsed ? "▸" : "▾"}
                      </span>
                      <span id="work-detail-subtasks-heading">
                        {t("subtasks")}
                      </span>
                    </button>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {t("subtaskProgress", {
                        completed: item.subtasks.completed,
                        total: item.subtasks.total,
                      })}
                    </span>
                  </div>

                  {/* Jira Subtasks Section Top-Right Controls (`···`, `[|||]`, `+` — see `DATN-86-R3-subtasks-overview-2026-10-05.jpg`) */}
                  <div className="flex items-center gap-1.5">
                    {subtaskList.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedSubtaskIds(
                            allSubtasksInlineExpanded
                              ? new Set()
                              : new Set(subtaskList.map((s) => s.id)),
                          )
                        }
                        className="cursor-pointer border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                      >
                        {allSubtasksInlineExpanded
                          ? "▾ Collapse subtask details"
                          : "▸ Expand all subtask details"}
                      </button>
                    )}

                    {/* 1. `···` Subtasks Section Menu (Sort, Hide Done, Bulk Actions) */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setSubtaskColsMenuOpen(false);
                          setSubtasksMenuOpen((prev) => !prev);
                        }}
                        aria-label="Subtasks section options"
                        title="Order and filter subtasks"
                        className="inline-flex h-6 w-6 cursor-pointer items-center justify-center border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                      >
                        ···
                      </button>
                      {subtasksMenuOpen && (
                        <div
                          role="menu"
                          aria-label="Subtasks section menu"
                          className="absolute end-0 top-full z-30 mt-1 w-56 border border-gray-200 bg-white py-1.5 text-xs shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
                        >
                          <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Order subtasks by
                          </div>
                          {(
                            [
                              { id: "default", label: "Default (Rank)" },
                              { id: "priority", label: "Priority" },
                              { id: "status", label: "Status" },
                              { id: "assignee", label: "Assignee" },
                              { id: "due", label: "Due date" },
                              { id: "key", label: "Key" },
                            ] as const
                          ).map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setSubtaskSortBy(opt.id)}
                              className="flex w-full cursor-pointer items-center justify-between px-3 py-1 text-start text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                              <span>{opt.label}</span>
                              {subtaskSortBy === opt.id && <span>✓</span>}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => setSubtaskSortAsc((prev) => !prev)}
                            className="flex w-full cursor-pointer items-center justify-between border-t border-gray-100 px-3 py-1.5 text-start font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-800 dark:text-gray-200 dark:hover:bg-gray-800"
                          >
                            <span>Direction</span>
                            <span className="font-mono text-[11px]">
                              {subtaskSortAsc ? "Ascending ↑" : "Descending ↓"}
                            </span>
                          </button>
                          <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                          <label className="flex cursor-pointer items-center justify-between px-3 py-1.5 text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800">
                            <span>Hide done subtasks</span>
                            <input
                              type="checkbox"
                              checked={hideDoneSubtasks}
                              onChange={(e) =>
                                setHideDoneSubtasks(e.target.checked)
                              }
                              className="h-3.5 w-3.5 cursor-pointer border-gray-300 text-brand-600"
                            />
                          </label>
                          {onBulkUpdateSubtasks && subtaskList.length > 0 && (
                            <>
                              <div className="my-1 border-t border-gray-100 dark:border-gray-800" />
                              <button
                                type="button"
                                onClick={() => {
                                  setSubtasksMenuOpen(false);
                                  onBulkUpdateSubtasks(
                                    item.id,
                                    subtaskList.map((s) => s.id),
                                    { status: "DONE", done: true },
                                  );
                                  showSubtaskFeedback(
                                    "Marked all subtasks as Done",
                                  );
                                }}
                                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-start font-medium text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                              >
                                <MonoIcon name="check" size={12} />
                                <span>Mark all subtasks Done</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSubtasksMenuOpen(false);
                                  onBulkUpdateSubtasks(
                                    item.id,
                                    subtaskList.map((s) => s.id),
                                    { assignee: mePerson },
                                  );
                                  showSubtaskFeedback(
                                    `Assigned all subtasks to ${mePerson.name}`,
                                  );
                                }}
                                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-start font-medium text-gray-800 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                              >
                                <MonoIcon name="user" size={12} />
                                <span>Assign all subtasks to me</span>
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {/* 2. `[|||]` Configure Subtask Table Columns Button */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setSubtasksMenuOpen(false);
                          setSubtaskColsMenuOpen((prev) => !prev);
                        }}
                        aria-label="Configure subtask columns"
                        title="Configure subtask columns"
                        className="inline-flex h-6 w-6 cursor-pointer items-center justify-center border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                      >
                        <MonoIcon name="sliders" size={11} />
                      </button>
                      {subtaskColsMenuOpen && (
                        <div
                          role="menu"
                          aria-label="Subtask columns configuration"
                          className="absolute end-0 top-full z-30 mt-1 w-48 border border-gray-200 bg-white p-2.5 text-xs shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
                        >
                          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                            Subtask table columns
                          </p>
                          {(
                            [
                              { key: "priority", label: "Priority" },
                              { key: "assignee", label: "Assignee" },
                              { key: "due", label: "Due date" },
                              { key: "estimate", label: "Time estimate" },
                              { key: "status", label: "Status" },
                            ] as const
                          ).map((col) => (
                            <label
                              key={col.key}
                              className="flex cursor-pointer items-center justify-between py-1 text-gray-700 dark:text-gray-200"
                            >
                              <span>{col.label}</span>
                              <input
                                type="checkbox"
                                checked={subtaskCols[col.key]}
                                onChange={(e) =>
                                  setSubtaskCols((prev) => ({
                                    ...prev,
                                    [col.key]: e.target.checked,
                                  }))
                                }
                                className="h-3.5 w-3.5 cursor-pointer border-gray-300 text-brand-600"
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 3. `+` Add Subtask Button */}
                    {onAddSubtask && (
                      <button
                        type="button"
                        onClick={() => {
                          setSubtasksSectionCollapsed(false);
                          openExistingSubtaskPicker();
                        }}
                        title="Add subtask"
                        aria-label="Add subtask"
                        className="inline-flex h-6 w-6 cursor-pointer items-center justify-center border border-gray-200 bg-white text-xs font-bold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>

                {/* Jira Segmented Subtask Progress Bar + `X% Done` on the Same Horizontal Row (`DATN-86-R3-subtasks-overview-2026-10-05.jpg`) */}
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-2 flex-1 overflow-hidden bg-gray-200 dark:bg-gray-800"
                    role="progressbar"
                    aria-label={t("subtasks")}
                    aria-valuemin={0}
                    aria-valuemax={item.subtasks.total}
                    aria-valuenow={item.subtasks.completed}
                  >
                    {(() => {
                      const total = item.subtasks.total;
                      if (total === 0) return null;
                      const doneCount = subtaskList.filter(
                        (s) => s.done,
                      ).length;
                      const inProgCount = subtaskList.filter(
                        (s) =>
                          !s.done &&
                          (s.status === "IN_PROGRESS" ||
                            s.status === "IN_REVIEW"),
                      ).length;
                      const donePct = (doneCount / total) * 100;
                      const inProgPct = (inProgCount / total) * 100;
                      return (
                        <>
                          {donePct > 0 && (
                            <div
                              className="h-full bg-gray-900 transition-all dark:bg-gray-100"
                              style={{ width: `${donePct}%` }}
                            />
                          )}
                          {inProgPct > 0 && (
                            <div
                              className="h-full bg-gray-500 transition-all dark:bg-gray-400"
                              style={{ width: `${inProgPct}%` }}
                            />
                          )}
                        </>
                      );
                    })()}
                  </div>
                  <span className="shrink-0 text-xs font-semibold text-gray-600 dark:text-gray-300">
                    {item.subtasks.total === 0
                      ? "0% Done"
                      : `${Math.round(
                          (item.subtasks.completed / item.subtasks.total) * 100,
                        )}% Done`}
                  </span>
                </div>

                {/* Jira Automation Rule Prompt when 100% of Subtasks are Done */}
                {subtaskList.length > 0 &&
                  item.subtasks.completed === subtaskList.length &&
                  item.status !== "DONE" &&
                  onStatusChange && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border border-gray-800 bg-gray-100 px-3 py-2 text-xs dark:border-gray-300 dark:bg-gray-800">
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        ✓ All {subtaskList.length} subtasks are{" "}
                        <strong>Done</strong>. Move parent{" "}
                        <strong>{item.key}</strong> to Done?
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onStatusChange(item.id, "DONE");
                          showSubtaskFeedback(
                            `Transitioned parent ${item.key} to Done`,
                          );
                        }}
                        className="cursor-pointer bg-gray-900 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900"
                      >
                        Move {item.key} to Done
                      </button>
                    </div>
                  )}

                {!subtasksSectionCollapsed && displayedSubtasks.length > 0 && (
                  <div className="border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
                    <table className="w-full table-fixed border-collapse text-xs">
                      <thead className="border-b border-gray-200 bg-gray-50 text-[11px] font-semibold text-gray-500 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-400">
                        <tr>
                          <th className="w-[42%] px-2.5 py-2 text-start">
                            Work
                          </th>
                          {subtaskCols.priority && (
                            <th className="w-[13%] px-1.5 py-2 text-start">
                              Priority
                            </th>
                          )}
                          {subtaskCols.assignee && (
                            <th className="w-[15%] px-1.5 py-2 text-start">
                              Assignee
                            </th>
                          )}
                          {subtaskCols.due && (
                            <th className="w-[13%] px-1.5 py-2 text-start">
                              Due date
                            </th>
                          )}
                          {subtaskCols.estimate && (
                            <th className="w-[10%] px-1.5 py-2 text-start">
                              Est.
                            </th>
                          )}
                          {subtaskCols.status && (
                            <th className="w-[15%] px-1.5 py-2 text-start">
                              Status
                            </th>
                          )}
                          <th className="w-[10%] px-1.5 py-2 text-end">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {displayedSubtasks.map((sub, subIdx) => {
                          const subAssignee = sub.assignee ?? item.assignee;
                          const subPriority = sub.priority ?? item.priority;
                          const isEditingThisSub =
                            editingSubtaskId === sub.id;
                          const isSubDetailExpanded =
                            expandedSubtaskIds.has(sub.id);
                          const subSteps = sub.steps ?? [];
                          const doneStepsCount = subSteps.filter(
                            (st) => st.done,
                          ).length;
                          const totalSubCols =
                            2 +
                            Number(subtaskCols.priority) +
                            Number(subtaskCols.assignee) +
                            Number(subtaskCols.due) +
                            Number(subtaskCols.estimate) +
                            Number(subtaskCols.status);

                          return (
                            <Fragment key={sub.id}>
                              <tr
                                className={`group/sub hover:bg-gray-50 dark:hover:bg-gray-800/50 ${
                                  sub.flagged
                                    ? "bg-gray-100/70 dark:bg-gray-800/60"
                                    : ""
                                }`}
                              >
                                <td className="px-2.5 py-2 align-middle">
                                  <div className="flex min-w-0 items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        toggleInlineSubtaskExpand(sub.id)
                                      }
                                      title={
                                        isSubDetailExpanded
                                          ? "Hide subtask details & steps"
                                          : "Show subtask details & steps"
                                      }
                                      aria-label={`Toggle details for ${sub.key}`}
                                      className="flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center text-[10px] text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700"
                                    >
                                      {isSubDetailExpanded ? "▾" : "▸"}
                                    </button>
                                    <input
                                      type="checkbox"
                                      checked={sub.done}
                                      onChange={() =>
                                        onToggleSubtask?.(item.id, sub.id)
                                      }
                                      aria-label={`Complete subtask ${sub.key}`}
                                      className="h-3.5 w-3.5 shrink-0 cursor-pointer border-gray-300 text-brand-600"
                                    />
                                    <span className="flex h-4 w-4 shrink-0 items-center justify-center border border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                      <MonoIssueTypeIcon
                                        type="SUBTASK"
                                        size={10}
                                      />
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => selectSubtaskLayer(sub.id)}
                                      title={`Open subtask ${sub.key} detail layer`}
                                      className="shrink-0 cursor-pointer font-semibold text-gray-800 hover:underline dark:text-gray-200"
                                    >
                                      {sub.key}
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        if (typeof navigator !== "undefined") {
                                          navigator.clipboard?.writeText(
                                            `${window.location.origin}${window.location.pathname}#${sub.key}`,
                                          );
                                        }
                                        showSubtaskFeedback(
                                          `Copied subtask link for ${sub.key}`,
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
                                          const nextSummary =
                                            editingSubtaskSummary.trim();
                                          if (nextSummary) {
                                            onUpdateSubtask?.(
                                              item.id,
                                              sub.id,
                                              { summary: nextSummary },
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
                                          className="h-6 min-w-0 flex-1 border border-gray-300 bg-white px-2 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                        />
                                        <button
                                          type="submit"
                                          className="h-6 cursor-pointer bg-gray-900 px-2 text-[10px] font-semibold text-white dark:bg-gray-100 dark:text-gray-900"
                                        >
                                          Save
                                        </button>
                                      </form>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          selectSubtaskLayer(sub.id)
                                        }
                                        title="Click to open subtask detail layer"
                                        className={`min-w-0 flex-1 cursor-pointer truncate text-start ${
                                          sub.done
                                            ? "line-through text-gray-400 dark:text-gray-500"
                                            : "text-gray-800 hover:underline dark:text-gray-200"
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
                                        <MonoIcon name="flag" size={11} />
                                      </span>
                                    )}
                                    {subSteps.length > 0 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          toggleInlineSubtaskExpand(sub.id)
                                        }
                                        title="Implementation steps progress"
                                        className="shrink-0 cursor-pointer border border-gray-200 bg-gray-100 px-1 py-0.5 font-mono text-[10px] font-semibold text-gray-600 hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                      >
                                        {doneStepsCount}/{subSteps.length}
                                      </button>
                                    )}
                                  </div>
                                </td>

                                {subtaskCols.priority && (
                                  <td className="px-1.5 py-2 align-middle">
                                    {onUpdateSubtask ? (
                                      <select
                                        aria-label={`Priority for ${sub.key}`}
                                        value={subPriority}
                                        onChange={(e) =>
                                          onUpdateSubtask(item.id, sub.id, {
                                            priority: e.target
                                              .value as WorkPriority,
                                          })
                                        }
                                        className="h-6 w-full cursor-pointer border border-gray-200 bg-transparent px-1 text-[11px] text-gray-700 dark:border-gray-700 dark:text-gray-300"
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
                                    ) : (
                                      <WorkPriorityLabel
                                        priority={subPriority}
                                      />
                                    )}
                                  </td>
                                )}

                                {subtaskCols.assignee && (
                                  <td className="px-1.5 py-2 align-middle">
                                    {onUpdateSubtask ? (
                                      <select
                                        aria-label={`Assignee for ${sub.key}`}
                                        value={subAssignee.id}
                                        onChange={(e) => {
                                          const nextP = assigneeChoices.find(
                                            (p) => p.id === e.target.value,
                                          );
                                          if (nextP) {
                                            onUpdateSubtask(item.id, sub.id, {
                                              assignee: nextP,
                                            });
                                          }
                                        }}
                                        className="h-6 w-full cursor-pointer border border-gray-200 bg-transparent px-1 text-[11px] text-gray-700 dark:border-gray-700 dark:text-gray-300"
                                      >
                                        {assigneeChoices.map((person) => (
                                          <option
                                            key={person.id}
                                            value={person.id}
                                          >
                                            {person.name}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className="truncate text-gray-700 dark:text-gray-300">
                                        {subAssignee.name}
                                      </span>
                                    )}
                                  </td>
                                )}

                                {subtaskCols.due && (
                                  <td className="px-1.5 py-2 align-middle">
                                    <WorkDatePickerCell
                                      value={sub.dueDate ?? item.dueDate ?? null}
                                      itemKey={sub.key}
                                      disabled={!onUpdateSubtask}
                                      onChange={
                                        onUpdateSubtask
                                          ? (nextDate) =>
                                              onUpdateSubtask(item.id, sub.id, {
                                                dueDate: nextDate,
                                              })
                                          : undefined
                                      }
                                    />
                                  </td>
                                )}

                                {subtaskCols.estimate && (
                                  <td className="px-1.5 py-2 align-middle font-mono text-[11px] text-gray-600 dark:text-gray-300">
                                    {sub.loggedTime ?? "0h"}/
                                    {sub.estimate ?? "2h"}
                                  </td>
                                )}

                                {subtaskCols.status && (
                                  <td className="px-1.5 py-2 align-middle">
                                    {onUpdateSubtask ? (
                                      <select
                                        aria-label={`Status for ${sub.key}`}
                                        value={sub.status}
                                        onChange={(e) =>
                                          onUpdateSubtask(item.id, sub.id, {
                                            status: e.target
                                              .value as WorkStatus,
                                          })
                                        }
                                        className="h-6 w-full cursor-pointer border border-gray-300 bg-white px-1 text-[11px] font-semibold text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                                      >
                                        {WORK_STATUS_ORDER.map((st) => (
                                          <option key={st} value={st}>
                                            {t(`statuses.${st}`)}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <WorkStatusBadge status={sub.status} />
                                    )}
                                  </td>
                                )}

                                <td className="relative px-1.5 py-2 text-end align-middle">
                                  <div className="inline-flex items-center justify-end gap-0.5">
                                    <button
                                      type="button"
                                      onClick={() => selectSubtaskLayer(sub.id)}
                                      title={`Open ${sub.key} full subtask view`}
                                      aria-label={`Open ${sub.key} detail view`}
                                      className="inline-flex h-6 w-6 cursor-pointer items-center justify-center text-gray-500 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                                    >
                                      <MonoIcon name="arrowUpRight" size={12} />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setActiveSubtaskRowMenuId((cur) =>
                                          cur === sub.id ? null : sub.id,
                                        )
                                      }
                                      aria-label={`More actions for subtask ${sub.key}`}
                                      title={`More actions for ${sub.key}`}
                                      className="inline-flex h-6 w-6 cursor-pointer items-center justify-center font-bold text-gray-500 hover:bg-gray-200 hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-white"
                                    >
                                      ···
                                    </button>
                                    {onDeleteSubtask && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onDeleteSubtask(item.id, sub.id)
                                        }
                                        aria-label={`Delete subtask ${sub.key}`}
                                        title="Delete subtask"
                                        className="inline-flex h-6 w-6 cursor-pointer items-center justify-center text-gray-400 hover:bg-gray-200 hover:text-gray-800 dark:hover:bg-gray-800 dark:hover:text-white"
                                      >
                                        <MonoIcon name="trash" size={12} />
                                      </button>
                                    )}
                                  </div>

                                  {/* Jira Per-Row Subtask Context Menu (`···`) */}
                                  {activeSubtaskRowMenuId === sub.id && (
                                    <div
                                      role="menu"
                                      aria-label={`Actions for ${sub.key}`}
                                      className="absolute end-2 top-full z-30 mt-1 w-48 border border-gray-200 bg-white py-1 text-start text-xs shadow-theme-lg dark:border-gray-700 dark:bg-gray-900"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setActiveSubtaskRowMenuId(null);
                                          selectSubtaskLayer(sub.id);
                                        }}
                                        className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                      >
                                        <MonoIcon name="eye" size={12} />
                                        <span>Open subtask detail</span>
                                      </button>
                                      {onUpdateSubtask && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveSubtaskRowMenuId(null);
                                            setEditingSubtaskId(sub.id);
                                            setEditingSubtaskSummary(
                                              sub.summary,
                                            );
                                          }}
                                          className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                        >
                                          <MonoIcon name="edit" size={12} />
                                          <span>Edit summary</span>
                                        </button>
                                      )}
                                      {onUpdateSubtask && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveSubtaskRowMenuId(null);
                                            onUpdateSubtask(item.id, sub.id, {
                                              assignee: mePerson,
                                            });
                                            showSubtaskFeedback(
                                              `Assigned ${sub.key} to ${mePerson.name}`,
                                            );
                                          }}
                                          className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                        >
                                          <MonoIcon name="user" size={12} />
                                          <span>Assign to me</span>
                                        </button>
                                      )}
                                      {onUpdateSubtask && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveSubtaskRowMenuId(null);
                                            onUpdateSubtask(item.id, sub.id, {
                                              flagged: !sub.flagged,
                                            });
                                          }}
                                          className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                        >
                                          <MonoIcon name="flag" size={12} />
                                          <span>
                                            {sub.flagged
                                              ? "Remove flag"
                                              : "Add flag"}
                                          </span>
                                        </button>
                                      )}
                                      {onReorderSubtask && (
                                        <div className="flex items-center border-t border-gray-100 px-3 py-1 dark:border-gray-800">
                                          <span className="flex-1 text-[11px] text-gray-500">
                                            Reorder
                                          </span>
                                          <button
                                            type="button"
                                            disabled={subIdx === 0}
                                            onClick={() => {
                                              setActiveSubtaskRowMenuId(null);
                                              onReorderSubtask(
                                                item.id,
                                                sub.id,
                                                "up",
                                              );
                                            }}
                                            className="cursor-pointer px-1.5 py-0.5 font-bold hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
                                          >
                                            ↑
                                          </button>
                                          <button
                                            type="button"
                                            disabled={
                                              subIdx ===
                                              displayedSubtasks.length - 1
                                            }
                                            onClick={() => {
                                              setActiveSubtaskRowMenuId(null);
                                              onReorderSubtask(
                                                item.id,
                                                sub.id,
                                                "down",
                                              );
                                            }}
                                            className="cursor-pointer px-1.5 py-0.5 font-bold hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-gray-800"
                                          >
                                            ↓
                                          </button>
                                        </div>
                                      )}
                                      {onCloneSubtask && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveSubtaskRowMenuId(null);
                                            onCloneSubtask(item.id, sub.id);
                                            showSubtaskFeedback(
                                              `Cloned ${sub.key}`,
                                            );
                                          }}
                                          className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                        >
                                          <MonoIcon name="copy" size={12} />
                                          <span>Clone subtask</span>
                                        </button>
                                      )}
                                      {onConvertSubtaskToTask && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setActiveSubtaskRowMenuId(null);
                                            onConvertSubtaskToTask(
                                              item.id,
                                              sub.id,
                                            );
                                            showSubtaskFeedback(
                                              `Converted ${sub.key} to Task`,
                                            );
                                          }}
                                          className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                                        >
                                          <MonoIcon
                                            name="arrowUpRight"
                                            size={12}
                                          />
                                          <span>Convert to Task</span>
                                        </button>
                                      )}
                                      {onMoveSubtaskToParent &&
                                        allItems.length > 1 && (
                                          <div className="border-t border-gray-100 px-2.5 py-1.5 dark:border-gray-800">
                                            <label className="block text-[10px] font-semibold text-gray-400">
                                              Move to parent
                                            </label>
                                            <select
                                              aria-label={`Move ${sub.key} to parent`}
                                              value={item.id}
                                              onChange={(e) => {
                                                const targetId = e.target.value;
                                                if (
                                                  targetId &&
                                                  targetId !== item.id
                                                ) {
                                                  setActiveSubtaskRowMenuId(
                                                    null,
                                                  );
                                                  onMoveSubtaskToParent(
                                                    item.id,
                                                    sub.id,
                                                    targetId,
                                                  );
                                                  showSubtaskFeedback(
                                                    `Moved ${sub.key} to new parent`,
                                                  );
                                                }
                                              }}
                                              className="mt-1 h-6 w-full border border-gray-200 bg-white px-1 text-[11px] text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                                            >
                                              {allItems.map((cand) => (
                                                <option
                                                  key={cand.id}
                                                  value={cand.id}
                                                >
                                                  {cand.key} — {cand.title}
                                                </option>
                                              ))}
                                            </select>
                                          </div>
                                        )}
                                    </div>
                                  )}
                                </td>
                              </tr>

                              {/* INLINE EXPANDED SUBTASK INFORMATION LAYER (LEVEL 2 INSIDE SUBTASKS TABLE) */}
                              {isSubDetailExpanded && (
                                <tr className="bg-gray-50/90 dark:bg-gray-950/60">
                                  <td
                                    colSpan={totalSubCols}
                                    className="border-t border-gray-200 px-4 py-3 dark:border-gray-800"
                                  >
                                    <div className="space-y-2.5 border-s-2 border-gray-800 ps-3 dark:border-gray-300">
                                      {/* Metadata & Action Strip */}
                                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-600 dark:text-gray-400">
                                        <div className="flex flex-wrap items-center gap-3">
                                          <span className="inline-flex items-center gap-1 font-semibold text-gray-800 dark:text-gray-200">
                                            <MonoIssueTypeIcon
                                              type="SUBTASK"
                                              size={11}
                                            />
                                            <span>{sub.key} Detail Layer</span>
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
                                          {(sub.dueDate ?? item.dueDate) && (
                                            <span>
                                              Due:{" "}
                                              <strong>
                                                {sub.dueDate ?? item.dueDate}
                                              </strong>
                                            </span>
                                          )}
                                          <span>
                                            Steps:{" "}
                                            <strong>
                                              {doneStepsCount}/{subSteps.length}
                                            </strong>
                                          </span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                          {onUpdateSubtask && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setEditingSubtaskId(sub.id);
                                                setEditingSubtaskSummary(
                                                  sub.summary,
                                                );
                                              }}
                                              className="inline-flex cursor-pointer items-center gap-1 border border-gray-200 bg-white px-2 py-0.5 font-medium text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                                            >
                                              <MonoIcon name="edit" size={10} />
                                              <span>Rename</span>
                                            </button>
                                          )}
                                          <button
                                            type="button"
                                            onClick={() =>
                                              selectSubtaskLayer(sub.id)
                                            }
                                            className="inline-flex cursor-pointer items-center gap-1 border border-gray-800 bg-gray-900 px-2 py-0.5 font-semibold text-white hover:bg-gray-800 dark:border-gray-200 dark:bg-gray-100 dark:text-gray-900"
                                          >
                                            <span>Open subtask view</span>
                                            <MonoIcon
                                              name="arrowUpRight"
                                              size={10}
                                            />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Subtask Description */}
                                      {sub.description && (
                                        <p className="border border-gray-200 bg-white px-3 py-2 text-xs leading-5 text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
                                          {sub.description}
                                        </p>
                                      )}

                                      {/* Subtask Implementation Steps Checklist */}
                                      <div className="space-y-1.5">
                                        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                                          Implementation Steps ({doneStepsCount}/
                                          {subSteps.length})
                                        </div>
                                        {subSteps.length > 0 && (
                                          <ul className="space-y-1">
                                            {subSteps.map((st) => (
                                              <li
                                                key={st.id}
                                                className="flex items-center justify-between gap-2 border border-gray-200 bg-white px-2.5 py-1.5 text-xs dark:border-gray-800 dark:bg-gray-900"
                                              >
                                                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                                                  <input
                                                    type="checkbox"
                                                    checked={st.done}
                                                    onChange={() =>
                                                      handleToggleSubtaskStep(
                                                        sub,
                                                        st.id,
                                                      )
                                                    }
                                                    className="h-3.5 w-3.5 shrink-0 cursor-pointer border-gray-300 text-brand-600"
                                                  />
                                                  <span
                                                    className={
                                                      st.done
                                                        ? "line-through text-gray-400 dark:text-gray-500"
                                                        : "text-gray-800 dark:text-gray-200"
                                                    }
                                                  >
                                                    {st.text}
                                                  </span>
                                                </label>
                                                {onUpdateSubtask && (
                                                  <button
                                                    type="button"
                                                    onClick={() =>
                                                      handleDeleteSubtaskStep(
                                                        sub,
                                                        st.id,
                                                      )
                                                    }
                                                    title="Delete step"
                                                    className="inline-flex h-5 w-5 cursor-pointer items-center justify-center text-gray-400 hover:text-gray-800 dark:hover:text-white"
                                                  >
                                                    <MonoIcon
                                                      name="trash"
                                                      size={10}
                                                    />
                                                  </button>
                                                )}
                                              </li>
                                            ))}
                                          </ul>
                                        )}

                                        {onUpdateSubtask && (
                                          <form
                                            onSubmit={(e) =>
                                              handleAddSubtaskStep(e, sub)
                                            }
                                            className="flex items-center gap-1.5 pt-0.5"
                                          >
                                            <input
                                              value={
                                                newStepTextBySubtask[sub.id] ??
                                                ""
                                              }
                                              onChange={(e) =>
                                                setNewStepTextBySubtask(
                                                  (prev) => ({
                                                    ...prev,
                                                    [sub.id]: e.target.value,
                                                  }),
                                                )
                                              }
                                              placeholder={`Add implementation step for ${sub.key}…`}
                                              className="h-7 flex-1 border border-gray-300 bg-white px-2.5 text-xs text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                                            />
                                            <button
                                              type="submit"
                                              className="h-7 cursor-pointer bg-gray-900 px-2.5 text-[11px] font-semibold text-white dark:bg-gray-100 dark:text-gray-900"
                                            >
                                              + Step
                                            </button>
                                          </form>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {onAddSubtask &&
                  (selectingExistingSubtask ? (
                    <div className="space-y-2 border border-gray-300 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900">
                      <label
                        htmlFor="existing-subtask-task"
                        className="block text-xs font-semibold text-gray-700 dark:text-gray-300"
                      >
                        {t("selectExistingTask")}
                      </label>
                      <select
                        id="existing-subtask-task"
                        aria-label={t("selectExistingTask")}
                        value={existingSubtaskTaskId}
                        onChange={(event) =>
                          setExistingSubtaskTaskId(event.target.value)
                        }
                        className="h-8 w-full border border-gray-300 bg-white px-2.5 text-xs text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                      >
                        <option value="">
                          {existingTaskCandidates.length > 0
                            ? t("chooseProjectTask")
                            : t("noOtherProjectTasks")}
                        </option>
                        {existingTaskCandidates.map((candidate) => (
                          <option
                            key={candidate.id}
                            value={candidate.id}
                            disabled={candidate.hasChildren}
                          >
                            {candidate.key} — {candidate.summary}
                            {candidate.hasChildren
                              ? ` (${t("taskHasSubtasks")})`
                              : ""}
                          </option>
                        ))}
                      </select>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">
                        {t("newestTasksFirst")}
                      </p>
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectingExistingSubtask(false);
                            setAddingSubtask(true);
                          }}
                          className="me-auto h-7 cursor-pointer px-2 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                        >
                          {t("createNewSubtask")}
                        </button>
                        <button
                          type="button"
                          onClick={handleAddExistingTaskAsSubtask}
                          disabled={
                            !selectedExistingTask ||
                            selectedExistingTask.hasChildren
                          }
                          className="h-7 cursor-pointer bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {t("addAsSubtask")}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectingExistingSubtask(false);
                            setExistingSubtaskTaskId("");
                          }}
                          className="h-7 cursor-pointer border border-gray-200 bg-white px-2.5 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
                        >
                          {t("cancel")}
                        </button>
                      </div>
                    </div>
                  ) : addingSubtask ? (
                    <form
                      onSubmit={handleAddSubtask}
                      className="space-y-2 border border-gray-300 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center border border-gray-300 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                          <MonoIssueTypeIcon type="SUBTASK" size={11} />
                        </span>
                        <input
                          value={subtaskInput}
                          onChange={(event) =>
                            setSubtaskInput(event.target.value)
                          }
                          placeholder="What needs to be done?"
                          className="h-8 flex-1 border border-gray-300 bg-white px-3 text-xs text-gray-900 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                        />
                      </div>
                      <input
                        value={subtaskDescInput}
                        onChange={(event) =>
                          setSubtaskDescInput(event.target.value)
                        }
                        placeholder="Technical description / acceptance criteria for this subtask (optional)…"
                        className="h-7 w-full border border-gray-200 bg-white px-3 text-xs text-gray-800 outline-none focus:border-brand-500 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            aria-label="New subtask priority"
                            value={subtaskPriority}
                            onChange={(e) =>
                              setSubtaskPriority(e.target.value as WorkPriority)
                            }
                            className="h-7 cursor-pointer border border-gray-200 bg-white px-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
                          >
                            <option value="HIGH">
                              {t("priorities.HIGH")}
                            </option>
                            <option value="MEDIUM">
                              {t("priorities.MEDIUM")}
                            </option>
                            <option value="LOW">{t("priorities.LOW")}</option>
                          </select>
                          <select
                            aria-label="New subtask assignee"
                            value={subtaskAssigneeId}
                            onChange={(e) =>
                              setSubtaskAssigneeId(e.target.value)
                            }
                            className="h-7 cursor-pointer border border-gray-200 bg-white px-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
                          >
                            {assigneeChoices.map((person) => (
                              <option key={person.id} value={person.id}>
                                {person.name}
                              </option>
                            ))}
                          </select>
                          <input
                            type="date"
                            aria-label="New subtask due date"
                            value={subtaskDueDateInput}
                            onChange={(e) =>
                              setSubtaskDueDateInput(e.target.value)
                            }
                            className="h-7 border border-gray-200 bg-white px-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
                          />
                          <input
                            value={subtaskEstimateInput}
                            onChange={(e) =>
                              setSubtaskEstimateInput(e.target.value)
                            }
                            placeholder="Est (2h)"
                            aria-label="New subtask estimate"
                            className="h-7 w-16 border border-gray-200 bg-white px-2 text-xs text-gray-700 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
                          />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="submit"
                            className="h-7 cursor-pointer bg-brand-600 px-3 text-xs font-semibold text-white hover:bg-brand-700"
                          >
                            Create
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setAddingSubtask(false);
                              setSubtaskInput("");
                            }}
                            className="h-7 cursor-pointer border border-gray-200 bg-white px-2.5 text-xs text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </form>
                  ) : (
                    <button
                      type="button"
                      onClick={openExistingSubtaskPicker}
                      className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                    >
                      <span>+</span>
                      <span>Add a child work item</span>
                    </button>
                  ))}
              </section>

              {/* Activity & Comments Stream with 4 Tabs (All, Comments, History, Work log) */}
              <section
                aria-labelledby="work-detail-activity-heading"
                className="space-y-3 border-t border-gray-100 pt-5 dark:border-gray-800"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3
                    id="work-detail-activity-heading"
                    className="text-sm font-semibold text-gray-800 dark:text-gray-200"
                  >
                    Activity
                  </h3>
                  <div className="inline-flex border border-gray-200 bg-gray-50 p-0.5 text-xs dark:border-gray-800 dark:bg-gray-950">
                    {(
                      [
                        { id:"all", label:"All"},
                        { id:"comments", label:"Comments"},
                        { id:"history", label:"History"},
                        { id:"worklog", label:"Work log"},
                      ] as const
                    ).map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActivityTab(tab.id)}
                        className={`cursor-pointer px-2.5 py-1 font-medium transition ${
                          activityTab === tab.id
                            ?"bg-white text-brand-600 shadow-theme-xs dark:bg-gray-800 dark:text-brand-400"
                            :"text-gray-600 hover:text-gray-900 dark:text-gray-400"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(activityTab ==="all"|| activityTab ==="comments") && (
                  <>
                    {onAddComment && (
                      <div className="space-y-2">
                        {/* Jira Cloud Quick-Reply Comment Chips (`19-task-detail-modal.png`) */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {[
                            "Who is working on this...?",
                            "Can I get more info...?",
                            "Status update...",
                          ].map((chip) => (
                            <button
                              key={chip}
                              type="button"
                              onClick={() => setCommentInput(chip)}
                              className="cursor-pointer border border-gray-200 bg-gray-50 px-2.5 py-1 text-[11px] font-medium text-gray-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-brand-500"
                            >
                              {chip}
                            </button>
                          ))}
                        </div>
                        <form
                          onSubmit={handleAddComment}
                          className="flex items-start gap-2.5"
                        >
                          <input
                            value={commentInput}
                            onChange={(event) =>
                              setCommentInput(event.target.value)
                            }
                            placeholder="Add a comment…"
                            className="h-9 flex-1 border border-gray-200 bg-white px-3 text-xs text-gray-800 outline-none focus:border-brand-300 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                          />
                          <button
                            type="submit"
                            className="h-9 cursor-pointer bg-brand-500 px-3.5 text-xs font-semibold text-white hover:bg-brand-600"
                          >
                            Save
                          </button>
                        </form>
                        <p className="text-[11px] text-gray-400">
                          <strong>Pro tip:</strong> press{""}
                          <kbd className="border border-gray-300 bg-gray-100 px-1 py-0.5 text-[10px] font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                            M
                          </kbd>{""}
                          to comment
                        </p>
                      </div>
                    )}

                    {item.comments && item.comments.length > 0 ? (
                      <ul className="space-y-2.5">
                        {item.comments.map((comment) => (
                          <li
                            key={comment.id}
                            className="border border-gray-200 bg-gray-50/70 p-3 text-xs dark:border-gray-800 dark:bg-gray-900"
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-semibold text-gray-900 dark:text-white/90">
                                {comment.author}
                              </span>
                              <span className="tabular-nums text-gray-400">
                                {formatCommentTimestamp(comment.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 text-gray-700 dark:text-gray-300">
                              {comment.text}
                            </p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        No comments on this work item yet.
                      </p>
                    )}
                  </>
                )}

                {activityTab ==="history"&& (
                  <ul className="space-y-2 text-xs text-gray-600 dark:text-gray-300">
                    <li className="border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900">
                      <strong>{item.assignee.name}</strong> updated status to{""}
                      <strong>{item.status}</strong> • Today
                    </li>
                    <li className="border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900">
                      <strong>{item.reporter.name}</strong> created work item{""}
                      <strong>{item.key}</strong>
                    </li>
                  </ul>
                )}

                {activityTab ==="worklog"&& (
                  <div className="space-y-3">
                    <form
                      onSubmit={handleAddWorklog}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <input
                        value={worklogTime}
                        onChange={(event) => setWorklogTime(event.target.value)}
                        placeholder="Time spent (e.g. 1h 30m)"
                        className="h-8 w-40 border border-gray-200 bg-white px-2.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                      />
                      <input
                        value={worklogNote}
                        onChange={(event) => setWorklogNote(event.target.value)}
                        placeholder="Work description…"
                        className="h-8 flex-1 border border-gray-200 bg-white px-2.5 text-xs text-gray-900 dark:border-gray-700 dark:bg-gray-950 dark:text-white"
                      />
                      <button
                        type="submit"
                        className="h-8 cursor-pointer bg-brand-500 px-3 text-xs font-semibold text-white hover:bg-brand-600"
                      >
                        + Log work
                      </button>
                    </form>
                    {item.worklogs && item.worklogs.length > 0 ? (
                      <ul className="space-y-2 text-xs">
                        {item.worklogs.map((wl) => (
                          <li
                            key={wl.id}
                            className="border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900"
                          >
                            <div className="flex items-center justify-between font-semibold text-gray-900 dark:text-white">
                              <div className="flex items-center gap-2">
                                <span>{wl.author}</span>
                                {wl.createdAt && (
                                  <span className="tabular-nums font-normal text-gray-400">
                                    {formatCommentTimestamp(wl.createdAt)}
                                  </span>
                                )}
                              </div>
                              <span className="inline-flex items-center gap-1 tabular-nums text-gray-700 dark:text-gray-300">
                                <MonoIcon name="clock"className="h-3.5 w-3.5"/>
                                <span>{wl.timeSpent}</span>
                              </span>
                            </div>
                            {wl.note && (
                              <p className="mt-1 text-gray-600 dark:text-gray-300">
                                {wl.note}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        No work logged on this work item yet.
                      </p>
                    )}
                  </div>
                )}
              </section>
            </main>

            {/* Right Details & Integrations Column (Image 4 Jira Cloud Details Card) */}
            <aside
              className={`min-w-0 space-y-4 border-t border-gray-200 bg-white px-5 py-5 sm:px-6 lg:border-s lg:border-t-0 dark:border-gray-800 dark:bg-gray-900 ${
                mode === "page" ? "lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto" : ""
              }`}
            >
              {/* Top Status Transition Selector (Image 4) */}
              <div className="flex items-center justify-between gap-2">
                <label className="relative inline-flex cursor-pointer items-center">
                  <WorkStatusBadge status={item.status} showChevron />
                  {onStatusChange && (
                    <select
                      aria-label="Update work item status"
                      value={item.status}
                      onChange={(event) =>
                        onStatusChange(
                          item.id,
                          event.target.value as WorkStatus,
                        )
                      }
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
              </div>

              <section
                aria-labelledby="work-detail-fields-heading"
                className="rounded-md border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2.5 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() =>
                      setDetailsSectionCollapsed((prev) => !prev)
                    }
                    aria-expanded={!detailsSectionCollapsed}
                    className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200"
                  >
                    <span aria-hidden="true">
                      {detailsSectionCollapsed ? "▸" : "▾"}
                    </span>
                    <span id="work-detail-fields-heading">
                      {t("details")}
                    </span>
                  </button>
                  <MonoIcon
                    name="sliders"
                    size={13}
                    className="text-gray-400"
                  />
                </div>

                {!detailsSectionCollapsed && (
                  <dl className="space-y-3 p-4">
                    <DetailField label={t("assignee")}>
                      <div className="space-y-1">
                        <label className="relative flex cursor-pointer items-center rounded px-1.5 py-1 transition hover:bg-gray-50 dark:hover:bg-gray-800">
                          <PersonValue person={item.assignee} />
                          {onAssigneeChange && (
                            <select
                              aria-label="Reassign work item"
                              value={item.assignee.id}
                              onChange={(event) => {
                                const nextPerson = assigneeChoices.find(
                                  (person) => person.id === event.target.value,
                                );
                                if (nextPerson) {
                                  onAssigneeChange(item.id, nextPerson);
                                }
                              }}
                              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                            >
                              {assigneeChoices.map((person) => (
                                <option key={person.id} value={person.id}>
                                  {person.name}
                                </option>
                              ))}
                            </select>
                          )}
                        </label>
                        {onAssigneeChange && (
                          <button
                            type="button"
                            onClick={() => {
                              onAssigneeChange(item.id, mePerson);
                              showSubtaskFeedback(
                                `Assigned ${item.key} to ${mePerson.name}`,
                              );
                            }}
                            className="cursor-pointer ps-1.5 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                          >
                            Assign to me
                          </button>
                        )}
                      </div>
                    </DetailField>

                    <DetailField label={t("priority")}>
                      <label className="relative inline-flex cursor-pointer items-center rounded px-1.5 py-1 transition hover:bg-gray-50 dark:hover:bg-gray-800">
                        <WorkPriorityLabel priority={item.priority} />
                        {onPriorityChange && (
                          <select
                            aria-label="Update work item priority"
                            value={item.priority}
                            onChange={(event) =>
                              onPriorityChange(
                                item.id,
                                event.target.value as WorkPriority,
                              )
                            }
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          >
                            <option value="HIGH">{t("priorities.HIGH")}</option>
                            <option value="MEDIUM">
                              {t("priorities.MEDIUM")}
                            </option>
                            <option value="LOW">{t("priorities.LOW")}</option>
                          </select>
                        )}
                      </label>
                    </DetailField>

                    {item.parent && (
                      <DetailField label="Parent">
                        <span className="inline-flex items-center gap-1.5 rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-brand-600 dark:border-gray-700 dark:bg-gray-800 dark:text-brand-400">
                          <MonoIssueTypeIcon
                            type="EPIC"
                            className="h-3.5 w-3.5 shrink-0"
                          />
                          <span className="truncate">
                            {item.parent.key} {item.parent.summary}
                          </span>
                        </span>
                      </DetailField>
                    )}

                    <DetailField label={t("dueDate")}>
                      <WorkDatePickerCell
                        value={item.dueDate}
                        itemKey={item.key}
                        placeholder={t("noDueDate")}
                        disabled={!onDueDateChange}
                        onChange={
                          onDueDateChange
                            ? (nextDate) => {
                                onDueDateChange(item.id, nextDate);
                                showSubtaskFeedback(
                                  nextDate
                                    ? `Updated due date for ${item.key} to ${nextDate}`
                                    : `Cleared due date for ${item.key}`,
                                );
                              }
                            : undefined
                        }
                      />
                    </DetailField>

                    <DetailField label="Labels">
                      <div className="flex flex-wrap gap-1 px-1.5">
                        {(item.labels && item.labels.length > 0
                          ? item.labels
                          : ["None"]
                        ).map((lbl) => (
                          <span
                            key={lbl}
                            className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                          >
                            {lbl}
                          </span>
                        ))}
                      </div>
                    </DetailField>

                    <DetailField label="Team">
                      <span className="px-1.5 text-xs text-gray-700 dark:text-gray-300">
                        {item.team ?? "Core Engineering"}
                      </span>
                    </DetailField>

                    <DetailField label={t("reporter")}>
                      <div className="px-1.5">
                        <PersonValue person={item.reporter} />
                      </div>
                    </DetailField>

                    <DetailField label={t("resolution")}>
                      <span className="px-1.5 text-xs text-gray-700 dark:text-gray-300">
                        {t(`resolutions.${item.resolution}`)}
                      </span>
                    </DetailField>

                    <DetailField label={t("created")}>
                      <time
                        dateTime={item.createdAt}
                        className="px-1.5 text-xs text-gray-500 dark:text-gray-400"
                      >
                        {new Intl.DateTimeFormat(locale, {
                          dateStyle: "medium",
                          timeZone: "UTC",
                        }).format(new Date(item.createdAt))}
                      </time>
                    </DetailField>
                  </dl>
                )}
              </section>

              {/* Development Accordion Card */}
              <section
                aria-label="Development git actions"
                className="rounded-md border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900"
              >
                <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Development
                </h3>
                <div className="mt-2.5 space-y-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setBranchCreated(true)}
                    className="flex w-full cursor-pointer items-center justify-between rounded px-2 py-1.5 font-medium text-brand-600 hover:bg-gray-50 dark:text-brand-400 dark:hover:bg-gray-800"
                  >
                    <span>
                      {branchCreated
                        ? `✓ Branch feat/${item.key.toLowerCase()} ready`
                        : "Create branch"}
                    </span>
                    <MonoIcon
                      name="arrowUpRight"
                      className="h-3.5 w-3.5"
                    />
                  </button>
                  <button
                    type="button"
                    onClick={() => setCommitCopied(true)}
                    className="flex w-full cursor-pointer items-center justify-between rounded px-2 py-1.5 font-medium text-brand-600 hover:bg-gray-50 dark:text-brand-400 dark:hover:bg-gray-800"
                  >
                    <span>
                      {commitCopied
                        ? `✓ Copied git commit -m "${item.key}: ..."`
                        : "Create commit"}
                    </span>
                    <MonoIcon
                      name="copy"
                      className="h-3.5 w-3.5"
                    />
                  </button>
                </div>
              </section>

              {/* Automation Accordion Card */}
              <section
                aria-label="Automation rules"
                className="rounded-md border border-gray-200 bg-white p-3.5 dark:border-gray-800 dark:bg-gray-900"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    Automation
                  </h3>
                  <span className="rounded bg-success-50 px-2 py-0.5 text-[10px] font-bold text-success-700 dark:bg-success-500/15 dark:text-success-400">
                    ACTIVE
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                  {automationRan
                    ? "✓ Synced status & parent Epic progress via Jira Automation."
                    : "Rule executions"}
                </p>
                <button
                  type="button"
                  onClick={() => setAutomationRan(true)}
                  className="mt-2 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
                >
                  <MonoIcon name="bolt" className="h-3.5 w-3.5" />
                  <span>Run automation check</span>
                </button>
              </section>

              <p className="sr-only">
                {t("detailPreviewNotice")}
              </p>
            </aside>
          </div>
          )}
    </div>
  ) : null;

  if (mode === "page") {
    return detailContent;
  }

  return (
    <Modal
      isOpen={Boolean(item)}
      onClose={onClose}
      backdropClassName="bg-gray-900/20 backdrop-blur-[1px] dark:bg-gray-950/35"
      showCloseButton={false}
      className={`mx-3 overflow-hidden rounded-lg p-0 shadow-theme-lg ${
        isMaximized ? "max-h-[96vh] max-w-7xl" : "max-h-[92vh] max-w-6xl"
      }`}
    >
      {detailContent}
    </Modal>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-2">
      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400">
        {label}
      </dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function PersonValue({ person }: { person: WorkPerson }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-2 text-xs font-medium text-gray-800 dark:text-gray-200">
      <span
        aria-hidden="true"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-gray-100 text-[10px] font-bold text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
      >
        {person.initials}
      </span>
      <span className="truncate">{person.name}</span>
    </span>
  );
}

function formatCommentTimestamp(value: string | Date): string {
  if (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2})?$/.test(value.trim())
  ) {
    return value.trim();
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return typeof value === "string" ? value : "";
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hours}:${minutes}`;
}
