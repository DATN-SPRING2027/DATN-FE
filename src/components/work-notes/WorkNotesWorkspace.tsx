"use client";

import { useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Clock,
  Code2,
  Database,
  ExternalLink,
  ListTree,
  MessageSquareText,
  PanelLeftClose,
  PanelLeftOpen,
  Table2,
} from "lucide-react";
import Button from "@/components/ui/button/Button";
import { BackgroundRefreshError } from "@/components/ui/loading/AsyncStatus";
import {
  ArrowRightIcon,
  CloseLineIcon,
  SearchIcon,
  TaskIcon,
} from "@/icons";
import { Link } from "@/i18n/navigation";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import { cn } from "@/utils";
import WorkNotesPageHeader from "./WorkNotesPageHeader";
import {
  isWorkNoteId,
  type TaskNote,
  type TaskNoteReviewStatus,
  useProjectTaskNoteQuery,
  useProjectTaskNotesQuery,
  useTaskNoteKnowledgeChunksQuery,
  useTaskNoteKnowledgeStatusQuery,
  useWorkNotesMutation,
  workNoteKeys,
  workNotesApi,
} from "@/lib/queries/work-notes/useWorkNotes";
import WorkNoteAiChatSources from "./WorkNoteAiChatSources";
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
  extractMarkdownSignals,
  MarkdownArtifactStrip,
  MarkdownDocumentView,
  SectionOutlineBar,
} from "./MarkdownArtifactStrip";
import { resolvePipelineDisplay } from "./ProjectDocumentsWorkspace";
import {
  UploadAlertCircleIcon,
  UploadIndexReadyIcon,
  UploadPauseIcon,
  UploadProgressArcIcon,
} from "./UploadIcons";

type SortOrder = "recent" | "oldest";
type GroupMode = "task" | "timeline";
type ReviewFilterTab = "ALL" | TaskNoteReviewStatus;

const REVIEW_FILTER_TABS: readonly ReviewFilterTab[] = [
  "ALL",
  "PENDING_REVIEW",
  "CHANGES_REQUESTED",
  "APPROVED",
  "REJECTED",
];

const AVATAR_TONES = [
  "bg-brand-50 text-brand-700 ring-brand-200/80 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30",
  "bg-sky-50 text-sky-700 ring-sky-200/80 dark:bg-sky-500/15 dark:text-sky-300 dark:ring-sky-500/30",
  "bg-emerald-50 text-emerald-700 ring-emerald-200/80 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/30",
  "bg-violet-50 text-violet-700 ring-violet-200/80 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/30",
  "bg-amber-50 text-amber-800 ring-amber-200/80 dark:bg-amber-500/15 dark:text-amber-300 dark:ring-amber-500/30",
] as const;

function getAuthorInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

function getAvatarToneClass(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length]!;
}

function getEffectiveReviewStatus(note: TaskNote): TaskNoteReviewStatus {
  return note.reviewStatus ?? "PENDING_REVIEW";
}

function canNoteControlKnowledge(note: TaskNote): boolean {
  if (getEffectiveReviewStatus(note) !== "APPROVED") {
    return Boolean(
      note.permissions.canControlKnowledge ??
        (note.permissions.canReview || note.permissions.canConfigure),
    );
  }
  return Boolean(
    note.permissions.canControlKnowledge ??
      (note.permissions.canConfigure ||
        note.permissions.canDelete ||
        note.permissions.canEdit ||
        note.permissions.canReview),
  );
}

function canNotePurgeArtifact(note: TaskNote): boolean {
  return Boolean(
    note.permissions.canPurgeArtifact ??
      (note.permissions.canConfigure || note.permissions.canDelete),
  );
}

function isNoteBulkSelectable(note: TaskNote): boolean {
  const status = getEffectiveReviewStatus(note);
  return Boolean(
    (note.permissions.canReview && status !== "APPROVED") ||
      (status === "APPROVED" &&
        (canNoteControlKnowledge(note) || canNotePurgeArtifact(note))) ||
      note.permissions.canDelete,
  );
}

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

function renderLegacyNoteFields(
  note: TaskNote,
  t: ReturnType<typeof useTranslations<"workNotes">>,
) {
  return (
    <dl className="max-w-[72ch] divide-y divide-gray-100 dark:divide-gray-800/80">
      {(["accomplishments", "approach", "reason"] as const).map(
        (field, idx) => (
          <div
            key={field}
            className={cn(
              "min-w-0",
              idx > 0 && "pt-4",
              idx < 2 && "pb-4",
            )}
          >
            <dt className="font-mono text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {t(`taskNotes.${field}`)}
            </dt>
            <dd className="mt-1.5">
              <MarkdownDocumentView markdown={note[field] ?? ""} compact />
            </dd>
          </div>
        ),
      )}
    </dl>
  );
}

