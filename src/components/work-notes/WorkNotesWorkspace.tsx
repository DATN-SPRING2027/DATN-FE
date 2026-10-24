"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { ApiError } from "@/lib/api-client";
import WorkNotesPageHeader from "./WorkNotesPageHeader";
import {
  isWorkNoteId,
  useProjectTaskNoteQuery,
  useProjectTaskNotesQuery,
} from "@/lib/queries/work-notes/useWorkNotes";

export default function WorkNotesWorkspace({
  projectId,
}: {
  projectId: string;
}) {
  const t = useTranslations("workNotes");
  const [page, setPage] = useState(1);
  const deepLinkNoteId = useSearchParams().get("noteId");
  const query = useProjectTaskNotesQuery(projectId, page);
  const deepLinkQuery = useProjectTaskNoteQuery(
    projectId,
    deepLinkNoteId ?? "",
  );
  const invalidDeepLink = Boolean(
    deepLinkNoteId &&
    (!isWorkNoteId(projectId) || !isWorkNoteId(deepLinkNoteId)),
  );
  const unavailableDeepLink = Boolean(
    deepLinkNoteId &&
    (invalidDeepLink ||
      (deepLinkQuery.error instanceof ApiError &&
        [403, 404].includes(deepLinkQuery.error.status))),
  );
  const [search, setSearch] = useState("");
  const notes = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    return (query.data?.data ?? []).filter(
      (note) =>
        !needle ||
        [
          note.title,
          note.authorName,
          note.accomplishments,
          note.approach,
          note.reason,
          note.taskId,
        ].some((value) => value.toLocaleLowerCase().includes(needle)),
    );
  }, [query.data?.data, search]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <WorkNotesPageHeader projectId={projectId} active="tasks" />
      {unavailableDeepLink && (
        <div
          role="status"
          data-testid="work-note-unavailable-banner"
          className="mb-4 border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200"
        >
          {t("contentUnavailable")}
        </div>
      )}
      {deepLinkNoteId &&
        !unavailableDeepLink &&
        isWorkNoteId(projectId) &&
        isWorkNoteId(deepLinkNoteId) &&
        deepLinkQuery.isPending && (
          <div
            role="status"
            className="mb-4 text-sm text-gray-500 dark:text-gray-400"
          >
            {t("loading")}
          </div>
        )}
      {deepLinkNoteId && !unavailableDeepLink && deepLinkQuery.isError && (
        <div
          role="alert"
          className="mb-4 flex flex-wrap items-center justify-between gap-3 border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
        >
          <span>
            {deepLinkQuery.error instanceof Error
              ? deepLinkQuery.error.message
              : t("taskNotes.loadError")}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void deepLinkQuery.refetch()}
          >
            {t("retry")}
          </Button>
        </div>
      )}
      {deepLinkQuery.data && (
        <article
          className="mb-5 border border-brand-200 bg-brand-50/60 p-4 sm:p-5 dark:border-brand-500/30 dark:bg-brand-500/5"
          aria-labelledby="deep-linked-task-note-title"
        >
          <h2
            id="deep-linked-task-note-title"
            className="text-base font-semibold text-gray-900 dark:text-white/90"
          >
            {deepLinkQuery.data.title}
          </h2>
          <p className="mt-1 text-xs break-all text-gray-500 dark:text-gray-400">
            {t("taskNotes.taskId", { id: deepLinkQuery.data.taskId })}
          </p>
          <dl className="mt-4 grid gap-4 md:grid-cols-3">
            {(["accomplishments", "approach", "reason"] as const).map(
              (field) => (
                <div key={field} className="min-w-0">
                  <dt className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {t(`taskNotes.${field}`)}
                  </dt>
                  <dd className="mt-1 text-sm leading-6 break-words whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                    {deepLinkQuery.data[field]}
                  </dd>
                </div>
              ),
            )}
          </dl>
        </article>
      )}
      <section className="space-y-4" aria-labelledby="project-task-notes-title">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2
              id="project-task-notes-title"
              className="text-base font-semibold text-gray-900 dark:text-white/90"
            >
              {t("taskNotes.listTitle")}
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              {t("taskNotes.listDescription")}
            </p>
          </div>
          <label className="grid w-full gap-1.5 text-xs font-medium text-gray-700 sm:max-w-xs dark:text-gray-300">
            {t("searchLabel")}
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-10 w-full border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder:text-gray-500"
            />
          </label>
        </div>

        {query.isPending ? (
          <div role="status" className="space-y-3" aria-label={t("loading")}>
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-32 animate-pulse border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
              />
            ))}
          </div>
        ) : query.isError ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 border border-error-200 bg-error-50 px-4 py-4 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
          >
            <span>
              {query.error instanceof Error
                ? query.error.message
                : t("taskNotes.loadError")}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void query.refetch()}
            >
              {t("retry")}
            </Button>
          </div>
        ) : notes.length === 0 ? (
          <div className="border border-dashed border-gray-300 bg-white px-5 py-12 text-center dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
              {search ? t("noSearchResults") : t("taskNotes.emptyProject")}
            </h3>
            <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-gray-500 dark:text-gray-400">
              {search ? t("adjustSearch") : t("taskNotes.openTaskHint")}
            </p>
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {notes.map((note) => (
                <li
                  key={note.id}
                  className="min-w-0 border border-gray-200 bg-white p-4 shadow-theme-xs sm:p-5 dark:border-gray-800 dark:bg-gray-900"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-semibold break-words text-gray-900 dark:text-white/90">
                        {note.title}
                      </h3>
                      <p className="mt-1 text-xs break-all text-gray-500 dark:text-gray-400">
                        {t("taskNotes.taskId", { id: note.taskId })}
                      </p>
                    </div>
                    <time
                      dateTime={note.createdAt}
                      className="shrink-0 text-xs text-gray-500 tabular-nums dark:text-gray-400"
                    >
                      {new Date(note.createdAt).toLocaleString()}
                    </time>
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    {t("taskNotes.by", { name: note.authorName })}
                  </p>
                  <dl className="mt-4 grid gap-4 md:grid-cols-3">
                    {(["accomplishments", "approach", "reason"] as const).map(
                      (field) => (
                        <div key={field} className="min-w-0">
                          <dt className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                            {t(`taskNotes.${field}`)}
                          </dt>
                          <dd className="mt-1 text-sm leading-6 break-words whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                            {note[field]}
                          </dd>
                        </div>
                      ),
                    )}
                  </dl>
                </li>
              ))}
            </ul>
            {query.data && query.data.pagination.totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4 text-sm dark:border-gray-800">
                <p className="text-gray-500 tabular-nums dark:text-gray-400">
                  {t("pagination.total", {
                    count: query.data.pagination.totalItems,
                  })}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={query.data.pagination.page <= 1}
                    onClick={() =>
                      setPage((current) => Math.max(1, current - 1))
                    }
                  >
                    {t("pagination.previous")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={
                      query.data.pagination.page >=
                      query.data.pagination.totalPages
                    }
                    onClick={() => setPage((current) => current + 1)}
                  >
                    {t("pagination.next")}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
