"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import {
  BackgroundRefreshError,
  UpdatingStatus,
} from "@/components/ui/loading/AsyncStatus";
import {
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseLineIcon,
  SearchIcon,
  TaskIcon,
} from "@/icons";
import { Link } from "@/i18n/navigation";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import WorkNotesPageHeader from "./WorkNotesPageHeader";
import {
  isWorkNoteId,
  type TaskNote,
  useProjectTaskNoteQuery,
  useProjectTaskNotesQuery,
} from "@/lib/queries/work-notes/useWorkNotes";

type SortOrder = "recent" | "oldest";

function resolveTaskMetadata(
  note: TaskNote,
  fallbackKeyFormatter: (code: string) => string,
  untitledTaskLabel: string,
): { taskKey: string; taskTitle: string } {
  const rawKey = note.taskKey?.trim();
  const rawTitle = note.taskTitle?.trim();
  const fallbackSuffix = note.taskId.slice(-4).toUpperCase() || "TASK";
  return {
    taskKey:
      rawKey && rawKey.length > 0
        ? rawKey
        : fallbackKeyFormatter(fallbackSuffix),
    taskTitle: rawTitle && rawTitle.length > 0 ? rawTitle : untitledTaskLabel,
  };
}

function formatNoteTimestamp(
  isoDate: string,
  formatters: {
    todayAt: (time: string) => string;
    yesterdayAt: (time: string) => string;
    dateAt: (date: string, time: string) => string;
  },
  locale = "en",
): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return isoDate;
  }
  const resolvedLocale = locale === "vi" ? "vi-VN" : "en-US";

  const timeStr = parsed.toLocaleTimeString(resolvedLocale, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const now = new Date();
  const startOfToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startOfTarget = new Date(
    parsed.getFullYear(),
    parsed.getMonth(),
    parsed.getDate(),
  );
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfTarget.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) {
    return formatters.todayAt(timeStr);
  }
  if (diffDays === 1) {
    return formatters.yesterdayAt(timeStr);
  }

  const dateStr = parsed.toLocaleDateString(resolvedLocale, {
    month: "short",
    day: "numeric",
    year: parsed.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  });
  return formatters.dateAt(dateStr, timeStr);
}

