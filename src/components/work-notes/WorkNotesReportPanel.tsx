"use client";

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { Modal } from "@/components/ui/modal";
import { CheckCircleIcon, FileIcon } from "@/icons";
import type { WorkNotesRole, WeeklyReport } from "./work-notes-types";

const FIELD_CLASS = "w-full rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm leading-6 text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder:text-gray-500";

export default function WorkNotesReportPanel({
  role,
  reports,
  currentUserName,
  onSubmit,
  onMarkReviewed,
}: {
  role: WorkNotesRole;
  reports: readonly WeeklyReport[];
  currentUserName: string;
  onSubmit: (report: Pick<WeeklyReport, "completed" | "blockers" | "nextWeek">) => void;
  onMarkReviewed: (id: string) => void;
}) {
  const t = useTranslations("workNotes");
  const [selected, setSelected] = useState<WeeklyReport | null>(null);
  const currentReport = reports.find((report) => report.member === currentUserName && report.week === "THIS_WEEK");
  const [draft, setDraft] = useState(() => {
    return {
      completed: currentReport?.completed ?? "",
      blockers: currentReport?.blockers ?? "",
      nextWeek: currentReport?.nextWeek ?? "",
    };
  });
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.completed.trim() || !draft.blockers.trim() || !draft.nextWeek.trim()) {
      setError(t("reports.allSectionsRequired"));
      return;
    }
    onSubmit({ completed: draft.completed.trim(), blockers: draft.blockers.trim(), nextWeek: draft.nextWeek.trim() });
    setError("");
  }

  const submitted = reports.filter((report) => report.status === "SUBMITTED").length;
  const reviewed = reports.filter((report) => report.reviewed).length;

  if (role === "MEMBER") {
    return (
      <section className="max-w-4xl">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">{t("reports.memberTitle")}</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("reports.weekRange")}</p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${currentReport?.status === "SUBMITTED" ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300" : "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-300"}`}>
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{currentReport?.status === "SUBMITTED" ? t("reports.submitted") : t("reports.notSubmitted")}
          </span>
        </div>
        <form onSubmit={submit} className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">{t("reports.yourSummary")}</h3>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("reports.shortReportHint")}</p>
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400">{t("reports.memberName", { member: currentUserName })}</span>
          </div>
          <div className="space-y-4 px-5 py-5">
            <ReportField label={t("reports.completed")} value={draft.completed} placeholder={t("reports.completedPlaceholder")} onChange={(value) => setDraft((current) => ({ ...current, completed: value }))} />
            <ReportField label={t("reports.blockers")} value={draft.blockers} placeholder={t("reports.blockersPlaceholder")} onChange={(value) => setDraft((current) => ({ ...current, blockers: value }))} />
            <ReportField label={t("reports.nextWeek")} value={draft.nextWeek} placeholder={t("reports.nextWeekPlaceholder")} onChange={(value) => setDraft((current) => ({ ...current, nextWeek: value }))} />
            {error && <p role="alert" className="text-sm text-error-600 dark:text-error-400">{error}</p>}
          </div>
          <div className="flex flex-col-reverse gap-2 border-t border-gray-100 bg-gray-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 dark:bg-gray-950/40">
            <p className="text-xs text-gray-500 dark:text-gray-400">{t("previewNotice")}</p>
            <Button type="submit" startIcon={<FileIcon aria-hidden="true" className="size-4" />} className="focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500">{t("reports.submitPreview")}</Button>
          </div>
        </form>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white/90">{t("reports.leaderTitle")}</h2>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("reports.leaderDescription")}</p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">{t("reports.submittedCount", { submitted, total: reports.length })}</span>
          {role === "LEADER" && <span className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">{t("reports.reviewedCount", { count: reviewed })}</span>}
        </div>
      </div>
      <div className="overflow-hidden rounded-xl border border-gray-200 dark:border-gray-800">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[42rem] border-collapse text-start">
            <thead className="bg-gray-50 dark:bg-gray-950/60">
              <tr>
                <th scope="col" className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">{t("reports.memberColumn")}</th>
                <th scope="col" className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">{t("reports.statusColumn")}</th>
                <th scope="col" className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">{t("reports.highlightsColumn")}</th>
                <th scope="col" className="px-4 py-3 text-start text-xs font-semibold uppercase tracking-wide text-gray-500">{t("reports.updatedColumn")}</th>
                <th scope="col" className="px-4 py-3 text-end text-xs font-semibold uppercase tracking-wide text-gray-500"><span className="sr-only">{t("reports.actionsColumn")}</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
              {reports.map((report) => (
                <tr key={report.id} className="align-middle">
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2.5"><Avatar initials={report.initials} /><span className="text-sm font-medium text-gray-800 dark:text-gray-200">{report.member}</span></div>
                  </td>
                  <td className="px-4 py-3.5"><StatusPill submitted={report.status === "SUBMITTED"} label={report.status === "SUBMITTED" ? t("reports.submitted") : t("reports.missing")} /></td>
                  <td className="max-w-md px-4 py-3.5 text-sm text-gray-600 dark:text-gray-300">
                    {report.status === "SUBMITTED" ? <span className="line-clamp-2">{report.completed}</span> : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-sm text-gray-500 dark:text-gray-400">{report.updatedAt}</td>
                  <td className="px-4 py-3.5 text-end">
                    {report.status === "SUBMITTED" ? (
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => setSelected(report)}>{t("reports.view")}</Button>
                        {role === "LEADER" && <button type="button" onClick={() => onMarkReviewed(report.id)} disabled={report.reviewed} aria-label={report.reviewed ? t("reports.alreadyReviewed", { member: report.member }) : t("reports.markReviewed", { member: report.member })} className="inline-flex size-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:bg-gray-50 hover:text-success-600 disabled:cursor-default disabled:border-success-200 disabled:bg-success-50 disabled:text-success-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 dark:disabled:border-success-500/20 dark:disabled:bg-success-500/10">
                          <CheckCircleIcon aria-hidden="true" className="size-4" />
                        </button>}
                      </div>
                    ) : <span className="text-xs text-gray-400">{t("reports.awaitingSubmission")}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {reports.length === 0 && <p role="status" className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">{t("reports.empty")}</p>}
      </div>
      <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">{t("reports.readOnlyHint")}</p>
      <ReportDetailDialog report={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

function ReportField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return <label className="grid gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">{label}<textarea required rows={3} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className={FIELD_CLASS} /></label>;
}

function StatusPill({ submitted, label }: { submitted: boolean; label: string }) {
  return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${submitted ? "bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-300" : "bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-300"}`}><span aria-hidden="true" className="size-1.5 rounded-full bg-current" />{label}</span>;
}

