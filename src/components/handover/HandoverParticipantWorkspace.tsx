"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type {
  HandoverParticipantView,
  HandoverSummaryDto,
} from "@/lib/queries/handovers/handover.types";
import Button from "@/components/ui/button/Button";
import TaskNotesPanel from "@/components/work-notes/TaskNotesPanel";
import HandoverDialogShell from "./HandoverDialogShell";
import HandoverQaPanel from "./HandoverQaPanel";
import { buildSourceWorkspaceHref, formatUtcDate } from "./handover-ui.utils";

type ParticipantTask = HandoverParticipantView["tasks"][number];

const heading = "text-base font-semibold text-gray-900 dark:text-white";
const surface =
  "min-w-0 rounded-xl border border-gray-200 bg-white p-4 sm:p-5 dark:border-gray-800 dark:bg-gray-900";
const link =
  "break-words font-medium text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500 dark:text-brand-300";

function TaskRows({
  projectId,
  tasks,
  openNote,
}: {
  projectId: string;
  tasks: ParticipantTask[];
  openNote: (task: ParticipantTask) => void;
}) {
  const t = useTranslations("handover.participant");
  return (
    <ul className="divide-y divide-gray-200 dark:divide-gray-800">
      {tasks.map((task) => (
        <li
          key={task.id}
          className="flex min-w-0 flex-wrap items-start justify-between gap-2 py-3"
        >
          <div className="min-w-0 flex-1 basis-48 space-y-1 text-sm">
            <Link
              href={`/projects/${encodeURIComponent(projectId)}/work?taskId=${encodeURIComponent(task.id)}`}
              className={link}
            >
              <span className="me-2 text-xs tabular-nums">{task.key}</span>
              {task.title}
            </Link>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-600 dark:text-gray-400">
              <span>
                {t.has(`taskStatus.${task.status}`)
                  ? t(`taskStatus.${task.status}`)
                  : task.status}
              </span>
              <span className="tabular-nums">
                {task.dueDate
                  ? t("taskDue", { date: formatUtcDate(task.dueDate) })
                  : t("noDue")}
              </span>
              {task.disposition !== "DEPARTING" && (
                <span>{t(`disposition.${task.disposition}`)}</span>
              )}
            </div>
          </div>
          {task.canAddNote && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => openNote(task)}
            >
              {t("addNote")}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

export default function HandoverParticipantWorkspace({
  projectId,
  handover,
  view,
  published,
  canManage,
  busy,
  actionError,
  onAccept,
  children,
}: {
  projectId: string;
  handover: HandoverSummaryDto;
  view: HandoverParticipantView;
  published: boolean;
  canManage: boolean;
  busy: boolean;
  actionError: string | null;
  onAccept: () => void;
  children: ReactNode;
}) {
  const t = useTranslations("handover.participant");
  const [noteTask, setNoteTask] = useState<ParticipantTask | null>(null);
  const isSuccessor = view.role === "SUCCESSOR";
  const tasks = [...view.tasks].sort((a, b) => {
    if (a.dueDate === null && b.dueDate !== null) return 1;
    if (b.dueDate === null && a.dueDate !== null) return -1;
    return (
      (a.dueDate ?? "").localeCompare(b.dueDate ?? "") ||
      a.key.localeCompare(b.key)
    );
  });
  const nextTasks = tasks
    .filter((task) => task.status !== "DONE" && task.status !== "CANCELLED")
    .slice(0, 3);
  const description = view.packageAccepted
    ? t("accepted")
    : published
      ? t("reviewSummary")
      : t("waitingForPackage");
  const listHref = `/projects/${encodeURIComponent(projectId)}/handover`;

  return (
    <div className="min-w-0 space-y-4">
      <header className={surface}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-sm font-medium text-brand-700 dark:text-brand-300">
              {t(`views.${view.role}`)}
            </p>
            <h1 className="text-xl font-semibold break-words text-gray-900 sm:text-2xl dark:text-white">
              {handover.title}
            </h1>
            <p className="text-sm text-gray-600 tabular-nums dark:text-gray-400">
              {t("handoverDue", {
                date: formatUtcDate(handover.targetCompletionDate),
              })}
            </p>
          </div>
          {canManage && (
            <Link
              className={link}
              href={`${listHref}/${encodeURIComponent(handover.id)}`}
            >
              {t("manage")}
            </Link>
          )}
        </div>
      </header>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 space-y-4">
          <section className={surface}>
            <h2 className={heading}>
              {t(isSuccessor ? "nextTasks" : "departingTasks")}
            </h2>
            {(isSuccessor ? nextTasks : tasks).length ? (
              <TaskRows
                projectId={projectId}
                tasks={isSuccessor ? nextTasks : tasks}
                openNote={setNoteTask}
              />
            ) : (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {t(isSuccessor ? "noNextTasks" : "noDepartingTasks")}
              </p>
            )}
            {isSuccessor && tasks.length > 0 && (
              <details className="mt-3 border-t border-gray-200 pt-3 dark:border-gray-800">
                <summary className="cursor-pointer text-sm font-medium text-gray-800 tabular-nums dark:text-gray-200">
                  {t("allReceivedTasks", { count: tasks.length })}
                </summary>
                <TaskRows
                  projectId={projectId}
                  tasks={tasks}
                  openNote={setNoteTask}
                />
              </details>
            )}
          </section>
          {isSuccessor && (
            <section className={surface}>
              <h2 className={heading}>{t("receiptTitle")}</h2>
              <p
                role={view.packageAccepted ? "status" : undefined}
                className="mt-1 text-sm text-gray-600 dark:text-gray-400"
              >
                {description}
              </p>
              {published &&
                !view.packageAccepted &&
                !view.canQuickAccept &&
                handover.status === "OPEN" && (
                  <p className="mt-2 text-sm text-warning-700 dark:text-warning-300">
                    {t("waitingForTransfer")}
                  </p>
                )}
              {actionError && (
                <p
                  role="alert"
                  className="mt-2 text-sm break-words text-error-700 dark:text-error-300"
                >
                  {actionError}
                </p>
              )}
              {view.canQuickAccept && (
                <div className="mt-3">
                  <Button
                    type="button"
                    size="sm"
                    isLoading={busy}
                    onClick={onAccept}
                  >
                    {t("accept")}
                  </Button>
                </div>
              )}
            </section>
          )}
          <section className={surface}>
            <h2 className={heading}>{t("sources")}</h2>
            {view.sources.length ? (
              <ul className="mt-2 divide-y divide-gray-200 text-sm dark:divide-gray-800">
                {view.sources.map((source) => {
                  const href = buildSourceWorkspaceHref(
                    projectId,
                    source.kind,
                    source.id,
                  );
                  return (
                    <li
                      key={`${source.kind}:${source.id}:${source.version}`}
                      className="flex flex-wrap justify-between gap-x-3 gap-y-1 py-2.5"
                    >
                      {href ? (
                        <Link href={href} className={link}>
                          {source.title}
                        </Link>
                      ) : (
                        <span className="break-words">{source.title}</span>
                      )}
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {t(`sourceKind.${source.kind}`)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                {t("noSources")}
              </p>
            )}
          </section>
          {published && (
            <details className={surface}>
              <summary className="cursor-pointer font-semibold text-gray-900 dark:text-white">
                {t(isSuccessor ? "reviewOrClarify" : "publishedSummary")}
              </summary>
              <div className="mt-3">{children}</div>
            </details>
          )}
        </div>
        {isSuccessor && published && (
          <div className="min-w-0">
            <HandoverQaPanel projectId={projectId} handover={handover} />
          </div>
        )}
      </div>
      <HandoverDialogShell
        isOpen={Boolean(noteTask)}
        onClose={() => setNoteTask(null)}
        title={t("addNote")}
        description={t("noteVersionHint")}
        closeLabel={t("close")}
        size="xl"
      >
        {noteTask && (
          <TaskNotesPanel projectId={projectId} taskId={noteTask.id} />
        )}
      </HandoverDialogShell>
    </div>
  );
}
