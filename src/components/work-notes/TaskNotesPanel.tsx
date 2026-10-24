"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { useTaskNotesQuery, useWorkNotesMutation, workNoteKeys, workNotesApi, type TaskNoteInput } from "@/lib/queries/work-notes/useWorkNotes";

const EMPTY_INPUT: TaskNoteInput = {
  title: "",
  accomplishments: "",
  approach: "",
  reason: "",
};

const FIELD_CLASS = "w-full min-w-0 border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder:text-gray-500";

export default function TaskNotesPanel({ projectId, taskId }: { projectId: string; taskId: string }) {
  const t = useTranslations("workNotes.taskNotes");
  const query = useTaskNotesQuery(projectId, taskId);
  const [input, setInput] = useState<TaskNoteInput>(EMPTY_INPUT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState("");
  const create = useWorkNotesMutation(
    workNotesApi.createTaskNote.bind(null, projectId, taskId),
    [workNoteKeys.taskNotes(projectId, taskId), workNoteKeys.project(projectId)],
  );
  const update = useWorkNotesMutation(
    ({ noteId, value }: { noteId: string; value: TaskNoteInput }) => workNotesApi.updateTaskNote(projectId, taskId, noteId, value),
    [workNoteKeys.taskNotes(projectId, taskId), workNoteKeys.project(projectId)],
  );
  const remove = useWorkNotesMutation(
    (noteId: string) => workNotesApi.deleteTaskNote(projectId, taskId, noteId),
    [workNoteKeys.taskNotes(projectId, taskId), workNoteKeys.project(projectId)],
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    create.reset();
    update.reset();
    remove.reset();
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
      if (editingId) await update.mutateAsync({ noteId: editingId, value: cleaned });
      else await create.mutateAsync(cleaned);
      setInput(EMPTY_INPUT);
      setEditingId(null);
    } catch {
      // The mutation state surfaces the server error while preserving the draft.
    }
  }

  return (
    <section aria-labelledby="task-notes-heading" className="space-y-4">
      <div>
        <h4 id="task-notes-heading" className="text-sm font-semibold text-gray-900 dark:text-white/90">{t("title")}</h4>
        <p className="mt-1 text-xs leading-5 text-gray-500 dark:text-gray-400">{t("description")}</p>
      </div>

      {query.isPending ? (
        <div role="status" className="space-y-2" aria-label={t("loading")}>
          <div className="h-12 animate-pulse bg-gray-100 dark:bg-gray-800" />
          <div className="h-12 animate-pulse bg-gray-100 dark:bg-gray-800" />
        </div>
      ) : query.isError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-error-200 bg-error-50 px-3 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300">
          <span>{query.error instanceof Error ? query.error.message : t("loadError")}</span>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>{t("retry")}</Button>
        </div>
      ) : (
        <>
          {query.data?.data.length ? (
            <ul className="space-y-3">
              {query.data.data.map((note) => (
                <li key={note.id} className="min-w-0 border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-800 dark:bg-gray-900">
                  <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                    <h5 className="min-w-0 break-words text-sm font-semibold text-gray-900 dark:text-white/90">{note.title}</h5>
                    <time className="shrink-0 tabular-nums text-xs text-gray-500 dark:text-gray-400" dateTime={note.createdAt}>{new Date(note.createdAt).toLocaleString()}</time>
                  </div>
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("by", { name: note.authorName })}</p>
                  {(note.permissions.canEdit || note.permissions.canDelete) && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {note.permissions.canEdit && <Button size="sm" variant="outline" onClick={() => { create.reset(); update.reset(); remove.reset(); setValidationError(""); setEditingId(note.id); setInput({ title: note.title, accomplishments: note.accomplishments, approach: note.approach, reason: note.reason }); }}>{t("edit")}</Button>}
                      {note.permissions.canDelete && <Button size="sm" variant="outline" disabled={remove.isPending} onClick={() => {
                        if (window.confirm(t("deleteConfirm"))) {
                          create.reset();
                          update.reset();
                          remove.reset();
                          setValidationError("");
                          remove.mutate(note.id, {
                            onSuccess: () => {
                              if (editingId === note.id) {
                                setEditingId(null);
                                setInput(EMPTY_INPUT);
                                setValidationError("");
                              }
                            },
                          });
                        }
                      }}>{t("delete")}</Button>}
                    </div>
                  )}
                  <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="min-w-0"><dt className="text-xs font-semibold text-gray-600 dark:text-gray-300">{t("accomplishments")}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-gray-700 dark:text-gray-300">{note.accomplishments}</dd></div>
                    <div className="min-w-0"><dt className="text-xs font-semibold text-gray-600 dark:text-gray-300">{t("approach")}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-gray-700 dark:text-gray-300">{note.approach}</dd></div>
                    <div className="min-w-0"><dt className="text-xs font-semibold text-gray-600 dark:text-gray-300">{t("reason")}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-gray-700 dark:text-gray-300">{note.reason}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          ) : (
            <p className="border border-dashed border-gray-300 px-4 py-6 text-center text-sm text-gray-500 dark:border-gray-700 dark:text-gray-400">{t("empty")}</p>
          )}

          <form onSubmit={submit} className="space-y-3 border-t border-gray-100 pt-4 dark:border-gray-800">
            <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200">{t(editingId ? "editTitle" : "addTitle")}</h5>
            <label className="grid gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
              {t("noteTitle")}
              <input required maxLength={160} value={input.title} onChange={(event) => setInput((current) => ({ ...current, title: event.target.value }))} className={FIELD_CLASS} />
            </label>
            <div className="grid gap-3 md:grid-cols-3">
              {(["accomplishments", "approach", "reason"] as const).map((field) => (
                <label key={field} className="grid min-w-0 gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-300">
                  {t(field)}
                  <textarea required maxLength={field === "reason" ? 5000 : 10000} rows={3} value={input[field]} onChange={(event) => setInput((current) => ({ ...current, [field]: event.target.value }))} className={`${FIELD_CLASS} min-h-24 resize-y`} />
                </label>
              ))}
            </div>
            {validationError && <p role="alert" className="text-xs text-error-600 dark:text-error-400">{validationError}</p>}
            {(create.isError || update.isError || remove.isError) && <p role="alert" className="text-xs text-error-600 dark:text-error-400">{(create.error ?? update.error ?? remove.error) instanceof Error ? (create.error ?? update.error ?? remove.error)?.message : t("saveError")}</p>}
            {!validationError && !(create.isError || update.isError || remove.isError) && (create.isSuccess || update.isSuccess || remove.isSuccess) && <p role="status" className="text-xs text-success-700 dark:text-success-400">{t("saved")}</p>}
            <div className="flex justify-end">
              {editingId && <Button type="button" variant="outline" size="sm" onClick={() => { setEditingId(null); setInput(EMPTY_INPUT); }}>{t("cancel")}</Button>}
              <Button type="submit" size="sm" isLoading={create.isPending || update.isPending}>{t("save")}</Button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}
