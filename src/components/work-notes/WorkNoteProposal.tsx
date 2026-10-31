"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import type { AgentSuggestion } from "@/lib/queries/work-notes/work-note-agent.api";
import { reconcileTextareaEdit } from "./textarea-source";
type Action =
  "replace_body" | "replace_selection" | "insert_after" | "replace_title";
export default function WorkNoteProposal({
  suggestion,
  before,
  stale,
  busy,
  onApply,
  onDismiss,
  onRegenerate,
}: {
  suggestion: AgentSuggestion;
  before: { title: string; contentMarkdown: string };
  stale: boolean;
  busy: boolean;
  onApply: (action: Action, title: boolean, edited: string | null) => void;
  onDismiss: () => void;
  onRegenerate: () => void;
}) {
  const t = useTranslations("workNotes.agent");
  const [edited, setEdited] = useState<string | null>(null),
    [title, setTitle] = useState(false);
  return (
    <section
      aria-label={t("proposal")}
      className="space-y-3 rounded-lg border border-brand-200 p-4 dark:border-brand-500/30"
    >
      <h3 className="font-semibold">
        {t("proposal")} ·{" "}
        {t(suggestion.scope === "selection" ? "selection" : "wholeNote")}
      </h3>
      <ul className="list-inside list-disc text-sm text-gray-600 dark:text-gray-400">
        {suggestion.changeSummary.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <h4 className="mb-1 text-xs text-gray-500 dark:text-gray-400">
            {t("before")}
          </h4>
          <pre className="max-h-64 overflow-auto rounded-md bg-gray-50 p-3 font-sans text-sm break-words whitespace-pre-wrap dark:bg-gray-950">
            {suggestion.operation === "title"
              ? before.title
              : (suggestion.selection?.quote ?? before.contentMarkdown)}
          </pre>
        </div>
        <div>
          <h4 className="mb-1 text-xs text-gray-500 dark:text-gray-400">
            {t("after")}
          </h4>
          {edited === null ? (
            <pre className="max-h-64 overflow-auto rounded-md bg-brand-50 p-3 font-sans text-sm break-words whitespace-pre-wrap dark:bg-brand-500/10">
              {suggestion.replacementText ?? suggestion.suggestedTitle}
            </pre>
          ) : (
            <label className="block text-sm">
              <span>{t("editProposal")}</span>
              <textarea
                rows={6}
                maxLength={30000}
                value={edited}
                onChange={(e) =>
                  setEdited(reconcileTextareaEdit(edited, e.target.value))
                }
                className="w-full rounded-lg border border-gray-200 bg-transparent p-3 dark:border-gray-700"
              />
            </label>
          )}
        </div>
      </div>
      {suggestion.suggestedTitle && suggestion.operation !== "title" && (
        <label className="flex gap-2 text-sm">
          <input
            type="checkbox"
            checked={title}
            onChange={(e) => setTitle(e.target.checked)}
          />
          {t("applyTitle")}: {suggestion.suggestedTitle}
        </label>
      )}
      {stale && (
        <p
          role="status"
          className="text-sm text-warning-600 dark:text-warning-400"
        >
          {t("stale")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={busy || stale || (edited !== null && !edited.trim())}
          onClick={() =>
            onApply(
              suggestion.operation === "title"
                ? "replace_title"
                : suggestion.scope === "selection"
                  ? "replace_selection"
                  : "replace_body",
              suggestion.operation === "title" || title,
              edited,
            )
          }
        >
          {t("apply")}
        </Button>
        {suggestion.scope === "selection" && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy || stale}
            onClick={() => onApply("insert_after", false, edited)}
          >
            {t("insertAfter")}
          </Button>
        )}
        {suggestion.replacementText !== null && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setEdited(suggestion.replacementText)}
          >
            {t("editProposal")}
          </Button>
        )}
        <Button size="sm" variant="outline" disabled={busy} onClick={onDismiss}>
          {t("dismiss")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={busy}
          onClick={onRegenerate}
        >
          {t("regenerate")}
        </Button>
      </div>
    </section>
  );
}
