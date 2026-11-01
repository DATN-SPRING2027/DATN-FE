"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import { CloseLineIcon } from "@/icons";
import type { AiChatMessage } from "@/lib/queries/ai-chat/ai-chat.types";
import { useProjectTasksQuery } from "@/lib/queries/tasks/useTasks";
import type { TaskNoteAiChatSourceInput } from "@/lib/queries/work-notes/useWorkNotes";
import { isContinuumDocumentId } from "./citation-utils";
import WorkNoteComposer from "../work-notes/WorkNoteComposer";

const FIELD_CLASS =
  "w-full min-w-0 rounded-xl border border-gray-300 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-brand-500 focus:ring-3 focus:ring-brand-500/15 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100 dark:placeholder:text-gray-500";

function makeSource(
  threadId: string,
  message: AiChatMessage,
): TaskNoteAiChatSourceInput {
  return {
    threadId,
    messageId: message.id,
    citations: message.citations.map((citation) => ({
      number: citation.number,
      sourceLabel:
        citation.documentName?.trim() ||
        citation.sourceName?.trim() ||
        citation.label?.trim() ||
        `Source ${citation.number}`,
      ...(citation.mapped !== false &&
      isContinuumDocumentId(citation.documentId)
        ? { documentId: citation.documentId }
        : {}),
      ...(Number.isSafeInteger(citation.versionNo) && citation.versionNo! > 0
        ? { versionNo: citation.versionNo }
        : {}),
      ...(citation.chunkId ? { chunkId: citation.chunkId } : {}),
      ...(citation.heading ? { heading: citation.heading } : {}),
      ...(citation.sectionPath ? { sectionPath: citation.sectionPath } : {}),
      ...(Number.isSafeInteger(citation.pageFrom) && citation.pageFrom! > 0
        ? { pageFrom: citation.pageFrom }
        : {}),
      ...(Number.isSafeInteger(citation.pageTo) && citation.pageTo! > 0
        ? { pageTo: citation.pageTo }
        : {}),
    })),
    sessionCitations: message.sessionCitations.map((citation) => ({
      ref: citation.ref,
      ...(citation.groupId ? { groupId: citation.groupId } : {}),
      turnIds: [...citation.turnIds],
    })),
  };
}

function initialTitle(questionText: string, fallback: string): string {
  const normalized = questionText.replace(/\s+/g, " ").trim();
  const candidate = normalized || fallback;
  return candidate.length > 100
    ? `${candidate.slice(0, 99).trimEnd()}…`
    : candidate;
}