function Avatar({ initials }: { initials: string }) {
  return <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{initials}</span>;
}

function ReportDetailDialog({ report, onClose }: { report: WeeklyReport | null; onClose: () => void }) {
  const t = useTranslations("workNotes");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (report && !wasOpenRef.current) {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      closeButtonRef.current?.focus();
    } else if (!report && wasOpenRef.current) {
      returnFocusRef.current?.focus();
    }
    wasOpenRef.current = Boolean(report);
  }, [report]);

  function trapDialogFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const nodes = event.currentTarget.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex="0"]',
    );
    if (!nodes.length) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <Modal isOpen={Boolean(report)} onClose={onClose} backdropClassName="bg-gray-900/15 backdrop-blur-[1px] dark:bg-gray-950/25" showCloseButton={false} className="mx-4 max-h-[90vh] max-w-xl overflow-y-auto rounded-2xl border border-gray-200 shadow-theme-lg dark:border-gray-800">
      {report && <div role="dialog" aria-modal="true" aria-labelledby="report-detail-title" onKeyDown={trapDialogFocus} className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-4 dark:border-gray-800">
          <div className="flex items-center gap-3"><Avatar initials={report.initials} /><div><h3 id="report-detail-title" className="font-semibold text-gray-900 dark:text-white/90">{t("reports.detailTitle", { member: report.member })}</h3><p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{t("reports.weekRange")}</p></div></div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label={t("closeDialog")} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-gray-400 dark:hover:bg-gray-800">×</button>
        </div>
        <div className="space-y-4 pt-4">{([[t("reports.completed"), report.completed], [t("reports.blockers"), report.blockers], [t("reports.nextWeek"), report.nextWeek]] as const).map(([label, text]) => <section key={label}><h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">{label}</h4><p className="mt-1.5 whitespace-pre-line text-sm leading-6 text-gray-700 dark:text-gray-300">{text || "—"}</p></section>)}</div>
        <div className="mt-5 flex justify-end"><Button type="button" variant="outline" onClick={onClose}>{t("close")}</Button></div>
      </div>}
    </Modal>
  );
}
