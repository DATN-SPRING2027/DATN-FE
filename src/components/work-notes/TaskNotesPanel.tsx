"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import WorkNoteComposer from "./WorkNoteComposer";
import {
  BackgroundRefreshError,
  UpdatingStatus,
} from "@/components/ui/loading/AsyncStatus";
import {
  AlertIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  CloseIcon,
  DocsIcon,
  MoreDotIcon,
  PencilIcon,
  PlusIcon,
  TrashBinIcon,
} from "@/icons";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import {
  useTaskNotesQuery,
  useWorkNotesMutation,
  workNoteKeys,
  workNotesApi,
  type TaskNoteInput,
} from "@/lib/queries/work-notes/useWorkNotes";

const EMPTY_INPUT: TaskNoteInput = {
  title: "",
  accomplishments: "",
  approach: "",
  reason: "",
};

type TaskNoteDraftSnapshot = Readonly<{
  input: TaskNoteInput;
  isComposerOpen: boolean;
  editingId: string | null;
}>;

const draftStoreByClient = new WeakMap<
  QueryClient,
  Map<string, TaskNoteDraftSnapshot>
>();

function getDraftMap(client: QueryClient): Map<string, TaskNoteDraftSnapshot> {
  let map = draftStoreByClient.get(client);
  if (!map) {
    map = new Map<string, TaskNoteDraftSnapshot>();
    draftStoreByClient.set(client, map);
  }
  return map;
}

function hasDraftContent(input: TaskNoteInput): boolean {
  return Boolean(
    input.title.trim() ||
    input.accomplishments.trim() ||
    input.approach.trim() ||
    input.reason.trim(),
  );
}

function getAuthorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function formatNoteTimestamp(value: string, locale: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

const FIELD_CLASS =
  "w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder:text-gray-500";

export type TaskNotesSplitControl = {
  isOpen: boolean;
  editingNoteId: string | null;
  savedSignal?: number;
  onOpen: (noteId?: string) => void;
  onClose: () => void;
};

export default function TaskNotesPanel({
  projectId,
  taskId,
  splitControl,
}: {
  projectId: string;
  taskId: string;
  splitControl?: TaskNotesSplitControl;
}) {
  return (
    <TaskNotesContent
      key={`${projectId}:${taskId}`}
      projectId={projectId}
      taskId={taskId}
      splitControl={splitControl}
    />
  );
}

function TaskNotesContent({
  projectId,
  taskId,
  splitControl,
}: {
  projectId: string;
  taskId: string;
  splitControl?: TaskNotesSplitControl;
}) {
  const t = useTranslations("workNotes.taskNotes");
  const locale = useLocale();
  const queryClient = useQueryClient();
  const draftKey = `${projectId}:${taskId}`;
  const initialDraft = getDraftMap(queryClient).get(draftKey);

  const query = useTaskNotesQuery(projectId, taskId);
  const accessLost = isAccessOrResourceUnavailableError(query.error);
  const visibleNotes = accessLost ? undefined : query.data;
  const [input, setInput] = useState<TaskNoteInput>(
    initialDraft?.input ?? EMPTY_INPUT,
  );
  const [editingId, setEditingId] = useState<string | null>(
    initialDraft?.editingId ?? null,
  );
  const [isComposerOpen, setIsComposerOpen] = useState<boolean>(
    initialDraft?.isComposerOpen ?? false,
  );
  const [validationError, setValidationError] = useState("");
  const [showSavedBanner, setShowSavedBanner] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [removingNoteId, setRemovingNoteId] = useState<string | null>(null);

  const titleInputRef = useRef<HTMLInputElement>(null);
  const menuContainerRef = useRef<HTMLDivElement>(null);

  const create = useWorkNotesMutation(
    workNotesApi.createTaskNote.bind(null, projectId, taskId),
    [
      workNoteKeys.taskNotes(projectId, taskId),
      workNoteKeys.project(projectId),
    ],
  );
  const update = useWorkNotesMutation(
    ({ noteId, value }: { noteId: string; value: TaskNoteInput }) =>
      workNotesApi.updateTaskNote(projectId, taskId, noteId, value),
    [
      workNoteKeys.taskNotes(projectId, taskId),
      workNoteKeys.project(projectId),
    ],
  );
  const remove = useWorkNotesMutation(
    (noteId: string) => workNotesApi.deleteTaskNote(projectId, taskId, noteId),
    [
      workNoteKeys.taskNotes(projectId, taskId),
      workNoteKeys.project(projectId),
    ],
  );

  useEffect(() => {
    const map = getDraftMap(queryClient);
    if (hasDraftContent(input) || isComposerOpen || editingId !== null) {
      map.set(draftKey, { input, isComposerOpen, editingId });
    } else {
      map.delete(draftKey);
    }
  }, [draftKey, editingId, input, isComposerOpen, queryClient]);

  useEffect(() => {
    if (!openMenuId) return;
    function handlePointerDown(event: MouseEvent) {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(event.target as Node)
      ) {
        setOpenMenuId(null);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openMenuId]);

  const notes = visibleNotes?.data ?? [];
  const notesCount = visibleNotes?.pagination.totalItems ?? notes.length;
  const showComposer = isComposerOpen || editingId !== null;
  const envAgentEditorEnabled =
    process.env.NEXT_PUBLIC_WORKNOTE_EDITOR_ENABLED === "true";
  const agentEditorEnabled =
    envAgentEditorEnabled ||
    notes.some(
      (note) => note.id === editingId && note.contentSchemaVersion === 2,
    );
  const isDraftDirty = hasDraftContent(input);
  const isNewNoteActive =
    (showComposer && !editingId) ||
    Boolean(splitControl?.isOpen && !splitControl.editingNoteId);

  const [dismissedSplitSignal, setDismissedSplitSignal] = useState(
    splitControl?.savedSignal ?? 0,
  );
  const currentSplitSignal = splitControl?.savedSignal ?? 0;
  const effectiveSavedBanner =
    showSavedBanner ||
    (currentSplitSignal > 0 && currentSplitSignal !== dismissedSplitSignal);

  function resetFeedback() {
    create.reset();
    update.reset();
    remove.reset();
    setValidationError("");
    setShowSavedBanner(false);
    setDismissedSplitSignal(currentSplitSignal);
  }

  function handleOpenNewNote() {
    resetFeedback();
    setOpenMenuId(null);
    if (splitControl && envAgentEditorEnabled) {
      if (editingId !== null || isComposerOpen) {
        setEditingId(null);
        setIsComposerOpen(false);
        setInput(EMPTY_INPUT);
        getDraftMap(queryClient).delete(draftKey);
      }
      splitControl.onOpen(undefined);
      return;
    }
    if (editingId !== null) {
      setEditingId(null);
      setInput(EMPTY_INPUT);
    }
    setIsComposerOpen(true);
    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 0);
  }

  function handleCloseComposer() {
    resetFeedback();
    setEditingId(null);
    setIsComposerOpen(false);
    setInput(EMPTY_INPUT);
    getDraftMap(queryClient).delete(draftKey);
  }

  function handleStartEdit(note: (typeof notes)[number]) {
    resetFeedback();
    setOpenMenuId(null);
    if (
      splitControl &&
      (envAgentEditorEnabled || note.contentSchemaVersion === 2)
    ) {
      if (editingId !== null || isComposerOpen) {
        setEditingId(null);
        setIsComposerOpen(false);
        setInput(EMPTY_INPUT);
        getDraftMap(queryClient).delete(draftKey);
      }
      splitControl.onOpen(note.id);
      return;
    }
    setEditingId(note.id);
    setIsComposerOpen(true);
    setInput({
      title: note.title,
      accomplishments: note.accomplishments,
      approach: note.approach,
      reason: note.reason,
    });
    setTimeout(() => {
      titleInputRef.current?.focus();
    }, 0);
  }

  function handleArchiveNote(noteId: string) {
    setOpenMenuId(null);
    if (!window.confirm(t("deleteConfirm"))) return;
    resetFeedback();
    setRemovingNoteId(noteId);
    remove.mutate(noteId, {
      onSuccess: () => {
        setRemovingNoteId(null);
        if (editingId === noteId) {
          setEditingId(null);
          setIsComposerOpen(false);
          setInput(EMPTY_INPUT);
          getDraftMap(queryClient).delete(draftKey);
        }
        if (splitControl?.isOpen && splitControl.editingNoteId === noteId) {
          splitControl.onClose();
        }
      },
      onError: () => {
        setRemovingNoteId(null);
      },
    });
  }

  function toggleNoteDetails(noteId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.reset();
    update.reset();
    remove.reset();
    setShowSavedBanner(false);
    const cleaned = {
      title: input.title.trim(),
      accomplishments: input.accomplishments.trim(),
      approach: input.approach.trim(),
      reason: input.reason.trim(),
    };
    if (Object.values(cleaned).some((value) => !value)) {
      setValidationError(t("required"));
      return;
    }
    setValidationError("");
    try {
      if (editingId) {
        await update.mutateAsync({ noteId: editingId, value: cleaned });
      } else {
        await create.mutateAsync(cleaned);
      }
      setInput(EMPTY_INPUT);
      setEditingId(null);
      setIsComposerOpen(false);
      getDraftMap(queryClient).delete(draftKey);
      setShowSavedBanner(true);
    } catch {
      // The mutation state surfaces the server error while preserving the draft.
    }
  }

  const mutationError = create.error ?? update.error ?? remove.error;
  const hasMutationError = create.isError || update.isError || remove.isError;

  return (
    <section aria-labelledby="task-notes-heading" className="min-w-0 space-y-4">
      {/* Header: Title + Count Pill + Description + New Note CTA */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4
              id="task-notes-heading"
              className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white/90"
            >
              {t("title")}
            </h4>
            {!query.isLoading && (
              <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 tabular-nums dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {t("count", { count: notesCount })}
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">
            {t("description")}
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          variant={isNewNoteActive ? "outline" : "primary"}
          startIcon={<PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />}
          onClick={handleOpenNewNote}
        >
          {t("newNote")}
        </Button>
      </div>

      {visibleNotes !== undefined &&
        !accessLost &&
        (query.isFetching || query.isRefetchError) && (
          <div>
            {query.isFetching && (
              <UpdatingStatus>{t("loading")}</UpdatingStatus>
            )}
            {query.isRefetchError && (
              <BackgroundRefreshError
                retryLabel={t("retry")}
                onRetry={() => void query.refetch()}
              >
                {t("loadError")}
              </BackgroundRefreshError>
            )}
          </div>
        )}

      {/* Saved Status Banner */}
      {effectiveSavedBanner && !validationError && !hasMutationError && (
        <div
          role="status"
          className="flex items-center justify-between gap-3 rounded-lg border border-success-200 bg-success-50/80 px-3.5 py-2.5 text-xs font-medium text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300"
        >
          <span className="inline-flex items-center gap-2">
            <CheckCircleIcon
              className="h-4 w-4 shrink-0 text-success-600 dark:text-success-400"
              aria-hidden="true"
            />
            <span>{t("saved")}</span>
          </span>
          <button
            type="button"
            aria-label={t("dismissNotice")}
            onClick={() => {
              setShowSavedBanner(false);
              setDismissedSplitSignal(currentSplitSignal);
            }}
            className="cursor-pointer rounded p-1 text-success-700/80 transition-colors hover:bg-success-100 hover:text-success-800 dark:text-success-300 dark:hover:bg-success-500/20"
          >
            <CloseIcon
              className="h-3.5 w-3.5 fill-current"
              aria-hidden="true"
            />
          </button>
        </div>
      )}

      {/* Archive / Delete Error Banner when composer is closed */}
      {remove.isError && !showComposer && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-lg border border-error-200 bg-error-50 px-3.5 py-2.5 text-xs font-medium text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
        >
          <AlertIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            {remove.error instanceof Error
              ? remove.error.message
              : t("saveError")}
          </span>
        </div>
      )}

      {/* Collapsible Composer */}
      {showComposer && agentEditorEnabled && (
        <WorkNoteComposer
          projectId={projectId}
          taskId={taskId}
          noteId={editingId ?? undefined}
          onClose={handleCloseComposer}
          onSaved={() => {
            handleCloseComposer();
            setShowSavedBanner(true);
          }}
        />
      )}
      {showComposer && !agentEditorEnabled && (
        <form
          onSubmit={submit}
          noValidate
          className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/60 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900/60">
            <div className="flex flex-wrap items-center gap-2">
              <h5 className="text-xs font-semibold text-gray-900 dark:text-white/90">
                {t(editingId ? "editTitle" : "addTitle")}
              </h5>
              {editingId ? (
                <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-medium text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  {t("editingBadge")}
                </span>
              ) : isDraftDirty ? (
                <span className="rounded bg-warning-50 px-1.5 py-0.5 text-[11px] font-medium text-warning-700 dark:bg-warning-500/15 dark:text-warning-300">
                  {t("draftBadge")}
                </span>
              ) : null}
            </div>
            <button
              type="button"
              aria-label={t("closeComposer")}
              onClick={handleCloseComposer}
              className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded text-gray-400 transition-colors hover:bg-gray-200/60 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <CloseIcon
                className="h-3.5 w-3.5 fill-current"
                aria-hidden="true"
              />
            </button>
          </div>

          <div className="space-y-3.5 p-4">
            <label className="grid min-w-0 gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
              <span>{t("noteTitle")}</span>
              <input
                ref={titleInputRef}
                required
                maxLength={160}
                placeholder={t("noteTitlePlaceholder")}
                value={input.title}
                onChange={(event) => {
                  if (validationError) setValidationError("");
                  setInput((current) => ({
                    ...current,
                    title: event.target.value,
                  }));
                }}
                className={FIELD_CLASS}
              />
            </label>

            <label className="grid min-w-0 gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
              <span>{t("accomplishments")}</span>
              <textarea
                required
                maxLength={10000}
                rows={3}
                placeholder={t("accomplishmentsPlaceholder")}
                value={input.accomplishments}
                onChange={(event) => {
                  if (validationError) setValidationError("");
                  setInput((current) => ({
                    ...current,
                    accomplishments: event.target.value,
                  }));
                }}
                className={`${FIELD_CLASS} min-h-24 resize-y`}
              />
            </label>

            <div className="grid gap-3.5 sm:grid-cols-2">
              <label className="grid min-w-0 gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                <span>{t("approach")}</span>
                <textarea
                  required
                  maxLength={10000}
                  rows={3}
                  placeholder={t("approachPlaceholder")}
                  value={input.approach}
                  onChange={(event) => {
                    if (validationError) setValidationError("");
                    setInput((current) => ({
                      ...current,
                      approach: event.target.value,
                    }));
                  }}
                  className={`${FIELD_CLASS} min-h-24 resize-y`}
                />
              </label>

              <label className="grid min-w-0 gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                <span>{t("reason")}</span>
                <textarea
                  required
                  maxLength={5000}
                  rows={3}
                  placeholder={t("reasonPlaceholder")}
                  value={input.reason}
                  onChange={(event) => {
                    if (validationError) setValidationError("");
                    setInput((current) => ({
                      ...current,
                      reason: event.target.value,
                    }));
                  }}
                  className={`${FIELD_CLASS} min-h-24 resize-y`}
                />
              </label>
            </div>

            {validationError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-md border border-error-200 bg-error-50 px-3 py-2 text-xs font-medium text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
              >
                <AlertIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{validationError}</span>
              </div>
            )}

            {hasMutationError && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-md border border-error-200 bg-error-50 px-3 py-2 text-xs font-medium text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
              >
                <AlertIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {mutationError instanceof Error
                    ? mutationError.message
                    : t("saveError")}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/60 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900/50">
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              {t("composerHint")}
            </span>
            <div className="ms-auto flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCloseComposer}
              >
                {t("cancel")}
              </Button>
              <Button
                type="submit"
                size="sm"
                isLoading={create.isPending || update.isPending}
              >
                {t("save")}
              </Button>
            </div>
          </div>
        </form>
      )}

      {/* Query Load Error Banner (always visible if refetch or initial load fails) */}
      {query.isError && !visibleNotes && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error-200 bg-error-50 px-3.5 py-3 text-xs font-medium text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
        >
          <span className="inline-flex items-center gap-2">
            <AlertIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              {query.error instanceof Error
                ? query.error.message
                : t("loadError")}
            </span>
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void query.refetch()}
          >
            {t("retry")}
          </Button>
        </div>
      )}

      {/* Loading Skeletons */}
      {query.isLoading && !visibleNotes ? (
        <div role="status" className="space-y-2.5" aria-label={t("loading")}>
          <div className="h-20 animate-pulse rounded-lg border border-gray-200/80 bg-gray-100/80 dark:border-gray-800 dark:bg-gray-800/60" />
          <div className="h-20 animate-pulse rounded-lg border border-gray-200/80 bg-gray-100/80 dark:border-gray-800 dark:bg-gray-800/60" />
        </div>
      ) : notes.length > 0 ? (
        /* Timeline Notes Feed */
        <ol
          aria-label={t("title")}
          className="relative space-y-3 before:absolute before:start-3.5 before:top-4 before:bottom-4 before:w-px before:bg-gray-200 dark:before:bg-gray-800"
        >
          {notes.map((note) => {
            const isExpanded = expandedIds.has(note.id);
            const isBeingEdited =
              editingId === note.id ||
              Boolean(
                splitControl?.isOpen && splitControl.editingNoteId === note.id,
              );
            const isRemovingThis =
              remove.isPending && removingNoteId === note.id;
            const hasActions =
              note.permissions.canEdit || Boolean(note.permissions.canDelete);
            const isMenuOpen = openMenuId === note.id;

            return (
              <li
                key={note.id}
                aria-busy={isRemovingThis}
                className="relative min-w-0 ps-9"
              >
                {/* Timeline Node Dot */}
                <span
                  aria-hidden="true"
                  className={`absolute start-1.5 top-4 flex h-4 w-4 items-center justify-center rounded-full border bg-white dark:bg-gray-900 ${
                    isBeingEdited
                      ? "border-brand-500 ring-2 ring-brand-500/20"
                      : "border-gray-300 dark:border-gray-700"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isBeingEdited
                        ? "bg-brand-500"
                        : "bg-gray-400 dark:bg-gray-500"
                    }`}
                  />
                </span>

                {/* Note Card */}
                <article
                  className={`min-w-0 rounded-lg border bg-white p-3.5 shadow-theme-xs transition-colors sm:p-4 dark:bg-gray-900 ${
                    isBeingEdited
                      ? "border-brand-300 ring-2 ring-brand-500/15 dark:border-brand-500/50"
                      : "border-gray-200 hover:border-gray-300 dark:border-gray-800 dark:hover:border-gray-700"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h5 className="min-w-0 text-sm font-semibold break-words text-gray-900 dark:text-white/90">
                          {note.title}
                        </h5>
                        {isBeingEdited && (
                          <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                            {t("editingBadge")}
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                        <span
                          aria-hidden="true"
                          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
                        >
                          {getAuthorInitials(note.authorName)}
                        </span>
                        <span className="font-medium text-gray-700 dark:text-gray-300">
                          {note.authorName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <time
                          className="shrink-0 text-xs text-gray-500 tabular-nums dark:text-gray-400"
                          dateTime={note.createdAt}
                        >
                          {formatNoteTimestamp(note.createdAt, locale)}
                        </time>
                      </div>
                    </div>

                    {hasActions && (
                      <div
                        ref={isMenuOpen ? menuContainerRef : undefined}
                        className="relative shrink-0"
                      >
                        <button
                          type="button"
                          aria-label={t("noteActions", { title: note.title })}
                          aria-haspopup="menu"
                          aria-expanded={isMenuOpen}
                          disabled={remove.isPending}
                          onClick={() =>
                            setOpenMenuId((current) =>
                              current === note.id ? null : note.id,
                            )
                          }
                          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-transparent text-gray-500 transition-colors hover:border-gray-200 hover:bg-gray-50 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:text-gray-400 dark:hover:border-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                        >
                          <MoreDotIcon className="h-4 w-4" aria-hidden="true" />
                        </button>

                        {isMenuOpen && (
                          <div
                            role="menu"
                            aria-label={t("noteActions", { title: note.title })}
                            className="absolute end-0 top-full z-30 mt-1 w-36 overflow-hidden rounded-lg border border-gray-200 bg-white py-1 shadow-theme-md dark:border-gray-700 dark:bg-gray-900"
                          >
                            {note.permissions.canEdit && (
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => handleStartEdit(note)}
                                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-start text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 dark:text-gray-200 dark:hover:bg-gray-800 dark:hover:text-white"
                              >
                                <PencilIcon
                                  className="h-3.5 w-3.5 text-gray-400"
                                  aria-hidden="true"
                                />
                                <span>{t("edit")}</span>
                              </button>
                            )}
                            {note.permissions.canDelete && (
                              <button
                                type="button"
                                role="menuitem"
                                disabled={remove.isPending}
                                onClick={() => handleArchiveNote(note.id)}
                                className="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-start text-xs font-medium text-error-600 transition-colors hover:bg-error-50 disabled:cursor-not-allowed disabled:opacity-50 dark:text-error-400 dark:hover:bg-error-500/10"
                              >
                                <TrashBinIcon
                                  className="h-3.5 w-3.5"
                                  aria-hidden="true"
                                />
                                <span>{t("archive")}</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Summary Preview when collapsed */}
                  {!isExpanded && (
                    <p className="mt-2.5 line-clamp-2 text-xs leading-5 break-words text-gray-600 dark:text-gray-300">
                      {note.contentMarkdown ?? note.accomplishments}
                    </p>
                  )}

                  {/* Expandable Structured What / How / Why Details */}
                  {isExpanded && note.contentMarkdown !== undefined && (
                    <div className="mt-3 rounded-md border border-gray-100 p-3 text-sm leading-6 break-words whitespace-pre-wrap text-gray-700 dark:border-gray-800 dark:text-gray-200">
                      {note.contentMarkdown}
                    </div>
                  )}
                  {isExpanded && note.contentMarkdown === undefined && (
                    <dl className="mt-3 space-y-3 rounded-md border border-gray-100 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-950/50">
                      <div className="min-w-0">
                        <dt className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                          {t("accomplishments")}
                        </dt>
                        <dd className="mt-1 text-xs leading-5 break-words whitespace-pre-wrap text-gray-700 dark:text-gray-200">
                          {note.accomplishments}
                        </dd>
                      </div>
                      <div className="grid gap-3 border-t border-gray-200/70 pt-3 sm:grid-cols-2 dark:border-gray-800">
                        <div className="min-w-0">
                          <dt className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                            {t("approach")}
                          </dt>
                          <dd className="mt-1 text-xs leading-5 break-words whitespace-pre-wrap text-gray-700 dark:text-gray-200">
                            {note.approach}
                          </dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400">
                            {t("reason")}
                          </dt>
                          <dd className="mt-1 text-xs leading-5 break-words whitespace-pre-wrap text-gray-700 dark:text-gray-200">
                            {note.reason}
                          </dd>
                        </div>
                      </div>
                    </dl>
                  )}

                  {/* View details / Hide details toggle */}
                  <div className="mt-2.5 flex items-center">
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => toggleNoteDetails(note.id)}
                      className="inline-flex cursor-pointer items-center gap-1 text-xs font-semibold text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                    >
                      <span>
                        {isExpanded ? t("hideDetails") : t("viewDetails")}
                      </span>
                      <ChevronDownIcon
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </article>
              </li>
            );
          })}
        </ol>
      ) : !showComposer && !query.isError ? (
        /* Compact Empty State with Icon, Guidance & CTA */
        <div className="rounded-lg border border-gray-200/90 bg-gray-50/50 px-5 py-7 text-center dark:border-gray-800 dark:bg-gray-900/40">
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 bg-white text-brand-600 shadow-theme-xs dark:border-gray-700 dark:bg-gray-800 dark:text-brand-400">
            <DocsIcon className="h-4.5 w-4.5" aria-hidden="true" />
          </div>
          <h5 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white/90">
            {t("empty")}
          </h5>
          <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-gray-500 dark:text-gray-400">
            {t("emptyDescription")}
          </p>
          <div className="mt-4 flex justify-center">
            <Button
              type="button"
              size="sm"
              variant="outline"
              startIcon={
                <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
              }
              onClick={handleOpenNewNote}
            >
              {t("addFirstNote")}
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
