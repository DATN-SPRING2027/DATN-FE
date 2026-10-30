"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useFormatter, useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import {
  BackgroundRefreshError,
  UpdatingStatus,
} from "@/components/ui/loading/AsyncStatus";
import {
  AlertIcon,
  CalenderIcon,
  CloseIcon,
  DocsIcon,
  DownloadIcon,
  EyeIcon,
  FileIcon,
  GroupIcon,
  LockIcon,
  PencilIcon,
  SearchIcon,
  UploadIcon,
  UserCircleIcon,
} from "@/icons";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import {
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
import DocumentFilePreviewModal from "./DocumentFilePreviewModal";
import WorkNotesPageHeader from "./WorkNotesPageHeader";
import WorkReportCadencePopover from "./WorkReportCadencePopover";

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

function statusDotClasses(status: WorkReportStatus, hasContent: boolean): string {
  switch (status) {
    case "APPROVED":
      return "bg-emerald-500";
    case "PENDING_REVIEW":
      return "bg-amber-500";
    case "CHANGES_REQUESTED":
      return "bg-orange-500";
    case "REJECTED":
    case "OVERDUE":
      return "bg-rose-500";
    case "DRAFT":
    default:
      return hasContent
        ? "bg-brand-500"
        : "border border-gray-300 bg-transparent dark:border-gray-600";
  }
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

function hasReportContent(report: WorkReport): boolean {
  return Boolean(
    report.accomplishments.trim() ||
      report.approach.trim() ||
      report.reason.trim() ||
      report.blockers?.trim() ||
      report.nextSteps?.trim() ||
      report.file ||
      (report.documentIds && report.documentIds.length > 0),
  );
}

function countCoreFields(report: WorkReport): number {
  let filled = 0;
  if (report.accomplishments.trim()) filled += 1;
  if (report.approach.trim()) filled += 1;
  if (report.reason.trim()) filled += 1;
  return filled;
}

function isReportOverdue(report: WorkReport, nowMs: number): boolean {
  if (report.status === "OVERDUE") return true;
  if (
    (report.status === "DRAFT" || report.status === "CHANGES_REQUESTED") &&
    Date.parse(report.dueAt) < nowMs
  ) {
    return true;
  }
  return false;
}

function resolveEffectiveStatus(
  report: WorkReport,
  nowMs: number,
): WorkReportStatus {
  return isReportOverdue(report, nowMs) ? "OVERDUE" : report.status;
}

function MiniProgressDots({
  filled,
  label,
}: {
  filled: number;
  label: string;
}) {
  return (
    <span
      title={label}
      aria-label={label}
      className="inline-flex items-center gap-1"
    >
      {[0, 1, 2].map((idx) => (
        <span
          key={idx}
          className={`h-1.5 w-1.5 rounded-full ${
            idx < filled
              ? "bg-brand-500 dark:bg-brand-400"
              : "bg-gray-300 dark:bg-gray-700"
          }`}
        />
      ))}
    </span>
  );
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
  onPreviewFile,
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
  onPreviewFile?: (report: WorkReport) => void;
  onClose?: () => void;
}) {
  const t = useTranslations("workNotes.reports");
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
  const [previewingSelectedFile, setPreviewingSelectedFile] = useState(false);
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
      className="space-y-4"
    >
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
          <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-800 dark:text-gray-200">
            <UploadIcon className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
            {t("attachmentLabel")}
          </span>
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
              <div className="inline-flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300">
                  <FileIcon className="h-3.5 w-3.5 shrink-0" />
                  <span className="max-w-44 truncate">{selectedFile.name}</span>
                  <span className="tabular-nums text-xs opacity-80">
                    ({formatFileSize(selectedFile.size)})
                  </span>
                  <button
                    type="button"
                    aria-label={t("removeSelectedFile")}
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewingSelectedFile(false);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                    className="ms-1 rounded p-0.5 hover:bg-brand-100 dark:hover:bg-brand-500/20"
                  >
                    <CloseIcon className="h-3 w-3" />
                  </button>
                </span>
                <button
                  type="button"
                  onClick={() => setPreviewingSelectedFile(true)}
                  className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-white px-2.5 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 dark:border-brand-500/30 dark:bg-gray-900 dark:text-brand-300"
                >
                  <EyeIcon className="h-3.5 w-3.5 shrink-0" />
                  <span>{t("previewAttachment")}</span>
                </button>
                <DocumentFilePreviewModal
                  isOpen={previewingSelectedFile}
                  onClose={() => setPreviewingSelectedFile(false)}
                  fileName={selectedFile.name}
                  contentType={selectedFile.type}
                  fileSize={selectedFile.size}
                  fetchBlob={() => Promise.resolve(selectedFile)}
                />
              </div>
            )}

            {!selectedFile && report.file && (
              <div className="inline-flex flex-wrap items-center gap-1.5">
                {onPreviewFile && (
                  <button
                    type="button"
                    onClick={() => onPreviewFile(report)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50/80 px-2.5 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
                  >
                    <EyeIcon className="h-3.5 w-3.5 shrink-0" />
                    <span>{t("previewAttachment")}</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void onDownloadFile(report)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 transition hover:border-brand-300 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                  <DownloadIcon className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
                  <span className="max-w-44 truncate">{report.file.name}</span>
                  <span className="tabular-nums text-xs text-gray-400">
                    ({formatFileSize(report.file.size)})
                  </span>
                </button>
              </div>
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
                const selected = Boolean(form.documentIds?.includes(doc.id));
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

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800">
        {onClose && (
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t("closeEditor")}
          </Button>
        )}
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

function InlineReportReviewBar({
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
    <div className="border-t border-gray-200 bg-gray-50/70 px-5 py-3.5 sm:px-6 dark:border-gray-800 dark:bg-gray-950/60">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          maxLength={5000}
          aria-label={t("reviewComment")}
          placeholder={t("reviewCommentPlaceholder")}
          value={comment}
          onChange={(event) => {
            setComment(event.target.value);
            setError("");
          }}
          className="h-9 min-w-48 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-800 outline-none transition focus:border-brand-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        />
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
      {error && (
        <p
          role="alert"
          className="mt-1.5 text-xs text-error-600 dark:text-error-400"
        >
          {error}
        </p>
      )}
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
  const [periodFilter, setPeriodFilter] = useState<string>("DEFAULT");
  const [statusFilter, setStatusFilter] = useState<WorkReportStatus | "ALL">(
    "ALL",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [editingReportId, setEditingReportId] = useState("");
  const [pendingReportId, setPendingReportId] = useState("");
  const [downloadingReportId, setDownloadingReportId] = useState("");

  const memberSettings = useWorkReportSettingsQuery(projectId, "MEMBER");
  const settings = useWorkReportSettingsQuery(projectId, activeScope);
  const reportsQuery = useWorkReportsQuery(projectId, "ALL", page, activeScope);
  const documentsQuery = useDocumentsQuery(projectId, "ALL", 1);

  const settingsAccessLost = isAccessOrResourceUnavailableError(settings.error);
  const reportsAccessLost = isAccessOrResourceUnavailableError(
    reportsQuery.error,
  );
  const memberSettingsData = isAccessOrResourceUnavailableError(
    memberSettings.error,
  )
    ? undefined
    : memberSettings.data;
  const settingsData = settingsAccessLost ? undefined : settings.data;
  const reportsData = reportsAccessLost ? undefined : reportsQuery.data;

  const actorRole = settingsData?.actorRole ?? memberSettingsData?.actorRole;
  const canSwitchLeaderTier =
    actorRole === "LEADER" ||
    actorRole === "MANAGER" ||
    Boolean(
      settingsData?.permissions.canConfigure ??
        memberSettingsData?.permissions.canConfigure,
    );

  const allScopeReports = useMemo(
    () => reportsData?.data ?? [],
    [reportsData?.data],
  );
  const totalReportsCount =
    reportsData?.pagination.totalItems ?? allScopeReports.length;

  const [mountNow] = useState(() => Date.now());
  const currentTime = Math.max(mountNow, reportsQuery.dataUpdatedAt);

  // Fixed Role × Period check: detect ALL reports in the active date window (not only canEdit!)
  const activePeriodReports = useMemo(
    () =>
      allScopeReports.filter(
        (report) =>
          Date.parse(report.periodStart) <= currentTime &&
          currentTime < Date.parse(report.periodEnd),
      ),
    [allScopeReports, currentTime],
  );

  // Editable report belonging to the signed-in author in the active cycle (used for POST /work-reports)
  const editableCurrentReport = useMemo(
    () => activePeriodReports.find((report) => report.permissions.canEdit),
    [activePeriodReports],
  );

  const isReviewerOnlyScope =
    actorRole === "MANAGER" ||
    (actorRole === "LEADER" && activeScope === "MEMBER");

  // Build distinct reporting periods sorted newest first
  const periods = useMemo(() => {
    const map = new Map<
      string,
      { key: string; start: string; end: string; dueAt: string }
    >();
    const sortedByDate = [...allScopeReports].sort(
      (a, b) => Date.parse(b.periodStart) - Date.parse(a.periodStart),
    );
    for (const report of sortedByDate) {
      if (!map.has(report.periodStart)) {
        map.set(report.periodStart, {
          key: report.periodStart,
          start: report.periodStart,
          end: report.periodEnd,
          dueAt: report.dueAt,
        });
      }
    }
    return Array.from(map.values());
  }, [allScopeReports]);

  const activePeriodKey = activePeriodReports[0]?.periodStart;

  const effectivePeriod = useMemo(() => {
    if (periodFilter === "ALL") return "ALL";
    if (
      periodFilter !== "DEFAULT" &&
      periods.some((item) => item.key === periodFilter)
    ) {
      return periodFilter;
    }
    return activePeriodKey ?? periods[0]?.key ?? "ALL";
  }, [periodFilter, periods, activePeriodKey]);

  const periodReports = useMemo(() => {
    if (effectivePeriod === "ALL") return allScopeReports;
    return allScopeReports.filter(
      (report) => report.periodStart === effectivePeriod,
    );
  }, [allScopeReports, effectivePeriod]);

  // Detect overdue items in older periods when viewing a specific period
  const hiddenPastOverdueReports = useMemo(() => {
    if (effectivePeriod === "ALL") return [];
    return allScopeReports.filter(
      (report) =>
        report.periodStart !== effectivePeriod &&
        isReportOverdue(report, currentTime),
    );
  }, [allScopeReports, effectivePeriod, currentTime]);

  // Semantic metrics separating on-track Drafts from genuinely Overdue items
  const periodMetrics = useMemo(() => {
    const total = periodReports.length;
    const draftOnTrack = periodReports.filter(
      (r) => r.status === "DRAFT" && !isReportOverdue(r, currentTime),
    ).length;
    const pendingReview = periodReports.filter(
      (r) => r.status === "PENDING_REVIEW",
    ).length;
    const changesRequested = periodReports.filter(
      (r) =>
        r.status === "CHANGES_REQUESTED" && !isReportOverdue(r, currentTime),
    ).length;
    const approved = periodReports.filter(
      (r) => r.status === "APPROVED",
    ).length;
    const rejected = periodReports.filter(
      (r) => r.status === "REJECTED",
    ).length;
    const overdue = periodReports.filter((r) =>
      isReportOverdue(r, currentTime),
    ).length;

    return {
      total,
      draftOnTrack,
      pendingReview,
      changesRequested,
      approved,
      rejected,
      overdue,
    };
  }, [periodReports, currentTime]);

  const filteredReports = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return periodReports.filter((report) => {
      if (query && !report.memberName.toLowerCase().includes(query)) {
        return false;
      }
      if (statusFilter === "ALL") return true;
      if (statusFilter === "OVERDUE") {
        return isReportOverdue(report, currentTime);
      }
      if (statusFilter === "DRAFT") {
        return (
          report.status === "DRAFT" && !isReportOverdue(report, currentTime)
        );
      }
      if (statusFilter === "CHANGES_REQUESTED") {
        return (
          report.status === "CHANGES_REQUESTED" &&
          !isReportOverdue(report, currentTime)
        );
      }
      return report.status === statusFilter;
    });
  }, [periodReports, searchQuery, statusFilter, currentTime]);

  const sortedReports = useMemo(() => {
    function priority(report: WorkReport): number {
      if (report.permissions.canEdit) return 0;
      if (report.status === "PENDING_REVIEW") return 1;
      if (isReportOverdue(report, currentTime)) return 2;
      if (report.status === "CHANGES_REQUESTED") return 3;
      if (report.status === "DRAFT" && hasReportContent(report)) return 4;
      if (report.status === "APPROVED") return 5;
      if (report.status === "REJECTED") return 6;
      return 9;
    }
    return [...filteredReports].sort((a, b) => priority(a) - priority(b));
  }, [filteredReports, currentTime]);

  const activeRoster = useMemo(
    () =>
      sortedReports.filter(
        (r) =>
          r.permissions.canEdit ||
          hasReportContent(r) ||
          resolveEffectiveStatus(r, currentTime) !== "DRAFT",
      ),
    [sortedReports, currentTime],
  );

  const unstartedRoster = useMemo(
    () =>
      sortedReports.filter(
        (r) =>
          !r.permissions.canEdit &&
          !hasReportContent(r) &&
          resolveEffectiveStatus(r, currentTime) === "DRAFT",
      ),
    [sortedReports, currentTime],
  );

  const selectedReport = useMemo(
    () =>
      sortedReports.find((r) => r.id === selectedReportId) ??
      sortedReports[0] ??
      null,
    [sortedReports, selectedReportId],
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
  const docMap = new Map(availableDocuments.map((doc) => [doc.id, doc]));

  const [previewTarget, setPreviewTarget] = useState<{
    fileName: string;
    contentType?: string;
    fileSize?: number;
    fetchBlob: () => Promise<Blob>;
    downloadUrl?: string;
    onDownload?: () => void;
  } | null>(null);

  function handlePreviewReportFile(report: WorkReport) {
    if (!report.file) return;
    setPreviewTarget({
      fileName: report.file.name,
      contentType: report.file.contentType,
      fileSize: report.file.size,
      fetchBlob: () => workNotesApi.downloadReportFile(projectId, report.id),
      onDownload: () => void handleDownloadReportFile(report),
    });
  }

  async function handlePreviewLinkedDocument(
    docId: string,
    fallbackTitle: string,
  ) {
    const summary = docMap.get(docId);
    if (summary?.file) {
      setPreviewTarget({
        fileName: summary.file.name,
        contentType: summary.file.contentType,
        fileSize: summary.file.size,
        fetchBlob: () => workNotesApi.downloadDocumentFile(projectId, docId),
        downloadUrl: `/api/backend/capture/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(docId)}/file`,
      });
      return;
    }
    try {
      const fullDoc = await workNotesApi.getDocument(projectId, docId);
      if (fullDoc.file) {
        setPreviewTarget({
          fileName: fullDoc.file.name,
          contentType: fullDoc.file.contentType,
          fileSize: fullDoc.file.size,
          fetchBlob: () => workNotesApi.downloadDocumentFile(projectId, docId),
          downloadUrl: `/api/backend/capture/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(docId)}/file`,
        });
      } else {
        const textBlob = new Blob([fullDoc.content || ""], {
          type: "text/markdown;charset=utf-8",
        });
        setPreviewTarget({
          fileName: `${fullDoc.title || fallbackTitle}.md`,
          contentType: "text/markdown",
          fileSize: textBlob.size,
          fetchBlob: () => Promise.resolve(textBlob),
        });
      }
    } catch {
      const textBlob = new Blob([summary?.description || fallbackTitle], {
        type: "text/plain;charset=utf-8",
      });
      setPreviewTarget({
        fileName: `${fallbackTitle}.txt`,
        contentType: "text/plain",
        fileSize: textBlob.size,
        fetchBlob: () => Promise.resolve(textBlob),
      });
    }
  }

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
      report.id === editableCurrentReport?.id
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
      setEditingReportId("");
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

  const submittedInPeriod = periodMetrics.approved + periodMetrics.pendingReview;
  const activePeriodObj =
    effectivePeriod !== "ALL"
      ? periods.find((item) => item.key === effectivePeriod)
      : undefined;
  const progressPercent =
    periodMetrics.total > 0
      ? Math.max(Math.round((submittedInPeriod / periodMetrics.total) * 100), 8)
      : 0;

  const isEditingSelected = Boolean(
    selectedReport &&
      selectedReport.permissions.canEdit &&
      editingReportId === selectedReport.id,
  );

  function renderRosterItem(item: WorkReport) {
    const isSelected = selectedReport?.id === item.id;
    const hasContent = hasReportContent(item);
    const effectiveStatus = resolveEffectiveStatus(item, currentTime);
    const attachCount =
      (item.file ? 1 : 0) + (item.documentIds ? item.documentIds.length : 0);
    const coreFilled = countCoreFields(item);

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          setSelectedReportId(item.id);
          if (editingReportId && editingReportId !== item.id) {
            setEditingReportId("");
          }
        }}
        className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-start transition ${
          isSelected
            ? "border-brand-200 bg-brand-50/80 dark:border-brand-500/30 dark:bg-brand-500/15"
            : "border-transparent hover:bg-gray-100/80 dark:hover:bg-gray-800/60"
        }`}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              effectiveStatus === "OVERDUE"
                ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                : "bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300"
            }`}
          >
            {initialsFromName(item.memberName)}
          </span>
          <div className="min-w-0">
            <div
              className={`truncate text-xs ${
                isSelected
                  ? "font-bold text-brand-800 dark:text-brand-200"
                  : hasContent ||
                      effectiveStatus !== "DRAFT" ||
                      item.permissions.canEdit
                    ? "font-semibold text-gray-900 dark:text-white/90"
                    : "font-medium text-gray-500 dark:text-gray-400"
              }`}
            >
              {item.memberName}
              {item.permissions.canEdit ? ` ${t("youSuffix")}` : ""}
            </div>
            {effectivePeriod === "ALL" && (
              <div className="truncate text-xs tabular-nums text-gray-400 dark:text-gray-500">
                {format.dateTime(new Date(item.periodStart), {
                  dateStyle: "short",
                  timeZone: "UTC",
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {Boolean(item.blockers?.trim()) && (
            <AlertIcon
              aria-label={t("blockers")}
              className="h-3.5 w-3.5 text-amber-500 dark:text-amber-400"
            />
          )}
          {attachCount > 0 && (
            <FileIcon className="h-3 w-3 text-gray-400 dark:text-gray-500" />
          )}
          {effectiveStatus === "DRAFT" && hasContent ? (
            <MiniProgressDots
              filled={coreFilled}
              label={t("sectionsProgress", { filled: coreFilled })}
            />
          ) : (
            <span
              className={`text-xs font-semibold ${
                effectiveStatus === "OVERDUE" || effectiveStatus === "REJECTED"
                  ? "text-rose-600 dark:text-rose-400"
                  : effectiveStatus === "PENDING_REVIEW"
                    ? "text-amber-600 dark:text-amber-400"
                    : effectiveStatus === "APPROVED"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-gray-400 dark:text-gray-500"
              }`}
            >
              {t(`status.${effectiveStatus}`)}
            </span>
          )}
          <span
            aria-hidden="true"
            className={`h-2 w-2 shrink-0 rounded-full ${statusDotClasses(
              effectiveStatus,
              hasContent,
            )}`}
          />
        </div>
      </button>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <WorkNotesPageHeader projectId={projectId} active="reports" />

      <div className="space-y-4">
        {/* MINIMAL TOP TOOLBAR: Scope Tabs + Period Selector + Cadence Popover */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {settings.isPending && !settingsData && !memberSettingsData ? (
            <div className="h-9 w-60 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
          ) : canSwitchLeaderTier ? (
            <nav
              aria-label={t("title")}
              className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-gray-100 p-1 dark:bg-gray-800"
            >
              <button
                type="button"
                onClick={() => {
                  setActiveScope("MEMBER");
                  setPeriodFilter("DEFAULT");
                  setStatusFilter("ALL");
                  setSelectedReportId("");
                  setEditingReportId("");
                  setPage(1);
                }}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  activeScope === "MEMBER"
                    ? "bg-white text-gray-900 shadow-2xs dark:bg-gray-900 dark:text-white"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <GroupIcon
                  className={`h-3.5 w-3.5 shrink-0 ${
                    activeScope === "MEMBER"
                      ? "text-brand-600 dark:text-brand-400"
                      : "text-gray-400"
                  }`}
                />
                <span>{t("tabs.memberReports")}</span>
                {(memberSettingsData?.frequency ??
                  (activeScope === "MEMBER"
                    ? settingsData?.frequency
                    : undefined)) && (
                  <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                    {t(
                      `daysShort.${
                        (activeScope === "MEMBER"
                          ? settingsData?.frequency
                          : undefined) ?? memberSettingsData!.frequency
                      }`,
                    )}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveScope("LEADER");
                  setPeriodFilter("DEFAULT");
                  setStatusFilter("ALL");
                  setSelectedReportId("");
                  setEditingReportId("");
                  setPage(1);
                }}
                className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition ${
                  activeScope === "LEADER"
                    ? "bg-white text-gray-900 shadow-2xs dark:bg-gray-900 dark:text-white"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                }`}
              >
                <UserCircleIcon
                  className={`h-3.5 w-3.5 shrink-0 ${
                    activeScope === "LEADER"
                      ? "text-brand-600 dark:text-brand-400"
                      : "text-gray-400"
                  }`}
                />
                <span>
                  {actorRole === "MANAGER"
                    ? t("tabs.managerLeaderReports")
                    : t("tabs.leaderMyReport")}
                </span>
                {((activeScope === "LEADER"
                  ? settingsData?.frequency
                  : undefined) ??
                  settingsData?.leaderSettings?.frequency ??
                  memberSettingsData?.leaderSettings?.frequency) && (
                  <span className="rounded bg-brand-50 px-1.5 py-0.5 text-xs font-semibold tabular-nums text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                    {t(
                      `daysShort.${
                        (activeScope === "LEADER"
                          ? settingsData?.frequency
                          : undefined) ??
                        settingsData?.leaderSettings?.frequency ??
                        memberSettingsData!.leaderSettings!.frequency
                      }`,
                    )}
                  </span>
                )}
              </button>
            </nav>
          ) : (
            <div className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-200">
              <LockIcon className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
              <span>{t("mandatoryScheduleLabel")}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {!reportsQuery.isPending &&
              !reportsQuery.isError &&
              allScopeReports.length > 0 &&
              activePeriodReports.length === 0 && (
                <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs font-medium text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                  <CalenderIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                  <span>{t("noActiveCycleArchive")}</span>
                </span>
              )}

            {periods.length > 0 && (
              <select
                aria-label={t("periodSelectLabel")}
                value={effectivePeriod}
                onChange={(event) => {
                  setPeriodFilter(event.target.value);
                  setSelectedReportId("");
                  setEditingReportId("");
                }}
                className="h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold tabular-nums text-gray-800 outline-none transition hover:border-gray-300 focus:border-brand-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
              >
                {periods.map((item) => (
                  <option key={item.key} value={item.key}>
                    {t("period", {
                      start: format.dateTime(new Date(item.start), {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      }),
                      end: format.dateTime(new Date(item.end), {
                        dateStyle: "medium",
                        timeZone: "UTC",
                      }),
                    })}
                  </option>
                ))}
                {periods.length > 1 && (
                  <option value="ALL">
                    {t("allPeriods", { count: totalReportsCount })}
                  </option>
                )}
              </select>
            )}

            <WorkReportCadencePopover
              activeScope={activeScope}
              actorRole={actorRole}
              settingsData={settingsData}
              isPending={settings.isPending}
              isError={settings.isError}
              error={settings.error}
              isFetching={settings.isFetching}
              isRefetchError={settings.isRefetchError}
              accessLost={settingsAccessLost}
              onRetry={() => void settings.refetch()}
              isSaving={settingsMutation.isPending}
              saveError={settingsMutation.error}
              saveSuccess={settingsMutation.isSuccess}
              onApplyFrequency={async (nextFreq) => {
                await settingsMutation.mutateAsync(nextFreq);
              }}
            />
          </div>
        </div>

        {/* SUBTLE PAST-OVERDUE ALERT STRIP */}
        {hiddenPastOverdueReports.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setPeriodFilter("ALL");
              setStatusFilter("OVERDUE");
              setSelectedReportId(hiddenPastOverdueReports[0]?.id ?? "");
            }}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100/70 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            <span className="inline-flex items-center gap-1.5">
              <AlertIcon className="h-3.5 w-3.5 shrink-0" />
              <span>
                {t("pastOverdueAlert", {
                  count: hiddenPastOverdueReports.length,
                })}
              </span>
            </span>
            <span>{t("inspectOverdue")} →</span>
          </button>
        )}

        {/* BACKGROUND REFRESH STATUS */}
        {reportsData !== undefined &&
          !reportsAccessLost &&
          (reportsQuery.isFetching || reportsQuery.isRefetchError) && (
            <div>
              {reportsQuery.isFetching && (
                <UpdatingStatus>{common("loading")}</UpdatingStatus>
              )}
              {reportsQuery.isRefetchError && (
                <BackgroundRefreshError
                  retryLabel={common("retry")}
                  onRetry={() => void reportsQuery.refetch()}
                >
                  {common("updateFailed")}
                </BackgroundRefreshError>
              )}
            </div>
          )}

        {/* WORKFLOW MUTATION ALERTS */}
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
                void reportsQuery.refetch();
              }}
            >
              {common("retry")}
            </Button>
          </div>
        )}
        {(reportAction.isSuccess ||
          saveReport.isSuccess ||
          updateReport.isSuccess) && (
          <p
            role="status"
            className="text-xs font-medium text-emerald-700 dark:text-emerald-400"
          >
            {reportAction.isSuccess ? t("actionSuccess") : t("saveSuccess")}
          </p>
        )}

        {/* MAIN SPLIT-VIEW 2-PANE WORKSPACE */}
        {reportsQuery.isPending && !reportsData ? (
          <div
            role="status"
            aria-label={common("loading")}
            className="grid min-h-96 grid-cols-1 overflow-hidden rounded-2xl border border-gray-200 bg-white md:grid-cols-12 dark:border-gray-800 dark:bg-gray-900"
          >
            <div className="space-y-2 border-b border-gray-200 bg-gray-50/60 p-3 md:col-span-4 md:border-b-0 md:border-e dark:border-gray-800 dark:bg-gray-950/40">
              {[0, 1, 2, 3].map((idx) => (
                <div
                  key={idx}
                  className="h-11 animate-pulse rounded-lg bg-gray-200/70 dark:bg-gray-800"
                />
              ))}
            </div>
            <div className="space-y-4 p-6 md:col-span-8">
              <div className="h-12 w-2/3 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
              <div className="h-32 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>
        ) : reportsQuery.isError && !reportsData ? (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-4 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
          >
            <span>
              {reportsQuery.error instanceof Error
                ? reportsQuery.error.message
                : t("permissionDenied")}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void reportsQuery.refetch()}
            >
              {common("retry")}
            </Button>
          </div>
        ) : (
          <section
            aria-label={t("title")}
            className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
          >
            {/* SLIM FILTER & CYCLE PROGRESS HEADER (Draft separated from Overdue!) */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 px-4 py-2.5 dark:border-gray-800">
              <div
                role="tablist"
                aria-label={t("filterLabel")}
                className="flex flex-wrap items-center gap-1"
              >
                {(
                  [
                    {
                      id: "ALL" as const,
                      label: t("filterTabs.all"),
                      count: periodMetrics.total,
                      alert: false,
                    },
                    {
                      id: "DRAFT" as const,
                      label: t("filterTabs.draft"),
                      count: periodMetrics.draftOnTrack,
                      alert: false,
                    },
                    {
                      id: "PENDING_REVIEW" as const,
                      label: t("filterTabs.review"),
                      count: periodMetrics.pendingReview,
                      alert: false,
                    },
                    ...(periodMetrics.changesRequested > 0 ||
                    statusFilter === "CHANGES_REQUESTED"
                      ? [
                          {
                            id: "CHANGES_REQUESTED" as const,
                            label: t("filterTabs.revision"),
                            count: periodMetrics.changesRequested,
                            alert: false,
                          },
                        ]
                      : []),
                    {
                      id: "APPROVED" as const,
                      label: t("filterTabs.approved"),
                      count: periodMetrics.approved,
                      alert: false,
                    },
                    ...(periodMetrics.rejected > 0 ||
                    statusFilter === "REJECTED"
                      ? [
                          {
                            id: "REJECTED" as const,
                            label: t("filterTabs.rejected"),
                            count: periodMetrics.rejected,
                            alert: true,
                          },
                        ]
                      : []),
                    {
                      id: "OVERDUE" as const,
                      label: t("filterTabs.overdue"),
                      count: periodMetrics.overdue,
                      alert: periodMetrics.overdue > 0,
                    },
                  ] as const
                ).map((tab) => {
                  const active = statusFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setStatusFilter(tab.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition ${
                        active
                          ? tab.alert
                            ? "bg-rose-600 font-semibold text-white dark:bg-rose-500"
                            : "bg-gray-900 font-semibold text-white dark:bg-white dark:text-gray-900"
                          : tab.alert
                            ? "bg-rose-50 font-semibold text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300"
                            : "font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                      }`}
                    >
                      <span>{tab.label}</span>{" "}
                      <span className="tabular-nums opacity-80">
                        {tab.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                {activePeriodObj && periodMetrics.total > 0 && (
                  <div className="inline-flex items-center gap-2 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                    <span>
                      {t("due", {
                        date: format.dateTime(new Date(activePeriodObj.dueAt), {
                          dateStyle: "medium",
                          timeZone: "UTC",
                        }),
                      })}
                    </span>
                    <span className="h-1.5 w-11 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                      <span
                        style={{ width: `${progressPercent}%` }}
                        className={`block h-full rounded-full ${
                          submittedInPeriod > 0
                            ? "bg-emerald-500"
                            : "bg-gray-400 dark:bg-gray-500"
                        }`}
                      />
                    </span>
                    <strong className="font-semibold text-gray-700 dark:text-gray-200">
                      {t("cycleSubmittedProgress", {
                        submitted: submittedInPeriod,
                        total: periodMetrics.total,
                      })}
                    </strong>
                  </div>
                )}

                <div className="relative">
                  <SearchIcon className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                  <input
                    type="search"
                    aria-label={t("searchMemberLabel")}
                    placeholder={t("searchMemberPlaceholder")}
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    className="h-7 w-36 rounded-lg border border-gray-200 bg-gray-50 ps-8 pe-2.5 text-xs text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-400 focus:bg-white sm:w-44 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  />
                </div>
              </div>
            </div>

            {/* 2-PANE BODY: LEFT ROSTER + RIGHT READER & INLINE REVIEW CANVAS */}
            {allScopeReports.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <FileIcon className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
                <h3 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white/90">
                  {isReviewerOnlyScope ? t("empty") : t("noCurrentReport")}
                </h3>
              </div>
            ) : (
              <div className="flex min-h-96 flex-col md:flex-row">
                {/* LEFT PANE: CLEAN MEMBER ROSTER (w-72 = 288px, zero paragraph clutter) */}
                <div className="flex w-full flex-col justify-between border-b border-gray-200 bg-gray-50/50 md:w-72 md:shrink-0 md:border-b-0 md:border-e dark:border-gray-800 dark:bg-gray-950/40">
                  <div className="max-h-60 space-y-1 overflow-y-auto p-2 md:max-h-none">
                    {sortedReports.length === 0 ? (
                      <p className="px-3 py-8 text-center text-xs text-gray-400 dark:text-gray-500">
                        {t("noMatchingReports")}
                      </p>
                    ) : (
                      <>
                        {activeRoster.map(renderRosterItem)}

                        {unstartedRoster.length > 0 && (
                          <>
                            <div className="px-2.5 pt-2.5 pb-1 text-xs font-bold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                              {t("notStartedGroup", {
                                count: unstartedRoster.length,
                              })}
                            </div>
                            {unstartedRoster.map(renderRosterItem)}
                          </>
                        )}
                      </>
                    )}
                  </div>

                  {reportsData && reportsData.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between gap-2 border-t border-gray-200 px-3 py-2 text-xs dark:border-gray-800">
                      <span className="tabular-nums text-gray-500 dark:text-gray-400">
                        {common("pagination.total", {
                          count: reportsData.pagination.totalItems,
                        })}
                      </span>
                      <div className="flex gap-1.5">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={page <= 1}
                          onClick={() =>
                            setPage((value) => Math.max(1, value - 1))
                          }
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
                </div>

                {/* RIGHT PANE: CALM SPACIOUS READER, COMPOSER & INLINE REVIEW */}
                <div className="flex min-w-0 flex-1 flex-col justify-between">
                  {!selectedReport ? (
                    <div className="flex flex-1 items-center justify-center px-6 py-16 text-center text-sm text-gray-400 dark:text-gray-500">
                      {sortedReports.length === 0
                        ? t("noMatchingReports")
                        : t("selectMemberPrompt")}
                    </div>
                  ) : (
                    <>
                      <div className="p-5 sm:p-6">
                        {/* Selected Member Header */}
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 pb-4 dark:border-gray-800">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                              {initialsFromName(selectedReport.memberName)}
                            </span>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="break-words text-base font-bold text-gray-900 dark:text-white">
                                  {selectedReport.memberName}
                                </h2>
                                <span
                                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadgeClasses(
                                    resolveEffectiveStatus(
                                      selectedReport,
                                      currentTime,
                                    ),
                                  )}`}
                                >
                                  {t(
                                    `status.${resolveEffectiveStatus(
                                      selectedReport,
                                      currentTime,
                                    )}`,
                                  )}
                                </span>
                                <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                  {selectedReport.reportScope === "LEADER"
                                    ? t("leaderReportBadge")
                                    : t("memberReportBadge")}
                                </span>
                              </div>
                              <p className="mt-1 text-xs tabular-nums text-gray-500 dark:text-gray-400">
                                {t("period", {
                                  start: format.dateTime(
                                    new Date(selectedReport.periodStart),
                                    { dateStyle: "medium", timeZone: "UTC" },
                                  ),
                                  end: format.dateTime(
                                    new Date(selectedReport.periodEnd),
                                    { dateStyle: "medium", timeZone: "UTC" },
                                  ),
                                })}{" "}
                                ·{" "}
                                {t("due", {
                                  date: format.dateTime(
                                    new Date(selectedReport.dueAt),
                                    { dateStyle: "medium", timeZone: "UTC" },
                                  ),
                                })}
                                {selectedReport.reviewedBy
                                  ? ` · ${t("reviewedByMeta", {
                                      reviewer: selectedReport.reviewedBy,
                                    })}`
                                  : ""}
                              </p>
                            </div>
                          </div>

                          {selectedReport.permissions.canEdit && (
                            <Button
                              type="button"
                              variant={isEditingSelected ? "outline" : "primary"}
                              size="sm"
                              onClick={() =>
                                setEditingReportId((current) =>
                                  current === selectedReport.id
                                    ? ""
                                    : selectedReport.id,
                                )
                              }
                            >
                              {!isEditingSelected && (
                                <PencilIcon className="me-1.5 h-3.5 w-3.5" />
                              )}
                              {isEditingSelected
                                ? t("closeEditor")
                                : hasReportContent(selectedReport)
                                  ? t("editReport")
                                  : t("writeReportCta")}
                            </Button>
                          )}
                        </div>

                        {/* Canvas Content: Editor vs Spacious Reader vs Calm Empty State */}
                        <div className="pt-5">
                          {isEditingSelected &&
                          selectedReport.permissions.canEdit ? (
                            <ReportEditor
                              key={`${selectedReport.id}-${selectedReport.updatedAt}`}
                              report={selectedReport}
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
                                  await saveReportDraft(
                                    selectedReport,
                                    input,
                                    file,
                                  );
                                } catch {
                                  /* form preserves draft */
                                }
                              }}
                              onSubmit={(input, file) =>
                                submitReport(selectedReport, input, file)
                              }
                              onDownloadFile={handleDownloadReportFile}
                              onPreviewFile={handlePreviewReportFile}
                              onClose={() => setEditingReportId("")}
                            />
                          ) : hasReportContent(selectedReport) ? (
                            <div className="space-y-5">
                              <div>
                                <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                                  {t("accomplishments")}
                                </h3>
                                <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-900 dark:text-gray-100">
                                  {selectedReport.accomplishments ||
                                    common("noValue")}
                                </p>
                              </div>

                              <div className="grid gap-5 border-t border-gray-100 pt-4 md:grid-cols-2 dark:border-gray-800">
                                <div className="min-w-0">
                                  <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                                    {t("approach")}
                                  </h3>
                                  <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                                    {selectedReport.approach ||
                                      common("noValue")}
                                  </p>
                                </div>
                                <div className="min-w-0">
                                  <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                                    {t("reason")}
                                  </h3>
                                  <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                                    {selectedReport.reason || common("noValue")}
                                  </p>
                                </div>
                              </div>

                              {Boolean(selectedReport.blockers?.trim()) && (
                                <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                                  <strong className="font-semibold">
                                    {t("blockers")}:
                                  </strong>{" "}
                                  <span className="whitespace-pre-wrap break-words">
                                    {selectedReport.blockers}
                                  </span>
                                </div>
                              )}

                              {Boolean(selectedReport.nextSteps?.trim()) && (
                                <div className="min-w-0">
                                  <h3 className="text-xs font-bold tracking-wider text-gray-400 uppercase dark:text-gray-500">
                                    {t("nextSteps")}
                                  </h3>
                                  <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                                    {selectedReport.nextSteps}
                                  </p>
                                </div>
                              )}

                              {(selectedReport.file ||
                                (selectedReport.documentIds &&
                                  selectedReport.documentIds.length > 0)) && (
                                <div className="flex flex-wrap items-center gap-2 pt-1">
                                  {selectedReport.file && (
                                    <div className="inline-flex flex-wrap items-center gap-1.5 rounded-xl border border-brand-200/80 bg-brand-50/40 p-1 ps-2.5 dark:border-brand-500/30 dark:bg-brand-500/10">
                                      <FileIcon className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
                                      <span className="max-w-52 truncate text-xs font-medium tabular-nums text-gray-800 dark:text-gray-200">
                                        {`${selectedReport.file.name} (${formatFileSize(selectedReport.file.size)})`}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          handlePreviewReportFile(
                                            selectedReport,
                                          )
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-white px-2 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-50 dark:border-brand-500/30 dark:bg-gray-900 dark:text-brand-300 dark:hover:bg-gray-800"
                                      >
                                        <EyeIcon className="h-3.5 w-3.5 shrink-0" />
                                        <span>{t("previewAttachment")}</span>
                                      </button>
                                      <button
                                        type="button"
                                        disabled={
                                          downloadingReportId ===
                                          selectedReport.id
                                        }
                                        onClick={() =>
                                          void handleDownloadReportFile(
                                            selectedReport,
                                          )
                                        }
                                        className="inline-flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs font-medium text-gray-700 transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
                                      >
                                        <DownloadIcon className="h-3.5 w-3.5 shrink-0" />
                                        <span>
                                          {downloadingReportId ===
                                          selectedReport.id
                                            ? t("downloadingFile")
                                            : t("downloadAttachment")}
                                        </span>
                                      </button>
                                    </div>
                                  )}

                                  {selectedReport.documentIds?.map((docId) => {
                                    const docTitle =
                                      docTitleMap.get(docId) ?? docId;
                                    return (
                                      <button
                                        key={docId}
                                        type="button"
                                        aria-label={`${t("previewDocument")}: ${docTitle}`}
                                        onClick={() =>
                                          void handlePreviewLinkedDocument(
                                            docId,
                                            docTitle,
                                          )
                                        }
                                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-medium text-gray-700 transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                      >
                                        <DocsIcon className="h-3.5 w-3.5 shrink-0 text-brand-600 dark:text-brand-400" />
                                        <span className="max-w-48 truncate">
                                          {docTitle}
                                        </span>
                                        <EyeIcon className="ms-0.5 h-3 w-3 shrink-0 text-brand-600 dark:text-brand-400" />
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {selectedReport.reviewComment && (
                                <p className="rounded-lg border-s-4 border-warning-500 bg-warning-50 px-3.5 py-2.5 text-xs leading-relaxed text-warning-900 dark:bg-warning-500/10 dark:text-warning-200">
                                  <strong>{t("reviewComment")}:</strong>{" "}
                                  {selectedReport.reviewComment}
                                </p>
                              )}
                            </div>
                          ) : (
                            /* Calm Empty Canvas for Unstarted / Overdue Report */
                            <div className="py-12 text-center">
                              <p
                                className={`text-sm font-semibold ${
                                  resolveEffectiveStatus(
                                    selectedReport,
                                    currentTime,
                                  ) === "OVERDUE"
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "text-gray-800 dark:text-gray-200"
                                }`}
                              >
                                {resolveEffectiveStatus(
                                  selectedReport,
                                  currentTime,
                                ) === "OVERDUE"
                                  ? t("overdueEmptyTitle")
                                  : selectedReport.permissions.canEdit
                                    ? t("yourReportEmptyTitle")
                                    : t("emptyReportContent")}
                              </p>
                              <p className="mt-1 text-xs tabular-nums text-gray-400 dark:text-gray-500">
                                {t("due", {
                                  date: format.dateTime(
                                    new Date(selectedReport.dueAt),
                                    { dateStyle: "medium", timeZone: "UTC" },
                                  ),
                                })}{" "}
                                ·{" "}
                                {t("sectionsProgress", {
                                  filled: countCoreFields(selectedReport),
                                })}
                              </p>

                              {selectedReport.permissions.canEdit && (
                                <div className="mt-4">
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() =>
                                      setEditingReportId(selectedReport.id)
                                    }
                                  >
                                    <PencilIcon className="me-1.5 h-3.5 w-3.5" />
                                    {t("writeReportCta")}
                                  </Button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {selectedReport.permissions.canReview &&
                        !isEditingSelected && (
                          <InlineReportReviewBar
                            key={selectedReport.id}
                            report={selectedReport}
                            pending={
                              reportAction.isPending &&
                              pendingReportId === selectedReport.id
                            }
                            onReview={reviewReport}
                          />
                        )}
                    </>
                  )}
                </div>
              </div>
            )}
          </section>
        )}
      </div>

      {previewTarget && (
        <DocumentFilePreviewModal
          isOpen={Boolean(previewTarget)}
          onClose={() => setPreviewTarget(null)}
          fileName={previewTarget.fileName}
          contentType={previewTarget.contentType}
          fileSize={previewTarget.fileSize}
          fetchBlob={previewTarget.fetchBlob}
          downloadUrl={previewTarget.downloadUrl}
          onDownload={previewTarget.onDownload}
        />
      )}
    </main>
  );
}