function ReviewerFeedbackCallout({
  comment,
  reviewerName,
  label,
  tone = "amber",
}: Readonly<{
  comment: string;
  reviewerName?: string;
  label: string;
  tone?: "amber" | "rose";
}>) {
  const isRose = tone === "rose";
  return (
    <div
      className={cn(
        "max-w-[72ch] rounded-xl px-4 py-3 text-xs ring-1 ring-inset",
        isRose
          ? "bg-rose-50/70 text-rose-950 ring-rose-200/80 dark:bg-rose-500/10 dark:text-rose-200 dark:ring-rose-500/25"
          : "bg-amber-50/70 text-amber-950 ring-amber-200/80 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/25",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-wider",
            isRose
              ? "text-rose-700 dark:text-rose-300"
              : "text-amber-800 dark:text-amber-300",
          )}
        >
          <MessageSquareText className="h-3 w-3" />
          <span>{label}</span>
        </span>
        {reviewerName ? (
          <span className="text-[11px] font-medium opacity-80">
            {reviewerName}
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 whitespace-pre-wrap leading-relaxed">{comment}</p>
    </div>
  );
}

function TaskNoteLiveStudioPane({
  note,
  projectId,
  authorDirectory,
  isDeepLinked,
  isFocusReader,
  isBulkActive = false,
  onToggleFocusReader,
  onBackToList,
  onAfterReviewDecision,
}: Readonly<{
  note: TaskNote;
  projectId: string;
  authorDirectory: ReadonlyMap<string, string>;
  isDeepLinked: boolean;
  isFocusReader: boolean;
  isBulkActive?: boolean;
  onToggleFocusReader: () => void;
  onBackToList: () => void;
  onAfterReviewDecision: (
    reviewedNoteId: string,
    action: "approve" | "request-changes" | "reject",
  ) => void;
}>) {
  const t = useTranslations("workNotes");
  const tg = useTranslations("workNotes.governance");
  const common = useTranslations("common");
  const activeLocale = common("localeCode") === "vi" ? "vi" : "en";
  const dateLocale = activeLocale === "vi" ? "vi-VN" : "en-US";
  const queryClient = useQueryClient();
  const readerScrollRef = useRef<HTMLDivElement>(null);

  const [viewMode, setViewMode] = useState<"rendered" | "markdown">("rendered");
  const [isInspectorOpen, setIsInspectorOpen] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [isPipelineBusy, setIsPipelineBusy] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [manualSyncTriggered, setManualSyncTriggered] = useState(false);

  const effectiveStatus = getEffectiveReviewStatus(note);
  const isApproved = effectiveStatus === "APPROVED";
  const versionNo = note.currentVersionNumber ?? 1;

  const statusQuery = useTaskNoteKnowledgeStatusQuery(
    projectId,
    note.id,
    isApproved && Boolean(note.knowledgeSync || manualSyncTriggered),
  );
  const liveSync = statusQuery.data ?? note.knowledgeSync;

  const shouldLoadChunks =
    isApproved &&
    ((liveSync?.chunkCount ?? 0) > 0 ||
      liveSync?.knowledgeReady === true ||
      liveSync?.searchReady === true ||
      liveSync?.status === "KNOWLEDGE_READY" ||
      liveSync?.status === "SEARCH_READY" ||
      liveSync?.status === "COMPLETED");

  const chunksQuery = useTaskNoteKnowledgeChunksQuery(
    projectId,
    note.id,
    shouldLoadChunks,
    note.currentVersionNumber,
  );

  const reviewMutation = useWorkNotesMutation(
    ({
      action,
      comment,
    }: {
      action: "approve" | "request-changes" | "reject";
      comment?: string;
    }) => workNotesApi.taskNoteAction(projectId, note.id, action, comment),
    [
      workNoteKeys.project(projectId),
      workNoteKeys.note(projectId, note.id),
      workNoteKeys.noteKnowledgeStatus(projectId, note.id),
    ],
  );


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

  const previewArtifact = useMemo(
    () =>
      buildClientMarkdownPreview({
        kind: "TASK_NOTE",
        title: note.title,
        version: versionNo,
        taskKey,
        taskTitle,
        authorName: note.authorName,
        contentMarkdown: note.contentMarkdown,
        sections:
          note.contentMarkdown === undefined
            ? [
                {
                  heading: t("taskNotes.accomplishments"),
                  body: note.accomplishments,
                },
                {
                  heading: t("taskNotes.approach"),
                  body: note.approach,
                },
                {
                  heading: t("taskNotes.reason"),
                  body: note.reason,
                },
              ]
            : undefined,
      }),
    [
      note.title,
      versionNo,
      taskKey,
      taskTitle,
      note.authorName,
      note.contentMarkdown,
      note.accomplishments,
      note.approach,
      note.reason,
      t,
    ],
  );

  const outlineItems = useMemo(
    () =>
      note.contentMarkdown !== undefined
        ? extractMarkdownOutline(previewArtifact.markdownSource, note.title)
        : [],
    [note.contentMarkdown, previewArtifact.markdownSource, note.title],
  );

  const reviewHistoryEntries = useMemo<GovernanceReviewHistoryEntry[]>(() => {
    const rawHistory = note.reviewHistory ?? [];
    return rawHistory.map((evt) => {
      const actorLabel =
        authorDirectory.get(evt.reviewerId) ||
        (note.reviewedBy === evt.reviewerId ? note.reviewerName : undefined) ||
        t("documents.reviewerActor");
      const parsedDate = new Date(evt.at);
      const formattedDate = Number.isNaN(parsedDate.getTime())
        ? evt.at
        : parsedDate.toLocaleString(dateLocale, {
            dateStyle: "medium",
            timeStyle: "short",
          });
      return {
        action: evt.action,
        actionLabel: t(`taskNotes.status.${evt.action}`),
        reviewerId: evt.reviewerId,
        actorLabel,
        at: evt.at,
        formattedDate,
        comment: evt.comment,
      };
    });
  }, [
    note.reviewHistory,
    note.reviewedBy,
    note.reviewerName,
    authorDirectory,
    dateLocale,
    t,
  ]);

  const handleDownload = async () => {
    setIsDownloading(true);
    setPipelineError(null);
    try {
      await workNotesApi.downloadTaskNoteFile(projectId, note.id);
    } catch (error) {
      setPipelineError(
        error instanceof Error ? error.message : t("taskNotes.saveError"),
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleReviewDecision = async (
    action: "approve" | "request-changes" | "reject",
  ) => {
    const trimmed = reviewComment.trim();
    if (
      (action === "request-changes" || action === "reject") &&
      trimmed.length === 0
    ) {
      setReviewError(t("taskNotes.reviewCommentRequired"));
      return;
    }
    setReviewError(null);
    try {
      await reviewMutation.mutateAsync({
        action,
        ...(trimmed ? { comment: trimmed } : {}),
      });
      setReviewComment("");
      if (action === "approve") {
        setManualSyncTriggered(true);
      }
      onAfterReviewDecision(note.id, action);
    } catch (error) {
      setReviewError(
        error instanceof Error ? error.message : t("taskNotes.saveError"),
      );
    }
  };

  const invalidateNoteQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: workNoteKeys.project(projectId),
      }),
      queryClient.invalidateQueries({
        queryKey: workNoteKeys.note(projectId, note.id),
      }),
      queryClient.invalidateQueries({
        queryKey: workNoteKeys.noteKnowledgeStatus(projectId, note.id),
      }),
      queryClient.invalidateQueries({
        queryKey: workNoteKeys.noteKnowledgeChunks(
          projectId,
          note.id,
          note.currentVersionNumber,
        ),
      }),
    ]);
  };

  const handlePipelineAction = async (action: SagPipelineAction) => {
    setIsPipelineBusy(true);
    setPipelineError(null);
    setManualSyncTriggered(true);
    try {
      const nextStatus =
        action === "SYNC"
          ? await workNotesApi.syncTaskNoteToSag(projectId, note.id)
          : await workNotesApi.controlTaskNoteKnowledge(
              projectId,
              note.id,
              action,
            );
      queryClient.setQueryData(
        workNoteKeys.noteKnowledgeStatus(projectId, note.id),
        nextStatus,
      );
      await invalidateNoteQueries();
    } catch (error) {
      setPipelineError(
        error instanceof Error ? error.message : t("taskNotes.saveError"),
      );
    } finally {
      setIsPipelineBusy(false);
    }
  };

  const handlePurgeArtifact = async (options: PurgeArtifactOptions) => {
    setIsPipelineBusy(true);
    setPipelineError(null);
    try {
      await workNotesApi.purgeTaskNoteFile(projectId, note.id, options);
      await invalidateNoteQueries();
    } catch (error) {
      setPipelineError(
        error instanceof Error ? error.message : t("taskNotes.saveError"),
      );
    } finally {
      setIsPipelineBusy(false);
    }
  };

  const handleDeleteNote = async () => {
    setIsPipelineBusy(true);
    setPipelineError(null);
    try {
      await workNotesApi.deleteProjectTaskNote(projectId, note.id);
      setIsInspectorOpen(false);
      await queryClient.invalidateQueries({
        queryKey: workNoteKeys.project(projectId),
      });
    } catch (error) {
      setPipelineError(
        error instanceof Error ? error.message : t("taskNotes.saveError"),
      );
    } finally {
      setIsPipelineBusy(false);
    }
  };

  const canMakeReviewDecision =
    note.permissions.canReview &&
    effectiveStatus !== "APPROVED" &&
    !isBulkActive;
  const resolvedReviewer =
    note.reviewerName ||
    (note.reviewedBy ? authorDirectory.get(note.reviewedBy) : undefined);
  const encodedProjectId = encodeURIComponent(projectId);
  const targetTaskSegment = encodeURIComponent(
    note.taskKey?.trim() || note.taskId,
  );
  const taskHref = `/projects/${encodedProjectId}/work/${targetTaskSegment}`;
  const canDownloadR2 = isApproved && Boolean(note.file);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white dark:bg-gray-900">
      {/* Compact Say-It-Once Sticky Header */}
      <header className="shrink-0 border-b border-gray-100 bg-white px-5 py-3 sm:px-6 dark:border-gray-800 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={onBackToList}
              className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 lg:hidden dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{tg("backToListMobile")}</span>
            </button>

            <Link
              href={taskHref}
              title={`${taskKey} · ${taskTitle}`}
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-gray-200/90 bg-gray-50/80 px-2 py-0.5 text-xs font-medium text-gray-700 transition-colors hover:border-brand-200 hover:bg-brand-50/50 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:border-brand-500/30 dark:hover:text-brand-300"
            >
              <TaskIcon
                className="h-3 w-3 shrink-0 text-brand-500"
                aria-hidden="true"
              />
              <span className="shrink-0 font-mono font-semibold tabular-nums text-brand-700 dark:text-brand-300">
                {taskKey}
              </span>
              <span
                aria-hidden="true"
                className="hidden text-gray-300 2xl:inline dark:text-gray-600"
              >
                ·
              </span>
              <span className="hidden max-w-[160px] truncate 2xl:inline">
                {taskTitle}
              </span>
              <ExternalLink
                className="h-2.5 w-2.5 shrink-0 opacity-50"
                aria-hidden="true"
              />
            </Link>

            <span className="rounded-md border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10.5px] font-medium tabular-nums text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {tg("versionBadge", { version: versionNo })}
            </span>

            <ApprovalStatusBadge
              status={effectiveStatus}
              label={t(`taskNotes.status.${effectiveStatus}`)}
            />

            {isDeepLinked && (
              <span className="inline-flex items-center rounded-full border border-brand-200 bg-brand-50 px-2 py-0.5 text-[10.5px] font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/15 dark:text-brand-300">
                {t("taskNotes.deepLinkedBadge")}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <ArtifactActionCluster
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              markdownSource={previewArtifact.markdownSource}
              isApproved={canDownloadR2}
              onDownload={handleDownload}
              isDownloading={isDownloading}
            />

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
                "hidden h-8 w-8 items-center justify-center rounded-lg border transition-colors lg:inline-flex",
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

        <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-2">
          <p
            data-testid="studio-note-title"
            className="text-lg font-semibold tracking-tight text-gray-900 dark:text-white"
          >
            {note.title}
          </p>

          <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span
              className={cn(
                "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9.5px] font-semibold ring-1 ring-inset",
                getAvatarToneClass(note.authorId || note.authorName),
              )}
            >
              {getAuthorInitials(note.authorName)}
            </span>
            <span className="font-medium text-gray-800 dark:text-gray-200">
              {note.authorName}
            </span>
            <span aria-hidden="true">·</span>
            <time dateTime={note.createdAt} className="tabular-nums">
              {formattedTimestamp}
            </time>
            {resolvedReviewer && (
              <>
                <span aria-hidden="true">·</span>
                <span>
                  {t("reports.reviewedByMeta", {
                    reviewer: resolvedReviewer,
                  })}
                </span>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Conditional Section Outline Bar (>= 3 headings & rendered mode) */}
      {viewMode === "rendered" ? (
        <SectionOutlineBar
          items={outlineItems}
          scrollContainerRef={readerScrollRef}
        />
      ) : null}

      {/* Bounded Scrollable Editorial Reader */}
      <div
        ref={readerScrollRef}
        data-testid="task-note-reader-scroll"
        className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6"
      >
        {(effectiveStatus === "CHANGES_REQUESTED" ||
          effectiveStatus === "REJECTED") &&
          note.reviewComment && (
            <ReviewerFeedbackCallout
              comment={note.reviewComment}
              reviewerName={resolvedReviewer}
              label={t("taskNotes.reviewerFeedbackLabel")}
              tone={effectiveStatus === "REJECTED" ? "rose" : "amber"}
            />
          )}

        <MarkdownArtifactStrip
          variant="editorial"
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          isApproved={isApproved}
          file={note.file}
          storageReference={note.storageReference}
          previewFileName={previewArtifact.previewFileName}
          markdownSource={previewArtifact.markdownSource}
          previewByteLength={previewArtifact.byteLength}
          omitTopHeading={note.title}
          isDownloading={isDownloading}
          onDownload={canDownloadR2 ? handleDownload : undefined}
          renderedContent={
            note.contentMarkdown === undefined
              ? renderLegacyNoteFields(note, t)
              : undefined
          }
        />

        {note.aiChatSource && (
          <div className="max-w-[72ch]">
            <WorkNoteAiChatSources
              projectId={projectId}
              source={note.aiChatSource}
            />
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
          commentAriaLabel={t("taskNotes.reviewCommentPlaceholder")}
          commentPlaceholder={t("taskNotes.reviewCommentPlaceholder")}
          commentRequiredMessage={t("taskNotes.reviewCommentRequired")}
          approveLabel={t("taskNotes.approveAndSync")}
          requestChangesLabel={t("taskNotes.requestChanges")}
          rejectLabel={t("taskNotes.reject")}
          inspectTriggerLabel={t("taskNotes.openReviewModal")}
          isBusy={reviewMutation.isPending}
          error={reviewError}
          onDecision={handleReviewDecision}
          onOpenInspector={() => setIsInspectorOpen(true)}
        />
      ) : (
        <KnowledgeTelemetryDock
          status={effectiveStatus}
          knowledgeSync={liveSync}
          file={note.file}
          storageReference={note.storageReference}
          reviewHistoryCount={reviewHistoryEntries.length}
          canControl={canNoteControlKnowledge(note)}
          isBusy={isPipelineBusy}
          inspectTriggerLabel={t("taskNotes.openSagModal")}
          onQuickSync={() => void handlePipelineAction("SYNC")}
          onOpenInspector={() => setIsInspectorOpen(true)}
        />
      )}

      {/* On-Demand Slide-Over Knowledge & Governance Inspector */}
      <KnowledgeGovernanceDrawer
        isOpen={isInspectorOpen}
        onClose={() => setIsInspectorOpen(false)}
        title={note.title}
        status={effectiveStatus}
        statusLabel={t(`taskNotes.status.${effectiveStatus}`)}
        version={versionNo}
        previewFileName={previewArtifact.previewFileName}
        previewByteLength={previewArtifact.byteLength}
        file={note.file}
        storageReference={note.storageReference}
        knowledgeSync={liveSync}
        chunksData={chunksQuery.data}
        isChunksPending={chunksQuery.isPending}
        reviewHistory={reviewHistoryEntries}
        canControl={canNoteControlKnowledge(note)}
        canPurge={canNotePurgeArtifact(note)}
        canReopen={Boolean(
          note.permissions.canReview || note.permissions.canConfigure,
        )}
        isBusy={isPipelineBusy}
        isDownloading={isDownloading}
        controlError={pipelineError}
        onDownload={canDownloadR2 ? handleDownload : undefined}
        onAction={handlePipelineAction}
        onPurgeArtifact={handlePurgeArtifact}
        onDeleteEntity={
          note.permissions.canDelete ? handleDeleteNote : undefined
        }
      />
    </div>
  );
}

function TaskNoteQueueRow({
  note,
  active,
  bulkSelected,
  selectable,
  showTaskChip,
  isApproving,
  onSelectStudio,
  onToggleBulk,
  onQuickApprove,
}: Readonly<{
  note: TaskNote;
  active: boolean;
  bulkSelected: boolean;
  selectable: boolean;
  showTaskChip: boolean;
  isApproving: boolean;
  onSelectStudio: () => void;
  onToggleBulk: () => void;
  onQuickApprove: () => void;
}>) {
  const t = useTranslations("workNotes");
  const tg = useTranslations("workNotes.governance");
  const td = useTranslations("workNotes.documents");
  const common = useTranslations("common");
  const activeLocale = common("localeCode") === "vi" ? "vi" : "en";

  const effectiveStatus = getEffectiveReviewStatus(note);
  const canQuickApprove =
    note.permissions.canReview && effectiveStatus === "PENDING_REVIEW";
  const versionNo = note.currentVersionNumber ?? 1;

  const { taskKey } = resolveTaskMetadata(
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

  const signals = useMemo(
    () =>
      extractMarkdownSignals(
        note.contentMarkdown ??
          [note.accomplishments, note.approach, note.reason]
            .filter(Boolean)
            .join("\n\n"),
      ),
    [note.contentMarkdown, note.accomplishments, note.approach, note.reason],
  );

  const pipeline = useMemo(
    () =>
      effectiveStatus === "APPROVED"
        ? resolvePipelineDisplay("APPROVED", note.knowledgeSync)
        : null,
    [effectiveStatus, note.knowledgeSync],
  );

  return (
    <div
      data-note-id={note.id}
      className={cn(
        "group relative flex items-start gap-2.5 px-3.5 py-2.5 transition-colors",
        active
          ? "bg-brand-50/60 shadow-[inset_2px_0_0_0_var(--color-brand-500)] dark:bg-brand-500/12"
          : bulkSelected
            ? "bg-brand-25/85 dark:bg-brand-500/8"
            : "hover:bg-gray-50/80 dark:hover:bg-gray-800/40",
      )}
    >
      {selectable && (
        <input
          type="checkbox"
          checked={bulkSelected}
          onChange={onToggleBulk}
          aria-label={tg("selectItemAria", { title: note.title })}
          className="mt-1 h-4 w-4 shrink-0 cursor-pointer rounded border-gray-300 accent-brand-500 text-brand-600 focus:ring-brand-500/20 dark:border-gray-600 dark:bg-gray-900"
        />
      )}

      <div
        role="button"
        tabIndex={0}
        onClick={onSelectStudio}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectStudio();
          }
        }}
        className="min-w-0 flex-1 cursor-pointer text-start focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-500"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-1.5">
            {showTaskChip && (
              <span className="inline-flex shrink-0 items-center rounded border border-gray-200 bg-gray-50 px-1.5 py-0.2 font-mono text-[10px] font-semibold tabular-nums text-gray-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {taskKey}
              </span>
            )}
            <h3
              id={`task-note-title-${note.id}`}
              className={cn(
                "min-w-0 flex-1 truncate text-[13px] font-semibold tracking-tight",
                active
                  ? "text-brand-950 dark:text-white"
                  : "text-gray-900 dark:text-gray-100",
              )}
            >
              {note.title}
            </h3>
          </div>

          <ApprovalStatusBadge
            status={effectiveStatus}
            label={t(`taskNotes.status.${effectiveStatus}`)}
            className="shrink-0"
          />
        </div>

        {/* Single Quiet Metadata & Signal Line */}
        <div className="mt-1.5 flex items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400">
          <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden whitespace-nowrap">
            <span
              className={cn(
                "inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8.5px] font-semibold ring-1 ring-inset",
                getAvatarToneClass(note.authorId || note.authorName),
              )}
            >
              {getAuthorInitials(note.authorName)}
            </span>
            <span className="max-w-[108px] shrink-0 truncate font-medium text-gray-700 dark:text-gray-300">
              {note.authorName}
            </span>
            <span aria-hidden="true" className="shrink-0">
              ·
            </span>
            <time dateTime={note.createdAt} className="shrink-0 tabular-nums">
              {formattedTimestamp}
            </time>
            {versionNo > 1 && (
              <span className="shrink-0 font-mono text-[10px] font-medium text-gray-400 dark:text-gray-500">
                {tg("versionBadge", { version: versionNo })}
              </span>
            )}

            {effectiveStatus === "APPROVED" && pipeline ? (
              <>
                <span aria-hidden="true" className="shrink-0">
                  ·
                </span>
                {note.file && (
                  <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
                    <Database className="h-2.5 w-2.5" aria-hidden="true" />
                    <span>
                      {note.storageReference?.provider === "CLOUDFLARE_R2"
                        ? "R2"
                        : "Vault"}
                    </span>
                  </span>
                )}
                <span
                  className={cn(
                    "inline-flex min-w-0 items-center gap-1 truncate text-[10.5px] font-medium",
                    pipeline.phase === "ready"
                      ? "text-gray-600 dark:text-gray-300"
                      : pipeline.phase === "processing"
                        ? "text-brand-600 dark:text-brand-400"
                        : pipeline.phase === "paused"
                          ? "text-amber-700 dark:text-amber-400"
                          : pipeline.phase === "failed"
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-gray-500 dark:text-gray-400",
                  )}
                >
                  {pipeline.phase === "processing" ? (
                    <UploadProgressArcIcon className="h-3 w-3 shrink-0 animate-spin text-brand-500" />
                  ) : pipeline.phase === "ready" ? (
                    <UploadIndexReadyIcon className="h-3 w-3 shrink-0 text-emerald-500" />
                  ) : pipeline.phase === "paused" ? (
                    <UploadPauseIcon className="h-3 w-3 shrink-0 text-amber-500" />
                  ) : pipeline.phase === "failed" ? (
                    <UploadAlertCircleIcon className="h-3 w-3 shrink-0 text-rose-500" />
                  ) : null}
                  <span className="truncate">
                    {pipeline.phase === "ready" && pipeline.chunkCount > 0
                      ? td("pipelineChunksBadge", {
                          count: pipeline.chunkCount,
                        })
                      : pipeline.percent !== null &&
                          pipeline.phase === "processing"
                        ? `${pipeline.percent}%`
                        : td(pipeline.stageKey)}
                  </span>
                </span>
              </>
            ) : (effectiveStatus === "CHANGES_REQUESTED" ||
                effectiveStatus === "REJECTED") &&
              note.reviewComment ? (
              <>
                <span aria-hidden="true" className="shrink-0">
                  ·
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-orange-700 dark:text-orange-300">
                  <MessageSquareText className="h-2.5 w-2.5" />
                  <span>{t("taskNotes.signalFeedback")}</span>
                </span>
              </>
            ) : signals.checklistTotal > 0 ? (
              <>
                <span aria-hidden="true" className="shrink-0">
                  ·
                </span>
                <span className="inline-flex shrink-0 items-center gap-1 font-mono text-[10px] tabular-nums text-gray-600 dark:text-gray-300">
                  <CheckSquare className="h-2.5 w-2.5 text-brand-500" />
                  <span>
                    {signals.checklistDone}/{signals.checklistTotal}
                  </span>
                </span>
              </>
            ) : signals.hasCode ? (
              <>
                <span aria-hidden="true" className="shrink-0">
                  ·
                </span>
                <span className="inline-flex min-w-0 items-center gap-1 truncate font-mono text-[10px] text-gray-500 dark:text-gray-400">
                  <Code2 className="h-2.5 w-2.5 shrink-0" />
                  <span className="truncate">
                    {signals.codeLang || t("taskNotes.signalCode")}
                  </span>
                </span>
              </>
            ) : signals.hasTable ? (
              <>
                <span aria-hidden="true" className="shrink-0">
                  ·
                </span>
                <span
                  title={t("taskNotes.signalTable")}
                  className="inline-flex shrink-0 items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400"
                >
                  <Table2 className="h-2.5 w-2.5" />
                  <span>{t("taskNotes.signalTable")}</span>
                </span>
              </>
            ) : null}
          </div>

          {canQuickApprove && (
            <button
              type="button"
              disabled={isApproving}
              aria-label={t("taskNotes.quickApproveAria", {
                title: note.title,
              })}
              title={t("taskNotes.quickApprove")}
              onClick={(event) => {
                event.stopPropagation();
                onQuickApprove();
              }}
              className={cn(
                "inline-flex h-6 shrink-0 items-center gap-1 rounded-md bg-brand-500 px-2 text-[10.5px] font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50",
                !isApproving &&
                  "lg:pointer-events-none lg:w-0 lg:overflow-hidden lg:px-0 lg:opacity-0 lg:group-hover:pointer-events-auto lg:group-hover:w-auto lg:group-hover:px-2 lg:group-hover:opacity-100 lg:focus-within:pointer-events-auto lg:focus-within:w-auto lg:focus-within:px-2 lg:focus-within:opacity-100 focus:pointer-events-auto focus:w-auto focus:px-2 focus:opacity-100",
              )}
            >
              {isApproving ? (
                <UploadProgressArcIcon className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3 stroke-[2.5]" />
              )}
              <span>{t("taskNotes.quickApprove")}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function WorkNotesWorkspace({
  projectId,
}: {
  projectId: string;
}) {
  const t = useTranslations("workNotes");
  const tg = useTranslations("workNotes.governance");
  const queryClient = useQueryClient();
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
  const [selectedReviewStatus, setSelectedReviewStatus] =
    useState<ReviewFilterTab>("ALL");
  const [sortOrder, setSortOrder] = useState<SortOrder>("recent");
  const [groupMode, setGroupMode] = useState<GroupMode>("task");
  const [collapsedTaskIds, setCollapsedTaskIds] = useState<
    Record<string, boolean>
  >({});
  const [selectedStudioNoteId, setSelectedStudioNoteId] = useState<
    string | null
  >(deepLinkNoteId);
  const [isFocusReader, setIsFocusReader] = useState(false);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(
    Boolean(deepLinkNoteId),
  );
  const [approvingNoteId, setApprovingNoteId] = useState<string | null>(null);
  const [selectedNoteIds, setSelectedNoteIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isBulkBusy, setIsBulkBusy] = useState(false);
  const [bulkFeedback, setBulkFeedback] = useState<string | null>(null);
  const splitQueue = useResizableSplitWidth({
    storageKey: "continuum:work-notes:queue-width",
    defaultWidth: 360,
    minWidth: 260,
    maxWidth: 520,
  });

  const quickApproveMutation = useWorkNotesMutation(
    (noteId: string) =>
      workNotesApi.taskNoteAction(projectId, noteId, "approve"),
    [workNoteKeys.project(projectId)],
  );

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

  const authorDirectory = useMemo(() => {
    const map = new Map<string, string>();
    for (const item of allLoadedNotes) {
      if (item.authorId && item.authorName) {
        map.set(item.authorId, item.authorName);
      }
      if (item.reviewedBy && item.reviewerName) {
        map.set(item.reviewedBy, item.reviewerName);
      }
    }
    return map;
  }, [allLoadedNotes]);

  const statusCounts = useMemo(() => {
    const counts: Record<ReviewFilterTab, number> = {
      ALL: allLoadedNotes.length,
      PENDING_REVIEW: 0,
      CHANGES_REQUESTED: 0,
      APPROVED: 0,
      REJECTED: 0,
    };
    for (const item of allLoadedNotes) {
      const status = getEffectiveReviewStatus(item);
      counts[status] += 1;
    }
    return counts;
  }, [allLoadedNotes]);

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
    const filtered = allLoadedNotes.filter((note) => {
      if (
        selectedReviewStatus !== "ALL" &&
        getEffectiveReviewStatus(note) !== selectedReviewStatus
      ) {
        return false;
      }
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
    allLoadedNotes,
    selectedReviewStatus,
    search,
    selectedTaskId,
    selectedAuthorId,
    sortOrder,
    t,
  ]);

  const taskGroups = useMemo(() => {
    const map = new Map<
      string,
      {
        taskId: string;
        taskKey: string;
        taskTitle: string;
        items: TaskNote[];
      }
    >();
    for (const note of notes) {
      const existing = map.get(note.taskId);
      if (existing) {
        existing.items.push(note);
      } else {
        const { taskKey, taskTitle } = resolveTaskMetadata(
          note,
          (code) => t("taskNotes.taskCodeFallback", { code }),
          t("taskNotes.untitledTask"),
        );
        map.set(note.taskId, {
          taskId: note.taskId,
          taskKey,
          taskTitle,
          items: [note],
        });
      }
    }
    return [...map.values()];
  }, [notes, t]);

  const activeStudioNote = useMemo(() => {
    if (notes.length === 0) return null;
    if (deepLinkNoteId) {
      const deepMatch = notes.find((n) => n.id === deepLinkNoteId);
      if (
        deepMatch &&
        (!selectedStudioNoteId || selectedStudioNoteId === deepLinkNoteId)
      ) {
        return deepMatch;
      }
    }
    if (selectedStudioNoteId) {
      const match = notes.find((n) => n.id === selectedStudioNoteId);
      if (match) return match;
    }
    return notes[0] ?? null;
  }, [notes, selectedStudioNoteId, deepLinkNoteId]);

  const advanceToNextPending = (reviewedNoteId: string) => {
    const currentIndex = notes.findIndex((item) => item.id === reviewedNoteId);
    const orderedCandidates =
      currentIndex >= 0
        ? [...notes.slice(currentIndex + 1), ...notes.slice(0, currentIndex)]
        : notes;
    const nextPending = orderedCandidates.find(
      (item) =>
        item.id !== reviewedNoteId &&
        getEffectiveReviewStatus(item) === "PENDING_REVIEW",
    );
    if (nextPending) {
      setSelectedStudioNoteId(nextPending.id);
    }
  };

  const handleQuickApprove = async (noteId: string) => {
    setApprovingNoteId(noteId);
    try {
      await quickApproveMutation.mutateAsync(noteId);
      if (activeStudioNote?.id === noteId) {
        advanceToNextPending(noteId);
      }
    } catch {
      // Handled via query refetch/state
    } finally {
      setApprovingNoteId(null);
    }
  };

  const selectableNotes = useMemo(
    () => notes.filter(isNoteBulkSelectable),
    [notes],
  );

  const selectedNotes = useMemo(
    () => notes.filter((n) => selectedNoteIds.has(n.id)),
    [notes, selectedNoteIds],
  );

  const bulkCounts = useMemo(() => {
    let reviewableCount = 0;
    let approvedControlCount = 0;
    let purgeableCount = 0;
    let deletableCount = 0;
    for (const item of selectedNotes) {
      const status = getEffectiveReviewStatus(item);
      if (item.permissions.canReview && status !== "APPROVED") {
        reviewableCount += 1;
      }
      if (status === "APPROVED" && canNoteControlKnowledge(item)) {
        approvedControlCount += 1;
      }
      if (
        status === "APPROVED" &&
        Boolean(item.file) &&
        canNotePurgeArtifact(item)
      ) {
        purgeableCount += 1;
      }
      if (item.permissions.canDelete) {
        deletableCount += 1;
      }
    }
    return {
      reviewableCount,
      approvedControlCount,
      purgeableCount,
      deletableCount,
    };
  }, [selectedNotes]);

  const allSelectableSelected =
    selectableNotes.length > 0 &&
    selectableNotes.every((item) => selectedNoteIds.has(item.id));

  const handleToggleSelectAll = () => {
    setBulkFeedback(null);
    if (allSelectableSelected) {
      setSelectedNoteIds(new Set());
    } else {
      setSelectedNoteIds(new Set(selectableNotes.map((item) => item.id)));
    }
  };

  const handleToggleSelectOne = (noteId: string) => {
    setBulkFeedback(null);
    setSelectedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(noteId)) next.delete(noteId);
      else next.add(noteId);
      return next;
    });
  };

  const handleExecuteBulk = async (
    action: BulkCommandAction,
    comment?: string,
  ) => {
    const targetIds = selectedNotes
      .filter((item) => {
        const status = getEffectiveReviewStatus(item);
        if (
          action === "APPROVE" ||
          action === "REQUEST_CHANGES" ||
          action === "REJECT"
        ) {
          return item.permissions.canReview && status !== "APPROVED";
        }
        if (action === "PURGE_ARTIFACT") {
          return (
            status === "APPROVED" &&
            Boolean(item.file) &&
            canNotePurgeArtifact(item)
          );
        }
        if (action === "DELETE") {
          return Boolean(item.permissions.canDelete);
        }
        return status === "APPROVED" && canNoteControlKnowledge(item);
      })
      .map((item) => item.id);

    if (targetIds.length === 0) return;
    setIsBulkBusy(true);
    setBulkFeedback(null);
    try {
      const result = await workNotesApi.bulkTaskNoteAction(projectId, {
        ids: targetIds,
        action,
        ...(comment ? { comment } : {}),
      });
      await queryClient.invalidateQueries({
        queryKey: workNoteKeys.project(projectId),
      });
      setSelectedNoteIds(new Set());
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
        error instanceof Error ? error.message : t("taskNotes.saveError"),
      );
    } finally {
      setIsBulkBusy(false);
    }
  };

  const distinctTaskCount = useMemo(() => {
    return new Set(notes.map((note) => note.taskId)).size;
  }, [notes]);

  const hasActiveFilters =
    search.trim().length > 0 ||
    selectedReviewStatus !== "ALL" ||
    selectedTaskId !== "ALL" ||
    selectedAuthorId !== "ALL" ||
    sortOrder !== "recent";

  const handleResetFilters = () => {
    setSearch("");
    setSelectedReviewStatus("ALL");
    setSelectedTaskId("ALL");
    setSelectedAuthorId("ALL");
    setSortOrder("recent");
  };

  const toggleTaskGroup = (taskId: string) => {
    setCollapsedTaskIds((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const handleSelectStudioNote = (noteId: string) => {
    setSelectedStudioNoteId(noteId);
    setMobileDetailOpen(true);
  };

  const handleQueueKeyNavigation = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const targetTag = (event.target as HTMLElement | null)?.tagName;
    if (
      targetTag === "INPUT" ||
      targetTag === "SELECT" ||
      targetTag === "TEXTAREA"
    ) {
      return;
    }
    if (notes.length === 0) return;
    event.preventDefault();
    const currentIdx = activeStudioNote
      ? notes.findIndex((n) => n.id === activeStudioNote.id)
      : -1;
    const nextIdx =
      event.key === "ArrowDown"
        ? Math.min(notes.length - 1, currentIdx + 1)
        : Math.max(0, currentIdx - 1);
    const nextNote = notes[nextIdx];
    if (nextNote) {
      setSelectedStudioNoteId(nextNote.id);
    }
  };

  const selectControlClass =
    "h-8 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 shadow-theme-xs transition outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200";

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-3 pb-2 sm:px-6 lg:px-8">
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
        deepLinkQuery.isRefetchError && (
          <div className="mb-4">
            <BackgroundRefreshError
              retryLabel={t("retry")}
              onRetry={() => void deepLinkQuery.refetch()}
            >
              {t("taskNotes.loadError")}
            </BackgroundRefreshError>
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

      {visibleList !== undefined &&
        !listAccessLost &&
        query.isRefetchError && (
          <div className="mb-3">
            <BackgroundRefreshError
              retryLabel={t("retry")}
              onRetry={() => void query.refetch()}
            >
              {t("taskNotes.loadError")}
            </BackgroundRefreshError>
          </div>
        )}

      {/* Viewport-Bounded Continuum Split Workbench */}
      <section
        aria-label={t("taskNotes.title")}
        className="overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
      >
        {/* Sheet Toolbar Row 1: Segmented Status Filter, Summary & Task-Group Switch */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-gray-100 px-4 py-2.5 sm:px-5 dark:border-gray-800">
          <div className="flex flex-wrap items-center gap-2">
            {allLoadedNotes.length > 0 && (
              <div
                role="tablist"
                aria-label={t("documents.filterLabel")}
                className="flex flex-wrap items-center gap-0.5 rounded-lg bg-gray-100/85 p-0.5 ring-1 ring-inset ring-gray-200/60 dark:bg-gray-800 dark:ring-gray-700"
              >
                {REVIEW_FILTER_TABS.map((tab) => {
                  const isSelected = selectedReviewStatus === tab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={isSelected}
                      onClick={() => setSelectedReviewStatus(tab)}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all",
                        isSelected
                          ? "bg-white text-gray-900 shadow-theme-xs ring-1 ring-gray-200/70 dark:bg-gray-900 dark:text-white dark:ring-gray-700"
                          : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
                      )}
                    >
                      <span>{t(`taskNotes.filterTabs.${tab}`)}</span>
                      <span
                        className={cn(
                          "rounded-full px-1.5 py-0.2 font-mono text-[10px] font-semibold tabular-nums",
                          isSelected
                            ? "bg-brand-50 text-brand-600 dark:bg-brand-500/20 dark:text-brand-300"
                            : "text-gray-400 dark:text-gray-500",
                        )}
                      >
                        {statusCounts[tab]}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {(visibleList || visibleDeepLink) && (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                {t("taskNotes.notesAcrossTasks", {
                  noteCount: notes.length,
                  taskCount: distinctTaskCount,
                })}
              </span>
            )}
          </div>

          {allLoadedNotes.length > 0 && (
            <div className="inline-flex items-center rounded-lg bg-gray-100/85 p-0.5 ring-1 ring-inset ring-gray-200/60 dark:bg-gray-800 dark:ring-gray-700">
              <button
                type="button"
                aria-pressed={groupMode === "task"}
                onClick={() => setGroupMode("task")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all",
                  groupMode === "task"
                    ? "bg-white text-brand-700 shadow-theme-xs ring-1 ring-gray-200/70 dark:bg-gray-900 dark:text-brand-300 dark:ring-gray-700"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
                )}
              >
                <ListTree className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {t("taskNotes.groupByTask")}
                </span>
              </button>
              <button
                type="button"
                aria-pressed={groupMode === "timeline"}
                onClick={() => setGroupMode("timeline")}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-all",
                  groupMode === "timeline"
                    ? "bg-white text-brand-700 shadow-theme-xs ring-1 ring-gray-200/70 dark:bg-gray-900 dark:text-brand-300 dark:ring-gray-700"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
                )}
              >
                <Clock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">
                  {t("taskNotes.groupByTimeline")}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Sheet Toolbar Row 2: Search & Facet Controls */}
        <div className="flex flex-col gap-2 border-b border-gray-100 bg-gray-50/45 px-4 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:px-5 dark:border-gray-800 dark:bg-gray-950/35">
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
              className="h-8 w-full rounded-lg border border-gray-200 bg-white ps-9 pe-8 text-xs text-gray-800 shadow-theme-xs transition outline-none placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:placeholder:text-gray-500"
            />
            {search.length > 0 && (
              <button
                type="button"
                aria-label={t("taskNotes.clearSearch")}
                onClick={() => setSearch("")}
                className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-gray-400 transition-colors hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
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
              className={cn(
                selectControlClass,
                "col-span-2 w-full truncate sm:w-auto sm:max-w-[220px]",
              )}
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
              className={cn(
                selectControlClass,
                "w-full truncate sm:w-auto sm:max-w-[180px]",
              )}
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
              className={cn(selectControlClass, "w-full sm:w-auto")}
            >
              <option value="recent">{t("taskNotes.sortRecent")}</option>
              <option value="oldest">{t("taskNotes.sortOldest")}</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="col-span-2 h-8 rounded-lg px-2.5 text-xs font-semibold text-brand-600 transition hover:bg-brand-50 hover:text-brand-700 sm:w-auto dark:text-brand-400 dark:hover:bg-brand-500/10"
              >
                {t("taskNotes.resetFilters")}
              </button>
            )}
          </div>
        </div>

        {/* Sheet Body: Loading / Error / Empty / Viewport-Bounded Split Workbench */}
        {query.isPending && !visibleList && !visibleDeepLink ? (
          <div
            role="status"
            className="grid gap-4 p-5 lg:grid-cols-12"
            aria-label={t("loading")}
          >
            <div className="space-y-2.5 lg:col-span-5">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-20 rounded-xl bg-gray-50 motion-safe:animate-pulse dark:bg-gray-800/60"
                />
              ))}
            </div>
            <div className="h-96 rounded-xl bg-gray-50/70 motion-safe:animate-pulse lg:col-span-7 dark:bg-gray-800/40" />
          </div>
        ) : query.isError && !visibleList && !visibleDeepLink ? (
          <div
            role="alert"
            className="m-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-error-200 bg-error-50 px-4 py-4 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
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
          <div className="px-5 py-14 text-center">
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
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-500 px-3.5 py-2 text-xs font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
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
          <div
            data-testid="task-notes-split-workbench"
            onKeyDown={handleQueueKeyNavigation}
            className={cn(
              "flex flex-col lg:h-[calc(100dvh-22.5rem)] lg:min-h-[430px] lg:max-h-[760px] lg:flex-row lg:overflow-hidden",
              mobileDetailOpen &&
                "max-lg:h-[calc(100dvh-16rem)] max-lg:min-h-[440px] max-lg:overflow-hidden",
            )}
          >
            {/* Left Column (Resizable Queue): Independent Scrollable Task-Grouped Queue */}
            <div
              data-testid="task-notes-queue-pane"
              style={
                {
                  "--split-pane-w": `${splitQueue.width}px`,
                } as React.CSSProperties
              }
              className={cn(
                "min-h-0 w-full flex-col border-b border-gray-100 bg-gray-50/25 lg:h-full lg:w-[var(--split-pane-w)] lg:shrink-0 lg:border-b-0 lg:overflow-hidden dark:border-gray-800 dark:bg-gray-950/30",
                mobileDetailOpen ? "hidden" : "flex",
                isFocusReader ? "lg:hidden" : "lg:flex",
              )}
            >
              {selectableNotes.length > 0 && (
                <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 bg-white/80 px-3.5 py-2 dark:border-gray-800 dark:bg-gray-900/60">
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white">
                    <input
                      type="checkbox"
                      checked={allSelectableSelected}
                      onChange={handleToggleSelectAll}
                      className="h-3.5 w-3.5 rounded border-gray-300 accent-brand-500 text-brand-600 focus:ring-brand-500/20"
                    />
                    <span>
                      {tg("selectAllLabel", {
                        count: selectableNotes.length,
                      })}
                    </span>
                  </label>
                </div>
              )}

              <div className="min-h-0 flex-1 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800/80">
                {groupMode === "task"
                  ? taskGroups.map((group) => {
                      const isCollapsed = Boolean(
                        collapsedTaskIds[group.taskId],
                      );
                      return (
                        <div key={group.taskId}>
                          <button
                            type="button"
                            aria-expanded={!isCollapsed}
                            onClick={() => toggleTaskGroup(group.taskId)}
                            className="flex w-full items-center justify-between gap-2 bg-gray-50/90 px-3.5 py-2 text-start text-xs transition hover:bg-gray-100/80 dark:bg-gray-900/80 dark:hover:bg-gray-800/80"
                          >
                            <span className="flex min-w-0 items-center gap-1.5">
                              {isCollapsed ? (
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                              )}
                              <TaskIcon
                                className="h-3.5 w-3.5 shrink-0 text-brand-500"
                                aria-hidden="true"
                              />
                              <span className="shrink-0 font-mono font-semibold tabular-nums text-brand-700 dark:text-brand-300">
                                {group.taskKey}
                              </span>
                              <span
                                aria-hidden="true"
                                className="text-gray-300 dark:text-gray-600"
                              >
                                ·
                              </span>
                              <span className="truncate font-medium text-gray-700 dark:text-gray-200">
                                {group.taskTitle}
                              </span>
                            </span>
                            <span className="shrink-0 rounded-full bg-white px-2 py-0.2 font-mono text-[10px] font-semibold tabular-nums text-gray-500 ring-1 ring-inset ring-gray-200/80 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700">
                              {group.items.length}
                            </span>
                          </button>

                          {!isCollapsed && (
                            <div className="divide-y divide-gray-100 dark:divide-gray-800/70">
                              {group.items.map((note) => (
                                <TaskNoteQueueRow
                                  key={note.id}
                                  note={note}
                                  active={activeStudioNote?.id === note.id}
                                  bulkSelected={selectedNoteIds.has(note.id)}
                                  selectable={isNoteBulkSelectable(note)}
                                  showTaskChip={false}
                                  isApproving={approvingNoteId === note.id}
                                  onSelectStudio={() =>
                                    handleSelectStudioNote(note.id)
                                  }
                                  onToggleBulk={() =>
                                    handleToggleSelectOne(note.id)
                                  }
                                  onQuickApprove={() =>
                                    void handleQuickApprove(note.id)
                                  }
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  : notes.map((note) => (
                      <TaskNoteQueueRow
                        key={note.id}
                        note={note}
                        active={activeStudioNote?.id === note.id}
                        bulkSelected={selectedNoteIds.has(note.id)}
                        selectable={isNoteBulkSelectable(note)}
                        showTaskChip
                        isApproving={approvingNoteId === note.id}
                        onSelectStudio={() => handleSelectStudioNote(note.id)}
                        onToggleBulk={() => handleToggleSelectOne(note.id)}
                        onQuickApprove={() => void handleQuickApprove(note.id)}
                      />
                    ))}
              </div>

              {visibleList && visibleList.pagination.totalPages > 1 ? (
                <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-white px-3.5 py-2 text-xs dark:border-gray-800 dark:bg-gray-900">
                  <span className="tabular-nums text-gray-500 dark:text-gray-400">
                    {t("pagination.total", {
                      count: visibleList.pagination.totalItems,
                    })}
                  </span>
                  <div className="flex gap-1.5">
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
              ) : (
                <div className="hidden shrink-0 items-center justify-between border-t border-gray-100 bg-white/75 px-3.5 py-2 text-[11px] text-gray-400 lg:flex dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-500">
                  <span className="font-mono">↑↓</span>
                  <span className="tabular-nums">
                    {t("pagination.total", {
                      count: notes.length,
                    })}
                  </span>
                </div>
              )}
            </div>

            <SplitWorkbenchResizer
              width={splitQueue.width}
              minWidth={splitQueue.minWidth}
              maxWidth={splitQueue.maxWidth}
              isDragging={splitQueue.isDragging}
              onStartDrag={splitQueue.startDrag}
              onStepWidth={splitQueue.setWidth}
              onResetWidth={splitQueue.resetWidth}
              className={cn("hidden", !isFocusReader && "lg:flex")}
            />

            {/* Right Column (Flexible Editorial Studio): Bounded Editorial Studio */}
            <div
              data-testid="task-notes-studio-pane"
              className={cn(
                "min-h-0 min-w-0 flex-1 flex-col lg:h-full lg:overflow-hidden",
                mobileDetailOpen ? "flex" : "hidden lg:flex",
              )}
            >
              {activeStudioNote ? (
                <TaskNoteLiveStudioPane
                  key={activeStudioNote.id}
                  note={activeStudioNote}
                  projectId={projectId}
                  authorDirectory={authorDirectory}
                  isDeepLinked={Boolean(
                    deepLinkNoteId && activeStudioNote.id === deepLinkNoteId,
                  )}
                  isFocusReader={isFocusReader}
                  isBulkActive={selectedNotes.length > 0}
                  onToggleFocusReader={() =>
                    setIsFocusReader((prev) => !prev)
                  }
                  onBackToList={() => setMobileDetailOpen(false)}
                  onAfterReviewDecision={(reviewedId, action) => {
                    if (action === "approve") {
                      advanceToNextPending(reviewedId);
                    }
                  }}
                />
              ) : (
                <div className="flex h-full min-h-[420px] items-center justify-center p-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  {t("taskNotes.selectNotePrompt")}
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      <BulkGovernanceBar
        selectedCount={selectedNotes.length}
        reviewableCount={bulkCounts.reviewableCount}
        approvedControlCount={bulkCounts.approvedControlCount}
        purgeableCount={bulkCounts.purgeableCount}
        deletableCount={bulkCounts.deletableCount}
        isBusy={isBulkBusy}
        feedbackMessage={bulkFeedback}
        onClearSelection={() => setSelectedNoteIds(new Set())}
        onExecute={handleExecuteBulk}
      />
    </main>
  );
}
