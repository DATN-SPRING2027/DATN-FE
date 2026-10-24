"use client";

import { useRef, useState, type FormEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import {
  BackgroundRefreshError,
  UpdatingStatus,
} from "@/components/ui/loading/AsyncStatus";
import {
  AlertIcon,
  CalenderIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  DocsIcon,
  DownloadIcon,
  FileIcon,
  GroupIcon,
  LockIcon,
  PencilIcon,
  PlatformBellIcon,
  TimeIcon,
  UploadIcon,
  UserCircleIcon,
} from "@/icons";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import WorkNotesPageHeader from "./WorkNotesPageHeader";
import {
  REPORT_FREQUENCIES,
  useDocumentsQuery,
  useWorkNotesMutation,
  useWorkReportSettingsQuery,
  useWorkReportsQuery,
  workNoteKeys,
  workNotesApi,
  type ProjectDocumentSummary,
  type ReportFrequency,
  type WorkReport,
  type WorkReportInput,
  type WorkReportScope,
  type WorkReportStatus,
} from "@/lib/queries/work-notes/useWorkNotes";

const FREQUENCIES: readonly ReportFrequency[] = REPORT_FREQUENCIES;
const STATUSES: readonly (WorkReportStatus | "ALL")[] = [
  "ALL",
  "DRAFT",
  "PENDING_REVIEW",
  "APPROVED",
  "CHANGES_REQUESTED",
  "REJECTED",
  "OVERDUE",
];

const FIELD_CLASS =
  "w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-400 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder:text-gray-500";

const DOCUMENT_FILE_ACCEPT =
  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.rtf,.txt,.md,.markdown,.csv,.tsv,.json,.yaml,.yml,.xml,.drawio,.sql,.png,.jpg,.jpeg,.webp";

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadgeClasses(status: WorkReportStatus): string {
  switch (status) {
    case "APPROVED":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300";
    case "PENDING_REVIEW":
      return "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300";
    case "CHANGES_REQUESTED":
      return "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300";
    case "REJECTED":
    case "OVERDUE":
      return "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300";
    case "DRAFT":
    default:
      return "border-gray-200 bg-gray-100 text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function ReportEditor({
  report,
  availableDocuments,
  isSaving,
  isSubmitting,
  error,
  onSave,
  onSubmit,
  onDownloadFile,
  onClose,
}: {
  report: WorkReport;
  availableDocuments: readonly ProjectDocumentSummary[];
  isSaving: boolean;
  isSubmitting: boolean;
  error: string;
  onSave: (input: WorkReportInput, file: File | null) => Promise<void>;
  onSubmit: (input: WorkReportInput, file: File | null) => Promise<void>;
  onDownloadFile: (report: WorkReport) => Promise<void>;
  onClose?: () => void;
}) {
  const t = useTranslations("workNotes.reports");
  const format = useFormatter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<WorkReportInput>({
    accomplishments: report.accomplishments,
    approach: report.approach,
    reason: report.reason,
    blockers: report.blockers ?? "",
    nextSteps: report.nextSteps ?? "",
    documentIds: report.documentIds ?? [],
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validationError, setValidationError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>, saveOnly: boolean) {
    event.preventDefault();
    await persist(saveOnly);
  }

  async function persist(saveOnly: boolean) {
    const cleaned: WorkReportInput = {
      accomplishments: form.accomplishments.trim(),
      approach: form.approach.trim(),
      reason: form.reason.trim(),
      blockers: form.blockers?.trim() ?? "",
      nextSteps: form.nextSteps?.trim() ?? "",
      ...(form.documentIds && form.documentIds.length > 0
        ? { documentIds: form.documentIds }
        : {}),
    };
    if (!cleaned.accomplishments || !cleaned.approach || !cleaned.reason) {
      setValidationError(t("coreRequired"));
      return;
    }
    setValidationError("");
    await (saveOnly
      ? onSave(cleaned, selectedFile)
      : onSubmit(cleaned, selectedFile));
    setSelectedFile(null);
  }

  function toggleDocumentLink(docId: string) {
    setForm((current) => {
      const currentIds = current.documentIds ?? [];
      const nextIds = currentIds.includes(docId)
        ? currentIds.filter((id) => id !== docId)
        : [...currentIds, docId];
      return { ...current, documentIds: nextIds };
    });
  }

  return (
    <form
      onSubmit={(event) => void submit(event, true)}
      className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 bg-gray-50/70 px-4 py-3.5 dark:border-gray-800 dark:bg-gray-800/50 sm:px-5">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
              {t("reportEditorTitle")}
            </h3>
            <span
              className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClasses(report.status)}`}
            >
              {t(`status.${report.status}`)}
            </span>
            <span className="inline-flex items-center rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs font-medium tabular-nums text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
              {t(`daysFull.${report.frequency}`)}
            </span>
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs tabular-nums text-gray-500 dark:text-gray-400">
            <CalenderIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span>
              {t("period", {
                start: format.dateTime(new Date(report.periodStart), {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }),
                end: format.dateTime(new Date(report.periodEnd), {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }),
              })}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {t("due", {
                date: format.dateTime(new Date(report.dueAt), {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }),
              })}
            </span>
          </p>
        </div>
        {onClose && (
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t("closeEditor")}
          </Button>
        )}
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
          <span>
            {t("accomplishments")}
            <span className="ms-0.5 text-error-600">*</span>
          </span>
          <textarea
            required
            maxLength={10000}
            rows={4}
            placeholder={t("accomplishmentsPlaceholder")}
            value={form.accomplishments}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                accomplishments: event.target.value,
              }))
            }
            className={`${FIELD_CLASS} resize-y`}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
            <span>
              {t("approach")}
              <span className="ms-0.5 text-error-600">*</span>
            </span>
            <textarea
              required
              maxLength={10000}
              rows={3}
              placeholder={t("approachPlaceholder")}
              value={form.approach}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  approach: event.target.value,
                }))
              }
              className={`${FIELD_CLASS} resize-y`}
            />
          </label>

          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
            <span>
              {t("reason")}
              <span className="ms-0.5 text-error-600">*</span>
            </span>
            <textarea
              required
              maxLength={5000}
              rows={3}
              placeholder={t("reasonPlaceholder")}
              value={form.reason}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              className={`${FIELD_CLASS} resize-y`}
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
            <span>{t("blockers")}</span>
            <textarea
              maxLength={5000}
              rows={2}
              placeholder={t("blockersPlaceholder")}
              value={form.blockers ?? ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  blockers: event.target.value,
                }))
              }
              className={`${FIELD_CLASS} resize-y`}
            />
          </label>

          <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
            <span>{t("nextSteps")}</span>
            <textarea
              maxLength={5000}
              rows={2}
              placeholder={t("nextStepsPlaceholder")}
              value={form.nextSteps ?? ""}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  nextSteps: event.target.value,
                }))
              }
              className={`${FIELD_CLASS} resize-y`}
            />
          </label>
        </div>

        <div className="grid gap-4 rounded-xl border border-gray-200 bg-gray-50/60 p-3.5 dark:border-gray-800 dark:bg-gray-950/60 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200">
                <UploadIcon className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                {t("attachmentLabel")}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("attachmentHint")}
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept={DOCUMENT_FILE_ACCEPT}
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);
              }}
            />

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadIcon className="me-1.5 h-3.5 w-3.5" />
                {selectedFile || report.file
                  ? t("replaceFile")
                  : t("selectFile")}
              </Button>

              {selectedFile && (
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300">
                  <FileIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="max-w-44 truncate">{selectedFile.name}</span>
                  <span className="tabular-nums text-[11px] opacity-80">
                    ({formatFileSize(selectedFile.size)})
                  </span>
                  <button
                    type="button"
                    aria-label={t("removeSelectedFile")}
                    onClick={() => {
                      setSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="ms-1 rounded p-0.5 hover:bg-brand-100 dark:hover:bg-brand-500/20"
                  >
                    <CloseIcon className="h-3 w-3" />
                  </button>
                </span>
              )}

              {!selectedFile && report.file && (
                <button
                  type="button"
                  onClick={() => void onDownloadFile(report)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                  <DownloadIcon className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
                  <span className="max-w-44 truncate">{report.file.name}</span>
                  <span className="tabular-nums text-[11px] text-gray-400">
                    ({formatFileSize(report.file.size)})
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2 border-t border-gray-200/70 pt-3 md:border-s md:border-t-0 md:ps-4 md:pt-0 dark:border-gray-800">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200">
              <DocsIcon className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
              {t("linkedDocumentsLabel")}
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t("linkedDocumentsHint")}
            </p>

            {availableDocuments.length > 0 ? (
              <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto pt-1">
                {availableDocuments.map((doc) => {
                  const selected = Boolean(
                    form.documentIds?.includes(doc.id),
                  );
                  return (
                    <button
                      key={doc.id}
                      type="button"
                      onClick={() => toggleDocumentLink(doc.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
                        selected
                          ? "border-brand-500 bg-brand-50 text-brand-700 dark:border-brand-400 dark:bg-brand-500/20 dark:text-brand-200"
                          : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                      }`}
                    >
                      <DocsIcon className="h-3 w-3 shrink-0" />
                      <span className="max-w-40 truncate">{doc.title}</span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="pt-1 text-xs text-gray-400 dark:text-gray-500">
                {t("noProjectDocuments")}
              </p>
            )}
          </div>
        </div>

        {(validationError || error) && (
          <div
            role="alert"
            className="flex items-center gap-2 rounded-lg border border-error-200 bg-error-50 px-3.5 py-2.5 text-xs font-medium text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
          >
            <AlertIcon className="h-4 w-4 shrink-0" />
            <span>{validationError || error}</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/70 px-4 py-3 dark:border-gray-800 dark:bg-gray-800/40 sm:px-5">
        <Button
          type="submit"
          variant="outline"
          size="sm"
          isLoading={isSaving}
        >
          {t("saveDraft")}
        </Button>
        <Button
          type="button"
          size="sm"
          isLoading={isSubmitting}
          onClick={() => void persist(false)}
        >
          {t("submit")}
        </Button>
      </div>
    </form>
  );
}

