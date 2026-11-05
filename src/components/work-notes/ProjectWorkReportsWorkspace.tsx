"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import {
  ArrowLeft,
  Eye,
  FileEdit,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import Button from "@/components/ui/button/Button";
import { BackgroundRefreshError } from "@/components/ui/loading/AsyncStatus";
import {
  AlertIcon,
  CalenderIcon,
  FileIcon,
  GroupIcon,
  LockIcon,
  PencilIcon,
  SearchIcon,
  UserCircleIcon,
} from "@/icons";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import { cn } from "@/utils";
import {
  isKnowledgeSyncActive,
  useWorkNotesMutation,
  useWorkReportKnowledgeChunksQuery,
  useWorkReportKnowledgeStatusQuery,
  useWorkReportSettingsQuery,
  useWorkReportsQuery,
  workNoteKeys,
  workNotesApi,
  type ReportFrequency,
  type WorkReport,
  type WorkReportInput,
  type WorkReportScope,
  type WorkReportStatus,
} from "@/lib/queries/work-notes/useWorkNotes";
import WorkNoteComposer from "./WorkNoteComposer";
import WorkReportReminderSettings from "./WorkReportReminderSettings";
import WorkNotesPageHeader from "./WorkNotesPageHeader";
import WorkReportCadencePopover from "./WorkReportCadencePopover";
import {
  ApprovalStatusBadge,
  BulkGovernanceBar,
  KnowledgeGovernanceDrawer,
  KnowledgeTelemetryDock,
  PinnedReviewDecisionBar,
  SplitWorkbenchResizer,
  useResizableSplitWidth,
  type BulkCommandAction,
  type GovernanceReviewHistoryEntry,
  type PurgeArtifactOptions,
  type SagPipelineAction,
} from "./SagKnowledgePipelineCard";
import {
  ArtifactActionCluster,
  buildClientMarkdownPreview,
  extractMarkdownOutline,
  MarkdownArtifactStrip,
  MarkdownDocumentView,
  SectionOutlineBar,
} from "./MarkdownArtifactStrip";
import {
  UploadAlertCircleIcon,
  UploadIndexReadyIcon,
  UploadProgressArcIcon,
} from "./UploadIcons";

const FIELD_CLASS =
  "w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 shadow-theme-xs outline-none transition placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder:text-gray-500";

const REPORT_AVATAR_TONES = [
  "bg-brand-50 text-brand-700 ring-brand-200/80 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30",
  "bg-sky-50 text-sky-700 ring-sky-200/80 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
  "bg-emerald-50 text-emerald-700 ring-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  "bg-violet-50 text-violet-700 ring-violet-200/80 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30",
  "bg-amber-50 text-amber-800 ring-amber-200/80 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
] as const;

function getReportAvatarTone(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return REPORT_AVATAR_TONES[Math.abs(hash) % REPORT_AVATAR_TONES.length]!;
}

function isHexObjectId(value?: string): boolean {
  return Boolean(value && /^[0-9a-fA-F]{24}$/.test(value.trim()));
}

function statusDotClasses(
  status: WorkReportStatus,
  hasContent: boolean,
): string {
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
        ? "bg-gray-700 dark:bg-gray-300"
        : "border border-gray-300 bg-transparent dark:border-gray-600";
  }
}

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function reportBodyText(report: WorkReport): string {
  return report.contentSchemaVersion === 2
    ? (report.contentMarkdown ?? report.content ?? "")
    : (report.content ?? report.contentMarkdown ?? "");
}

function hasReportContent(report: WorkReport): boolean {
  return Boolean((report.title ?? "").trim() || reportBodyText(report).trim());
}

function countCoreFields(report: WorkReport): number {
  let filled = 0;
  if ((report.title ?? "").trim()) filled += 1;
  if (reportBodyText(report).trim()) filled += 1;
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

function canReportControlKnowledge(report: WorkReport): boolean {
  if (report.status !== "APPROVED") {
    return Boolean(
      report.permissions.canControlKnowledge ??
        (report.permissions.canConfigure || report.permissions.canReview),
    );
  }
  return Boolean(
    report.permissions.canControlKnowledge ??
      (report.permissions.canConfigure ||
        report.permissions.canReview ||
        report.permissions.canEdit),
  );
}

function canReportPurgeArtifact(report: WorkReport): boolean {
  return Boolean(
    report.permissions.canPurgeArtifact ?? report.permissions.canConfigure,
  );
}

function isReportBulkSelectable(report: WorkReport): boolean {
  return Boolean(
    (report.permissions.canReview && report.status !== "APPROVED") ||
      (report.status === "APPROVED" &&
        (canReportControlKnowledge(report) || canReportPurgeArtifact(report))),
  );
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
      {[0, 1].map((idx) => (
        <span
          key={idx}
          className={`h-1.5 w-1.5 rounded-full ${
            idx < filled
              ? "bg-gray-800 dark:bg-gray-200"
              : "bg-gray-300 dark:bg-gray-700"
          }`}
        />
      ))}
    </span>
  );
}

