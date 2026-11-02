"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ChevronDown, ChevronRight, Maximize2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { tr } from "@/i18n/tr";
import { TaskIcon } from "@/icons";
import TaskNotesPanel, {
  type TaskNotesSplitControl,
} from "@/components/work-notes/TaskNotesPanel";
import { MonoIcon, MonoIssueTypeIcon } from "./WorkMonoIcons";
import { WorkPriorityLabel, WorkStatusBadge } from "./WorkStatusBadge";
import {
  WORK_STATUS_ORDER,
  type WorkItem,
  type WorkPriority,
  type WorkStatus,
  type WorkSubtaskItem,
} from "./work-types";

type SplitSecondaryTab = "comments" | "worklog" | "notes" | "more";

function formatShortDate(
  value: string | null | undefined,
  locale: string,
): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(parsed);
}

function formatCommentTime(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}(\s+\d{2}:\d{2})?$/.test(value.trim())) {
    return value.trim();
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm}`;
}

export type WorkItemSplitReferencePaneProps = {
  item: WorkItem;
  activeSubtask: WorkSubtaskItem | null;
  activeSubtaskIndex: number;
  subtaskList: readonly WorkSubtaskItem[];
  projectId?: string;
  mode: "modal" | "page";
  isMaximized: boolean;
  isPreview: boolean;
  mutationError?: string | null;
  onDismissMutationError?: () => void;
  splitControl: TaskNotesSplitControl;
  onExpandFullView: () => void;
  onClose: () => void;
  onOpenFullPage?: (subtaskId?: string | null) => void;
  onToggleMaximize: () => void;
  onSelectSubtaskLayer: (subtaskId: string | null) => void;
  onInlineEditingChange?: (editing: boolean) => void;
  onStatusChange?: (id: string, status: WorkStatus) => void;
  onPriorityChange?: (id: string, priority: WorkPriority) => void;
  onToggleSubtask?: (itemId: string, subtaskId: string) => void;
  onUpdateSubtask?: (
    itemId: string,
    subtaskId: string,
    patch: Partial<Omit<WorkSubtaskItem, "id" | "key">>,
  ) => void;
  onDescriptionChange?: (
    id: string,
    description: string | null,
  ) => Promise<boolean> | boolean | void;
  onAddComment?: (itemId: string, text: string) => void;
};

export default function WorkItemSplitReferencePane({
  item,
  activeSubtask,
  activeSubtaskIndex,
  subtaskList,
  projectId,
  mode,
  isMaximized,
  isPreview,
  mutationError,
  onDismissMutationError,
  splitControl,
  onExpandFullView,
  onClose,
  onOpenFullPage,
  onToggleMaximize,
  onSelectSubtaskLayer,
  onInlineEditingChange,
  onStatusChange,
  onPriorityChange,
  onToggleSubtask,
  onUpdateSubtask,
  onDescriptionChange,
  onAddComment,
}: WorkItemSplitReferencePaneProps) {
  const t = useTranslations("work");
  const locale = useLocale();

  const [descOpen, setDescOpen] = useState(true);
  const [checklistOpen, setChecklistOpen] = useState(true);
  const [editingDesc, setEditingDesc] = useState(false);
  const [descDraft, setDescDraft] = useState("");
  const [savingDesc, setSavingDesc] = useState(false);
  const [descError, setDescError] = useState<string | null>(null);
  const [expandedStepSubIds, setExpandedStepSubIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [quickComment, setQuickComment] = useState("");

  useEffect(() => {
    onInlineEditingChange?.(editingDesc);
    return () => onInlineEditingChange?.(false);
  }, [editingDesc, onInlineEditingChange]);

  const activeComments = activeSubtask
    ? (activeSubtask.comments ?? [])
    : (item.comments ?? []);
  const activeWorklogs = activeSubtask
    ? (activeSubtask.worklogs ?? [])
    : (item.worklogs ?? []);

  const [secondaryTab, setSecondaryTab] = useState<SplitSecondaryTab>(() =>
    activeComments.length > 0 ? "comments" : "more",
  );

  const currentTitle = activeSubtask ? activeSubtask.summary : item.title;
  const currentStatus = activeSubtask ? activeSubtask.status : item.status;
  const currentPriority = activeSubtask
    ? (activeSubtask.priority ?? item.priority)
    : item.priority;
  const currentAssignee = activeSubtask
    ? (activeSubtask.assignee ?? item.assignee)
    : item.assignee;
  const currentDueDate = activeSubtask
    ? (activeSubtask.dueDate ?? item.dueDate)
    : item.dueDate;
  const currentDescription = activeSubtask
    ? activeSubtask.description
    : item.description;

  useEffect(() => {
    if (!editingDesc) return;
    const handleWindowEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      if (savingDesc) return;
      setDescDraft(currentDescription ?? "");
      setDescError(null);
      setEditingDesc(false);
    };
    window.addEventListener("keydown", handleWindowEscape, true);
    return () => window.removeEventListener("keydown", handleWindowEscape, true);
  }, [currentDescription, editingDesc, savingDesc]);
  const currentLabels = activeSubtask
    ? (activeSubtask.labels ?? item.labels ?? [])
    : (item.labels ?? []);

  const canEditStatus = activeSubtask
    ? Boolean(onUpdateSubtask && !activeSubtask.readOnly)
    : Boolean(onStatusChange && !item.readOnly);
  const canEditPriority = activeSubtask
    ? Boolean(onUpdateSubtask && !activeSubtask.readOnly)
    : Boolean(onPriorityChange && !item.readOnly);
  const canEditDescription = activeSubtask
    ? Boolean(onUpdateSubtask && !activeSubtask.readOnly)
    : Boolean(onDescriptionChange && !item.readOnly);

  const dueFormatted = formatShortDate(currentDueDate, locale);
  const createdFormatted = formatShortDate(
    activeSubtask?.createdAt ?? item.createdAt,
    locale,
  );

  function toggleSubtaskSteps(subId: string) {
    setExpandedStepSubIds((prev) => {
      const next = new Set(prev);
      if (next.has(subId)) next.delete(subId);
      else next.add(subId);
      return next;
    });
  }

  async function handleSaveInlineDescription(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setDescError(null);
    const trimmed = descDraft.trim();
    const fallbackError = tr(
      t,
      "splitTask.saveDescriptionError",
      "Could not save description. Please try again.",
    );
    if (activeSubtask) {
      if (!onUpdateSubtask) return;
      setSavingDesc(true);
      try {
        await Promise.resolve(
          onUpdateSubtask(item.id, activeSubtask.id, {
            description: trimmed,
          }),
        );
        setEditingDesc(false);
      } catch (err) {
        setDescError(
          err instanceof Error && err.message.trim().length > 0
            ? err.message
            : fallbackError,
        );
      } finally {
        setSavingDesc(false);
      }
      return;
    }
    if (!onDescriptionChange) return;
    setSavingDesc(true);
    try {
      const ok = await onDescriptionChange(
        item.id,
        trimmed.length > 0 ? trimmed : null,
      );
      if (ok === false) {
        setDescError(fallbackError);
        return;
      }
      setEditingDesc(false);
    } catch (err) {
      setDescError(
        err instanceof Error && err.message.trim().length > 0
          ? err.message
          : fallbackError,
      );
    } finally {
      setSavingDesc(false);
    }
  }

  function handleQuickCommentSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = quickComment.trim();
    if (!trimmed) return;
    if (!activeSubtask && onAddComment) {
      onAddComment(item.id, trimmed);
      setQuickComment("");
    }
  }

  const totalSubtasks = item.subtasks.total;
  const completedSubtasks = item.subtasks.completed;
  const subtaskDonePct =
    totalSubtasks > 0
      ? Math.round((completedSubtasks / totalSubtasks) * 100)
      : 0;

  return (
    <div
      data-testid="split-task-reference-view"
      className="relative flex min-h-full min-w-0 flex-col bg-gray-50/35 dark:bg-gray-900"
    >
      {/* 1. Compact Sticky Header */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-gray-200/90 bg-white/95 px-3.5 py-2.5 backdrop-blur-xs dark:border-gray-800 dark:bg-gray-900/95">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
          {mode === "page" && (
            <button
              type="button"
              onClick={onClose}
              aria-label={tr(t, "splitTask.backToList", "Back to task list")}
              title={tr(t, "splitTask.backToList", "Back to task list")}
              className="inline-flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 text-[11px] font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <span aria-hidden="true" className="inline-block rtl:rotate-180">
                ←
              </span>
            </button>
          )}

          {activeSubtask ? (
            <>
              <button
                type="button"
                onClick={() => onSelectSubtaskLayer(null)}
                className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 text-[11px] font-semibold text-gray-700 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
              >
                <span
                  aria-hidden="true"
                  className="inline-block rtl:rotate-180"
                >
                  ←
                </span>
                <span>
                  {tr(t, "splitTask.backToParent", `Back to ${item.key}`, {
                    key: item.key,
                  })}
                </span>
              </button>
              <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                <MonoIssueTypeIcon type="SUBTASK" className="h-3 w-3" />
                <span>{activeSubtask.key}</span>
              </span>
              {subtaskList.length > 1 && (
                <div className="inline-flex h-6 items-center rounded-md border border-gray-200 bg-white text-[11px] dark:border-gray-700 dark:bg-gray-900">
                  <button
                    type="button"
                    disabled={activeSubtaskIndex <= 0}
                    aria-label={tr(
                      t,
                      "splitTask.prevSubtask",
                      "Previous subtask",
                    )}
                    onClick={() => {
                      if (activeSubtaskIndex > 0) {
                        onSelectSubtaskLayer(
                          subtaskList[activeSubtaskIndex - 1].id,
                        );
                      }
                    }}
                    className="h-full cursor-pointer px-1.5 font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-35 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <span
                      aria-hidden="true"
                      className="inline-block rtl:rotate-180"
                    >
                      ‹
                    </span>
                  </button>
                  <span className="border-x border-gray-200 px-1.5 font-mono text-[10px] dark:border-gray-700">
                    {activeSubtaskIndex + 1}/{subtaskList.length}
                  </span>
                  <button
                    type="button"
                    disabled={activeSubtaskIndex >= subtaskList.length - 1}
                    aria-label={tr(t, "splitTask.nextSubtask", "Next subtask")}
                    onClick={() => {
                      if (activeSubtaskIndex < subtaskList.length - 1) {
                        onSelectSubtaskLayer(
                          subtaskList[activeSubtaskIndex + 1].id,
                        );
                      }
                    }}
                    className="h-full cursor-pointer px-1.5 font-bold text-gray-600 hover:bg-gray-100 disabled:opacity-35 dark:text-gray-300 dark:hover:bg-gray-800"
                  >
                    <span
                      aria-hidden="true"
                      className="inline-block rtl:rotate-180"
                    >
                      ›
                    </span>
                  </button>
                </div>
              )}
            </>
          ) : (
            <nav
              aria-label={t("detailBreadcrumb")}
              className="flex min-w-0 flex-wrap items-center gap-1.5"
            >
              <span className="inline-flex max-w-36 items-center gap-1 truncate">
                <TaskIcon
                  viewBox="0 0 24 24"
                  className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400"
                  aria-hidden="true"
                />
                <span className="truncate">{item.projectName}</span>
              </span>
              <span aria-hidden="true">/</span>
              {mode === "modal" ? (
                <button
                  type="button"
                  onClick={() => {
                    if (onOpenFullPage) onOpenFullPage(null);
                    else onToggleMaximize();
                  }}
                  title={
                    onOpenFullPage
                      ? tr(
                          t,
                          "splitTask.openFullPage",
                          "Open in full page view",
                        )
                      : isMaximized
                        ? tr(
                            t,
                            "splitTask.restoreModalSize",
                            "Restore modal size",
                          )
                        : tr(t, "splitTask.maximizeModal", "Full page view")
                  }
                  className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gray-900 hover:border-brand-300 hover:text-brand-600 dark:border-gray-700 dark:bg-gray-800 dark:text-white dark:hover:text-brand-400"
                >
                  <MonoIssueTypeIcon type={item.type} className="h-3 w-3" />
                  <span>{item.key}</span>
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-gray-100 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white">
                  <MonoIssueTypeIcon type={item.type} className="h-3 w-3" />
                  <span>{item.key}</span>
                </span>
              )}
            </nav>
          )}
        </div>

        <button
          type="button"
          data-testid="split-task-view-mode-toggle"
          onClick={onExpandFullView}
          title={tr(
            t,
            "splitTask.expandFullViewHint",
            "Switch to full Task management view",
          )}
          className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 shadow-2xs transition-colors hover:border-brand-300 hover:bg-brand-50/50 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-brand-500/40 dark:hover:text-brand-300"
        >
          <Maximize2 className="size-3" aria-hidden="true" />
          <span>{tr(t, "splitTask.expandFullView", "Full view")}</span>
        </button>

        <p id="work-detail-description" className="sr-only">
          {activeSubtask
            ? tr(
                t,
                "splitTask.subtaskLayerHint",
                `Subtask detail layer • Child of ${item.key} (${item.title})`,
                { key: item.key, title: item.title },
              )
            : t("detailPreviewHint")}
        </p>
      </header>

      {mutationError && (
        <div
          role="alert"
          className="mx-3.5 mt-3 flex items-center justify-between gap-2 rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-xs text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
        >
          <span>{mutationError}</span>
          {onDismissMutationError && (
            <button
              type="button"
              onClick={onDismissMutationError}
              className="font-semibold underline"
            >
              {t("mutationError.dismiss")}
            </button>
          )}
        </div>
      )}

      {/* Main Single-Column Scannable Stack */}
      <div className="space-y-3 p-3.5">
        {/* 2. Title + At-a-glance 2x2 Key Metadata Card */}
        <section className="space-y-3 rounded-xl border border-gray-200/90 bg-white p-3.5 shadow-2xs dark:border-gray-800 dark:bg-gray-900">
          <h2
            id="work-detail-title"
            className="text-base font-bold leading-snug break-words text-gray-900 dark:text-gray-100"
          >
            {currentTitle}
          </h2>

          <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-gray-100 bg-gray-50/80 p-2.5 dark:border-gray-800 dark:bg-gray-800/50">
            {/* Status */}
            <div className="min-w-0 space-y-1">
              <span className="block text-[10px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                {t("status")}
              </span>
              <label className="relative inline-flex max-w-full items-center">
                <WorkStatusBadge
                  status={currentStatus}
                  showChevron={canEditStatus}
                />
                {canEditStatus && (
                  <select
                    aria-label={tr(
                      t,
                      "splitTask.updateStatusAria",
                      "Update work item status",
                    )}
                    value={currentStatus}
                    onChange={(e) => {
                      const next = e.target.value as WorkStatus;
                      if (activeSubtask) {
                        onUpdateSubtask?.(item.id, activeSubtask.id, {
                          status: next,
                          done: next === "DONE",
                        });
                      } else {
                        onStatusChange?.(item.id, next);
                      }
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
            </div>

            {/* Priority */}
            <div className="min-w-0 space-y-1">
              <span className="block text-[10px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                {t("priority")}
              </span>
              <label className="relative inline-flex max-w-full items-center">
                <WorkPriorityLabel priority={currentPriority} />
                {canEditPriority && (
                  <select
                    aria-label={tr(
                      t,
                      "splitTask.updatePriorityAria",
                      "Update work item priority",
                    )}
                    value={currentPriority}
                    onChange={(e) => {
                      const next = e.target.value as WorkPriority;
                      if (activeSubtask) {
                        onUpdateSubtask?.(item.id, activeSubtask.id, {
                          priority: next,
                        });
                      } else {
                        onPriorityChange?.(item.id, next);
                      }
                    }}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                  >
                    <option value="HIGH">{t("priorities.HIGH")}</option>
                    <option value="MEDIUM">{t("priorities.MEDIUM")}</option>
                    <option value="LOW">{t("priorities.LOW")}</option>
                  </select>
                )}
              </label>
            </div>

            {/* Assignee */}
            <div className="min-w-0 space-y-1">
              <span className="block text-[10px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                {t("assignee")}
              </span>
              <span className="inline-flex max-w-full items-center gap-1.5 text-xs font-medium text-gray-800 dark:text-gray-200">
                <span
                  aria-hidden="true"
                  className="flex size-5 shrink-0 items-center justify-center rounded-full border border-gray-300 bg-white text-[9px] font-bold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                  {currentAssignee.initials}
                </span>
                <span className="truncate">{currentAssignee.name}</span>
              </span>
            </div>

            {/* Due Date */}
            <div className="min-w-0 space-y-1">
              <span className="block text-[10px] font-semibold tracking-wide text-gray-500 uppercase dark:text-gray-400">
                {t("dueDate")}
              </span>
              <span className="block truncate text-xs font-medium text-gray-700 dark:text-gray-300">
                {dueFormatted ?? t("noDueDate")}
              </span>
            </div>
          </div>

          {/* Parent / Labels Compact Pills */}
          {(activeSubtask || item.parent || currentLabels.length > 0) && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
              {activeSubtask ? (
                <button
                  type="button"
                  onClick={() => onSelectSubtaskLayer(null)}
                  className="inline-flex max-w-full cursor-pointer items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-medium text-brand-700 hover:bg-brand-50 dark:border-gray-700 dark:bg-gray-800 dark:text-brand-300"
                >
                  <span className="shrink-0 text-gray-500 dark:text-gray-400">
                    {tr(t, "splitTask.parentTask", "Parent")}:
                  </span>
                  <span className="font-mono font-semibold">{item.key}</span>
                  <span className="truncate">{item.title}</span>
                </button>
              ) : item.parent ? (
                <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-medium text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-brand-300">
                  <MonoIssueTypeIcon type="EPIC" className="h-3 w-3 shrink-0" />
                  <span className="font-mono font-semibold">
                    {item.parent.key}
                  </span>
                  <span className="truncate">{item.parent.summary}</span>
                </span>
              ) : null}

              {currentLabels.map((lbl) => (
                <span
                  key={lbl}
                  className="rounded-md bg-brand-50 px-1.5 py-0.5 font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                >
                  #{lbl}
                </span>
              ))}
            </div>
          )}
        </section>

        {/* 3. Description / Acceptance Criteria Card */}
        <section
          aria-labelledby="split-task-desc-heading"
          className="rounded-xl border border-gray-200/90 bg-white p-3.5 shadow-2xs dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-expanded={descOpen}
              onClick={() => setDescOpen((v) => !v)}
              className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-gray-800 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
            >
              {descOpen ? (
                <ChevronDown
                  className="size-3.5 text-gray-400"
                  aria-hidden="true"
                />
              ) : (
                <ChevronRight
                  className="size-3.5 text-gray-400 rtl:rotate-180"
                  aria-hidden="true"
                />
              )}
              <span id="split-task-desc-heading">{t("description")}</span>
            </button>

            {canEditDescription && !editingDesc && (
              <button
                type="button"
                onClick={() => {
                  setDescOpen(true);
                  setDescDraft(currentDescription ?? "");
                  setDescError(null);
                  setEditingDesc(true);
                }}
                aria-label={tr(
                  t,
                  "quickUi.editDescriptionAria",
                  "Edit work item description",
                )}
                className="inline-flex cursor-pointer items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/15"
              >
                <MonoIcon name="edit" size={11} />
                <span>{tr(t, "quickUi.edit", "Edit")}</span>
              </button>
            )}
          </div>

          {descOpen && (
            <div className="mt-2.5">
              {editingDesc ? (
                <form
                  onSubmit={(e) => void handleSaveInlineDescription(e)}
                  className="space-y-2"
                >
                  <textarea
                    autoFocus
                    aria-label={t("description")}
                    rows={6}
                    maxLength={20000}
                    disabled={savingDesc}
                    value={descDraft}
                    onChange={(e) => {
                      setDescDraft(e.target.value);
                      if (descError) setDescError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        e.stopPropagation();
                        setDescDraft(currentDescription ?? "");
                        setDescError(null);
                        setEditingDesc(false);
                      }
                    }}
                    className="w-full rounded-lg border border-brand-400 bg-white px-3 py-2 text-xs leading-relaxed text-gray-800 outline-none dark:border-brand-500 dark:bg-gray-950 dark:text-gray-200"
                  />
                  {descError && (
                    <p
                      role="alert"
                      className="rounded-md border border-error-200 bg-error-50 px-2.5 py-1.5 text-xs text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
                    >
                      {descError}
                    </p>
                  )}
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      type="submit"
                      disabled={savingDesc}
                      className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                    >
                      {savingDesc
                        ? tr(t, "quickUi.saving", "Saving…")
                        : tr(t, "quickUi.save", "Save")}
                    </button>
                    <button
                      type="button"
                      disabled={savingDesc}
                      onClick={() => {
                        setDescDraft(currentDescription ?? "");
                        setDescError(null);
                        setEditingDesc(false);
                      }}
                      className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                    >
                      {t("cancel")}
                    </button>
                  </div>
                </form>
              ) : currentDescription && currentDescription.trim().length > 0 ? (
                <p className="text-[13px] leading-relaxed break-words whitespace-pre-line text-gray-700 dark:text-gray-300">
                  {currentDescription}
                </p>
              ) : (
                <p className="text-xs italic text-gray-400 dark:text-gray-500">
                  {projectId
                    ? tr(
                        t,
                        "quickUi.noDescriptionReal",
                        "No description provided.",
                      )
                    : t("noDescription")}
                </p>
              )}
            </div>
          )}
        </section>

        {/* 4. Compact Subtasks / Steps Checklist (Single-Column, Zero Horizontal Scroll!) */}
        {!activeSubtask && (subtaskList.length > 0 || totalSubtasks > 0) && (
          <section
            aria-labelledby="split-task-subtasks-heading"
            className="rounded-xl border border-gray-200/90 bg-white p-3.5 shadow-2xs dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                aria-expanded={checklistOpen}
                onClick={() => setChecklistOpen((v) => !v)}
                className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-bold text-gray-800 hover:text-gray-900 dark:text-gray-200 dark:hover:text-white"
              >
                {checklistOpen ? (
                  <ChevronDown
                    className="size-3.5 text-gray-400"
                    aria-hidden="true"
                  />
                ) : (
                  <ChevronRight
                    className="size-3.5 text-gray-400 rtl:rotate-180"
                    aria-hidden="true"
                  />
                )}
                <span id="split-task-subtasks-heading">{t("subtasks")}</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {completedSubtasks}/{totalSubtasks}
                </span>
              </button>

              <span className="text-[11px] font-semibold tabular-nums text-gray-500 dark:text-gray-400">
                {tr(t, "splitTask.donePercent", `${subtaskDonePct}% Done`, {
                  percent: subtaskDonePct,
                })}
              </span>
            </div>

            {/* Slim Progress Bar */}
            <div
              role="progressbar"
              aria-label={t("subtasks")}
              aria-valuemin={0}
              aria-valuemax={totalSubtasks}
              aria-valuenow={completedSubtasks}
              className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
            >
              {subtaskDonePct > 0 && (
                <div
                  className="h-full bg-success-500 transition-all dark:bg-success-400"
                  style={{ width: `${subtaskDonePct}%` }}
                />
              )}
            </div>

            {checklistOpen && subtaskList.length > 0 && (
              <ul className="mt-2.5 divide-y divide-gray-100 dark:divide-gray-800">
                {subtaskList.map((sub) => {
                  const steps = sub.steps ?? [];
                  const doneSteps = steps.filter((s) => s.done).length;
                  const stepsExpanded = expandedStepSubIds.has(sub.id);
                  return (
                    <li key={sub.id} className="py-2 first:pt-1 last:pb-0">
                      <div className="flex items-start gap-2">
                        <input
                          type="checkbox"
                          checked={sub.done}
                          disabled={sub.readOnly || !onToggleSubtask}
                          onChange={() => onToggleSubtask?.(item.id, sub.id)}
                          aria-label={tr(
                            t,
                            "splitTask.completeSubtaskAria",
                            `Complete subtask ${sub.key}`,
                            { key: sub.key },
                          )}
                          className="mt-0.5 size-3.5 shrink-0 cursor-pointer rounded border-gray-300 text-brand-600 focus:ring-brand-500 disabled:cursor-not-allowed"
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-1.5">
                            <button
                              type="button"
                              onClick={() => onSelectSubtaskLayer(sub.id)}
                              className="cursor-pointer font-mono text-[11px] font-semibold text-gray-500 hover:text-brand-600 hover:underline dark:text-gray-400 dark:hover:text-brand-400"
                            >
                              {sub.key}
                            </button>
                            <div className="flex items-center gap-1.5">
                              {steps.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => toggleSubtaskSteps(sub.id)}
                                  className="cursor-pointer rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                >
                                  {doneSteps}/{steps.length}
                                </button>
                              )}
                              <WorkStatusBadge status={sub.status} />
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => onSelectSubtaskLayer(sub.id)}
                            className={`line-clamp-2 block w-full cursor-pointer text-start text-xs leading-snug font-medium ${
                              sub.done
                                ? "text-gray-400 line-through dark:text-gray-500"
                                : "text-gray-800 hover:text-brand-600 dark:text-gray-200 dark:hover:text-brand-300"
                            }`}
                          >
                            {sub.summary}
                          </button>

                          {stepsExpanded && steps.length > 0 && (
                            <ul className="mt-1.5 space-y-1 rounded-lg bg-gray-50/80 p-2 text-[11px] dark:bg-gray-800/60">
                              {steps.map((st) => (
                                <li
                                  key={st.id}
                                  className="flex items-start gap-1.5 text-gray-700 dark:text-gray-300"
                                >
                                  <span aria-hidden="true">
                                    {st.done ? "✓" : "•"}
                                  </span>
                                  <span
                                    className={
                                      st.done
                                        ? "text-gray-400 line-through"
                                        : ""
                                    }
                                  >
                                    {st.text}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {activeSubtask && (activeSubtask.steps?.length ?? 0) > 0 && (
          <section className="rounded-xl border border-gray-200/90 bg-white p-3.5 shadow-2xs dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200">
                {tr(t, "splitTask.stepsHeading", "Implementation steps")}
              </h3>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 font-mono text-[10px] font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {(activeSubtask.steps ?? []).filter((s) => s.done).length}/
                {(activeSubtask.steps ?? []).length}
              </span>
            </div>
            <ul className="mt-2.5 space-y-1.5 text-xs">
              {(activeSubtask.steps ?? []).map((st) => (
                <li key={st.id}>
                  <label className="flex cursor-pointer items-start gap-2">
                    <input
                      type="checkbox"
                      aria-label={st.text}
                      checked={st.done}
                      disabled={activeSubtask.readOnly || !onUpdateSubtask}
                      onChange={() => {
                        if (!onUpdateSubtask) return;
                        const nextSteps = (activeSubtask.steps ?? []).map(
                          (cur) =>
                            cur.id === st.id
                              ? { ...cur, done: !cur.done }
                              : cur,
                        );
                        onUpdateSubtask(item.id, activeSubtask.id, {
                          steps: nextSteps,
                        });
                      }}
                      className="mt-0.5 size-3.5 shrink-0 cursor-pointer rounded border-gray-300 text-brand-600 disabled:cursor-not-allowed"
                    />
                    <span
                      className={
                        st.done
                          ? "text-gray-400 line-through dark:text-gray-500"
                          : "text-gray-800 dark:text-gray-200"
                      }
                    >
                      {st.text}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* 5. Secondary Reference Tabs (Comments / Worklog / Notes / More Details) */}
        <section className="overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-2xs dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-stretch gap-0.5 border-b border-gray-100 bg-gray-50/90 px-1.5 pt-1.5 dark:border-gray-800 dark:bg-gray-800/70">
            {(
              [
                [
                  "comments",
                  tr(t, "splitTask.tabComments", "Comments"),
                  activeComments.length,
                ],
                [
                  "worklog",
                  tr(t, "splitTask.tabWorklog", "Work log"),
                  activeWorklogs.length,
                ],
                ...(projectId
                  ? ([
                      ["notes", tr(t, "splitTask.tabNotes", "Notes"), 0],
                    ] as const)
                  : []),
                ["more", tr(t, "splitTask.tabMore", "More info"), 0],
              ] as const
            ).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                onClick={() => setSecondaryTab(key)}
                className={`inline-flex flex-1 cursor-pointer items-center justify-center gap-1 border-b-2 px-1.5 pt-1 pb-2 text-[11px] whitespace-nowrap transition-colors ${
                  secondaryTab === key
                    ? "rounded-ss-lg rounded-se-lg border-brand-600 bg-white font-bold text-brand-600 dark:border-brand-400 dark:bg-gray-900 dark:text-brand-300"
                    : "border-transparent font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <span>{label}</span>
                {count > 0 && (
                  <span className="rounded-full bg-gray-200/80 px-1.5 py-0.2 text-[10px] tabular-nums dark:bg-gray-700">
                    {count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="p-3.5 text-xs">
            {secondaryTab === "comments" && (
              <div className="space-y-2.5">
                {!activeSubtask && onAddComment && (
                  <form
                    onSubmit={handleQuickCommentSubmit}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      value={quickComment}
                      onChange={(e) => setQuickComment(e.target.value)}
                      placeholder={tr(
                        t,
                        "splitTask.quickCommentPlaceholder",
                        "Add a quick comment…",
                      )}
                      className="h-8 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-800 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                    />
                    <button
                      type="submit"
                      disabled={!quickComment.trim()}
                      className="h-8 shrink-0 cursor-pointer rounded-lg bg-brand-600 px-2.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {tr(t, "splitTask.sendComment", "Send")}
                    </button>
                  </form>
                )}

                {activeComments.length > 0 ? (
                  <ul className="space-y-2">
                    {activeComments.map((comment) => (
                      <li
                        key={comment.id}
                        className="rounded-lg border border-gray-100 bg-gray-50/70 p-2.5 dark:border-gray-800 dark:bg-gray-800/40"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-gray-900 dark:text-gray-100">
                            {comment.author}
                          </span>
                          <span className="text-[11px] tabular-nums text-gray-400">
                            {formatCommentTime(comment.createdAt)}
                          </span>
                        </div>
                        <p className="mt-1 leading-relaxed break-words text-gray-700 dark:text-gray-300">
                          {comment.text}
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400">
                    {tr(
                      t,
                      "splitTask.noComments",
                      "No comments on this work item yet.",
                    )}
                  </p>
                )}
              </div>
            )}

            {secondaryTab === "worklog" &&
              (activeWorklogs.length > 0 ? (
                <ul className="space-y-2">
                  {activeWorklogs.map((wl) => (
                    <li
                      key={wl.id}
                      className="rounded-lg border border-gray-100 bg-gray-50/70 p-2.5 dark:border-gray-800 dark:bg-gray-800/40"
                    >
                      <div className="flex items-center justify-between gap-2 font-semibold text-gray-900 dark:text-gray-100">
                        <span>{wl.author}</span>
                        <span className="inline-flex items-center gap-1 text-brand-700 tabular-nums dark:text-brand-300">
                          <MonoIcon name="clock" className="h-3 w-3" />
                          <span>{wl.timeSpent}</span>
                        </span>
                      </div>
                      {wl.note && (
                        <p className="mt-1 leading-relaxed text-gray-600 dark:text-gray-300">
                          {wl.note}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">
                  {tr(
                    t,
                    "splitTask.noWorklogs",
                    "No work logged on this work item yet.",
                  )}
                </p>
              ))}

            {secondaryTab === "notes" && projectId && (
              <TaskNotesPanel
                projectId={projectId}
                taskId={activeSubtask ? activeSubtask.id : item.id}
                splitControl={splitControl}
              />
            )}

            {secondaryTab === "more" && (
              <dl className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-gray-500 dark:text-gray-400">
                    {t("reporter")}
                  </dt>
                  <dd className="font-medium text-gray-800 dark:text-gray-200">
                    {(activeSubtask?.reporter ?? item.reporter).name}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-gray-500 dark:text-gray-400">
                    {tr(t, "splitTask.teamLabel", "Team")}
                  </dt>
                  <dd className="font-medium text-gray-800 dark:text-gray-200">
                    {item.team ?? (isPreview ? "Core Engineering" : "—")}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-gray-500 dark:text-gray-400">
                    {t("resolution")}
                  </dt>
                  <dd className="font-medium text-gray-800 dark:text-gray-200">
                    {t(`resolutions.${item.resolution}`)}
                  </dd>
                </div>
                {createdFormatted && (
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-gray-500 dark:text-gray-400">
                      {t("created")}
                    </dt>
                    <dd className="tabular-nums text-gray-700 dark:text-gray-300">
                      {createdFormatted}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