function TaskNoteExplorerCard({
  note,
  projectId,
  isExpanded,
  isHighlighted = false,
  onToggleExpand,
}: {
  note: TaskNote;
  projectId: string;
  isExpanded: boolean;
  isHighlighted?: boolean;
  onToggleExpand: () => void;
}) {
  const t = useTranslations("workNotes");
  const common = useTranslations("common");
  const activeLocale = common("localeCode") === "vi" ? "vi" : "en";
  const encodedProjectId = encodeURIComponent(projectId);
  const taskHref = `/projects/${encodedProjectId}/work?taskId=${encodeURIComponent(note.taskId)}`;

  const { taskKey, taskTitle } = resolveTaskMetadata(
    note,
    (code) => t("taskNotes.taskCodeFallback", { code }),
    t("taskNotes.untitledTask"),
  );

  const formattedTimestamp = formatNoteTimestamp(
    note.createdAt,
    {
      todayAt: (time) => t("taskNotes.todayAt", { time }),
      yesterdayAt: (time) => t("taskNotes.yesterdayAt", { time }),
      dateAt: (date, time) => t("taskNotes.dateAt", { date, time }),
    },
    activeLocale,
  );

  const detailId = `task-note-detail-${note.id}`;

  return (
    <article
      className={`min-w-0 rounded-xl border p-5 transition-colors sm:p-6 ${
        isHighlighted
          ? "border-brand-300 bg-brand-50/40 dark:border-brand-500/40 dark:bg-brand-500/5"
          : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
      }`}
      aria-labelledby={`task-note-title-${note.id}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Link
            href={taskHref}
            className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-brand-50/90 px-2.5 py-1 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25"
          >
            <TaskIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="shrink-0 tabular-nums">{taskKey}</span>
            <span
              aria-hidden="true"
              className="text-brand-400 dark:text-brand-500"
            >
              ·
            </span>
            <span className="truncate font-medium text-gray-700 dark:text-gray-200">
              {taskTitle}
            </span>
          </Link>
          {isHighlighted && (
            <span className="inline-flex items-center rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-800 dark:bg-brand-500/20 dark:text-brand-200">
              {t("taskNotes.deepLinkedBadge")}
            </span>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5 text-xs text-gray-500 tabular-nums dark:text-gray-400">
          <span className="font-medium text-gray-700 dark:text-gray-300">
            {note.authorName}
          </span>
          <span aria-hidden="true">·</span>
          <time dateTime={note.createdAt}>{formattedTimestamp}</time>
        </div>
      </div>

      <h3
        id={`task-note-title-${note.id}`}
        className="mt-3 text-base font-semibold tracking-tight break-words text-gray-900 dark:text-white/90"
      >
        {note.title}
      </h3>

      {!isExpanded && (
        <p className="mt-1.5 line-clamp-2 text-sm leading-6 break-words text-gray-600 dark:text-gray-300">
          {note.contentMarkdown ?? note.accomplishments}
        </p>
      )}

      {isExpanded && note.contentMarkdown !== undefined && (
        <div
          id={detailId}
          className="mt-4 text-sm leading-6 break-words whitespace-pre-wrap text-gray-700 dark:text-gray-300"
        >
          {note.contentMarkdown}
        </div>
      )}
      {isExpanded && note.contentMarkdown === undefined && (
        <dl
          id={detailId}
          className="mt-4 grid gap-4 rounded-lg border border-gray-100 bg-gray-50/80 p-4 md:grid-cols-3 dark:border-gray-800/80 dark:bg-gray-950/60"
        >
          {(["accomplishments", "approach", "reason"] as const).map((field) => (
            <div key={field} className="min-w-0">
              <dt className="text-xs font-semibold tracking-wide text-gray-700 uppercase dark:text-gray-300">
                {t(`taskNotes.${field}`)}
              </dt>
              <dd className="mt-1.5 text-sm leading-6 break-words whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                {note[field]}
              </dd>
            </div>
          ))}
        </dl>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 pt-3.5 dark:border-gray-800/80">
        <Link
          href={taskHref}
          className="inline-flex items-center gap-1 text-xs font-medium text-brand-600 transition-colors hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-400 dark:hover:text-brand-300"
        >
          <span>{t("taskNotes.linkedToTask", { taskKey })}</span>
          <ArrowRightIcon
            className="h-3.5 w-3.5 rtl:rotate-180"
            aria-hidden="true"
          />
        </Link>

        <button
          type="button"
          aria-expanded={isExpanded}
          aria-controls={detailId}
          onClick={onToggleExpand}
          className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-gray-300 dark:hover:bg-gray-800 dark:hover:text-white"
        >
          <span>
            {isExpanded ? t("taskNotes.showLess") : t("taskNotes.viewDetails")}
          </span>
          {isExpanded ? (
            <ChevronUpIcon className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </article>
  );
}

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
  const listAccessLost = isAccessOrResourceUnavailableError(query.error);
  const deepLinkAccessLost = isAccessOrResourceUnavailableError(
    deepLinkQuery.error,
  );
  const visibleList = listAccessLost ? undefined : query.data;
  const visibleDeepLink = deepLinkAccessLost ? undefined : deepLinkQuery.data;
  const invalidDeepLink = Boolean(
    deepLinkNoteId &&
    (!isWorkNoteId(projectId) || !isWorkNoteId(deepLinkNoteId)),
  );
  const unavailableDeepLink = Boolean(
    deepLinkNoteId && (invalidDeepLink || deepLinkAccessLost),
  );

  const [search, setSearch] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState("ALL");
  const [selectedAuthorId, setSelectedAuthorId] = useState("ALL");
  const [sortOrder, setSortOrder] = useState<SortOrder>("recent");
  const [expandedNoteIds, setExpandedNoteIds] = useState<
    Record<string, boolean>
  >({});

  const allLoadedNotes = useMemo(() => {
    const raw = visibleList?.data ?? [];
    if (
      visibleDeepLink &&
      !raw.some((item) => item.id === visibleDeepLink.id)
    ) {
      return [visibleDeepLink, ...raw];
    }
    return raw;
  }, [visibleList?.data, visibleDeepLink]);

  const taskOptions = useMemo(() => {
    const map = new Map<string, { taskId: string; label: string }>();
    for (const note of allLoadedNotes) {
      if (!map.has(note.taskId)) {
        const { taskKey, taskTitle } = resolveTaskMetadata(
          note,
          (code) => t("taskNotes.taskCodeFallback", { code }),
          t("taskNotes.untitledTask"),
        );
        map.set(note.taskId, {
          taskId: note.taskId,
          label: `${taskKey} · ${taskTitle}`,
        });
      }
    }
    return [...map.values()];
  }, [allLoadedNotes, t]);

  const authorOptions = useMemo(() => {
    const map = new Map<string, { authorId: string; authorName: string }>();
    for (const note of allLoadedNotes) {
      if (!map.has(note.authorId)) {
        map.set(note.authorId, {
          authorId: note.authorId,
          authorName: note.authorName,
        });
      }
    }
    return [...map.values()];
  }, [allLoadedNotes]);

  const notes = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    const filtered = (visibleList?.data ?? []).filter((note) => {
      if (selectedTaskId !== "ALL" && note.taskId !== selectedTaskId) {
        return false;
      }
      if (selectedAuthorId !== "ALL" && note.authorId !== selectedAuthorId) {
        return false;
      }
      if (!needle) {
        return true;
      }
      const { taskKey, taskTitle } = resolveTaskMetadata(
        note,
        (code) => t("taskNotes.taskCodeFallback", { code }),
        t("taskNotes.untitledTask"),
      );
      return [
        note.title,
        note.authorName,
        note.accomplishments ?? "",
        note.contentMarkdown ?? "",
        note.approach ?? "",
        note.reason ?? "",
        note.taskId,
        taskKey,
        taskTitle,
      ].some((value) => (value ?? "").toLocaleLowerCase().includes(needle));
    });

    return [...filtered].sort((first, second) => {
      const firstTime = Date.parse(first.createdAt);
      const secondTime = Date.parse(second.createdAt);
      if (sortOrder === "oldest") {
        return firstTime - secondTime;
      }
      return secondTime - firstTime;
    });
  }, [
    visibleList?.data,
    search,
    selectedTaskId,
    selectedAuthorId,
    sortOrder,
    t,
  ]);

  const distinctTaskCount = useMemo(() => {
    return new Set(notes.map((note) => note.taskId)).size;
  }, [notes]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    selectedTaskId !== "ALL" ||
    selectedAuthorId !== "ALL" ||
    sortOrder !== "recent";

  const handleResetFilters = () => {
    setSearch("");
    setSelectedTaskId("ALL");
    setSelectedAuthorId("ALL");
    setSortOrder("recent");
  };

  const toggleNoteExpand = (noteId: string, defaultExpanded = false) => {
    setExpandedNoteIds((current) => {
      const currentValue = current[noteId] ?? defaultExpanded;
      return {
        ...current,
        [noteId]: !currentValue,
      };
    });
  };

  const showSeparateDeepLinkCard = Boolean(
    visibleDeepLink &&
    !(visibleList?.data ?? []).some((item) => item.id === visibleDeepLink.id),
  );

  return (
    <main className="mx-auto w-full max-w-[1160px] px-4 py-6 sm:px-6 lg:px-8">
      <WorkNotesPageHeader projectId={projectId} active="tasks" />

      {unavailableDeepLink && (
        <div
          role="status"
          data-testid="work-note-unavailable-banner"
          className="mb-4 rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-800 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200"
        >
          {t("contentUnavailable")}
        </div>
      )}

      {deepLinkNoteId &&
        !unavailableDeepLink &&
        isWorkNoteId(projectId) &&
        isWorkNoteId(deepLinkNoteId) &&
        deepLinkQuery.isPending &&
        !visibleDeepLink && (
          <div
            role="status"
            className="mb-4 text-sm text-gray-500 dark:text-gray-400"
          >
            {t("loading")}
          </div>
        )}

      {deepLinkNoteId &&
        !unavailableDeepLink &&
        visibleDeepLink !== undefined &&
        !deepLinkAccessLost &&
        (deepLinkQuery.isFetching || deepLinkQuery.isRefetchError) && (
          <div className="mb-4">
            {deepLinkQuery.isFetching && (
              <UpdatingStatus>{t("loading")}</UpdatingStatus>
            )}
            {deepLinkQuery.isRefetchError && (
              <BackgroundRefreshError
                retryLabel={t("retry")}
                onRetry={() => void deepLinkQuery.refetch()}
              >
                {t("taskNotes.loadError")}
              </BackgroundRefreshError>
            )}
          </div>
        )}

      {deepLinkNoteId &&
        !unavailableDeepLink &&
        deepLinkQuery.isError &&
        !visibleDeepLink && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
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

      {showSeparateDeepLinkCard && visibleDeepLink && (
        <div className="mb-5">
          <TaskNoteExplorerCard
            note={visibleDeepLink}
            projectId={projectId}
            isHighlighted
            isExpanded={expandedNoteIds[visibleDeepLink.id] ?? true}
            onToggleExpand={() => toggleNoteExpand(visibleDeepLink.id, true)}
          />
        </div>
      )}

      <section className="space-y-4" aria-labelledby="project-task-notes-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <h2
              id="project-task-notes-title"
              className="text-base font-semibold text-gray-900 dark:text-white/90"
            >
              {t("taskNotes.title")}
            </h2>
            {visibleList && (
              <span className="text-xs font-medium text-gray-500 tabular-nums dark:text-gray-400">
                {t("taskNotes.notesAcrossTasks", {
                  noteCount: notes.length,
                  taskCount: distinctTaskCount,
                })}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:flex-row sm:flex-wrap sm:items-center dark:border-gray-800 dark:bg-gray-900">
          <div className="relative min-w-[220px] flex-1">
            <SearchIcon
              className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
              aria-hidden="true"
            />
            <input
              type="search"
              aria-label={t("searchLabel")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("taskNotes.searchPlaceholder")}
              className="h-9 w-full rounded-lg border border-gray-200 bg-gray-50/60 ps-9 pe-8 text-sm text-gray-800 transition-colors outline-none placeholder:text-gray-400 focus:border-brand-400 focus:bg-white focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder:text-gray-500 dark:focus:border-brand-500"
            />
            {search.length > 0 && (
              <button
                type="button"
                aria-label={t("taskNotes.clearSearch")}
                onClick={() => setSearch("")}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-500 dark:hover:text-gray-300"
              >
                <CloseLineIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>

          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            <select
              aria-label={t("taskNotes.filterByTask")}
              value={selectedTaskId}
              onChange={(event) => setSelectedTaskId(event.target.value)}
              className="col-span-2 h-9 w-full truncate rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-colors outline-none focus:border-brand-400 focus:ring-3 focus:ring-brand-500/10 sm:w-auto sm:max-w-[220px] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
            >
              <option value="ALL">{t("taskNotes.allTasks")}</option>
              {taskOptions.map((option) => (
                <option key={option.taskId} value={option.taskId}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              aria-label={t("taskNotes.filterByAuthor")}
              value={selectedAuthorId}
              onChange={(event) => setSelectedAuthorId(event.target.value)}
              className="h-9 w-full truncate rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-colors outline-none focus:border-brand-400 focus:ring-3 focus:ring-brand-500/10 sm:w-auto sm:max-w-[180px] dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
            >
              <option value="ALL">{t("taskNotes.allAuthors")}</option>
              {authorOptions.map((option) => (
                <option key={option.authorId} value={option.authorId}>
                  {option.authorName}
                </option>
              ))}
            </select>

            <select
              aria-label={t("taskNotes.sortBy")}
              value={sortOrder}
              onChange={(event) =>
                setSortOrder(event.target.value as SortOrder)
              }
              className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 transition-colors outline-none focus:border-brand-400 focus:ring-3 focus:ring-brand-500/10 sm:w-auto dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
            >
              <option value="recent">{t("taskNotes.sortRecent")}</option>
              <option value="oldest">{t("taskNotes.sortOldest")}</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="col-span-2 h-9 rounded-lg px-2.5 text-xs font-semibold text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-brand-500 sm:w-auto dark:text-brand-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-300"
              >
                {t("taskNotes.resetFilters")}
              </button>
            )}
          </div>
        </div>

        {visibleList !== undefined &&
          !listAccessLost &&
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
                  {t("taskNotes.loadError")}
                </BackgroundRefreshError>
              )}
            </div>
          )}

        {query.isPending && !visibleList ? (
          <div role="status" className="space-y-3.5" aria-label={t("loading")}>
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-36 rounded-xl border border-gray-200 bg-gray-50 p-5 motion-safe:animate-pulse dark:border-gray-800 dark:bg-gray-900"
              />
            ))}
          </div>
        ) : query.isError && !visibleList ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-4 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
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
          <div className="rounded-xl border border-dashed border-gray-300 bg-white px-5 py-12 text-center dark:border-gray-700 dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
              {hasActiveFilters
                ? t("noSearchResults")
                : t("taskNotes.emptyProject")}
            </h3>
            <p className="mx-auto mt-1 max-w-lg text-sm leading-6 text-gray-500 dark:text-gray-400">
              {hasActiveFilters
                ? t("adjustSearch")
                : t("taskNotes.openTaskHint")}
            </p>
            <div className="mt-4 flex justify-center">
              {hasActiveFilters ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetFilters}
                >
                  {t("taskNotes.resetFilters")}
                </Button>
              ) : (
                <Link
                  href={`/projects/${encodeURIComponent(projectId)}/work`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 hover:text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <span>{t("taskNotes.openProjectTasks")}</span>
                  <ArrowRightIcon
                    className="h-3.5 w-3.5 rtl:rotate-180"
                    aria-hidden="true"
                  />
                </Link>
              )}
            </div>
          </div>
        ) : (
          <>
            <ul className="space-y-3.5">
              {notes.map((note) => {
                const isDeepLinked = Boolean(
                  deepLinkNoteId && note.id === deepLinkNoteId,
                );
                const isExpanded = expandedNoteIds[note.id] ?? isDeepLinked;
                return (
                  <li key={note.id} className="min-w-0">
                    <TaskNoteExplorerCard
                      note={note}
                      projectId={projectId}
                      isHighlighted={isDeepLinked}
                      isExpanded={isExpanded}
                      onToggleExpand={() =>
                        toggleNoteExpand(note.id, isDeepLinked)
                      }
                    />
                  </li>
                );
              })}
            </ul>

            {visibleList && visibleList.pagination.totalPages > 1 && (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-4 text-sm dark:border-gray-800">
                <p className="text-gray-500 tabular-nums dark:text-gray-400">
                  {t("pagination.total", {
                    count: visibleList.pagination.totalItems,
                  })}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={visibleList.pagination.page <= 1}
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
                      visibleList.pagination.page >=
                      visibleList.pagination.totalPages
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
