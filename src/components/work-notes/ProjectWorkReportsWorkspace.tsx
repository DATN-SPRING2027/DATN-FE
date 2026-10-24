"use client";

import { useState, type FormEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import WorkNotesPageHeader from "./WorkNotesPageHeader";
import {
  useWorkNotesMutation,
  useWorkReportSettingsQuery,
  useWorkReportsQuery,
  workNoteKeys,
  workNotesApi,
  type ReportFrequency,
  type WorkReport,
  type WorkReportInput,
  type WorkReportStatus,
} from "@/lib/queries/work-notes/useWorkNotes";

const FREQUENCIES: readonly ReportFrequency[] = ["DAILY", "EVERY_3_DAYS", "WEEKLY"];
const STATUSES: readonly (WorkReportStatus | "ALL")[] = ["ALL", "DRAFT", "PENDING_REVIEW", "APPROVED", "CHANGES_REQUESTED", "REJECTED", "OVERDUE"];
const FIELD_CLASS = "w-full min-w-0 border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder:text-gray-500";

function ReportEditor({ report, isSaving, isSubmitting, error, onSave, onSubmit, onClose }: {
  report: WorkReport;
  isSaving: boolean;
  isSubmitting: boolean;
  error: string;
  onSave: (input: WorkReportInput) => Promise<void>;
  onSubmit: (input: WorkReportInput) => Promise<void>;
  onClose?: () => void;
}) {
  const t = useTranslations("workNotes.reports");
  const format = useFormatter();
  const [form, setForm] = useState<WorkReportInput>(report);
  const [validationError, setValidationError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>, saveOnly: boolean) {
    event.preventDefault();
    await persist(saveOnly);
  }

  async function persist(saveOnly: boolean) {
    const cleaned = {
      accomplishments: form.accomplishments.trim(),
      approach: form.approach.trim(),
      reason: form.reason.trim(),
      blockers: form.blockers?.trim() ?? "",
      nextSteps: form.nextSteps?.trim() ?? "",
    };
    if (!cleaned.accomplishments || !cleaned.approach || !cleaned.reason) {
      setValidationError(t("coreRequired"));
      return;
    }
    setValidationError("");
    await (saveOnly ? onSave(cleaned) : onSubmit(cleaned));
  }

  return (
    <form onSubmit={(event) => void submit(event, true)} className="space-y-4 border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-semibold text-gray-900 dark:text-white/90">{t("reportEditorTitle")}</h3><p className="mt-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">{t("period", { start: format.dateTime(new Date(report.periodStart), { dateStyle: "medium", timeZone: "UTC" }), end: format.dateTime(new Date(report.periodEnd), { dateStyle: "medium", timeZone: "UTC" }) })} · {t("due", { date: format.dateTime(new Date(report.dueAt), { dateStyle: "medium", timeZone: "UTC" }) })}</p></div><div className="flex items-center gap-2"><span className="border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">{t(`status.${report.status}`)}</span>{onClose && <Button type="button" variant="outline" size="sm" onClick={onClose}>{t("closeEditor")}</Button>}</div></div>
      <div className="grid gap-3 md:grid-cols-2">
        {(["accomplishments", "approach", "reason", "blockers", "nextSteps"] as const).map((field) => {
          const required = field === "accomplishments" || field === "approach" || field === "reason";
          return <label key={field} className={`grid min-w-0 gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 ${field === "accomplishments" || field === "reason" ? "md:col-span-2" : ""}`}>
            {t(field)}{required && <span className="text-error-600">*</span>}
            <textarea required={required} maxLength={field === "reason" || field === "blockers" || field === "nextSteps" ? 5000 : 10000} rows={field === "accomplishments" ? 4 : 3} value={form[field] ?? ""} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} className={`${FIELD_CLASS} resize-y`} />
          </label>;
        })}
      </div>
      {validationError && <p role="alert" className="text-sm text-error-600 dark:text-error-400">{validationError}</p>}{error && <p role="alert" className="text-sm text-error-600 dark:text-error-400">{error}</p>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-gray-100 pt-4 dark:border-gray-800"><Button type="submit" variant="outline" size="sm" isLoading={isSaving}>{t("saveDraft")}</Button><Button type="button" size="sm" isLoading={isSubmitting} onClick={() => void persist(false)}>{t("submit")}</Button></div>
    </form>
  );
}

function ReportReviewActions({ report, pending, onReview }: {
  report: WorkReport;
  pending: boolean;
  onReview: (reportId: string, action: "approve" | "request-changes" | "reject", comment: string) => Promise<void>;
}) {
  const t = useTranslations("workNotes.reports");
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  async function review(action: "approve" | "request-changes" | "reject") {
    const text = comment.trim();
    if ((action === "request-changes" || action === "reject") && !text) {
      setError(t("reviewCommentRequired"));
      return;
    }
    setError("");
    try {
      await onReview(report.id, action, text);
      setComment("");
    } catch {
      // Preserve the review comment when the request fails.
    }
  }
  return <div className="mt-4 space-y-2 border-t border-gray-100 pt-3 dark:border-gray-800">
    <label className="grid gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">{t("reviewComment")}<textarea maxLength={5000} rows={2} value={comment} onChange={(event) => { setComment(event.target.value); setError(""); }} className="w-full border border-gray-200 bg-white px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-950" /></label>
    {error && <p role="alert" className="text-xs text-error-600 dark:text-error-400">{error}</p>}
    <div className="flex flex-wrap gap-2"><Button size="sm" isLoading={pending} onClick={() => void review("approve")}>{t("approve")}</Button><Button variant="outline" size="sm" isLoading={pending} onClick={() => void review("request-changes")}>{t("requestChanges")}</Button><Button variant="danger" size="sm" isLoading={pending} onClick={() => void review("reject")}>{t("reject")}</Button></div>
  </div>;
}

export default function ProjectWorkReportsWorkspace({ projectId }: { projectId: string }) {
  const t = useTranslations("workNotes.reports");
  const common = useTranslations("workNotes");
  const format = useFormatter();
  const [filter, setFilter] = useState<WorkReportStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [frequency, setFrequency] = useState<ReportFrequency | null>(null);
  const [isConfirmingSchedule, setIsConfirmingSchedule] = useState(false);
  const [pendingReportId, setPendingReportId] = useState("");
  const [editingReportId, setEditingReportId] = useState("");
  const settings = useWorkReportSettingsQuery(projectId);
  const reports = useWorkReportsQuery(projectId, filter, page);
  const currentReports = useWorkReportsQuery(projectId, "ALL", 1);
  const currentTime = Date.now();
  const currentReport = currentReports.data?.data.find((report) => report.permissions.canEdit && Date.parse(report.periodStart) <= currentTime && currentTime < Date.parse(report.periodEnd));
  const settingsMutation = useWorkNotesMutation((value: ReportFrequency) => workNotesApi.updateReportSettings(projectId, value), [workNoteKeys.settings(projectId), workNoteKeys.project(projectId)]);
  const saveReport = useWorkNotesMutation((input: WorkReportInput) => workNotesApi.saveCurrentReport(projectId, input), [workNoteKeys.project(projectId)]);
  const updateReport = useWorkNotesMutation((value: Readonly<{ id: string; input: WorkReportInput }>) => workNotesApi.updateReport(projectId, value.id, value.input), [workNoteKeys.project(projectId)]);
  const reportAction = useWorkNotesMutation((input: Readonly<{ id: string; action: "submit" | "approve" | "request-changes" | "reject"; comment?: string }>) => workNotesApi.reportAction(projectId, input.id, input.action, input.comment), [workNoteKeys.project(projectId)]);

  async function saveReportDraft(report: WorkReport, input: WorkReportInput) {
    if (report.id === currentReport?.id) {
      return saveReport.mutateAsync(input);
    }
    return updateReport.mutateAsync({ id: report.id, input });
  }

  async function submitReport(report: WorkReport, input: WorkReportInput) {
    try {
      const saved = await saveReportDraft(report, input);
      await reportAction.mutateAsync({ id: saved.id, action: "submit" });
    } catch {
      // The editor shows the failed request and retains entered content.
    }
  }

  async function reviewReport(id: string, action: "approve" | "request-changes" | "reject", comment: string) {
    setPendingReportId(id);
    try {
      await reportAction.mutateAsync({ id, action, ...(comment ? { comment } : {}) });
    } finally {
      setPendingReportId("");
    }
  }

  function prepareScheduleChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsConfirmingSchedule(true);
  }

  async function applyScheduleChange() {
    if (!frequency) return;
    try {
      await settingsMutation.mutateAsync(frequency);
      setFrequency(null);
      setIsConfirmingSchedule(false);
    } catch {
      // Keep the user's selection available for retry.
    }
  }

  const reportError = saveReport.error instanceof Error ? saveReport.error.message : updateReport.error instanceof Error ? updateReport.error.message : reportAction.error instanceof Error ? reportAction.error.message : "";

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <WorkNotesPageHeader projectId={projectId} active="reports" />
      <div className="space-y-6">
        <section aria-labelledby="report-frequency-heading" className="border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><h2 id="report-frequency-heading" className="text-base font-semibold text-gray-900 dark:text-white/90">{t("settingsTitle")}</h2><p className="mt-1 text-sm text-gray-500 dark:text-gray-400">{t("description")}</p></div>{settings.data && <span className="border border-gray-200 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">{t(settings.data.frequency)}</span>}</div>
          {settings.isPending ? <p role="status" className="mt-4 text-sm text-gray-500 dark:text-gray-400">{common("loading")}</p> : settings.isError ? <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 border border-error-200 bg-error-50 px-3 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"><span>{settings.error instanceof Error ? settings.error.message : t("permissionDenied")}</span><Button variant="outline" size="sm" onClick={() => void settings.refetch()}>{common("retry")}</Button></div> : settings.data?.permissions.canConfigure && !settings.data.nextEffectiveAt ? (
            <form onSubmit={prepareScheduleChange} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="grid min-w-0 flex-1 gap-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">{t("frequency")}<select value={frequency ?? settings.data.frequency} onChange={(event) => { setFrequency(event.target.value as ReportFrequency); setIsConfirmingSchedule(false); }} className="h-10 w-full border border-gray-200 bg-white px-3 dark:border-gray-700 dark:bg-gray-950">{FREQUENCIES.map((value) => <option key={value} value={value}>{t(value)}</option>)}</select></label>
              <Button type="submit" size="sm" disabled={!frequency || frequency === settings.data.frequency} isLoading={settingsMutation.isPending}>{t("saveFrequency")}</Button>
            </form>
          ) : null}
          {settings.data?.permissions.canConfigure && isConfirmingSchedule && frequency && <div role="group" aria-label={t("scheduleConfirmationTitle")} className="mt-4 flex flex-col gap-3 border-s-2 border-brand-500 bg-brand-50 px-4 py-3 dark:bg-brand-500/10 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">{t("scheduleConfirmationTitle")}</h3><p className="mt-1 text-sm text-gray-700 dark:text-gray-300">{t("scheduleConfirmation", { frequency: t(frequency) })}</p></div><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => setIsConfirmingSchedule(false)}>{common("cancel")}</Button><Button type="button" size="sm" isLoading={settingsMutation.isPending} onClick={() => void applyScheduleChange()}>{t("confirmScheduleChange")}</Button></div></div>}
          {settings.data?.nextEffectiveAt && <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{t("scheduledChange", { date: format.dateTime(new Date(settings.data.nextEffectiveAt), { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }) })}</p>}
          {settingsMutation.isError && <p role="alert" className="mt-3 text-sm text-error-600 dark:text-error-400">{settingsMutation.error instanceof Error ? settingsMutation.error.message : t("permissionDenied")}</p>}
          {settingsMutation.isSuccess && <p role="status" className="mt-3 text-sm text-success-700 dark:text-success-400">{t("frequencySaved")}</p>}
          {settings.data?.history.length ? <details className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800"><summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300">{t("scheduleHistory")}</summary><ol className="mt-2 space-y-2">{settings.data.history.map((entry) => <li key={`${entry.effectiveAt}-${entry.frequency}`} className="flex flex-wrap justify-between gap-2 text-xs text-gray-600 dark:text-gray-400"><span>{t(entry.frequency)}</span><time className="tabular-nums">{new Date(entry.effectiveAt).toLocaleString()}</time></li>)}</ol></details> : null}
        </section>

        {reports.isPending ? <div role="status" aria-label={common("loading")} className="space-y-3">{[0, 1, 2].map((item) => <div key={item} className="h-28 animate-pulse border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900" />)}</div> : reports.isError ? <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-error-200 bg-error-50 px-4 py-4 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"><span>{reports.error instanceof Error ? reports.error.message : t("permissionDenied")}</span><Button variant="outline" size="sm" onClick={() => void reports.refetch()}>{common("retry")}</Button></div> : (
          <>
            {currentReport && currentReport.permissions.canEdit && <section aria-labelledby="current-work-report-heading" className="space-y-3"><h2 id="current-work-report-heading" className="text-base font-semibold text-gray-900 dark:text-white/90">{t("yourCurrentReport")}</h2><ReportEditor key={`${currentReport.id}-${currentReport.updatedAt}`} report={currentReport} isSaving={saveReport.isPending || updateReport.isPending} isSubmitting={reportAction.isPending} error={reportError} onSave={async (input) => { try { await saveReportDraft(currentReport, input); } catch { /* form preserves draft */ } }} onSubmit={(input) => submitReport(currentReport, input)} /></section>}
            {currentReports.isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"><span>{currentReports.error instanceof Error ? currentReports.error.message : t("permissionDenied")}</span><Button variant="outline" size="sm" onClick={() => void currentReports.refetch()}>{common("retry")}</Button></div>}
            {!currentReport && !currentReports.isPending && !currentReports.isError && <p className="border border-dashed border-gray-300 px-4 py-5 text-sm text-gray-600 dark:border-gray-700 dark:text-gray-300">{t("noCurrentReport")}</p>}
            <section aria-labelledby="report-list-heading" className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><h2 id="report-list-heading" className="text-base font-semibold text-gray-900 dark:text-white/90">{t("title")}</h2><label className="grid gap-1 text-xs font-medium text-gray-700 dark:text-gray-300">{t("filterLabel")}<select value={filter} onChange={(event) => { setFilter(event.target.value as WorkReportStatus | "ALL"); setPage(1); }} className="h-10 min-w-44 border border-gray-200 bg-white px-3 text-sm dark:border-gray-700 dark:bg-gray-950">{STATUSES.map((status) => <option key={status} value={status}>{status === "ALL" ? t("allStatuses") : t(`status.${status}`)}</option>)}</select></label></div>
              {reportAction.isError && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"><span>{reportAction.error instanceof Error ? reportAction.error.message : t("permissionDenied")}</span><Button variant="outline" size="sm" onClick={() => { reportAction.reset(); void reports.refetch(); }}>{common("retry")}</Button></div>}
              {reportAction.isSuccess && <p role="status" className="text-sm text-success-700 dark:text-success-400">{t("actionSuccess")}</p>}
          {reports.data?.data.length ? <ul className="space-y-3">{reports.data.data.map((report) => <li key={report.id} className="min-w-0 border border-gray-200 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><h3 className="break-words text-sm font-semibold text-gray-900 dark:text-white/90">{report.memberName}</h3><p className="mt-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">{t("period", { start: format.dateTime(new Date(report.periodStart), { dateStyle: "medium", timeZone: "UTC" }), end: format.dateTime(new Date(report.periodEnd), { dateStyle: "medium", timeZone: "UTC" }) })} · {t("due", { date: format.dateTime(new Date(report.dueAt), { dateStyle: "medium", timeZone: "UTC" }) })}</p></div><div className="flex items-center gap-2"><span className="shrink-0 border border-gray-200 px-2 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">{t(`status.${report.status}`)}</span>{report.permissions.canEdit && report.id !== currentReport?.id && <Button type="button" variant="outline" size="sm" onClick={() => setEditingReportId((current) => current === report.id ? "" : report.id)}>{editingReportId === report.id ? t("closeEditor") : t("editReport")}</Button>}</div></div>{editingReportId === report.id && report.permissions.canEdit && <div className="mt-4"><ReportEditor key={`${report.id}-${report.updatedAt}`} report={report} isSaving={updateReport.isPending} isSubmitting={reportAction.isPending} error={reportError} onSave={async (input) => { try { await saveReportDraft(report, input); } catch { /* form preserves draft */ } }} onSubmit={(input) => submitReport(report, input)} onClose={() => setEditingReportId("")} /></div>}<dl className="mt-4 grid gap-3 md:grid-cols-2">{(["accomplishments", "approach", "reason", "blockers", "nextSteps"] as const).map((field) => <div key={field} className="min-w-0"><dt className="text-xs font-semibold text-gray-600 dark:text-gray-300">{t(field)}</dt><dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700 dark:text-gray-300">{report[field] || common("noValue")}</dd></div>)}</dl>{report.reviewComment && <p className="mt-3 border-s-2 border-warning-500 bg-warning-50 px-3 py-2 text-sm text-warning-900 dark:bg-warning-500/10 dark:text-warning-200"><strong>{t("reviewComment")}:</strong> {report.reviewComment}</p>}{report.permissions.canReview && <ReportReviewActions report={report} pending={reportAction.isPending && pendingReportId === report.id} onReview={reviewReport} />}</li>)}</ul> : <div className="border border-dashed border-gray-300 bg-white px-5 py-12 text-center dark:border-gray-700 dark:bg-gray-900"><h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">{t("empty")}</h3></div>}
              {reports.data && reports.data.pagination.totalPages > 1 && <div className="flex items-center justify-between border-t border-gray-200 pt-4 text-sm dark:border-gray-800"><span className="tabular-nums text-gray-500 dark:text-gray-400">{common("pagination.total", { count: reports.data.pagination.totalItems })}</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>{common("pagination.previous")}</Button><Button variant="outline" size="sm" disabled={page >= reports.data.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>{common("pagination.next")}</Button></div></div>}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
