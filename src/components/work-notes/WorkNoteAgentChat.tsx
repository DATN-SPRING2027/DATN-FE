"use client";
import type { RefObject } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import type { AgentDraft } from "@/lib/queries/work-notes/work-note-agent.api";
export default function WorkNoteAgentChat({
  draft,
  selection,
  busy,
  thinking,
  message,
  onMessage,
  fullContext,
  onFullContext,
  onSend,
  onReset,
  inputRef,
}: {
  draft: AgentDraft | undefined;
  selection: boolean;
  busy: boolean;
  thinking: boolean;
  message: string;
  onMessage: (v: string) => void;
  fullContext: boolean;
  onFullContext: (v: boolean) => void;
  onSend: (text?: string, disposition?: "answered" | "skipped") => void;
  onReset: () => void;
  inputRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const t = useTranslations("workNotes.agent");
  const question = draft?.pendingQuestion;
  return (
    <section
      id="worknote-agent-chat"
      aria-label={t("chat")}
      className="flex max-h-96 shrink-0 flex-col border-t border-gray-200 bg-gray-50 px-4 py-3 sm:px-6 dark:border-gray-800 dark:bg-gray-950"
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{t("chat")}</h3>
        <button
          type="button"
          disabled={busy || thinking}
          onClick={onReset}
          className="text-xs text-gray-500 dark:text-gray-400"
        >
          {t("resetChat")}
        </button>
      </div>
      <p className="py-1 text-xs text-gray-500 dark:text-gray-400">
        {t(
          draft?.workflow === "PROJECT_DOCUMENT"
            ? "documentContext"
            : draft?.workflow === "WORK_REPORT"
              ? "reportContext"
              : selection
                ? "selectionContext"
                : "taskContext",
        )}
      </p>
      <div
        role="log"
        aria-live="polite"
        className="min-h-0 space-y-2 overflow-y-auto py-2 text-sm"
      >
        {draft?.conversation.map((entry, i) => (
          <p key={i} className="break-words whitespace-pre-wrap">
            <strong>{t(entry.role === "user" ? "you" : "agent")}: </strong>
            {entry.content}
          </p>
        ))}
        {thinking && <p role="status">{t("thinking")}</p>}
        {question && (
          <div className="space-y-2">
            <p className="font-medium">{question.text}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {question.reason}
            </p>
            <div className="flex flex-wrap gap-2">
              {question.options.map((option) => (
                <button
                  key={option}
                  type="button"
                  disabled={thinking || busy}
                  onClick={() => onSend(option, "answered")}
                  className="rounded border border-gray-200 px-2 py-1 dark:border-gray-700"
                >
                  {option}
                </button>
              ))}
              <Button
                size="sm"
                variant="outline"
                disabled={thinking || busy}
                onClick={() => onSend(t("skip"), "skipped")}
              >
                {t("skip")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={thinking || busy}
                onClick={() => onSend(t("unknown"), "answered")}
              >
                {t("unknown")}
              </Button>
            </div>
          </div>
        )}
      </div>
      {selection && (
        <label className="flex gap-2 text-xs">
          <input
            type="checkbox"
            checked={fullContext}
            onChange={(e) => onFullContext(e.target.checked)}
          />
          {t("fullContext")}
        </label>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend(undefined, question ? "answered" : undefined);
        }}
        className="mt-2 flex gap-2"
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">{t("instruction")}</span>
          <textarea
            ref={inputRef}
            rows={2}
            value={message}
            maxLength={2000}
            onChange={(e) => onMessage(e.target.value)}
            className="w-full rounded-lg border border-gray-200 bg-white p-2 text-sm dark:border-gray-700 dark:bg-gray-900"
          />
        </label>
        <Button
          type="submit"
          size="sm"
          disabled={!message.trim() || thinking || busy}
        >
          {t("send")}
        </Button>
      </form>
    </section>
  );
}