export default function AiChatSaveTaskNoteDialog({
  projectId,
  threadId,
  message,
  questionText,
  onClose,
  onSaved,
}: {
  projectId: string;
  threadId: string;
  message: AiChatMessage;
  questionText: string;
  onClose: () => void;
  onSaved: (result?: unknown) => void;
}) {
  const t = useTranslations("AiChat");
  const tasksQuery = useProjectTasksQuery(projectId);
  const tasks = tasksQuery.data?.items ?? [];
  const [taskId, setTaskId] = useState("");
  const [title, setTitle] = useState(() =>
    initialTitle(questionText, t("taskNoteDefaultTitle")),
  );
  const [contentMarkdown, setContentMarkdown] = useState(message.content);
  const [editing, setEditing] = useState(false);
  const dialogRef = useRef<HTMLElement | null>(null);
  const source = useMemo(
    () => makeSource(threadId, message),
    [threadId, message],
  );
  const selectedTask = tasks.find((task) => task.id === taskId);
  const canContinue = Boolean(
    selectedTask && title.trim() && contentMarkdown.trim(),
  );

  useEffect(() => {
    const previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    dialogRef.current
      ?.querySelector<HTMLElement>(
        "button:not([disabled]), select:not([disabled]), input:not([disabled]), textarea:not([disabled])",
      )
      ?.focus();
    return () => {
      const fallback = Array.from(
        document.querySelectorAll<HTMLElement>(
          'button[data-testid^="ai-chat-more-actions-"]',
        ),
      ).find(
        (button) =>
          button.dataset.testid === `ai-chat-more-actions-${message.id}`,
      );
      (previousFocus?.isConnected ? previousFocus : fallback)?.focus();
    };
  }, [message.id]);

  function trapDialogFocus(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    ).filter((element) => !element.closest("[inert]"));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      showCloseButton={false}
      className="flex h-[min(92dvh,56rem)] w-full max-w-5xl flex-col overflow-hidden border border-gray-200 shadow-2xl dark:border-gray-800"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="ai-chat-save-task-note-title"
        ref={dialogRef}
        onKeyDown={trapDialogFocus}
        className="absolute inset-0 flex min-h-0 flex-col"
      >
        <header className="flex shrink-0 items-start gap-3 border-b border-gray-200 px-4 py-3.5 sm:px-6 dark:border-gray-800">
          <div className="min-w-0 flex-1">
            <h2
              id="ai-chat-save-task-note-title"
              className="text-base font-semibold text-gray-900 dark:text-gray-100"
            >
              {t("taskNoteDialogTitle")}
            </h2>
            <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-400">
              {t("taskNoteDialogDescription")}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("taskNoteClose")}
            onClick={onClose}
            className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
          >
            <CloseLineIcon aria-hidden="true" className="size-4" />
          </button>
        </header>

        {editing && selectedTask ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2.5 text-xs text-gray-600 sm:px-6 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
              <span className="font-semibold text-gray-800 dark:text-gray-100">
                {t("taskNoteTargetLabel")}
              </span>
              <span className="min-w-0 truncate">
                <span className="font-semibold tabular-nums">
                  {selectedTask.key}
                </span>
                <span aria-hidden="true"> · </span>
                {selectedTask.title}
              </span>
            </div>
            <WorkNoteComposer
              key={`${message.id}:${taskId}`}
              projectId={projectId}
              taskId={taskId}
              onClose={(persisted) => {
                if (persisted) {
                  setTitle(persisted.title);
                  setContentMarkdown(persisted.contentMarkdown);
                }
                setEditing(false);
              }}
              onSaved={onSaved}
              initialFields={{ title, contentMarkdown }}
              aiChatSource={source}
              startFreshDraft
              variant="inline"
            />
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className="grid min-h-0 gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)]">
                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="ai-chat-task-note-task"
                      className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300"
                    >
                      {t("taskNoteTaskLabel")}
                    </label>
                    <select
                      id="ai-chat-task-note-task"
                      value={taskId}
                      onChange={(event) => setTaskId(event.target.value)}
                      disabled={
                        tasksQuery.isPending ||
                        tasksQuery.isError ||
                        tasks.length === 0
                      }
                      className={FIELD_CLASS}
                    >
                      <option value="">{t("taskNoteChooseTask")}</option>
                      {tasks.map((task) => (
                        <option key={task.id} value={task.id}>
                          {task.key} · {task.title}
                        </option>
                      ))}
                    </select>
                    {tasksQuery.isPending && (
                      <p
                        role="status"
                        className="mt-2 text-xs text-gray-500 dark:text-gray-400"
                      >
                        {t("taskNoteLoadingTasks")}
                      </p>
                    )}
                    {tasksQuery.isError && (
                      <div
                        role="alert"
                        className="mt-2 space-y-2 text-xs text-error-700 dark:text-error-300"
                      >
                        <p>{t("taskNoteTasksError")}</p>
                        <button
                          type="button"
                          onClick={() => void tasksQuery.refetch()}
                          className="rounded-md font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
                        >
                          {t("retryAction")}
                        </button>
                      </div>
                    )}
                    {!tasksQuery.isPending &&
                      !tasksQuery.isError &&
                      tasks.length === 0 && (
                        <p
                          role="status"
                          className="mt-2 text-xs text-gray-500 dark:text-gray-400"
                        >
                          {t("taskNoteNoTasks")}
                        </p>
                      )}
                  </div>

                  <div>
                    <label
                      htmlFor="ai-chat-task-note-title"
                      className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300"
                    >
                      {t("taskNoteTitleLabel")}
                    </label>
                    <input
                      id="ai-chat-task-note-title"
                      value={title}
                      maxLength={300}
                      onChange={(event) => setTitle(event.target.value)}
                      className={FIELD_CLASS}
                    />
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-3.5 dark:border-gray-800 dark:bg-gray-950/60">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                      {t("taskNoteSourcesHeading")}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-gray-600 dark:text-gray-400">
                      {t("taskNoteSourcesSummary", {
                        documents: source.citations.length,
                        conversations: source.sessionCitations.length,
                      })}
                    </p>
                  </div>
                </div>

                <div className="flex min-h-72 min-w-0 flex-col">
                  <label
                    htmlFor="ai-chat-task-note-content"
                    className="mb-1.5 block text-xs font-semibold text-gray-700 dark:text-gray-300"
                  >
                    {t("taskNoteAnswerPreviewLabel")}
                  </label>
                  <textarea
                    id="ai-chat-task-note-content"
                    value={contentMarkdown}
                    maxLength={30000}
                    onChange={(event) => setContentMarkdown(event.target.value)}
                    className={`${FIELD_CLASS} min-h-72 flex-1 resize-y font-sans leading-6`}
                  />
                </div>
              </div>
            </div>

            <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-gray-200 bg-white px-4 py-3 sm:px-6 dark:border-gray-800 dark:bg-gray-900">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {t("taskNoteReviewHint")}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg px-3.5 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-white/10"
                >
                  {t("taskNoteCancel")}
                </button>
                <button
                  type="button"
                  disabled={!canContinue || tasksQuery.isPending}
                  onClick={() => setEditing(true)}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {t("taskNoteContinue")}
                </button>
              </div>
            </footer>
          </div>
        )}
      </section>
    </Modal>
  );
}
