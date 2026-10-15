"use client";

import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { BookOpenIcon, CheckCircleIcon, EyeIcon, TaskIcon, TimeIcon } from "@/icons";
import type { WorkNote, WorkNotesRole, WeeklyReport } from "./work-notes-types";

export default function WorkNotesActivityPanel({
  notes,
  reports,
  role,
  currentUserName,
  currentUserReportSubmitted,
  onMarkViewed,
  onConvert,
  onOpenReports,
}: {
  notes: readonly WorkNote[];
  reports: readonly WeeklyReport[];
  role: WorkNotesRole;
  currentUserName: string;
  currentUserReportSubmitted: boolean;
  onMarkViewed: (id: string) => void;
  onConvert: (note: WorkNote) => void;
  onOpenReports: () => void;
}) {
  const t = useTranslations("workNotes");
  const submitted = reports.filter((report) => report.status === "SUBMITTED").length;
  const needsAttention = reports.filter((report) => report.status === "MISSING");
  const percentage = reports.length ? Math.round((submitted / reports.length) * 100) : 0;

  return (
    <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="min-w-0">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">{t("activity.title")}</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("activity.description")}</p>
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400">{t("activity.noteCount", { count: notes.length })}</span>
        </div>
        {notes.length === 0 ? (
          <div role="status" className="rounded-xl border border-dashed border-gray-300 px-5 py-12 text-center dark:border-gray-700">
            <TimeIcon className="mx-auto size-7 text-gray-400" aria-hidden="true" />
            <p className="mt-3 text-sm font-medium text-gray-800 dark:text-gray-200">{t("empty.title")}</p>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("empty.description")}</p>
          </div>
        ) : (
          <ol className="space-y-3" aria-label={t("activity.timelineLabel")}>
            {notes.map((note) => (
              <li key={note.id}>
                <article className={`rounded-xl border border-gray-200 border-s-4 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 ${note.blocker ? "border-s-error-500" : note.unfinished || note.kind === "DECISION" ? "border-s-warning-500" : "border-s-brand-500"}`}>
                  <header className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar initials={note.initials} />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white/90">{note.author}</p>
                        <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{note.createdAt}</p>
                      </div>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${note.blocker ? "bg-error-50 text-error-700 dark:bg-error-500/10 dark:text-error-300" : "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"}`}>
                      <span aria-hidden="true" className={`size-1.5 rounded-full ${note.blocker ? "bg-error-500" : "bg-brand-500"}`} />
                      {t(`kinds.${note.kind}`)}
                    </span>
                  </header>

                  {note.taskKey && (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 dark:text-brand-400">
                      <TaskIcon aria-hidden="true" className="size-3.5" />{note.taskKey}
                    </p>
                  )}
                  <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white/90">{note.title}</h3>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-gray-600 dark:text-gray-300">{note.body}</p>

                  {note.blocker && (
                    <p className="mt-3 rounded-lg bg-error-50 px-3 py-2 text-xs leading-5 text-error-700 dark:bg-error-500/10 dark:text-error-300">
                      <span className="font-semibold">{t("activity.blockedLabel")}: </span>{note.blocker}
                    </p>
                  )}
                  {note.unfinished && (
                    <p className="mt-3 rounded-lg bg-warning-50 px-3 py-2 text-xs leading-5 text-warning-800 dark:bg-warning-500/10 dark:text-warning-300">
                      <span className="font-semibold">{t("activity.unfinishedLabel")}: </span>{note.unfinished}
                    </p>
                  )}
                  {note.nextStep && (
                    <p className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs leading-5 text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      {note.nextStep}
                    </p>
                  )}
                  {(role !== "MEMBER" || (note.kind === "WORK_UPDATE" && note.author === currentUserName)) && <footer className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
                    {role === "MEMBER" && note.kind === "WORK_UPDATE" && note.author === currentUserName && (
                      <button type="button" onClick={() => onConvert(note)} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:text-brand-400">
                        <BookOpenIcon aria-hidden="true" className="size-4" />{t("activity.saveAsKnowledge")}
                      </button>
                    )}
                    {role !== "MEMBER" && (
                      note.viewed ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-success-700 dark:text-success-400"><CheckCircleIcon className="size-4" aria-hidden="true" />{t("activity.viewed")}</span>
                      ) : (
                        <button type="button" onClick={() => onMarkViewed(note.id)} className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:text-brand-400">
                          <EyeIcon aria-hidden="true" className="size-4" />{t("activity.markViewed")}
                        </button>
                      )
                    )}
                  </footer>}
                </article>
              </li>
            ))}
          </ol>
        )}
      </section>

      <aside className="space-y-4">
        <section className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="border-b border-gray-100 px-4 py-3.5 dark:border-gray-800">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">{t("activity.weekCardTitle")}</h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("activity.weekRange")}</p>
          </div>
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-gray-700 dark:text-gray-300">{t("activity.reportsSubmitted", { submitted, total: reports.length })}</span>
              <span className="text-gray-500 dark:text-gray-400">{percentage}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800" role="progressbar" aria-label={t("activity.reportProgress")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage}>
              <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${percentage}%` }} />
            </div>
            {role === "MEMBER" ? (
              <p className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
                {currentUserReportSubmitted
                  ? <CheckCircleIcon aria-hidden="true" className="size-4 shrink-0 text-success-500" />
                  : <TimeIcon aria-hidden="true" className="size-4 shrink-0 text-warning-500" />}
                {t(currentUserReportSubmitted ? "activity.memberSubmitted" : "activity.memberNotSubmitted")}
              </p>
            ) : reports.length === 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("activity.noReports")}</p>
            ) : needsAttention.length > 0 ? (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {needsAttention.slice(0, 3).map((report) => (
                  <li key={report.id} className="flex items-center gap-2 py-2.5 first:pt-0 last:pb-0">
                    <Avatar initials={report.initials} compact />
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-800 dark:text-gray-200">{report.member}</span>
                    <span className="rounded-full bg-warning-50 px-2 py-1 text-[10px] font-medium text-warning-700 dark:bg-warning-500/10 dark:text-warning-300">{t("reports.missing")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">{t("activity.allReportsSubmitted")}</p>
            )}
            <Button type="button" variant="outline" size="sm" onClick={onOpenReports} className="w-full">{t("activity.viewReports")}</Button>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">{t("activity.principlesTitle")}</h3>
          <ul className="mt-3 space-y-2.5">
            {[t("activity.principleOne"), t("activity.principleTwo"), t("activity.principleThree")].map((principle) => (
              <li key={principle} className="flex gap-2 text-xs leading-5 text-gray-500 dark:text-gray-400">
                <CheckCircleIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-500" />{principle}
              </li>
            ))}
          </ul>
        </section>
      </aside>
    </div>
  );
}

function Avatar({ initials, compact = false }: { initials: string; compact?: boolean }) {
  return <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300 ${compact ? "size-7 text-[10px]" : "size-9 text-xs"}`}>{initials}</span>;
}