function ReportReviewActions({
  report,
  pending,
  onReview,
}: {
  report: WorkReport;
  pending: boolean;
  onReview: (
    reportId: string,
    action: "approve" | "request-changes" | "reject",
    comment: string,
  ) => Promise<void>;
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

  return (
    <div className="mt-4 space-y-2.5 rounded-xl border border-gray-200 bg-gray-50/70 p-3.5 dark:border-gray-800 dark:bg-gray-950/60">
      <label className="grid gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
        {t("reviewComment")}
        <textarea
          maxLength={5000}
          rows={2}
          placeholder={t("reviewCommentPlaceholder")}
          value={comment}
          onChange={(event) => {
            setComment(event.target.value);
            setError("");
          }}
          className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-800 outline-none focus:border-brand-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        />
      </label>
      {error && (
        <p role="alert" className="text-xs text-error-600 dark:text-error-400">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          isLoading={pending}
          onClick={() => void review("approve")}
        >
          {t("approve")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          isLoading={pending}
          onClick={() => void review("request-changes")}
        >
          {t("requestChanges")}
        </Button>
        <Button
          variant="danger"
          size="sm"
          isLoading={pending}
          onClick={() => void review("reject")}
        >
          {t("reject")}
        </Button>
      </div>
    </div>
  );
}

export default function ProjectWorkReportsWorkspace({
  projectId,
}: {
  projectId: string;
}) {
  const t = useTranslations("workNotes.reports");
  const common = useTranslations("workNotes");
  const format = useFormatter();

  const [activeScope, setActiveScope] = useState<WorkReportScope>("MEMBER");
  const [filter, setFilter] = useState<WorkReportStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [frequency, setFrequency] = useState<ReportFrequency | null>(null);
  const [isConfirmingSchedule, setIsConfirmingSchedule] = useState(false);
  const [pendingReportId, setPendingReportId] = useState("");
  const [editingReportId, setEditingReportId] = useState("");
  const [expandedReportIds, setExpandedReportIds] = useState<
    Record<string, boolean>
  >({});
  const [downloadingReportId, setDownloadingReportId] = useState("");

  const settings = useWorkReportSettingsQuery(projectId, activeScope);
  const reports = useWorkReportsQuery(projectId, filter, page, activeScope);
  const currentReports = useWorkReportsQuery(projectId, "ALL", 1, activeScope);
  const documentsQuery = useDocumentsQuery(projectId, "ALL", 1);

  const settingsAccessLost = isAccessOrResourceUnavailableError(settings.error);
  const reportsAccessLost = isAccessOrResourceUnavailableError(reports.error);
  const currentReportsAccessLost = isAccessOrResourceUnavailableError(
    currentReports.error,
  );
  const settingsData = settingsAccessLost ? undefined : settings.data;
  const reportsData = reportsAccessLost ? undefined : reports.data;
  const currentReportsData = currentReportsAccessLost
    ? undefined
    : currentReports.data;

  const actorRole = settingsData?.actorRole;
  const canSwitchLeaderTier =
    actorRole === "LEADER" ||
    actorRole === "MANAGER" ||
    Boolean(settingsData?.permissions.canConfigure);

  const currentTime = Date.now();
  const currentReport = currentReportsData?.data.find(
    (report) =>
      report.permissions.canEdit &&
      Date.parse(report.periodStart) <= currentTime &&
      currentTime < Date.parse(report.periodEnd),
  );

  const settingsMutation = useWorkNotesMutation(
    (value: ReportFrequency) =>
      workNotesApi.updateReportSettings(projectId, value, activeScope),
    [
      workNoteKeys.settings(projectId, activeScope),
      workNoteKeys.project(projectId),
    ],
  );
  const saveReport = useWorkNotesMutation(
    (input: WorkReportInput) =>
      workNotesApi.saveCurrentReport(projectId, input, activeScope),
    [workNoteKeys.project(projectId)],
  );
  const updateReport = useWorkNotesMutation(
    (value: Readonly<{ id: string; input: WorkReportInput }>) =>
      workNotesApi.updateReport(projectId, value.id, value.input),
    [workNoteKeys.project(projectId)],
  );
  const uploadFileMutation = useWorkNotesMutation(
    (value: Readonly<{ id: string; file: File }>) =>
      workNotesApi.uploadReportFile(projectId, value.id, value.file),
    [workNoteKeys.project(projectId)],
  );
  const reportAction = useWorkNotesMutation(
    (
      input: Readonly<{
        id: string;
        action: "submit" | "approve" | "request-changes" | "reject";
        comment?: string;
      }>,
    ) =>
      workNotesApi.reportAction(
        projectId,
        input.id,
        input.action,
        input.comment,
      ),
    [workNoteKeys.project(projectId)],
  );

  const availableDocuments = documentsQuery.data?.data ?? [];
  const docTitleMap = new Map(
    availableDocuments.map((doc) => [doc.id, doc.title]),
  );

  async function saveReportDraft(
    report: WorkReport,
    input: WorkReportInput,
    file: File | null,
  ) {
    saveReport.reset();
    updateReport.reset();
    uploadFileMutation.reset();
    reportAction.reset();
    const saved =
      report.id === currentReport?.id
        ? await saveReport.mutateAsync(input)
        : await updateReport.mutateAsync({ id: report.id, input });
    if (file) {
      return uploadFileMutation.mutateAsync({ id: saved.id, file });
    }
    return saved;
  }

  async function submitReport(
    report: WorkReport,
    input: WorkReportInput,
    file: File | null,
  ) {
    try {
      const saved = await saveReportDraft(report, input, file);
      await reportAction.mutateAsync({ id: saved.id, action: "submit" });
    } catch {
      // The editor shows the failed request and retains entered content.
    }
  }

  async function reviewReport(
    id: string,
    action: "approve" | "request-changes" | "reject",
    comment: string,
  ) {
    reportAction.reset();
    setPendingReportId(id);
    try {
      await reportAction.mutateAsync({
        id,
        action,
        ...(comment ? { comment } : {}),
      });
    } finally {
      setPendingReportId("");
    }
  }

  async function handleDownloadReportFile(report: WorkReport) {
    if (!report.file) return;
    setDownloadingReportId(report.id);
    try {
      const blob = await workNotesApi.downloadReportFile(projectId, report.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = report.file.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingReportId("");
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

  function toggleReportDetails(reportId: string) {
    setExpandedReportIds((current) => ({
      ...current,
      [reportId]: !current[reportId],
    }));
  }

  const allScopeReports = currentReportsData?.data ?? [];
  const totalReportsCount =
    currentReportsData?.pagination.totalItems ?? allScopeReports.length;
  const pendingReviewCount = allScopeReports.filter(
    (r) => r.status === "PENDING_REVIEW",
  ).length;
  const approvedCount = allScopeReports.filter(
    (r) => r.status === "APPROVED",
  ).length;
  const attentionCount = allScopeReports.filter(
    (r) =>
      r.status === "OVERDUE" ||
      r.status === "DRAFT" ||
      r.status === "CHANGES_REQUESTED",
  ).length;
  const overdueCount = allScopeReports.filter(
    (r) => r.status === "OVERDUE",
  ).length;

  const reportError =
    saveReport.error instanceof Error
      ? saveReport.error.message
      : updateReport.error instanceof Error
        ? updateReport.error.message
        : uploadFileMutation.error instanceof Error
          ? uploadFileMutation.error.message
          : reportAction.error instanceof Error
            ? reportAction.error.message
            : "";

  const activeFrequency = settingsData?.frequency ?? "WEEKLY";
  const selectedFrequency = frequency ?? activeFrequency;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <WorkNotesPageHeader projectId={projectId} active="reports" />

      <div className="space-y-6">
        {canSwitchLeaderTier && (
          <nav
            aria-label={t("title")}
            className="grid gap-3 sm:grid-cols-2"
          >
            <button
              type="button"
              onClick={() => {
                setActiveScope("MEMBER");
                setFrequency(null);
                setIsConfirmingSchedule(false);
                setPage(1);
              }}
              className={`flex items-start gap-3.5 rounded-xl border p-4 text-start transition ${
                activeScope === "MEMBER"
                  ? "border-brand-500 bg-brand-50/70 shadow-theme-xs dark:border-brand-400 dark:bg-brand-500/10"
                  : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
              }`}
            >
              <span
                className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  activeScope === "MEMBER"
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                <GroupIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white/90">
                    {t("tabs.memberReports")}
                  </span>
                  {settingsData && activeScope === "MEMBER" && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-brand-700 shadow-2xs dark:bg-gray-800 dark:text-brand-300">
                      {t(`daysShort.${settingsData.frequency}`)}
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                  {t("tabs.memberReportsDesc")}
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveScope("LEADER");
                setFrequency(null);
                setIsConfirmingSchedule(false);
                setPage(1);
              }}
              className={`flex items-start gap-3.5 rounded-xl border p-4 text-start transition ${
                activeScope === "LEADER"
                  ? "border-brand-500 bg-brand-50/70 shadow-theme-xs dark:border-brand-400 dark:bg-brand-500/10"
                  : "border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900 dark:hover:border-gray-700"
              }`}
            >
              <span
                className={`mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                  activeScope === "LEADER"
                    ? "bg-brand-600 text-white"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                <UserCircleIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-white/90">
                    {actorRole === "MANAGER"
                      ? t("tabs.managerLeaderReports")
                      : t("tabs.leaderMyReport")}
                  </span>
                  {settingsData?.leaderSettings && (
                    <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium tabular-nums text-brand-700 shadow-2xs dark:bg-gray-800 dark:text-brand-300">
                      {t(
                        `daysShort.${settingsData.leaderSettings.frequency}`,
                      )}
                    </span>
                  )}
                </span>
                <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
                  {actorRole === "MANAGER"
                    ? t("tabs.managerLeaderReportsDesc")
                    : t("tabs.leaderMyReportDesc")}
                </span>
              </span>
            </button>
          </nav>
        )}

        <section
          aria-labelledby="report-frequency-heading"
          className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
        >
          <div className="p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="report-frequency-heading"
                    className="text-base font-semibold text-gray-900 dark:text-white/90"
                  >
                    {activeScope === "LEADER" && actorRole === "MANAGER"
                      ? t("leaderScheduleSettingsTitle")
                      : t("settingsTitle")}
                  </h2>
                  {actorRole && (
                    <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {t(`roleBadge.${actorRole}`)}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <PlatformBellIcon className="h-3 w-3" />
                    {t("notificationLinkedBadge")}
                  </span>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {activeScope === "LEADER" && actorRole === "MANAGER"
                    ? t("leaderScheduleSettingsDesc")
                    : t("description")}
                </p>
              </div>

              {settingsData && (
                <div className="flex shrink-0 items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-semibold tabular-nums text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300">
                    <CalenderIcon className="h-3.5 w-3.5" />
                    {t(settingsData.frequency)}
                  </span>
                </div>
              )}
            </div>

            {settingsData !== undefined &&
              !settingsAccessLost &&
              (settings.isFetching || settings.isRefetchError) && (
                <div className="mt-4">
                  {settings.isFetching && (
                    <UpdatingStatus>{common("loading")}</UpdatingStatus>
                  )}
                  {settings.isRefetchError && (
                    <BackgroundRefreshError
                      retryLabel={common("retry")}
                      onRetry={() => void settings.refetch()}
                    >
                      {common("updateFailed")}
                    </BackgroundRefreshError>
                  )}
                </div>
              )}

            {settings.isPending && !settingsData ? (
              <p
                role="status"
                className="mt-4 text-sm text-gray-500 dark:text-gray-400"
              >
                {common("loading")}
              </p>
            ) : settings.isError && !settingsData ? (
              <div
                role="alert"
                className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error-200 bg-error-50 px-3.5 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
              >
                <span>
                  {settings.error instanceof Error
                    ? settings.error.message
                    : t("permissionDenied")}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void settings.refetch()}
                >
                  {common("retry")}
                </Button>
              </div>
            ) : settingsData?.permissions.canConfigure ? (
              <div className="mt-4 space-y-3 rounded-xl border border-gray-100 bg-gray-50/70 p-3.5 dark:border-gray-800 dark:bg-gray-950/50 sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    {t("flexibleScheduleHint")}
                  </span>
                </div>

                <div
                  role="group"
                  aria-label={t("flexibleScheduleHint")}
                  className="grid grid-cols-7 gap-1.5 sm:gap-2"
                >
                  {FREQUENCIES.map((value) => {
                    const isSelected = selectedFrequency === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setFrequency(value);
                          setIsConfirmingSchedule(false);
                        }}
                        className={`flex flex-col items-center justify-center rounded-lg border px-2 py-2 text-center transition ${
                          isSelected
                            ? "border-brand-600 bg-brand-600 text-white shadow-2xs dark:border-brand-500 dark:bg-brand-500"
                            : "border-gray-200 bg-white text-gray-700 hover:border-brand-300 hover:bg-brand-50/40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                        }`}
                      >
                        <span className="text-xs font-bold tabular-nums sm:text-sm">
                          {t(`daysShort.${value}`)}
                        </span>
                        <span
                          className={`mt-0.5 hidden truncate text-[11px] sm:block ${
                            isSelected
                              ? "text-white/90"
                              : "text-gray-500 dark:text-gray-400"
                          }`}
                        >
                          {t(value)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <form
                  onSubmit={prepareScheduleChange}
                  className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-end"
                >
                  <label className="grid min-w-0 flex-1 gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {t("frequency")}
                    <select
                      value={selectedFrequency}
                      onChange={(event) => {
                        setFrequency(event.target.value as ReportFrequency);
                        setIsConfirmingSchedule(false);
                      }}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                    >
                      {FREQUENCIES.map((value) => (
                        <option key={value} value={value}>
                          {t(value)} ({t(`daysFull.${value}`)})
                        </option>
                      ))}
                    </select>
                  </label>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={
                      !frequency || frequency === settingsData.frequency
                    }
                    isLoading={settingsMutation.isPending}
                  >
                    {t("saveFrequency")}
                  </Button>
                </form>
              </div>
            ) : settingsData ? (
              <div className="mt-4 flex flex-col gap-3 rounded-xl border border-brand-200/80 bg-brand-50/50 p-4 dark:border-brand-500/25 dark:bg-brand-500/10 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600/10 text-brand-700 dark:bg-brand-400/15 dark:text-brand-300">
                    <LockIcon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                      {activeScope === "LEADER"
                        ? t("mandatoryLeaderScheduleLabel")
                        : t("mandatoryScheduleLabel")}
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-300">
                      {activeScope === "LEADER"
                        ? t("mandatoryLeaderScheduleDesc")
                        : t("mandatoryScheduleDesc")}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="inline-flex items-center rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-xs font-bold tabular-nums text-brand-700 shadow-2xs dark:border-brand-500/40 dark:bg-gray-900 dark:text-brand-300">
                    {t(`daysFull.${settingsData.frequency}`)}
                  </span>
                </div>
              </div>
            ) : null}

            {settingsData?.permissions.canConfigure &&
              isConfirmingSchedule &&
              frequency && (
                <div
                  role="group"
                  aria-label={t("scheduleConfirmationTitle")}
                  className="mt-4 flex flex-col gap-3 rounded-lg border-s-4 border-brand-500 bg-brand-50 px-4 py-3 dark:bg-brand-500/10 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white/90">
                      {t("scheduleConfirmationTitle")}
                    </h3>
                    <p className="mt-1 text-sm text-gray-700 dark:text-gray-300">
                      {t("scheduleConfirmation", { frequency: t(frequency) })}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setIsConfirmingSchedule(false)}
                    >
                      {common("cancel")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      isLoading={settingsMutation.isPending}
                      onClick={() => void applyScheduleChange()}
                    >
                      {t("confirmScheduleChange")}
                    </Button>
                  </div>
                </div>
              )}

            {settingsData?.nextEffectiveAt && (
              <p className="mt-3 text-xs tabular-nums text-gray-600 dark:text-gray-300">
                {t("scheduledChange", {
                  date: format.dateTime(
                    new Date(settingsData.nextEffectiveAt),
                    {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: "UTC",
                    },
                  ),
                })}
              </p>
            )}
            {settingsMutation.isError && (
              <p
                role="alert"
                className="mt-3 text-sm text-error-600 dark:text-error-400"
              >
                {settingsMutation.error instanceof Error
                  ? settingsMutation.error.message
                  : t("permissionDenied")}
              </p>
            )}
            {settingsMutation.isSuccess && (
              <p
                role="status"
                className="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-400"
              >
                {t("frequencySaved")}
              </p>
            )}

            {settingsData?.history.length ? (
              <details className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
                <summary className="cursor-pointer text-xs font-semibold text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200">
                  {t("scheduleHistory")} ({settingsData.history.length})
                </summary>
                <ol className="mt-2.5 space-y-1.5">
                  {settingsData.history.map((entry, idx) => (
                    <li
                      key={`${entry.effectiveAt}-${entry.frequency}-${idx}`}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-gray-50 px-3 py-1.5 text-xs text-gray-600 dark:bg-gray-800/60 dark:text-gray-400"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200">
                        {t(entry.frequency)} ({t(`daysFull.${entry.frequency}`)})
                      </span>
                      <time className="tabular-nums">
                        {format.dateTime(new Date(entry.effectiveAt), {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "UTC",
                        })}
                      </time>
                    </li>
                  ))}
                </ol>
              </details>
            ) : null}
          </div>
        </section>

        <section
          aria-label={t("title")}
          className="grid grid-cols-2 gap-3 lg:grid-cols-4"
        >
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("kpi.total")}
              </span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300">
                <FileIcon className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900 dark:text-white">
              {totalReportsCount}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("kpi.pendingReview")}
              </span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300">
                <TimeIcon className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-amber-600 dark:text-amber-400">
              {pendingReviewCount}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("kpi.approved")}
              </span>
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                <CheckCircleIcon className="h-3.5 w-3.5" />
              </span>
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
              {approvedCount}
            </p>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-2xs dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {t("kpi.attention")}
              </span>
              <span
                className={`inline-flex h-7 w-7 items-center justify-center rounded-lg ${
                  overdueCount > 0
                    ? "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                }`}
              >
                <AlertIcon className="h-3.5 w-3.5" />
              </span>
            </div>
            <p
              className={`mt-2 text-2xl font-bold tabular-nums ${
                overdueCount > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-gray-900 dark:text-white"
              }`}
            >
              {attentionCount}
            </p>
          </div>
        </section>

        {reportsData !== undefined &&
          !reportsAccessLost &&
          (reports.isFetching || reports.isRefetchError) && (
            <div>
              {reports.isFetching && (
                <UpdatingStatus>{common("loading")}</UpdatingStatus>
              )}
              {reports.isRefetchError && (
                <BackgroundRefreshError
                  retryLabel={common("retry")}
                  onRetry={() => void reports.refetch()}
                >
                  {common("updateFailed")}
                </BackgroundRefreshError>
              )}
            </div>
          )}

        {reports.isPending && !reportsData ? (
          <div
            role="status"
            aria-label={common("loading")}
            className="space-y-3"
          >
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-28 animate-pulse rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
              />
            ))}
          </div>
        ) : reports.isError && !reportsData ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-4 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
          >
            <span>
              {reports.error instanceof Error
                ? reports.error.message
                : t("permissionDenied")}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void reports.refetch()}
            >
              {common("retry")}
            </Button>
          </div>
        ) : (
          <>
            {currentReport && currentReport.permissions.canEdit && (
              <section
                aria-labelledby="current-work-report-heading"
                className="space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2
                    id="current-work-report-heading"
                    className="text-base font-semibold text-gray-900 dark:text-white/90"
                  >
                    {t("yourCurrentReport")}
                  </h2>
                </div>
                <ReportEditor
                  key={`${currentReport.id}-${currentReport.updatedAt}`}
                  report={currentReport}
                  availableDocuments={availableDocuments}
                  isSaving={
                    saveReport.isPending ||
                    updateReport.isPending ||
                    uploadFileMutation.isPending
                  }
                  isSubmitting={reportAction.isPending}
                  error={reportError}
                  onSave={async (input, file) => {
                    try {
                      await saveReportDraft(currentReport, input, file);
                    } catch {
                      /* form preserves draft */
                    }
                  }}
                  onSubmit={(input, file) =>
                    submitReport(currentReport, input, file)
                  }
                  onDownloadFile={handleDownloadReportFile}
                />
              </section>
            )}

            {currentReports.isPending && !currentReportsData && (
              <p
                role="status"
                className="text-sm text-gray-500 dark:text-gray-400"
              >
                {common("loading")}
              </p>
            )}
            {currentReportsData !== undefined &&
              !currentReportsAccessLost &&
              (currentReports.isFetching || currentReports.isRefetchError) && (
                <div className="mb-3">
                  {currentReports.isFetching && (
                    <UpdatingStatus>{common("loading")}</UpdatingStatus>
                  )}
                  {currentReports.isRefetchError && (
                    <BackgroundRefreshError
                      retryLabel={common("retry")}
                      onRetry={() => void currentReports.refetch()}
                    >
                      {common("updateFailed")}
                    </BackgroundRefreshError>
                  )}
                </div>
              )}

            {currentReports.isError && !currentReportsData && (
              <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
              >
                <span>
                  {currentReports.error instanceof Error
                    ? currentReports.error.message
                    : t("permissionDenied")}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void currentReports.refetch()}
                >
                  {common("retry")}
                </Button>
              </div>
            )}

            {!currentReport &&
              !currentReports.isPending &&
              !currentReports.isError && (
                <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50/70 px-4 py-3.5 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-300">
                  <CalenderIcon className="h-4 w-4 shrink-0 text-gray-400" />
                  <span>{t("noCurrentReport")}</span>
                </div>
              )}

            <section aria-labelledby="report-list-heading" className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2
                    id="report-list-heading"
                    className="text-base font-semibold text-gray-900 dark:text-white/90"
                  >
                    {t("title")}
                  </h2>
                </div>
                <label className="grid gap-1 text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {t("filterLabel")}
                  <select
                    value={filter}
                    onChange={(event) => {
                      setFilter(event.target.value as WorkReportStatus | "ALL");
                      setPage(1);
                    }}
                    className="h-10 min-w-48 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                  >
                    {STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status === "ALL"
                          ? t("allStatuses")
                          : t(`status.${status}`)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {reportAction.isError && (
                <div
                  role="alert"
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
                >
                  <span>
                    {reportAction.error instanceof Error
                      ? reportAction.error.message
                      : t("permissionDenied")}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      reportAction.reset();
                      void reports.refetch();
                    }}
                  >
                    {common("retry")}
                  </Button>
                </div>
              )}
              {reportAction.isSuccess && (
                <p
                  role="status"
                  className="text-sm font-medium text-emerald-700 dark:text-emerald-400"
                >
                  {t("actionSuccess")}
                </p>
              )}

              {reportsData?.data.length ? (
                <ul className="space-y-3">
                  {reportsData.data.map((report) => {
                    const hasContent = Boolean(
                      report.accomplishments.trim() ||
                        report.approach.trim() ||
                        report.reason.trim() ||
                        report.blockers?.trim() ||
                        report.nextSteps?.trim() ||
                        report.file ||
                        (report.documentIds && report.documentIds.length > 0),
                    );
                    const isExpanded = Boolean(expandedReportIds[report.id]);

                    return (
                      <li
                        key={report.id}
                        className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-theme-xs transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900"
                      >
                        <div className="p-4 sm:p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex min-w-0 items-start gap-3">
                              <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                                {initialsFromName(report.memberName)}
                              </span>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="break-words text-sm font-semibold text-gray-900 dark:text-white/90">
                                    {report.memberName}
                                  </h3>
                                  <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                    {report.reportScope === "LEADER"
                                      ? t("leaderReportBadge")
                                      : t("memberReportBadge")}
                                  </span>
                                  <span className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                                    {t(`daysShort.${report.frequency}`)}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                                  {t("period", {
                                    start: format.dateTime(
                                      new Date(report.periodStart),
                                      { dateStyle: "medium", timeZone: "UTC" },
                                    ),
                                    end: format.dateTime(
                                      new Date(report.periodEnd),
                                      { dateStyle: "medium", timeZone: "UTC" },
                                    ),
                                  })}{" "}
                                  ·{" "}
                                  {t("due", {
                                    date: format.dateTime(
                                      new Date(report.dueAt),
                                      { dateStyle: "medium", timeZone: "UTC" },
                                    ),
                                  })}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClasses(report.status)}`}
                              >
                                {t(`status.${report.status}`)}
                              </span>
                              {hasContent && (
                                <button
                                  type="button"
                                  onClick={() => toggleReportDetails(report.id)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                                >
                                  <span>
                                    {isExpanded
                                      ? t("hideDetails")
                                      : t("viewDetails")}
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUpIcon className="h-3.5 w-3.5" />
                                  ) : (
                                    <ChevronDownIcon className="h-3.5 w-3.5" />
                                  )}
                                </button>
                              )}
                              {report.permissions.canEdit &&
                                report.id !== currentReport?.id && (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setEditingReportId((current) =>
                                        current === report.id ? "" : report.id,
                                      )
                                    }
                                  >
                                    <PencilIcon className="me-1 h-3.5 w-3.5" />
                                    {editingReportId === report.id
                                      ? t("closeEditor")
                                      : t("editReport")}
                                  </Button>
                                )}
                            </div>
                          </div>

                          {editingReportId === report.id &&
                            report.permissions.canEdit && (
                              <div className="mt-4">
                                <ReportEditor
                                  key={`${report.id}-${report.updatedAt}`}
                                  report={report}
                                  availableDocuments={availableDocuments}
                                  isSaving={
                                    updateReport.isPending ||
                                    uploadFileMutation.isPending
                                  }
                                  isSubmitting={reportAction.isPending}
                                  error={reportError}
                                  onSave={async (input, file) => {
                                    try {
                                      await saveReportDraft(
                                        report,
                                        input,
                                        file,
                                      );
                                    } catch {
                                      /* form preserves draft */
                                    }
                                  }}
                                  onSubmit={(input, file) =>
                                    submitReport(report, input, file)
                                  }
                                  onDownloadFile={handleDownloadReportFile}
                                  onClose={() => setEditingReportId("")}
                                />
                              </div>
                            )}

                          {hasContent ? (
                            <div className="mt-3.5 space-y-3 border-t border-gray-100 pt-3.5 dark:border-gray-800">
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                  {t("accomplishments")}
                                </p>
                                <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-gray-800 dark:text-gray-200">
                                  {report.accomplishments || common("noValue")}
                                </p>
                              </div>

                              {(report.file ||
                                (report.documentIds &&
                                  report.documentIds.length > 0)) && (
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  {report.file && (
                                    <button
                                      type="button"
                                      disabled={
                                        downloadingReportId === report.id
                                      }
                                      onClick={() =>
                                        void handleDownloadReportFile(report)
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/70 px-3 py-1 text-xs font-medium tabular-nums text-brand-700 transition hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
                                    >
                                      <DownloadIcon className="h-3.5 w-3.5 shrink-0" />
                                      <span className="max-w-56 truncate">
                                        {downloadingReportId === report.id
                                          ? t("downloadingFile")
                                          : `${report.file.name} (${formatFileSize(report.file.size)})`}
                                      </span>
                                    </button>
                                  )}
                                  {report.documentIds?.map((docId) => (
                                    <span
                                      key={docId}
                                      className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                    >
                                      <DocsIcon className="h-3 w-3 shrink-0 text-brand-600 dark:text-brand-400" />
                                      <span className="max-w-48 truncate">
                                        {docTitleMap.get(docId) ?? docId}
                                      </span>
                                    </span>
                                  ))}
                                </div>
                              )}

                              {isExpanded && (
                                <dl className="grid gap-3 rounded-xl bg-gray-50/80 p-3.5 dark:bg-gray-950/60 md:grid-cols-2">
                                  {(
                                    [
                                      "approach",
                                      "reason",
                                      "blockers",
                                      "nextSteps",
                                    ] as const
                                  ).map((field) => (
                                    <div key={field} className="min-w-0">
                                      <dt className="text-xs font-semibold text-gray-600 dark:text-gray-400">
                                        {t(field)}
                                      </dt>
                                      <dd className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-gray-800 dark:text-gray-200">
                                        {report[field] || common("noValue")}
                                      </dd>
                                    </div>
                                  ))}
                                </dl>
                              )}
                            </div>
                          ) : (
                            <p className="mt-3 border-t border-gray-100 pt-3 text-xs italic text-gray-400 dark:border-gray-800 dark:text-gray-500">
                              {t("emptyReportContent")}
                            </p>
                          )}

                          {report.reviewComment && (
                            <p className="mt-3 rounded-lg border-s-4 border-warning-500 bg-warning-50 px-3.5 py-2.5 text-sm text-warning-900 dark:bg-warning-500/10 dark:text-warning-200">
                              <strong>{t("reviewComment")}:</strong>{" "}
                              {report.reviewComment}
                            </p>
                          )}

                          {report.permissions.canReview && (
                            <ReportReviewActions
                              report={report}
                              pending={
                                reportAction.isPending &&
                                pendingReportId === report.id
                              }
                              onReview={reviewReport}
                            />
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="rounded-xl border border-gray-200 bg-white px-5 py-12 text-center dark:border-gray-800 dark:bg-gray-900">
                  <FileIcon className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
                  <h3 className="mt-2.5 text-sm font-semibold text-gray-900 dark:text-white/90">
                    {t("empty")}
                  </h3>
                </div>
              )}

              {reportsData && reportsData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-between border-t border-gray-200 pt-4 text-sm dark:border-gray-800">
                  <span className="tabular-nums text-gray-500 dark:text-gray-400">
                    {common("pagination.total", {
                      count: reportsData.pagination.totalItems,
                    })}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((value) => Math.max(1, value - 1))}
                    >
                      {common("pagination.previous")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= reportsData.pagination.totalPages}
                      onClick={() => setPage((value) => value + 1)}
                    >
                      {common("pagination.next")}
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