function ReportEditor({
  report,
  effectiveStatus,
  initialDraft,
  canAutoApprove = false,
  isSaving,
  isSubmitting,
  error,
  isFocusReader,
  onToggleFocusReader,
  onBackToList,
  onSave,
  onSubmit,
  onClose,
  onAgent,
}: {
  report: WorkReport;
  effectiveStatus: WorkReportStatus;
  initialDraft?: WorkReportInput;
  canAutoApprove?: boolean;
  isSaving: boolean;
  isSubmitting: boolean;
  error: string;
  isFocusReader: boolean;
  onToggleFocusReader: () => void;
  onBackToList: () => void;
  onSave: (input: WorkReportInput) => Promise<void>;
  onSubmit: (
    input: WorkReportInput,
    options?: Readonly<{ autoApprove?: boolean }>,
  ) => Promise<void>;
  onClose?: () => void;
  onAgent?: (draft?: { title: string; contentMarkdown: string }) => void;
}) {
  const t = useTranslations("workNotes.reports");
  const tg = useTranslations("workNotes.governance");
  const format = useFormatter();
  const baseTitle = initialDraft?.title ?? report.title ?? "";
  const baseContent = initialDraft?.content ?? reportBodyText(report);
  const [form, setForm] = useState<WorkReportInput>({
    title: baseTitle,
    content: baseContent,
  });
  const [editorMode, setEditorMode] = useState<"write" | "preview">("write");
  const [validationError, setValidationError] = useState("");
  const [autoApprove, setAutoApprove] = useState(true);
  const trimmedBodyLen = (
    report.contentSchemaVersion === 2 ? reportBodyText(report) : form.content
  ).trim().length;
  const isShortContent = trimmedBodyLen > 0 && trimmedBodyLen < 30;
  const effectiveAutoApprove = autoApprove && !isShortContent;
  const canAutoApproveOnSubmit = autoApprove && trimmedBodyLen >= 30;
  const showShortContentNudge =
    canAutoApprove && autoApprove && isShortContent;

  async function submit(event: FormEvent<HTMLFormElement>, saveOnly: boolean) {
    event.preventDefault();
    await persist(saveOnly);
  }

  async function persist(saveOnly: boolean) {
    const cleaned: WorkReportInput =
      report.contentSchemaVersion === 2
        ? {
            title: (report.title ?? "").trim(),
            content: reportBodyText(report).trim(),
          }
        : {
            title: form.title.trim(),
            content: form.content.trim(),
          };
    if (
      report.contentSchemaVersion !== 2 &&
      (!cleaned.title || !cleaned.content)
    ) {
      setValidationError(t("coreRequired"));
      return;
    }
    setValidationError("");
    await (saveOnly
      ? onSave(cleaned)
      : onSubmit(
          cleaned,
          canAutoApprove ? { autoApprove: canAutoApproveOnSubmit } : undefined,
        ));
  }

  return (
    <form
      onSubmit={(event) => void submit(event, true)}
      className="flex h-full min-h-[480px] flex-col overflow-hidden bg-white dark:bg-gray-900"
    >
      {/* Compact Sticky Editor Header */}
      <header className="shrink-0 border-b border-gray-100 bg-white px-5 py-3.5 sm:px-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onBackToList}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 md:hidden dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{tg("backToListMobile")}</span>
            </button>

            <span
              className={cn(
                "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ring-1 ring-inset",
                getReportAvatarTone(report.memberId || report.memberName),
              )}
            >
              {initialsFromName(report.memberName)}
            </span>

            <h2 className="text-sm font-semibold tracking-tight text-gray-900 dark:text-white">
              {report.memberName}
            </h2>

            <ApprovalStatusBadge
              status={effectiveStatus}
              label={t(`status.${effectiveStatus}`)}
            />

            <span className="hidden text-xs tabular-nums text-gray-500 lg:inline dark:text-gray-400">
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
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {report.contentSchemaVersion !== 2 && (
              <div
                role="tablist"
                aria-label={t("title")}
                className="inline-flex h-8 items-center rounded-lg bg-gray-100/90 p-0.5 ring-1 ring-inset ring-gray-200/75 dark:bg-gray-800 dark:ring-gray-700"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={editorMode === "write"}
                  onClick={() => setEditorMode("write")}
                  className={cn(
                    "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-all",
                    editorMode === "write"
                      ? "bg-white text-gray-900 shadow-theme-xs ring-1 ring-gray-200/70 dark:bg-gray-900 dark:text-white dark:ring-gray-700"
                      : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
                  )}
                >
                  <FileEdit className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t("editorWriteTab")}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={editorMode === "preview"}
                  onClick={() => setEditorMode("preview")}
                  className={cn(
                    "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-xs font-medium transition-all",
                    editorMode === "preview"
                      ? "bg-white text-gray-900 shadow-theme-xs ring-1 ring-gray-200/70 dark:bg-gray-900 dark:text-white dark:ring-gray-700"
                      : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
                  )}
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>{t("editorPreviewTab")}</span>
                </button>
              </div>
            )}

            {onAgent && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  if (
                    report.contentSchemaVersion !== 2 &&
                    (form.title !== baseTitle || form.content !== baseContent)
                  ) {
                    onAgent({
                      title: form.title,
                      contentMarkdown: form.content,
                    });
                  } else {
                    onAgent();
                  }
                }}
              >
                {t("agentEdit")}
              </Button>
            )}

            <button
              type="button"
              onClick={onToggleFocusReader}
              aria-pressed={isFocusReader}
              title={
                isFocusReader ? tg("focusReaderExit") : tg("focusReaderEnter")
              }
              aria-label={
                isFocusReader ? tg("focusReaderExit") : tg("focusReaderEnter")
              }
              className={cn(
                "hidden h-8 w-8 items-center justify-center rounded-lg border transition-colors md:inline-flex",
                isFocusReader
                  ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
                  : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white",
              )}
            >
              {isFocusReader ? (
                <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Bounded Scrollable Editor Body */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
        {report.contentSchemaVersion === 2 ? (
          <div className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/40 p-4 dark:border-gray-800 dark:bg-gray-950/40">
            <p className="text-base font-semibold text-gray-900 dark:text-white">
              {report.title}
            </p>
            <MarkdownDocumentView
              markdown={reportBodyText(report)}
              omitTopHeading={report.title}
            />
          </div>
        ) : editorMode === "preview" ? (
          form.title.trim() || form.content.trim() ? (
            <div className="space-y-4">
              {form.title.trim() && (
                <h3 className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white">
                  {form.title.trim()}
                </h3>
              )}
              <MarkdownDocumentView
                markdown={form.content}
                omitTopHeading={form.title}
              />
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/40 px-4 py-12 text-center text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-950/30 dark:text-gray-400">
              {t("editorPreviewEmpty")}
            </div>
          )
        ) : (
          <>
            <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
              <span>
                {t("reportTitleLabel")}
                <span className="ms-0.5 text-error-600">*</span>
              </span>
              <input
                type="text"
                required
                maxLength={240}
                placeholder={t("reportTitlePlaceholder")}
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                className={FIELD_CLASS}
              />
            </label>

            <label className="grid min-w-0 gap-1.5 text-xs font-semibold text-gray-700 dark:text-gray-300">
              <span>
                {t("reportContentLabel")}
                <span className="ms-0.5 text-error-600">*</span>
              </span>
              <textarea
                required
                maxLength={100000}
                rows={12}
                placeholder={t("reportContentPlaceholder")}
                value={form.content}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    content: event.target.value,
                  }))
                }
                className={`${FIELD_CLASS} resize-y font-mono text-xs leading-relaxed`}
              />
            </label>
          </>
        )}

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

      {/* Pinned Bottom Editor Actions */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-gray-200/90 bg-gray-50/85 px-5 py-2.5 sm:px-6 dark:border-gray-800 dark:bg-gray-900/90">
        {canAutoApprove && (
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              role="switch"
              aria-checked={effectiveAutoApprove}
              data-testid="report-auto-approve-toggle"
              onClick={() => setAutoApprove((prev) => !prev)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-[11px] font-medium transition-colors",
                effectiveAutoApprove
                  ? "border-emerald-200/80 bg-emerald-50/70 text-emerald-800 hover:bg-emerald-100/70 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-emerald-300"
                  : "border-amber-200/80 bg-amber-50/70 text-amber-800 hover:bg-amber-100/70 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-300",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  effectiveAutoApprove ? "bg-emerald-500" : "bg-amber-500",
                )}
              />
              <span>
                {t(
                  effectiveAutoApprove
                    ? "autoApproveToggleOn"
                    : "autoApproveToggleOff",
                )}
              </span>
              <span
                className={cn(
                  "rounded px-1 py-0.5 font-mono text-[10px] font-semibold tabular-nums",
                  effectiveAutoApprove
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                    : "bg-amber-500/15 text-amber-700 dark:text-amber-300",
                )}
              >
                {t(
                  effectiveAutoApprove
                    ? "autoApproveBadgeOn"
                    : "autoApproveBadgeOff",
                )}
              </span>
            </button>
            {showShortContentNudge && (
              <button
                type="button"
                data-testid="report-short-content-nudge"
                onClick={() => setAutoApprove(false)}
                className="inline-flex h-6 items-center gap-1 rounded-md border border-amber-300/80 bg-amber-50/90 px-2 text-[11px] font-medium text-amber-800 transition-colors hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-200"
              >
                <span>{t("shortContentNudge", { count: trimmedBodyLen })}</span>
              </button>
            )}
          </div>
        )}
        <div className="ms-auto flex flex-wrap items-center gap-2">
          {onClose && (
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              {t("closeEditor")}
            </Button>
          )}
          {report.contentSchemaVersion !== 2 && (
            <Button
              type="submit"
              variant="outline"
              size="sm"
              isLoading={isSaving}
            >
              {t("saveDraft")}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            isLoading={isSubmitting}
            onClick={() => void persist(false)}
          >
            {t("submit")}
          </Button>
        </div>
      </div>
    </form>
  );
}

