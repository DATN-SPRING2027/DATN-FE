"use client";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import { CloseIcon, DocsIcon } from "@/icons";
import type {
  AgentOperation,
  AgentResponse,
  SelectionAnchor,
  EditorSourceIdentity,
} from "@/lib/queries/work-notes/work-note-agent.api";
import { useWorkNoteComposer } from "./useWorkNoteComposer";
import WorkNoteProposal from "./WorkNoteProposal";
import WorkNoteAgentChat from "./WorkNoteAgentChat";
import WorkNoteHistory from "./WorkNoteHistory";
import WorkNoteContext from "./WorkNoteContext";
import { sourceSelection, reconcileTextareaEdit } from "./textarea-source";

export default function WorkNoteComposer({
  projectId,
  taskId = "",
  noteId,
  onClose,
  onSaved,
  source,
}: {
  projectId: string;
  taskId?: string;
  noteId?: string;
  onClose: () => void;
  onSaved: (result?: unknown) => void;
  source?: EditorSourceIdentity;
}) {
  const t = useTranslations("workNotes.agent");
  const editor = useWorkNoteComposer(
    projectId,
    taskId,
    noteId,
    onSaved,
    source,
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false),
    [instruction, setInstruction] = useState(""),
    [selection, setSelection] = useState<SelectionAnchor | null>(null),
    [fullContext, setFullContext] = useState(false),
    [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<"save" | "discard" | null>(
    null,
  );
  const section = useRef<HTMLElement>(null),
    body = useRef<HTMLTextAreaElement>(null),
    chatInput = useRef<HTMLTextAreaElement>(null),
    closeButton = useRef<HTMLButtonElement>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const confirmPanel = useRef<HTMLDivElement>(null);
  const retryAction = useRef<(() => Promise<unknown>) | null>(null);
  useEffect(() => {
    if (!confirmation) return;
    const composerSection = section.current;
    confirmPanel.current?.querySelector("button")?.focus();
    return () =>
      composerSection
        ?.querySelector<HTMLElement>("footer button:last-child")
        ?.focus();
  }, [confirmation]);
  const d = editor.draft,
    fields = editor.fields,
    suggestion = d?.suggestion ?? editor.response?.suggestion;
  useEffect(() => {
    if (!editor.error) retryAction.current = null;
  }, [editor.error]);
  const showSuggestion = suggestion && dismissed !== suggestion.id;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    return () => previous?.focus();
  }, []);
  async function run(action: () => Promise<unknown>) {
    retryAction.current = null;
    setBusy(true);
    try {
      await action();
    } catch (e) {
      retryAction.current = action;
      editor.setError(e instanceof Error ? e.message : t("requestFailed"));
    } finally {
      setBusy(false);
    }
  }
  async function close() {
    if (editor.draft) await editor.persist();
    onClose();
  }
  function trap(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== "Tab") return;
    const items = (
      confirmation ? confirmPanel.current : section.current
    )?.querySelectorAll<HTMLElement>(
      'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex="0"]',
    );
    if (!items?.length) return;
    const first = items[0],
      last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  function chooseSelection() {
    const element = body.current;
    if (!element) return;
    const { selectionStart: start, selectionEnd: end } = element;
    setSelection(
      fields ? sourceSelection(fields.contentMarkdown, start, end) : null,
    );
  }
  async function requestAgent(
    action: () => Promise<AgentResponse | undefined>,
  ) {
    retryAction.current = null;
    const result = await action();
    if (result) {
      setInstruction("");
      setDismissed(null);
      if (result.status === "CLARIFICATION_REQUIRED") {
        setChatOpen(true);
        setTimeout(() => chatInput.current?.focus(), 0);
      }
    } else {
      retryAction.current = () => requestAgent(action);
    }
  }
  async function send(
    operation: AgentOperation,
    custom?: string,
    disposition?: "answered" | "skipped",
  ) {
    const question = d?.pendingQuestion;
    return requestAgent(() =>
      editor.send({
        operation,
        scope: selection ? "selection" : "whole_note",
        instruction:
          disposition === "skipped" ? t("skip") : (custom ?? instruction),
        includeWholeNoteContext: fullContext,
        ...(selection ? { selection } : {}),
        ...(question && disposition
          ? {
              replyToQuestionId: question.id,
              questionDisposition: disposition,
              ...(disposition === "answered"
                ? { answer: custom ?? instruction }
                : {}),
            }
          : {}),
      }),
    );
  }
  const quick: readonly [AgentOperation, string][] = [
    ["grammar", "grammar"],
    ["clarify", "clarify"],
    ["shorten", "shorten"],
    ["restructure", "restructure"],
    ["tone", "tone"],
    ["handover", "handover"],
  ];
  return (
    <Modal
      isOpen
      isFullscreen
      showCloseButton={false}
      onClose={() => (confirmation ? setConfirmation(null) : void run(close))}
    >
      <section
        ref={section}
        role="dialog"
        aria-modal="true"
        aria-labelledby="agent-composer-title"
        onKeyDown={trap}
        className="mx-auto flex h-dvh w-full max-w-6xl flex-col overflow-hidden bg-white text-gray-900 sm:my-[5dvh] sm:h-[90dvh] sm:rounded-xl sm:border sm:border-gray-200 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100"
      >
        <div className="contents" inert={!!confirmation}>
          <header className="flex shrink-0 items-center gap-3 border-b border-gray-200 px-4 py-3 sm:px-6 dark:border-gray-800">
            <DocsIcon
              className="size-5 shrink-0 text-brand-500"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <h2 id="agent-composer-title" className="text-lg font-semibold">
                {t(
                  source
                    ? source.workflow === "PROJECT_DOCUMENT"
                      ? "documentEditorTitle"
                      : "reportEditorTitle"
                    : noteId
                      ? "editTitle"
                      : "title",
                )}
              </h2>
              <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                {source
                  ? t(
                      source.workflow === "PROJECT_DOCUMENT"
                        ? "documentContext"
                        : "reportContext",
                    )
                  : t("context", { task: taskId.slice(-6) })}
              </p>
            </div>
            <button
              type="button"
              aria-expanded={chatOpen}
              aria-controls="worknote-agent-chat"
              onClick={() => setChatOpen((v) => !v)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-brand-600 dark:border-gray-700 dark:text-brand-300"
            >
              {t("agent")}
            </button>
            <button
              ref={closeButton}
              type="button"
              aria-label={t("close")}
              onClick={() => void run(close)}
              disabled={busy}
              className="rounded p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              <CloseIcon className="size-5 fill-current" />
            </button>
          </header>
          <div
            role="status"
            aria-live="polite"
            className="shrink-0 border-b border-gray-100 px-4 py-2 text-xs text-gray-500 sm:px-6 dark:border-gray-800 dark:text-gray-400"
          >
            {editor.query.isPending
              ? t("loading")
              : editor.query.isError
                ? t("loadFailed")
                : editor.saving
                  ? t("saving")
                  : editor.dirty
                    ? t("unsaved")
                    : t("savedDraft")}{" "}
            {t("retention")} {editor.agentBusy && <span>{t("thinking")}</span>}
          </div>
          {(editor.error || editor.query.isError) && (
            <div
              role="alert"
              className="mx-4 mt-3 flex items-center justify-between gap-2 rounded-lg bg-error-50 p-3 text-sm text-error-700 dark:bg-error-500/10 dark:text-error-300"
            >
              <span>
                {editor.error ||
                  (editor.query.error instanceof Error
                    ? editor.query.error.message
                    : t("loadFailed"))}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={busy || editor.agentBusy || editor.saving}
                onClick={() => {
                  const retry = retryAction.current;
                  void run(
                    retry ??
                      (async () => {
                        if (d) {
                          await editor.persist();
                          editor.setError("");
                        } else await editor.query.refetch();
                      }),
                  );
                }}
              >
                {t("retry")}
              </Button>
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {fields && (
              <div className="mx-auto max-w-4xl space-y-4">
                {!source && (
                  <WorkNoteContext
                    projectId={projectId}
                    taskId={taskId}
                    selection={selection}
                    fullContext={fullContext}
                  />
                )}
                {source && (
                  <p className="border-b border-gray-100 pb-3 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                    {t(
                      source.workflow === "PROJECT_DOCUMENT"
                        ? "documentContext"
                        : "reportContext",
                    )}
                    {source.workflow === "WORK_REPORT" &&
                    typeof d?.context?.periodStart === "string" &&
                    typeof d.context.periodEnd === "string"
                      ? ` ${d.context.periodStart.slice(0, 10)} – ${d.context.periodEnd.slice(0, 10)}`
                      : ""}
                  </p>
                )}
                <label className="block space-y-2 text-sm font-medium">
                  <span>{t("noteTitle")}</span>
                  <input
                    value={fields.title}
                    maxLength={
                      source?.workflow === "PROJECT_DOCUMENT" ? 240 : 300
                    }
                    disabled={!!confirmation || busy}
                    onChange={(e) =>
                      editor.change({ ...fields, title: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-200 bg-transparent p-3 text-xl font-semibold outline-none focus:border-brand-500 dark:border-gray-700"
                  />
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!editor.canUndo || !!confirmation}
                    onClick={() => editor.undo()}
                  >
                    {t("undo")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!editor.canRedo || !!confirmation}
                    onClick={() => editor.undo(true)}
                  >
                    {t("redo")}
                  </Button>
                  {quick.map(([operation, key]) => (
                    <button
                      key={operation}
                      type="button"
                      disabled={
                        editor.agentBusy ||
                        busy ||
                        !!confirmation ||
                        !fields.contentMarkdown.trim()
                      }
                      onClick={() => void send(operation, t(`prompts.${key}`))}
                      className="rounded-md border border-gray-200 px-2 py-1.5 text-xs disabled:opacity-40 dark:border-gray-700"
                    >
                      {t(`quick.${key}`)}
                    </button>
                  ))}
                </div>
                <label className="block space-y-2 text-sm font-medium">
                  <span>{t("content")}</span>
                  <textarea
                    ref={body}
                    value={fields.contentMarkdown}
                    maxLength={30000}
                    disabled={!!confirmation || busy}
                    rows={12}
                    onChange={(e) => {
                      editor.change({
                        ...fields,
                        contentMarkdown: reconcileTextareaEdit(
                          fields.contentMarkdown,
                          e.target.value,
                        ),
                      });
                      setSelection(null);
                    }}
                    onSelect={chooseSelection}
                    onKeyDown={(e) => {
                      if (
                        (e.ctrlKey || e.metaKey) &&
                        e.shiftKey &&
                        e.key.toLowerCase() === "a"
                      ) {
                        e.preventDefault();
                        chooseSelection();
                        setChatOpen(true);
                        setTimeout(() => chatInput.current?.focus(), 0);
                      }
                    }}
                    className="min-h-72 w-full resize-y rounded-lg border border-gray-200 bg-transparent p-4 leading-7 outline-none focus:border-brand-500 dark:border-gray-700"
                  />
                </label>
                {selection && (
                  <div className="flex flex-wrap items-center gap-2 rounded-lg bg-brand-50 p-3 text-sm text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                    <span className="min-w-0 flex-1 truncate">
                      {t("selection")}: {selection.quote}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setChatOpen(true);
                        chatInput.current?.focus();
                      }}
                    >
                      {t("askSelection")}
                    </Button>
                    <button type="button" onClick={() => setSelection(null)}>
                      {t("wholeNote")}
                    </button>
                  </div>
                )}
                {showSuggestion && (
                  <WorkNoteProposal
                    key={suggestion.id}
                    suggestion={suggestion}
                    before={fields}
                    stale={
                      editor.dirty || suggestion.baseRevision !== d?.revision
                    }
                    busy={busy || !!confirmation || editor.agentBusy}
                    onApply={(action, title, edited) =>
                      void run(async () => {
                        const next = await editor.apply(
                          suggestion,
                          action,
                          title,
                        );
                        if (edited !== null) {
                          const anchor = suggestion.selection;
                          const contentMarkdown = anchor
                            ? action === "insert_after"
                              ? fields.contentMarkdown.slice(0, anchor.end) +
                                edited +
                                fields.contentMarkdown.slice(anchor.end)
                              : fields.contentMarkdown.slice(0, anchor.start) +
                                edited +
                                fields.contentMarkdown.slice(anchor.end)
                            : edited;
                          editor.change(
                            { title: next.title, contentMarkdown },
                            false,
                          );
                        }
                      })
                    }
                    onDismiss={() => {
                      setDismissed(suggestion.id);
                      editor.setResponse(null);
                    }}
                    onRegenerate={() => void requestAgent(editor.regenerate)}
                  />
                )}
                {historyOpen && d?.noteId && (
                  <WorkNoteHistory
                    api={editor.historyApi}
                    workflow={d.workflow}
                    projectId={projectId}
                    taskId={taskId}
                    noteId={d.noteId}
                    disabled={
                      busy ||
                      editor.dirty ||
                      d.hasAppliedRewrite ||
                      d.baseNoteVersion < 1
                    }
                    onRestore={(version) =>
                      void run(() => editor.restore(version))
                    }
                  />
                )}
                {!!editor.response?.uncertainties.length && (
                  <ul className="text-sm text-warning-700 dark:text-warning-300">
                    {editor.response.uncertainties.map((u, i) => (
                      <li key={i}>{u}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
          {chatOpen && (
            <WorkNoteAgentChat
              draft={d}
              selection={!!selection}
              busy={busy || !!confirmation}
              thinking={editor.agentBusy}
              message={instruction}
              onMessage={setInstruction}
              fullContext={fullContext}
              onFullContext={setFullContext}
              onSend={(text, disposition) =>
                void send("custom", text, disposition)
              }
              onReset={() => void run(editor.reset)}
              inputRef={chatInput}
            />
          )}
          <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-gray-200 px-4 py-3 sm:px-6 dark:border-gray-800">
            {d?.noteId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setHistoryOpen((v) => !v)}
              >
                {t("history")}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              disabled={!d || busy || editor.saving}
              onClick={() => setConfirmation("discard")}
            >
              {t("discard")}
            </Button>
            <span className="min-w-0 flex-1 text-xs text-gray-500 dark:text-gray-400">
              {t("saveHint")}
            </span>
            <Button
              size="sm"
              disabled={
                !fields?.title.trim() ||
                !fields.contentMarkdown.trim() ||
                editor.saving ||
                busy ||
                !!confirmation
              }
              onClick={() =>
                d?.hasAppliedRewrite
                  ? setConfirmation("save")
                  : void run(() => editor.save(false))
              }
            >
              {t(source?'saveDraft':"save")}
            </Button>
          </footer>
        </div>
        {confirmation && (
          <div
            ref={confirmPanel}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="agent-confirm-title"
            className="absolute inset-0 z-10 flex items-center justify-center bg-gray-950/50 p-4"
          >
            <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 dark:bg-gray-900">
              <h3 id="agent-confirm-title" className="text-lg font-semibold">
                {t(
                  confirmation === "save"
                    ? "confirmOriginal"
                    : "confirmDiscard",
                )}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t(
                  confirmation === "save"
                    ? "confirmOriginalBody"
                    : "confirmDiscardBody",
                )}
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmation(null)}
                >
                  {t("keepEditing")}
                </Button>
                <Button
                  size="sm"
                  disabled={busy || editor.saving}
                  onClick={() =>
                    void run(async () => {
                      if (confirmation === "save") await editor.save(true);
                      else {
                        await editor.discard();
                        onClose();
                      }
                      setConfirmation(null);
                    })
                  }
                >
                  {t(confirmation === "save" ? "confirmSave" : "discard")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
    </Modal>
  );
}