function WorkReportReadingPane({
  projectId,
  report,
  activeScope,
  effectiveStatus,
  memberDirectory,
  resolvedReviewer,
  isReviewPending,
  isFocusReader,
  isBulkActive = false,
  onToggleFocusReader,
  onBackToList,
  onOpenEditor,
  onReview,
}: Readonly<{
  projectId: string;
  report: WorkReport;
  activeScope: WorkReportScope;
  effectiveStatus: WorkReportStatus;
  memberDirectory: ReadonlyMap<string, string>;
  resolvedReviewer?: string;
  isReviewPending: boolean;
  isFocusReader: boolean;
  isBulkActive?: boolean;
  onToggleFocusReader: () => void;
  onBackToList: () => void;
  onOpenEditor: () => void;
  onReview: (
    reportId: string,
    action: "approve" | "request-changes" | "reject",
    comment: string,
  ) => Promise<void>;
}>) {
  const t = useTranslations("workNotes.reports");
  const tg = useTranslations("workNotes.governance");
  const common = useTranslations("workNotes");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const reportScrollRef = useRef<HTMLDivElement>(null);

  const [viewMode, setViewMode] = useState<"rendered" | "markdown">("rendered");
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [isPipelineBusy, setIsPipelineBusy] = useState(false);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [manualSyncTriggered, setManualSyncTriggered] = useState(false);

  const hasContent = hasReportContent(report);
  const isApproved = report.status === "APPROVED";
  const versionNo = report.currentVersionNumber ?? 1;
  const canDownloadR2 = isApproved && Boolean(report.file);

  const statusQuery = useWorkReportKnowledgeStatusQuery(
    projectId,
    report.id,
    isApproved && Boolean(report.knowledgeSync || manualSyncTriggered),
  );
  const liveSync = statusQuery.data ?? report.knowledgeSync;

  const shouldLoadChunks =
    isApproved &&
    ((liveSync?.chunkCount ?? 0) > 0 ||
      liveSync?.knowledgeReady === true ||
      liveSync?.searchReady === true ||
      liveSync?.status === "KNOWLEDGE_READY" ||
      liveSync?.status === "SEARCH_READY" ||
      liveSync?.status === "COMPLETED");

  const chunksQuery = useWorkReportKnowledgeChunksQuery(
    projectId,
    report.id,
    shouldLoadChunks,
    report.currentVersionNumber,
  );

  const previewArtifact = useMemo(() => {
    const periodLabel = `${report.periodStart.slice(0, 10)} → ${report.periodEnd.slice(0, 10)}`;
    return buildClientMarkdownPreview({
      kind: "WORK_REPORT",
      title: report.title?.trim() || `${report.memberName}`,
      version: versionNo,
      authorName: report.memberName,
      scope: report.reportScope ?? activeScope,
      frequency: report.frequency,
      periodLabel,
      contentMarkdown: reportBodyText(report),
    });
  }, [report, activeScope, versionNo]);

  const outlineItems = useMemo(
    () =>
      hasContent
        ? extractMarkdownOutline(previewArtifact.markdownSource, report.title)
        : [],
    [hasContent, previewArtifact.markdownSource, report.title],
  );

  const reviewHistoryEntries = useMemo<GovernanceReviewHistoryEntry[]>(() => {
    const rawHistory = report.reviewHistory ?? [];
    return rawHistory.map((evt) => {
      const actorLabel =
        memberDirectory.get(evt.reviewerId) ||
        (report.reviewedBy === evt.reviewerId
          ? report.reviewerName
          : undefined) ||
        (isHexObjectId(evt.reviewerId)
          ? common("documents.reviewerActor")
          : evt.reviewerId);
      const formattedDate = format.dateTime(new Date(evt.at), {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      });
      return {
        action: evt.action,
        actionLabel: t(`status.${evt.action}`),
        reviewerId: evt.reviewerId,
        actorLabel,
        at: evt.at,
        formattedDate,
        comment: evt.comment,
      };
    });
  }, [
    report.reviewHistory,
    report.reviewedBy,
    report.reviewerName,
    memberDirectory,
    common,
    format,
    t,
  ]);

  const invalidateReportQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: workNoteKeys.project(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: workNoteKeys.reportKnowledgeStatus(projectId, report.id),
      }),
      queryClient.invalidateQueries({
        queryKey: workNoteKeys.reportKnowledgeChunks(
          projectId,
          report.id,
          report.currentVersionNumber,
        ),
      }),
    ]);
  };

  const handleDownload = async () => {
    setIsDownloading(true);
    setPipelineError(null);
    try {
      await workNotesApi.downloadWorkReportFile(projectId, report.id);
    } catch (error) {
      setPipelineError(
        error instanceof Error
          ? error.message
          : common("taskNotes.saveError"),
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePipelineAction = async (action: SagPipelineAction) => {
    setIsPipelineBusy(true);
    setPipelineError(null);
    setManualSyncTriggered(true);
    try {
      const nextStatus =
        action === "SYNC"
          ? await workNotesApi.syncWorkReportToSag(projectId, report.id)
          : await workNotesApi.controlWorkReportKnowledge(
              projectId,
              report.id,
              action,
            );
      queryClient.setQueryData(
        workNoteKeys.reportKnowledgeStatus(projectId, report.id),
        nextStatus,
      );
      await invalidateReportQueries();
    } catch (error) {
      setPipelineError(
        error instanceof Error
          ? error.message
          : common("taskNotes.saveError"),
      );
    } finally {
      setIsPipelineBusy(false);
    }
  };

  const handlePurgeArtifact = async (options: PurgeArtifactOptions) => {
    setIsPipelineBusy(true);
    setPipelineError(null);
    try {
      await workNotesApi.purgeWorkReportFile(projectId, report.id, options);
      await invalidateReportQueries();
    } catch (error) {
      setPipelineError(
        error instanceof Error
          ? error.message
          : common("taskNotes.saveError"),
      );
    } finally {
      setIsPipelineBusy(false);
    }
  };

  const handleReviewDecision = async (
    action: "approve" | "request-changes" | "reject",
  ) => {
    const trimmed = reviewComment.trim();
    if ((action === "request-changes" || action === "reject") && !trimmed) {
      setReviewError(t("reviewCommentRequired"));
      return;
    }
    setReviewError(null);
    try {
      await onReview(report.id, action, trimmed);
      setReviewComment("");
      if (action === "approve") {
        setManualSyncTriggered(true);
      }
    } catch {
      // Preserve comment if mutation fails; parent alert displays error.
    }
  };

  const canMakeReviewDecision =
    report.permissions.canReview &&
    report.status !== "APPROVED" &&
    !isBulkActive;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white dark:bg-gray-900">
      {/* Single Say-It-Once Sticky Header */}
      <header className="shrink-0 border-b border-gray-100 bg-white px-5 py-3 sm:px-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onBackToList}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 md:hidden dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{tg("backToListMobile")}</span>
            </button>

            <span className="inline-flex items-center rounded-md border border-gray-200/90 bg-gray-50/80 px-2 py-0.5 text-[11px] font-medium tabular-nums text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
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

            <ApprovalStatusBadge
              status={effectiveStatus}
              label={t(`status.${effectiveStatus}`)}
            />

            {report.reportScope && report.reportScope !== activeScope && (
              <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10.5px] font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {report.reportScope === "LEADER"
                  ? t("leaderReportBadge")
                  : t("memberReportBadge")}
              </span>
            )}

            <span className="rounded-md border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
              {tg("versionBadge", { version: versionNo })}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {hasContent && (
              <ArtifactActionCluster
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                markdownSource={previewArtifact.markdownSource}
                isApproved={canDownloadR2}
                onDownload={handleDownload}
                isDownloading={isDownloading}
                compactCopy={Boolean(report.permissions.canEdit)}
              />
            )}

            {report.permissions.canEdit && (
              <button
                type="button"
                onClick={onOpenEditor}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white shadow-theme-xs transition-colors hover:bg-brand-600"
              >
                <PencilIcon className="h-3.5 w-3.5" />
                <span>{hasContent ? t("editReport") : t("writeReportCta")}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleFocusReader}
              aria-pressed={isFocusReader}
              title={
                isFocusReader ? tg("focusReaderExit") : tg("focusReaderEnter")
              }
              aria-label={
                isFocusReader ? tg("focusReaderExit") : tg("focusReaderEnter")
              }
              className={cn(
                "hidden h-8 w-8 items-center justify-center rounded-lg border transition-colors md:inline-flex",
                isFocusReader
                  ? "border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300"
                  : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white",
              )}
            >
              {isFocusReader ? (
                <PanelLeftOpen className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <PanelLeftClose className="h-3.5 w-3.5" aria-hidden="true" />
              )}
            </button>
          </div>
        </div>

        {/* Say-It-Once Title & Single Metadata Line */}
        {hasContent ? (
          <div className="mt-2.5 space-y-1.5">
            {Boolean(report.title?.trim()) && (
              <h3 className="text-lg font-semibold tracking-tight break-words text-gray-900 dark:text-white">
                {report.title}
              </h3>
            )}

            <div
              aria-label={t("systemMetadataLabel")}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs tabular-nums text-gray-500 dark:text-gray-400"
            >
              <span
                className={cn(
                  "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9.5px] font-semibold ring-1 ring-inset",
                  getReportAvatarTone(report.memberId || report.memberName),
                )}
              >
                {initialsFromName(report.memberName)}
              </span>
              <h2 className="text-xs font-semibold text-gray-800 dark:text-gray-200">
                {report.memberName}
              </h2>

              <span aria-hidden="true">·</span>
              <span>
                {t("due", {
                  date: format.dateTime(new Date(report.dueAt), {
                    dateStyle: "medium",
                    timeZone: "UTC",
                  }),
                })}
              </span>

              {report.submittedAt &&
              Number.isFinite(Date.parse(report.submittedAt)) ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t("submittedAtMeta", {
                      date: format.dateTime(new Date(report.submittedAt), {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "UTC",
                      }),
                    })}
                  </span>
                </>
              ) : Number.isFinite(Date.parse(report.updatedAt)) ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t("updatedAtMeta", {
                      date: format.dateTime(new Date(report.updatedAt), {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "UTC",
                      }),
                    })}
                  </span>
                </>
              ) : null}

              {resolvedReviewer && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t("reviewedByMeta", { reviewer: resolvedReviewer })}
                  </span>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="mt-2.5 flex flex-wrap items-center gap-2.5">
            <span
              className={cn(
                "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10.5px] font-semibold ring-1 ring-inset",
                getReportAvatarTone(report.memberId || report.memberName),
              )}
            >
              {initialsFromName(report.memberName)}
            </span>
            <h2 className="text-base font-semibold tracking-tight text-gray-900 dark:text-white">
              {report.memberName}
            </h2>
            <span className="text-xs tabular-nums text-gray-500 dark:text-gray-400">
              ·{" "}
              {t("due", {
                date: format.dateTime(new Date(report.dueAt), {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }),
              })}
            </span>
          </div>
        )}
      </header>

      {/* Conditional Section Outline Bar (>= 3 headings & rendered mode) */}
      {hasContent && viewMode === "rendered" ? (
        <SectionOutlineBar
          items={outlineItems}
          scrollContainerRef={reportScrollRef}
        />
      ) : null}

      {/* Bounded Scrollable Editorial Reader */}
      <div
        ref={reportScrollRef}
        data-testid="work-report-reader-scroll"
        className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6"
      >
        {hasContent ? (
          <>
            {report.reviewComment && (
              <div
                className={cn(
                  "max-w-[72ch] rounded-xl px-4 py-3 text-xs ring-1 ring-inset",
                  report.status === "REJECTED"
                    ? "bg-rose-50/70 text-rose-950 ring-rose-200/80 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/25"
                    : "bg-amber-50/70 text-amber-950 ring-amber-200/80 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/25",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider",
                      report.status === "REJECTED"
                        ? "text-rose-700 dark:text-rose-300"
                        : "text-amber-800 dark:text-amber-300",
                    )}
                  >
                    <MessageSquareText className="h-3 w-3" />
                    <span>{t("reviewComment")}</span>
                  </span>
                  {resolvedReviewer ? (
                    <span className="text-[11px] font-medium opacity-80">
                      {resolvedReviewer}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 whitespace-pre-wrap leading-relaxed">
                  {report.reviewComment}
                </p>
              </div>
            )}

            <MarkdownArtifactStrip
              variant="editorial"
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              isApproved={isApproved}
              file={report.file}
              storageReference={report.storageReference}
              previewFileName={previewArtifact.previewFileName}
              markdownSource={previewArtifact.markdownSource}
              previewByteLength={previewArtifact.byteLength}
              omitTopHeading={report.title}
              isDownloading={isDownloading}
              onDownload={canDownloadR2 ? handleDownload : undefined}
            />
          </>
        ) : (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center py-10 text-center">
            <p
              className={`text-sm font-semibold ${
                effectiveStatus === "OVERDUE"
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-gray-800 dark:text-gray-200"
              }`}
            >
              {effectiveStatus === "OVERDUE"
                ? t("overdueEmptyTitle")
                : report.permissions.canEdit
                  ? t("yourReportEmptyTitle")
                  : t("emptyReportContent")}
            </p>
            <p className="mt-1 text-xs tabular-nums text-gray-400 dark:text-gray-500">
              {t("due", {
                date: format.dateTime(new Date(report.dueAt), {
                  dateStyle: "medium",
                  timeZone: "UTC",
                }),
              })}{" "}
              ·{" "}
              {t("sectionsProgress", {
                filled: countCoreFields(report),
              })}
            </p>

            {report.permissions.canEdit && (
              <div className="mt-4">
                <Button type="button" size="sm" onClick={onOpenEditor}>
                  <PencilIcon className="me-1.5 h-3.5 w-3.5" />
                  {t("writeReportCta")}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Pinned Bottom Bar: Review Decision OR Knowledge Telemetry Dock */}
      {canMakeReviewDecision ? (
        <PinnedReviewDecisionBar
          status={effectiveStatus}
          comment={reviewComment}
          onCommentChange={(val) => {
            if (reviewError) setReviewError(null);
            setReviewComment(val);
          }}
          commentAriaLabel={t("reviewComment")}
          commentPlaceholder={t("reviewCommentPlaceholder")}
          commentRequiredMessage={t("reviewCommentRequired")}
          approveLabel={t("approve")}
          requestChangesLabel={t("requestChanges")}
          rejectLabel={t("reject")}
          inspectTriggerLabel={tg("inspectDrawerTrigger")}
          isBusy={isReviewPending}
          error={reviewError}
          onDecision={handleReviewDecision}
          onOpenInspector={() => setIsInspectorOpen(true)}
        />
      ) : hasContent ? (
        <KnowledgeTelemetryDock
          status={effectiveStatus}
          knowledgeSync={liveSync}
          file={report.file}
          storageReference={report.storageReference}
          reviewHistoryCount={reviewHistoryEntries.length}
          canControl={canReportControlKnowledge(report)}
          isBusy={isPipelineBusy}
          inspectTriggerLabel={tg("inspectDrawerTrigger")}
          onQuickSync={() => void handlePipelineAction("SYNC")}
          onOpenInspector={() => setIsInspectorOpen(true)}
        />
      ) : null}

      {/* On-Demand Slide-Over Knowledge & Governance Inspector */}
      <KnowledgeGovernanceDrawer
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        title={report.title?.trim() || report.memberName}
        status={effectiveStatus}
        statusLabel={t(`status.${effectiveStatus}`)}
        version={versionNo}
        previewFileName={previewArtifact.previewFileName}
        previewByteLength={previewArtifact.byteLength}
        file={report.file}
        storageReference={report.storageReference}
        knowledgeSync={liveSync}
        chunksData={chunksQuery.data}
        isChunksPending={chunksQuery.isPending}
        reviewHistory={reviewHistoryEntries}
        canControl={canReportControlKnowledge(report)}
        canPurge={canReportPurgeArtifact(report)}
        canReopen={Boolean(
          report.permissions.canConfigure || report.permissions.canReview,
        )}
        isBusy={isPipelineBusy}
        isDownloading={isDownloading}
        controlError={pipelineError}
        onDownload={canDownloadR2 ? handleDownload : undefined}
        onAction={handlePipelineAction}
        onPurgeArtifact={handlePurgeArtifact}
      />
    </div>
  );
}

export default function ProjectWorkReportsWorkspace({
  projectId,
}: {
  projectId: string;
}) {
  const t = useTranslations("workNotes.reports");
  const tg = useTranslations("workNotes.governance");
  const common = useTranslations("workNotes");
  const format = useFormatter();
  const queryClient = useQueryClient();

  const [agentReportId, setAgentReportId] = useState<string | null>(null);
  const [agentReportSeed, setAgentReportSeed] = useState<{
    title: string;
    contentMarkdown: string;
  } | null>(null);
  const [reportDraftOverrides, setReportDraftOverrides] = useState<
    Record<string, { versionKey: string; seq: number; input: WorkReportInput }>
  >({});
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
  const [isFocusReader, setIsFocusReader] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);
  const [selectedBulkIds, setSelectedBulkIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isBulkBusy, setIsBulkBusy] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);
  const splitRoster = useResizableSplitWidth({
    storageKey: "continuum:work-reports:roster-width",
    defaultWidth: 300,
    minWidth: 240,
    maxWidth: 480,
  });

  const memberSettings = useWorkReportSettingsQuery(projectId, "MEMBER");
  const settings = useWorkReportSettingsQuery(projectId, activeScope);
  const reportsQuery = useWorkReportsQuery(projectId, "ALL", page, activeScope);

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

  const memberDirectory = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of allScopeReports) {
      if (r.memberId && r.memberName) {
        map.set(r.memberId, r.memberName);
      }
      if (r.reviewedBy && r.reviewerName) {
        map.set(r.reviewedBy, r.reviewerName);
      }
    }
    return map;
  }, [allScopeReports]);

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
      if (
        query &&
        !report.memberName.toLowerCase().includes(query) &&
        !(report.title ?? "").toLowerCase().includes(query) &&
        !reportBodyText(report).toLowerCase().includes(query)
      ) {
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

  const selectableRosterReports = useMemo(
    () => sortedReports.filter(isReportBulkSelectable),
    [sortedReports],
  );

  const selectedBulkReports = useMemo(
    () => sortedReports.filter((r) => selectedBulkIds.has(r.id)),
    [sortedReports, selectedBulkIds],
  );

  const bulkCounts = useMemo(() => {
    let reviewableCount = 0;
    let approvedControlCount = 0;
    let purgeableCount = 0;
    for (const item of selectedBulkReports) {
      if (item.permissions.canReview && item.status !== "APPROVED") {
        reviewableCount += 1;
      }
      if (item.status === "APPROVED" && canReportControlKnowledge(item)) {
        approvedControlCount += 1;
      }
      if (
        item.status === "APPROVED" &&
        Boolean(item.file) &&
        canReportPurgeArtifact(item)
      ) {
        purgeableCount += 1;
      }
    }
    return { reviewableCount, approvedControlCount, purgeableCount };
  }, [selectedBulkReports]);

  const allRosterSelected =
    selectableRosterReports.length > 0 &&
    selectableRosterReports.every((item) => selectedBulkIds.has(item.id));

  const toggleSelectAllRoster = () => {
    setBulkFeedback(null);
    if (allRosterSelected) {
      setSelectedBulkIds(new Set());
    } else {
      setSelectedBulkIds(new Set(selectableRosterReports.map((r) => r.id)));
    }
  };

  const toggleSelectReport = (id: string) => {
    setBulkFeedback(null);
    setSelectedBulkIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleExecuteBulk = async (
    action: BulkCommandAction,
    comment?: string,
  ) => {
    if (action === "DELETE") return;
    const targetIds = selectedBulkReports
      .filter((item) => {
        if (
          action === "APPROVE" ||
          action === "REQUEST_CHANGES" ||
          action === "REJECT"
        ) {
          return item.permissions.canReview && item.status !== "APPROVED";
        }
        if (action === "PURGE_ARTIFACT") {
          return (
            item.status === "APPROVED" &&
            Boolean(item.file) &&
            canReportPurgeArtifact(item)
          );
        }
        return item.status === "APPROVED" && canReportControlKnowledge(item);
      })
      .map((item) => item.id);

    if (targetIds.length === 0) return;
    setIsBulkBusy(true);
    setBulkFeedback(null);
    try {
      const result = await workNotesApi.bulkWorkReportAction(projectId, {
        ids: targetIds,
        action,
        ...(comment ? { comment } : {}),
      });
      await queryClient.invalidateQueries({
        queryKey: workNoteKeys.project(projectId),
      });
      setSelectedBulkIds(new Set());
      setBulkFeedback(
        result.failed.length > 0
          ? tg("bulkResultPartialError", {
              succeeded: result.succeededIds.length,
              total: result.requestedCount,
              failed: result.failed.length,
            })
          : tg("bulkResultSummary", {
              succeeded: result.succeededIds.length,
              total: result.requestedCount,
            }),
      );
    } catch (error) {
      setBulkFeedback(
        error instanceof Error ? error.message : t("permissionDenied"),
      );
    } finally {
      setIsBulkBusy(false);
    }
  };

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
  const reportAction = useWorkNotesMutation(
    (
      input: Readonly<{
        id: string;
        action: "submit" | "approve" | "request-changes" | "reject";
        comment?: string;
        autoApprove?: boolean;
      }>,
    ) =>
      workNotesApi.reportAction(
        projectId,
        input.id,
        input.action,
        input.comment,
        input.autoApprove !== undefined
          ? { autoApprove: input.autoApprove }
          : undefined,
      ),
    [workNoteKeys.project(projectId)],
  );

  async function saveReportDraft(report: WorkReport, input: WorkReportInput) {
    saveReport.reset();
    updateReport.reset();
    reportAction.reset();
    if (report.contentSchemaVersion === 2) {
      return report;
    }
    return report.id === editableCurrentReport?.id
      ? saveReport.mutateAsync(input)
      : updateReport.mutateAsync({ id: report.id, input });
  }

  async function submitReport(
    report: WorkReport,
    input: WorkReportInput,
    options?: Readonly<{ autoApprove?: boolean }>,
  ) {
    try {
      saveReport.reset();
      updateReport.reset();
      reportAction.reset();
      const saved =
        report.contentSchemaVersion === 2
          ? report
          : await saveReportDraft(report, input);
      await reportAction.mutateAsync({
        id: saved.id,
        action: "submit",
        ...(options?.autoApprove !== undefined
          ? { autoApprove: options.autoApprove }
          : {}),
      });
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

  const reportError =
    saveReport.error instanceof Error
      ? saveReport.error.message
      : updateReport.error instanceof Error
        ? updateReport.error.message
        : reportAction.error instanceof Error
          ? reportAction.error.message
          : "";

  const submittedInPeriod =
    periodMetrics.approved + periodMetrics.pendingReview;
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

  const resolvedSelectedReviewer = useMemo(() => {
    if (!selectedReport?.reviewedBy) return undefined;
    if (selectedReport.reviewerName) return selectedReport.reviewerName;
    const fromRoster = memberDirectory.get(selectedReport.reviewedBy);
    if (fromRoster) return fromRoster;
    return isHexObjectId(selectedReport.reviewedBy)
      ? undefined
      : selectedReport.reviewedBy;
  }, [selectedReport, memberDirectory]);

  function renderRosterItem(item: WorkReport) {
    const isSelected = selectedReport?.id === item.id;
    const hasContent = hasReportContent(item);
    const effectiveStatus = resolveEffectiveStatus(item, currentTime);
    const coreFilled = countCoreFields(item);
    const reportTitle = (item.title ?? "").trim();
    const canBulkSelect = isReportBulkSelectable(item);
    const isChecked = selectedBulkIds.has(item.id);
    const avatarTone = getReportAvatarTone(item.memberId || item.memberName);

    return (
      <div
        key={item.id}
        className={cn(
          "flex items-center transition-colors",
          isSelected
            ? "bg-brand-50/60 shadow-[inset_2px_0_0_0_var(--color-brand-500)] dark:bg-brand-500/12"
            : isChecked
              ? "bg-brand-25/85 dark:bg-brand-500/8"
              : "hover:bg-gray-50/80 dark:hover:bg-gray-800/40",
        )}
      >
        {canBulkSelect && (
          <div className="ps-3.5">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => toggleSelectReport(item.id)}
              aria-label={tg("selectItemAria", {
                title: reportTitle || item.memberName,
              })}
              className="h-3.5 w-3.5 cursor-pointer rounded border-gray-300 accent-brand-500 text-brand-600 focus:ring-brand-500/20"
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => {
            setSelectedReportId(item.id);
            setMobileDetailOpen(true);
            if (editingReportId && editingReportId !== item.id) {
              setEditingReportId("");
            }
          }}
          className={cn(
            "flex min-w-0 flex-1 items-center justify-between gap-2 py-2.5 pe-3.5 text-start",
            canBulkSelect ? "ps-2.5" : "ps-3.5",
          )}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className={cn(
                "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ring-1 ring-inset",
                avatarTone,
              )}
            >
              {initialsFromName(item.memberName)}
            </span>
            <div className="min-w-0">
              <div
                className={cn(
                  "truncate text-xs",
                  isSelected
                    ? "font-semibold text-brand-950 dark:text-white"
                    : hasContent ||
                        effectiveStatus !== "DRAFT" ||
                        item.permissions.canEdit
                      ? "font-medium text-gray-800 dark:text-gray-200"
                      : "text-gray-500 dark:text-gray-400",
                )}
              >
                {item.memberName}
                {item.permissions.canEdit ? ` ${t("youSuffix")}` : ""}
              </div>
              {(reportTitle || effectivePeriod === "ALL") && (
                <div className="truncate text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                  {effectivePeriod === "ALL"
                    ? `${format.dateTime(new Date(item.periodStart), {
                        dateStyle: "short",
                        timeZone: "UTC",
                      })}${reportTitle ? ` · ${reportTitle}` : ""}`
                    : reportTitle}
                </div>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {effectiveStatus === "DRAFT" && hasContent ? (
              <MiniProgressDots
                filled={coreFilled}
                label={t("sectionsProgress", { filled: coreFilled })}
              />
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 dark:text-gray-300">
                {effectiveStatus === "APPROVED" && item.knowledgeSync && (
                  <>
                    {isKnowledgeSyncActive(item.knowledgeSync) ? (
                      <UploadProgressArcIcon className="h-3 w-3 shrink-0 animate-spin text-brand-500" />
                    ) : item.knowledgeSync.status === "FAILED" ||
                      item.knowledgeSync.status === "INDEX_FAILED" ? (
                      <UploadAlertCircleIcon className="h-3 w-3 shrink-0 text-rose-500" />
                    ) : item.knowledgeSync.knowledgeReady ||
                      item.knowledgeSync.searchReady ||
                      item.knowledgeSync.status === "KNOWLEDGE_READY" ||
                      item.knowledgeSync.status === "SEARCH_READY" ||
                      item.knowledgeSync.status === "COMPLETED" ? (
                      <UploadIndexReadyIcon className="h-3 w-3 shrink-0 text-emerald-500" />
                    ) : null}
                  </>
                )}
                <span>{t(`status.${effectiveStatus}`)}</span>
              </span>
            )}
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClasses(
                effectiveStatus,
                hasContent,
              )}`}
            />
          </div>
        </button>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-3 pb-2 sm:px-6 lg:px-8">
      <WorkNotesPageHeader projectId={projectId} active="reports" />

      <div className="space-y-3">
        {/* PAST-OVERDUE STRIP */}
        {hiddenPastOverdueReports.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setPeriodFilter("ALL");
              setStatusFilter("OVERDUE");
              setSelectedReportId(hiddenPastOverdueReports[0]?.id ?? "");
            }}
            className="flex w-full items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50/75 px-4 py-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100/75 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
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
          reportsQuery.isRefetchError && (
            <div>
              <BackgroundRefreshError
                retryLabel={common("retry")}
                onRetry={() => void reportsQuery.refetch()}
              >
                {common("updateFailed")}
              </BackgroundRefreshError>
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

        {/* VIEWPORT-BOUNDED CONTINUUM SPLIT WORKBENCH */}
        <section
          aria-label={t("title")}
          className="overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
        >
          {/* ROW 1: COMPACT CYCLE, SCOPE & AI REMINDER BAR */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-2.5 sm:px-5 dark:border-gray-800">
            {settings.isPending && !settingsData && !memberSettingsData ? (
              <div className="h-8 w-60 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
            ) : canSwitchLeaderTier ? (
              <nav
                aria-label={t("title")}
                className="inline-flex flex-wrap items-center gap-0.5 rounded-lg bg-gray-100/85 p-0.5 ring-1 ring-inset ring-gray-200/60 dark:bg-gray-800 dark:ring-gray-700"
              >
                <button
                  type="button"
                  onClick={() => {
                    setActiveScope("MEMBER");
                    setPeriodFilter("DEFAULT");
                    setStatusFilter("ALL");
                    setSelectedReportId("");
                    setEditingReportId("");
                    setSelectedBulkIds(new Set());
                    setPage(1);
                  }}
                  className={cn(
                    "inline-flex min-h-7 items-center gap-2 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                    activeScope === "MEMBER"
                      ? "bg-white text-gray-900 shadow-theme-xs ring-1 ring-gray-200/70 dark:bg-gray-900 dark:text-white dark:ring-gray-700"
                      : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
                  )}
                >
                  <GroupIcon className="h-3.5 w-3.5 shrink-0 text-brand-500" />
                  <span>{t("tabs.memberReports")}</span>
                  {(memberSettingsData?.frequency ??
                    (activeScope === "MEMBER"
                      ? settingsData?.frequency
                      : undefined)) && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 font-mono text-[10px] font-semibold tabular-nums",
                        activeScope === "MEMBER"
                          ? "bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300"
                          : "bg-white/80 text-gray-500 dark:bg-gray-900 dark:text-gray-400",
                      )}
                    >
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
                    setSelectedBulkIds(new Set());
                    setPage(1);
                  }}
                  className={cn(
                    "inline-flex min-h-7 items-center gap-2 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                    activeScope === "LEADER"
                      ? "bg-white text-gray-900 shadow-theme-xs ring-1 ring-gray-200/70 dark:bg-gray-900 dark:text-white dark:ring-gray-700"
                      : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
                  )}
                >
                  <UserCircleIcon className="h-3.5 w-3.5 shrink-0 text-brand-500" />
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
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 font-mono text-[10px] font-semibold tabular-nums",
                        activeScope === "LEADER"
                          ? "bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300"
                          : "bg-white/80 text-gray-500 dark:bg-gray-900 dark:text-gray-400",
                      )}
                    >
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
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-200/70 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30">
                  <LockIcon className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs font-semibold text-gray-900 dark:text-white/90">
                  {t("mandatoryScheduleLabel")}
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              {!reportsQuery.isPending &&
                !reportsQuery.isError &&
                allScopeReports.length > 0 &&
                activePeriodReports.length === 0 && (
                  <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
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
                    setSelectedBulkIds(new Set());
                  }}
                  className="h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold tabular-nums text-gray-800 shadow-theme-xs transition outline-none hover:border-gray-300 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
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

              {settingsData && (
                <WorkReportReminderSettings
                  key={`${activeScope}:${settingsData.reminderLeadMinutes ?? "off"}`}
                  variant="toolbar"
                  projectId={projectId}
                  scope={activeScope}
                  leadMinutes={settingsData.reminderLeadMinutes ?? null}
                  canConfigure={settingsData.permissions.canConfigure}
                />
              )}
            </div>
          </div>

          {reportsQuery.isPending && !reportsData ? (
            <div
              role="status"
              aria-label={common("loading")}
              className="grid min-h-96 grid-cols-1 md:grid-cols-12"
            >
              <div className="space-y-2 border-b border-gray-100 bg-gray-50/40 p-3.5 md:col-span-4 md:border-e md:border-b-0 dark:border-gray-800 dark:bg-gray-950/30">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className="h-12 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800"
                  />
                ))}
              </div>
              <div className="space-y-4 p-6 md:col-span-8">
                <div className="h-12 w-2/3 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
                <div className="h-36 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
              </div>
            </div>
          ) : reportsQuery.isError && !reportsData ? (
            <div
              role="alert"
              className="m-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-4 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
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
            <>
              {/* ROW 2: SEGMENTED STATUS FILTER, CYCLE PROGRESS & SEARCH */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-gray-100 bg-gray-50/45 px-4 py-2 sm:px-5 dark:border-gray-800 dark:bg-gray-950/35">
                <div
                  role="tablist"
                  aria-label={t("filterLabel")}
                  className="flex flex-wrap items-center gap-0.5 rounded-lg bg-gray-100/85 p-0.5 ring-1 ring-inset ring-gray-200/60 dark:bg-gray-800 dark:ring-gray-700"
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
                        className={cn(
                          "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all",
                          active
                            ? "bg-white text-gray-900 shadow-theme-xs ring-1 ring-gray-200/70 dark:bg-gray-900 dark:text-white dark:ring-gray-700"
                            : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
                        )}
                      >
                        {tab.alert && !active && (
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                        )}
                        <span>{tab.label}</span>{" "}
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.2 font-mono text-[10px] font-semibold tabular-nums",
                            active
                              ? "bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300"
                              : "text-gray-400 dark:text-gray-500",
                          )}
                        >
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
                          date: format.dateTime(
                            new Date(activePeriodObj.dueAt),
                            {
                              dateStyle: "medium",
                              timeZone: "UTC",
                            },
                          ),
                        })}
                      </span>
                      <span className="h-1.5 w-14 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                        <span
                          style={{ width: `${progressPercent}%` }}
                          className={cn(
                            "block h-full rounded-full transition-all",
                            submittedInPeriod >= periodMetrics.total
                              ? "bg-emerald-500"
                              : submittedInPeriod > 0
                                ? "bg-brand-500"
                                : "bg-gray-300 dark:bg-gray-600",
                          )}
                        />
                      </span>
                      <strong className="font-mono font-semibold text-gray-800 dark:text-gray-200">
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
                      className="h-8 w-56 rounded-lg border border-gray-200 bg-white ps-8 pe-2.5 text-xs text-gray-800 shadow-theme-xs transition outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 sm:w-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                    />
                  </div>
                </div>
              </div>

              {/* 2-PANE VIEWPORT-BOUNDED BODY: LEFT ROSTER + RIGHT EDITORIAL SHEET */}
              {allScopeReports.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <FileIcon className="mx-auto h-8 w-8 text-gray-300 dark:text-gray-600" />
                  <h3 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white/90">
                    {isReviewerOnlyScope ? t("empty") : t("noCurrentReport")}
                  </h3>
                </div>
              ) : (
                <div
                  data-testid="work-reports-split-workbench"
                  className={cn(
                    "flex flex-col md:h-[calc(100dvh-22.5rem)] md:min-h-[430px] md:max-h-[760px] md:flex-row md:overflow-hidden",
                    mobileDetailOpen &&
                      "max-md:h-[calc(100dvh-16rem)] max-md:min-h-[440px] max-md:overflow-hidden",
                  )}
                >
                  {/* LEFT PANE: INDEPENDENT SCROLLABLE & RESIZABLE MEMBER ROSTER */}
                  <div
                    data-testid="work-reports-roster-pane"
                    style={
                      {
                        "--split-pane-w": `${splitRoster.width}px`,
                      } as React.CSSProperties
                    }
                    className={cn(
                      "min-h-0 w-full flex-col border-b border-gray-100 bg-gray-50/25 md:h-full md:w-[var(--split-pane-w)] md:shrink-0 md:border-b-0 md:overflow-hidden dark:border-gray-800 dark:bg-gray-950/30",
                      mobileDetailOpen ? "hidden" : "flex",
                      isFocusReader ? "md:hidden" : "md:flex",
                    )}
                  >
                    {selectableRosterReports.length > 0 && (
                      <div className="flex shrink-0 items-center justify-between border-b border-gray-100 bg-white/80 px-3.5 py-2 dark:border-gray-800 dark:bg-gray-900/60">
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                          <input
                            type="checkbox"
                            checked={allRosterSelected}
                            onChange={toggleSelectAllRoster}
                            className="h-3.5 w-3.5 rounded border-gray-300 accent-brand-500 text-brand-600 focus:ring-brand-500/20"
                          />
                          <span>
                            {tg("selectAllLabel", {
                              count: selectableRosterReports.length,
                            })}
                          </span>
                        </label>
                      </div>
                    )}

                    <div className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800/70">
                      {sortedReports.length === 0 ? (
                        <p className="px-3.5 py-8 text-center text-xs text-gray-400 dark:text-gray-500">
                          {t("noMatchingReports")}
                        </p>
                      ) : (
                        <>
                          {activeRoster.map(renderRosterItem)}

                          {unstartedRoster.length > 0 && (
                            <>
                              <div className="bg-gray-50/90 px-3.5 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:bg-gray-900 dark:text-gray-400">
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

                    {reportsData && reportsData.pagination.totalPages > 1 ? (
                      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-gray-100 bg-white px-3.5 py-2 text-xs dark:border-gray-800 dark:bg-gray-900">
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
                    ) : (
                      <div className="hidden shrink-0 items-center justify-between border-t border-gray-100 bg-white/75 px-3.5 py-2 text-[11px] text-gray-400 md:flex dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-500">
                        <span>{t("filterTabs.all")}</span>
                        <span className="font-mono tabular-nums">
                          {t("cycleSubmittedProgress", {
                            submitted: submittedInPeriod,
                            total: periodMetrics.total,
                          })}
                        </span>
                      </div>
                    )}
                  </div>

                  <SplitWorkbenchResizer
                    width={splitRoster.width}
                    minWidth={splitRoster.minWidth}
                    maxWidth={splitRoster.maxWidth}
                    isDragging={splitRoster.isDragging}
                    onStartDrag={splitRoster.startDrag}
                    onStepWidth={splitRoster.setWidth}
                    onResetWidth={splitRoster.resetWidth}
                    className={cn("hidden", !isFocusReader && "md:flex")}
                  />

                  {/* RIGHT PANE: BOUNDED EDITORIAL READER / SPLIT EDITOR */}
                  <div
                    data-testid="work-reports-reader-pane"
                    className={cn(
                      "min-h-0 min-w-0 flex-1 flex-col bg-white md:h-full md:overflow-hidden dark:bg-gray-900",
                      mobileDetailOpen ? "flex" : "hidden md:flex",
                    )}
                  >
                    {!selectedReport ? (
                      <div className="flex flex-1 items-center justify-center px-6 py-16 text-center text-sm text-gray-400 dark:text-gray-500">
                        {sortedReports.length === 0
                          ? t("noMatchingReports")
                          : t("selectMemberPrompt")}
                      </div>
                    ) : isEditingSelected &&
                      selectedReport.permissions.canEdit ? (
                      (() => {
                        const reportVersionKey = `${selectedReport.id}-${selectedReport.updatedAt}`;
                        const overrideEntry =
                          reportDraftOverrides[selectedReport.id];
                        const activeOverride =
                          overrideEntry?.versionKey === reportVersionKey
                            ? overrideEntry
                            : undefined;
                        return (
                          <ReportEditor
                            key={`${reportVersionKey}-${activeOverride?.seq ?? 0}`}
                            report={selectedReport}
                            effectiveStatus={resolveEffectiveStatus(
                              selectedReport,
                              currentTime,
                            )}
                            initialDraft={activeOverride?.input}
                            canAutoApprove={
                              canSwitchLeaderTier ||
                              activeScope === "LEADER" ||
                              Boolean(selectedReport.permissions.canReview) ||
                              Boolean(selectedReport.permissions.canConfigure)
                            }
                            isFocusReader={isFocusReader}
                            onToggleFocusReader={() =>
                              setIsFocusReader((prev) => !prev)
                            }
                            onBackToList={() => setMobileDetailOpen(false)}
                            onAgent={
                              process.env
                                .NEXT_PUBLIC_WORKNOTE_SHARED_EDITOR_ENABLED ===
                                "true" ||
                              selectedReport.contentSchemaVersion === 2
                                ? (draft) => {
                                    setAgentReportSeed(draft ?? null);
                                    setAgentReportId(selectedReport.id);
                                  }
                                : undefined
                            }
                            isSaving={
                              saveReport.isPending || updateReport.isPending
                            }
                            isSubmitting={reportAction.isPending}
                            error={reportError}
                            onSave={async (input) => {
                              try {
                                await saveReportDraft(selectedReport, input);
                                setReportDraftOverrides((prev) => {
                                  if (!(selectedReport.id in prev)) return prev;
                                  const next = { ...prev };
                                  delete next[selectedReport.id];
                                  return next;
                                });
                              } catch {
                                /* form preserves draft */
                              }
                            }}
                            onSubmit={(input, options) =>
                              submitReport(selectedReport, input, options)
                            }
                            onClose={() => {
                              setReportDraftOverrides((prev) => {
                                if (!(selectedReport.id in prev)) return prev;
                                const next = { ...prev };
                                delete next[selectedReport.id];
                                return next;
                              });
                              setEditingReportId("");
                            }}
                          />
                        );
                      })()
                    ) : (
                      <WorkReportReadingPane
                        key={selectedReport.id}
                        projectId={projectId}
                        report={selectedReport}
                        activeScope={activeScope}
                        effectiveStatus={resolveEffectiveStatus(
                          selectedReport,
                          currentTime,
                        )}
                        memberDirectory={memberDirectory}
                        resolvedReviewer={resolvedSelectedReviewer}
                        isReviewPending={
                          reportAction.isPending &&
                          pendingReportId === selectedReport.id
                        }
                        isFocusReader={isFocusReader}
                        isBulkActive={selectedBulkReports.length > 0}
                        onToggleFocusReader={() =>
                          setIsFocusReader((prev) => !prev)
                        }
                        onBackToList={() => setMobileDetailOpen(false)}
                        onOpenEditor={() =>
                          setEditingReportId(selectedReport.id)
                        }
                        onReview={reviewReport}
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        <BulkGovernanceBar
          selectedCount={selectedBulkReports.length}
          reviewableCount={bulkCounts.reviewableCount}
          approvedControlCount={bulkCounts.approvedControlCount}
          purgeableCount={bulkCounts.purgeableCount}
          isBusy={isBulkBusy}
          feedbackMessage={bulkFeedback}
          onClearSelection={() => setSelectedBulkIds(new Set())}
          onExecute={handleExecuteBulk}
        />
      </div>

      {agentReportId && (
        <WorkNoteComposer
          projectId={projectId}
          source={{ workflow: "WORK_REPORT", resourceId: agentReportId }}
          initialFields={agentReportSeed ?? undefined}
          onClose={(persistedFields) => {
            const closedId = agentReportId;
            const targetReport = allScopeReports.find((r) => r.id === closedId);
            setReportDraftOverrides((prev) => {
              if (!persistedFields || !targetReport) {
                if (!(closedId in prev)) return prev;
                const next = { ...prev };
                delete next[closedId];
                return next;
              }
              return {
                ...prev,
                [closedId]: {
                  versionKey: `${targetReport.id}-${targetReport.updatedAt}`,
                  seq: (prev[closedId]?.seq ?? 0) + 1,
                  input: {
                    title: persistedFields.title,
                    content: persistedFields.contentMarkdown,
                  },
                },
              };
            });
            setAgentReportSeed(null);
            setAgentReportId(null);
          }}
          onSaved={() => {
            const savedId = agentReportId;
            setReportDraftOverrides((prev) => {
              if (!(savedId in prev)) return prev;
              const next = { ...prev };
              delete next[savedId];
              return next;
            });
            setAgentReportSeed(null);
            setAgentReportId(null);
          }}
        />
      )}
    </main>
  );
}
