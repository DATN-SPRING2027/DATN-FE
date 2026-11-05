"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useFormatter, useTranslations } from "next-intl";
import {
  AlertCircle,
  Check,
  ChevronDown,
  Copy,
  Database,
  Download,
  FileCode2,
  HardDriveDownload,
  History,
  Layers,
  Lock,
  MessageSquarePlus,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Share2,
  Trash2,
  Unlink,
  X,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import {
  type ArtifactFileMetadata,
  type DocumentKnowledgeChunksResponse,
  type DocumentKnowledgeControlAction,
  type DocumentKnowledgeStatus,
  type DocumentStatus,
  type DocumentStorageReference,
  type TaskNoteReviewStatus,
  type WorkReportStatus,
} from "@/lib/queries/work-notes/useWorkNotes";
import { cn } from "@/utils";
import { MarkdownDocumentView, formatArtifactBytes } from "./MarkdownArtifactStrip";
import { resolvePipelineDisplay } from "./ProjectDocumentsWorkspace";
import {
  UploadAlertCircleIcon,
  UploadIndexReadyIcon,
  UploadPauseIcon,
  UploadProgressArcIcon,
} from "./UploadIcons";

export type GovernanceReviewStatus =
  | TaskNoteReviewStatus
  | WorkReportStatus
  | DocumentStatus;

const STATUS_DOT_CLASSES: Record<GovernanceReviewStatus, string> = {
  DRAFT: "bg-gray-400 dark:bg-gray-500",
  OVERDUE: "bg-rose-500 dark:bg-rose-400",
  PENDING_REVIEW: "bg-amber-500 dark:bg-amber-400",
  APPROVED: "bg-emerald-500 dark:bg-emerald-400",
  CHANGES_REQUESTED: "bg-orange-500 dark:bg-orange-400",
  REJECTED: "bg-rose-500 dark:bg-rose-400",
  ARCHIVED: "bg-gray-400 dark:bg-gray-500",
};

function normalizeToDocumentStatus(
  status: GovernanceReviewStatus,
): DocumentStatus {
  if (status === "OVERDUE") return "DRAFT";
  return status;
}

function formatDurationMs(durationMs?: number): string | null {
  if (typeof durationMs !== "number" || !Number.isFinite(durationMs) || durationMs <= 0) {
    return null;
  }
  if (durationMs < 1000) return `${Math.round(durationMs)}ms`;
  return `${(durationMs / 1000).toFixed(1)}s`;
}

const STATUS_PILL_CLASSES: Record<GovernanceReviewStatus, string> = {
  DRAFT:
    "border-gray-200 bg-gray-50 text-gray-700 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-300",
  OVERDUE:
    "border-rose-200/85 bg-rose-50/75 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
  PENDING_REVIEW:
    "border-amber-200/85 bg-amber-50/75 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300",
  APPROVED:
    "border-emerald-200/85 bg-emerald-50/75 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300",
  CHANGES_REQUESTED:
    "border-orange-200/85 bg-orange-50/75 text-orange-800 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300",
  REJECTED:
    "border-rose-200/85 bg-rose-50/75 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300",
  ARCHIVED:
    "border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-400",
};

export function ApprovalStatusBadge({
  status,
  label,
  className,
}: Readonly<{
  status: GovernanceReviewStatus;
  label: string;
  className?: string;
}>) {
  const dotClass = STATUS_DOT_CLASSES[status] ?? STATUS_DOT_CLASSES.DRAFT;
  const pillClass = STATUS_PILL_CLASSES[status] ?? STATUS_PILL_CLASSES.DRAFT;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        pillClass,
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass)} />
      <span>{label}</span>
    </span>
  );
}

export function CompactPipelineProgressCell({
  status,
  knowledgeSync,
  hasR2File = false,
}: Readonly<{
  status: GovernanceReviewStatus;
  knowledgeSync?: DocumentKnowledgeStatus;
  hasR2File?: boolean;
}>) {
  const t = useTranslations("workNotes.documents");
  const tg = useTranslations("workNotes.governance");
  const normalizedStatus = normalizeToDocumentStatus(status);
  const pipeline = resolvePipelineDisplay(normalizedStatus, knowledgeSync);

  if (normalizedStatus !== "APPROVED") {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {hasR2File && (
        <span className="inline-flex items-center gap-1 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          <Database className="h-2.5 w-2.5 text-gray-400" />
          <span>{tg("r2ReadyShort")}</span>
        </span>
      )}

      <span
        className={cn(
          "inline-flex items-center gap-1.5 text-[11px] font-medium",
          pipeline.phase === "ready"
            ? "text-gray-800 dark:text-gray-200"
            : pipeline.phase === "processing"
              ? "text-brand-700 dark:text-brand-300"
              : pipeline.phase === "paused"
                ? "text-amber-700 dark:text-amber-300"
                : pipeline.phase === "failed"
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-gray-500 dark:text-gray-400",
        )}
      >
        {pipeline.phase === "processing" ? (
          <UploadProgressArcIcon className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-500" />
        ) : pipeline.phase === "ready" ? (
          <UploadIndexReadyIcon className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
        ) : pipeline.phase === "paused" ? (
          <UploadPauseIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
        ) : pipeline.phase === "failed" ? (
          <UploadAlertCircleIcon className="h-3.5 w-3.5 shrink-0 text-rose-500" />
        ) : null}
        <span>{t(pipeline.stageKey)}</span>
      </span>

      {(pipeline.phase === "processing" ||
        pipeline.phase === "paused" ||
        pipeline.phase === "ready") &&
        pipeline.percent !== null && (
          <div className="flex items-center gap-1.5">
            <div className="h-1 w-16 overflow-hidden rounded-sm bg-gray-200 dark:bg-gray-800">
              <div
                className={cn(
                  "h-full transition-all duration-300",
                  pipeline.phase === "ready"
                    ? "bg-emerald-500 dark:bg-emerald-400"
                    : pipeline.phase === "paused"
                      ? "bg-amber-500 dark:bg-amber-400"
                      : "bg-brand-500 dark:bg-brand-400",
                )}
                style={{ width: `${Math.max(0, pipeline.percent)}%` }}
              />
            </div>
            <span className="font-mono text-[11px] font-medium tabular-nums text-gray-600 dark:text-gray-300">
              {pipeline.percent}%
            </span>
          </div>
        )}

      {pipeline.phase === "ready" && pipeline.chunkCount > 0 && (
        <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] font-medium tabular-nums text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          {t("pipelineChunksBadge", { count: pipeline.chunkCount })}
        </span>
      )}
    </div>
  );
}

export type SagPipelineAction = "SYNC" | DocumentKnowledgeControlAction;

export interface PurgeArtifactOptions {
  readonly reopen?: boolean;
  readonly comment?: string;
}

export function SagKnowledgePipelineCard({
  status,
  knowledgeSync,
  file,
  storageReference,
  canControl = false,
  canPurge = false,
  canReopen = false,
  isBusy = false,
  controlError = null,
  variant = "card",
  onAction,
  onPurgeArtifact,
  onDeleteEntity,
}: Readonly<{
  status: GovernanceReviewStatus;
  knowledgeSync?: DocumentKnowledgeStatus;
  file?: ArtifactFileMetadata;
  storageReference?: DocumentStorageReference;
  canControl?: boolean;
  canPurge?: boolean;
  canReopen?: boolean;
  isBusy?: boolean;
  controlError?: string | null;
  variant?: "card" | "flush";
  onAction?: (action: SagPipelineAction) => void | Promise<void>;
  onPurgeArtifact?: (options: PurgeArtifactOptions) => void | Promise<void>;
  onDeleteEntity?: () => void | Promise<void>;
}>) {
  const t = useTranslations("workNotes.documents");
  const tg = useTranslations("workNotes.governance");
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [isLifecycleModalOpen, setIsLifecycleModalOpen] = useState(false);
  const [reopenOnPurge, setReopenOnPurge] = useState(false);
  const [reopenComment, setReopenComment] = useState("");
  const [isModalActionBusy, setIsModalActionBusy] = useState(false);

  const normalizedStatus = normalizeToDocumentStatus(status);
  const isApproved = normalizedStatus === "APPROVED";
  const isFlush = variant === "flush";

  // Pre-approval: Honest Governance Gate (NEVER show fake 4-step SAG progress bar!)
  if (!isApproved) {
    const gateDesc =
      normalizedStatus === "CHANGES_REQUESTED"
        ? tg("gateChangesDesc")
        : normalizedStatus === "REJECTED"
          ? tg("gateRejectedDesc")
          : normalizedStatus === "DRAFT"
            ? tg("gateDraftDesc")
            : tg("gatePendingDesc");

    const gateTone =
      normalizedStatus === "REJECTED"
        ? "border-rose-200/80 bg-rose-50/40 dark:border-rose-500/20 dark:bg-rose-500/5"
        : normalizedStatus === "CHANGES_REQUESTED"
          ? "border-orange-200/80 bg-orange-50/40 dark:border-orange-500/20 dark:bg-orange-500/5"
          : "border-brand-100/90 bg-brand-50/35 dark:border-brand-500/20 dark:bg-brand-500/5";

    return (
      <section
        aria-label={tg("gateTitle")}
        className={cn(
          isFlush
            ? "px-4 py-3.5"
            : cn("rounded-xl border px-4 py-3.5", gateTone),
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-brand-600 shadow-theme-xs ring-1 ring-inset ring-brand-200/70 dark:bg-gray-900 dark:text-brand-300 dark:ring-brand-500/30">
              <Lock className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                {tg("gateTitle")}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                {gateDesc}
              </p>
            </div>
          </div>
          {normalizedStatus === "PENDING_REVIEW" && canControl && onAction ? (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => void onAction("SYNC")}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white shadow-theme-xs transition-colors hover:bg-brand-600 disabled:opacity-50"
            >
              <RefreshCw
                className={cn("h-3 w-3", isBusy && "animate-spin")}
                aria-hidden="true"
              />
              <span>{tg("btnSyncSag")}</span>
            </button>
          ) : null}
        </div>
      </section>
    );
  }

  const pipeline = resolvePipelineDisplay(normalizedStatus, knowledgeSync);
  const stageProgressMap = knowledgeSync?.stageProgress ?? null;

  const sagStages: ReadonlyArray<{
    idx: 1 | 2 | 3 | 4;
    code: "RECEIVE" | "PARSE" | "EXTRACT" | "INDEX";
    label: string;
  }> = [
    { idx: 1, code: "RECEIVE", label: tg("stageReceive") },
    { idx: 2, code: "PARSE", label: tg("stageParse") },
    { idx: 3, code: "EXTRACT", label: tg("stageExtract") },
    { idx: 4, code: "INDEX", label: tg("stageIndex") },
  ];

  const handleTrigger = async (action: SagPipelineAction) => {
    if (!onAction) return;
    if (action === "REVOKE") {
      setConfirmingRevoke(false);
    }
    await onAction(action);
  };

  const hasLifecycleModalActions =
    canPurge && Boolean(onPurgeArtifact || onDeleteEntity);
  const showControlBar = Boolean((canControl && onAction) || hasLifecycleModalActions);
  const externalRefs = storageReference?.externalDocumentRefs ?? 0;
  const totalRefs = Math.max(1, storageReference?.refCount ?? externalRefs + 1);

  return (
    <>
      <section
        aria-label={tg("sagHeaderEyebrow")}
        className={cn(
          "@container divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-950",
          !isFlush &&
            "overflow-hidden rounded-xl border border-gray-200/90 shadow-theme-xs dark:border-gray-800",
        )}
      >
        {/* Row 1: SAG Header & Telemetry */}
        <div className="px-4 py-3.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className={cn(
                  "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                  pipeline.phase === "ready"
                    ? "border-emerald-200/80 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-500/10"
                    : pipeline.phase === "processing"
                      ? "border-brand-200/80 bg-brand-50/70 dark:border-brand-500/30 dark:bg-brand-500/10"
                      : "border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900",
                )}
              >
                {pipeline.phase === "processing" ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-brand-600 dark:text-brand-400" />
                ) : pipeline.phase === "ready" ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : pipeline.phase === "paused" ? (
                  <Pause className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                ) : pipeline.phase === "failed" ? (
                  <AlertCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                ) : (
                  <Layers className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                )}
              </span>

              <div className="min-w-0">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                  {tg("sagHeaderEyebrow")}
                </p>
                <p className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">
                  {t(pipeline.stageKey)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {pipeline.isDeduplicated && (
                <span
                  title={t("aiDeduplicatedTooltip")}
                  className="inline-flex items-center gap-1 rounded-md border border-brand-200/70 bg-brand-50/60 px-2 py-0.5 font-mono text-[10px] font-medium text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300"
                >
                  <Share2 className="h-2.5 w-2.5" />
                  <span>{tg("dedupChip")}</span>
                </span>
              )}

              {pipeline.chunkCount > 0 && pipeline.phase !== "revoked" && (
                <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-[10px] font-medium tabular-nums text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  {t("pipelineChunksBadge", { count: pipeline.chunkCount })}
                </span>
              )}

              {(knowledgeSync?.tokenUsage ?? 0) > 0 &&
                pipeline.phase !== "revoked" && (
                  <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-[10px] font-medium tabular-nums text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
                    {tg("tokensChip", { count: knowledgeSync?.tokenUsage ?? 0 })}
                  </span>
                )}

              {pipeline.percent !== null && (
                <span className="font-mono text-xs font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                  {pipeline.percent}%
                </span>
              )}
            </div>
          </div>

          {/* Crisp Linear Bar */}
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className={cn(
                "h-full rounded-full",
                pipeline.phase === "processing" && (pipeline.percent ?? 0) === 0
                  ? "transition-none"
                  : "transition-all duration-300",
                pipeline.phase === "ready"
                  ? "bg-emerald-500 dark:bg-emerald-400"
                  : pipeline.phase === "processing"
                    ? "bg-brand-500 dark:bg-brand-400"
                    : pipeline.phase === "paused"
                      ? "bg-amber-500 dark:bg-amber-400"
                      : pipeline.phase === "failed"
                        ? "bg-rose-500 dark:bg-rose-400"
                        : "bg-gray-300 dark:bg-gray-700",
              )}
              style={{
                width: `${
                  pipeline.phase === "failed"
                    ? Math.max(12, pipeline.percent ?? 12)
                    : Math.max(0, pipeline.percent ?? 0)
                }%`,
              }}
            />
          </div>

          {/* Authentic 4-Stage SAG Breakdown (RECEIVE / PARSE / EXTRACT / INDEX) */}
          <div className="mt-3 grid grid-cols-2 gap-1.5 @[520px]:grid-cols-4">
            {sagStages.map((stage) => {
              const stageMeta = stageProgressMap?.[stage.code];
              const stageRawStatus = (stageMeta?.status ?? "").toUpperCase();
              const completed =
                pipeline.phase === "ready" ||
                stageRawStatus === "COMPLETED" ||
                stageRawStatus === "DONE" ||
                pipeline.stepIndex > stage.idx;
              const failedHere =
                stageRawStatus === "FAILED" ||
                (pipeline.phase === "failed" && pipeline.stepIndex === stage.idx);
              const active =
                !completed &&
                !failedHere &&
                (stageRawStatus === "RUNNING" ||
                  stageRawStatus === "IN_PROGRESS" ||
                  (pipeline.phase === "processing" &&
                    pipeline.stepIndex === stage.idx));
              const pausedHere =
                !completed &&
                !failedHere &&
                pipeline.phase === "paused" &&
                pipeline.stepIndex === stage.idx;
              const durationText = formatDurationMs(stageMeta?.duration_ms);

              return (
                <div
                  key={stage.code}
                  className={cn(
                    "flex items-center justify-between gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors",
                    failedHere
                      ? "border-rose-200 bg-rose-50/60 text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/20 dark:text-rose-300"
                      : active
                        ? "border-brand-200 bg-brand-50/75 text-brand-700 dark:border-brand-500/35 dark:bg-brand-500/15 dark:text-brand-300"
                        : pausedHere
                          ? "border-amber-200 bg-amber-50/65 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                          : completed
                            ? "border-emerald-200/70 bg-emerald-50/35 text-gray-800 dark:border-emerald-500/25 dark:bg-emerald-500/10 dark:text-gray-200"
                            : "border-gray-100 bg-gray-50/40 text-gray-400 dark:border-gray-800/60 dark:bg-gray-900/30 dark:text-gray-500",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        failedHere
                          ? "bg-rose-500"
                          : completed
                            ? "bg-emerald-500"
                            : active
                              ? "animate-pulse bg-brand-500"
                              : pausedHere
                                ? "bg-amber-500"
                                : "bg-gray-300 dark:bg-gray-700",
                      )}
                    />
                    <span className="truncate font-medium">{stage.label}</span>
                  </div>
                  {durationText ? (
                    <span className="shrink-0 font-mono text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                      {durationText}
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          {(pipeline.phase === "failed" || Boolean(controlError)) && (
            <p
              role="alert"
              className="mt-2.5 rounded-lg border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
            >
              {controlError || pipeline.errorMessage || t("pipelineFailedHint")}
            </p>
          )}
        </div>

        {/* Row 2: Explicit Labeled Operational Controls */}
        {showControlBar && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-gray-50/50 px-4 py-2.5 dark:bg-gray-900/50">
            <div className="flex flex-wrap items-center gap-1.5">
              {canControl && onAction && (
                <>
                  {(pipeline.phase === "not_started" ||
                    pipeline.phase === "revoked" ||
                    pipeline.phase === "failed") && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        if (
                          pipeline.phase === "failed" &&
                          knowledgeSync?.sagDocumentId
                        ) {
                          void handleTrigger("REPROCESS");
                        } else {
                          void handleTrigger("SYNC");
                        }
                      }}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50"
                    >
                      {isBusy ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : pipeline.phase === "failed" ? (
                        <RotateCcw className="h-3 w-3" />
                      ) : (
                        <HardDriveDownload className="h-3 w-3" />
                      )}
                      <span>
                        {pipeline.phase === "failed"
                          ? tg("btnReprocess")
                          : tg("btnSyncSag")}
                      </span>
                    </button>
                  )}

                  {pipeline.phase === "processing" && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleTrigger("PAUSE")}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 shadow-theme-xs transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      {isBusy ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Pause className="h-3 w-3 text-amber-600" />
                      )}
                      <span>{tg("btnPause")}</span>
                    </button>
                  )}

                  {pipeline.phase === "paused" && (
                    <button
                      type="button"
                      disabled={isBusy || Boolean(pipeline.isPausing)}
                      onClick={() => void handleTrigger("RESUME")}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50"
                    >
                      {isBusy || pipeline.isPausing ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                      <span>
                        {pipeline.isPausing
                          ? tg("btnPausing")
                          : tg("btnResume")}
                      </span>
                    </button>
                  )}

                  {(pipeline.phase === "ready" ||
                    pipeline.phase === "paused") && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleTrigger("REPROCESS")}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 shadow-theme-xs transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <RotateCcw className="h-3 w-3 text-gray-500" />
                      <span>{tg("btnReprocess")}</span>
                    </button>
                  )}

                  {(pipeline.phase === "ready" ||
                    pipeline.phase === "paused") && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setConfirmingRevoke((prev) => !prev)}
                      className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 shadow-theme-xs transition hover:border-gray-300 hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
                    >
                      <Unlink className="h-3 w-3 text-gray-500" />
                      <span>{tg("btnRevokeSag")}</span>
                    </button>
                  )}
                </>
              )}
            </div>

            {hasLifecycleModalActions && (
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setIsLifecycleModalOpen(true)}
                className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 shadow-theme-xs transition hover:border-rose-200 hover:bg-rose-50/60 hover:text-rose-700 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-rose-800 dark:hover:text-rose-300"
              >
                <Database className="h-3 w-3" />
                <span>{tg("btnManageStorage")}</span>
              </button>
            )}
          </div>
        )}

        {/* Inline Revoke Quick Confirmation */}
        {confirmingRevoke && canControl && (
          <div className="flex flex-wrap items-center justify-between gap-2 bg-brand-50/40 px-4 py-2.5 text-xs dark:bg-brand-500/10">
            <span className="font-medium text-gray-700 dark:text-gray-200">
              {tg("revokeInlinePrompt")}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => setConfirmingRevoke(false)}
                className="rounded-lg border border-gray-200 bg-white px-2.5 py-1 font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
              >
                {tg("cancel")}
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void handleTrigger("REVOKE")}
                className="rounded-lg bg-brand-500 px-2.5 py-1 font-semibold text-white shadow-theme-xs hover:bg-brand-600"
              >
                {tg("confirmRevoke")}
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Tiered Lifecycle Removal Modal (SAG + Cloudflare R2 + Record) */}
      {isLifecycleModalOpen && (
        <Modal
          isOpen
          onClose={() => {
            if (!isModalActionBusy) setIsLifecycleModalOpen(false);
          }}
          showCloseButton={false}
          backdropClassName="bg-gray-950/40 backdrop-blur-[4px]"
          className="max-w-xl overflow-hidden rounded-2xl border border-gray-200/90 shadow-theme-xl dark:border-gray-800"
        >
          <div className="divide-y divide-gray-200 dark:divide-gray-800">
            {/* Header */}
            <div className="flex items-start justify-between gap-3 bg-gray-50/70 px-5 py-3.5 dark:bg-gray-900/70">
              <div className="min-w-0">
                <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {tg("lifecycleModalEyebrow")}
                </p>
                <h3 className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-white">
                  {tg("lifecycleModalTitle")}
                </h3>
              </div>
              <button
                type="button"
                aria-label={tg("lifecycleModalClose")}
                disabled={isModalActionBusy}
                onClick={() => setIsLifecycleModalOpen(false)}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Cloudflare R2 Reference Safety Banner */}
            <div className="px-5 py-3.5">
              {file ? (
                <div className="rounded-md border border-gray-200 bg-gray-50/80 p-3 dark:border-gray-800 dark:bg-gray-900/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-900 dark:text-gray-100">
                      {externalRefs > 0 ? (
                        <Share2 className="h-3.5 w-3.5 text-amber-600" />
                      ) : (
                        <Database className="h-3.5 w-3.5 text-gray-600" />
                      )}
                      <span>
                        {externalRefs > 0
                          ? tg("r2StatusSharedTitle", { count: totalRefs })
                          : tg("r2StatusUniqueTitle")}
                      </span>
                    </span>
                    <span className="font-mono text-[11px] text-gray-500">
                      {formatArtifactBytes(file.size)}
                      {file.sha256 ? ` · sha256:${file.sha256.slice(0, 8)}` : ""}
                    </span>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                    {externalRefs > 0
                      ? tg("r2StatusSharedDesc", { external: externalRefs })
                      : tg("r2StatusUniqueDesc", { fileName: file.name })}
                  </p>
                </div>
              ) : (
                <div className="rounded-md border border-gray-200 bg-gray-50/60 p-3 text-xs text-gray-600 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-400">
                  <p className="font-semibold text-gray-800 dark:text-gray-200">
                    {tg("r2StatusNoFileTitle")}
                  </p>
                  <p className="mt-0.5">{tg("r2StatusNoFileDesc")}</p>
                </div>
              )}
            </div>

            {/* Tiers */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800/80">
              {/* Tier 1: Detach SAG Only */}
              {canControl && onAction && (
                <div className="flex flex-col justify-between gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                        {tg("tier1Title")}
                      </span>
                      <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                        {tg("tier1Badge")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                      {tg("tier1Desc")}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isModalActionBusy || pipeline.phase === "revoked" || pipeline.phase === "not_started"}
                    onClick={async () => {
                      setIsModalActionBusy(true);
                      try {
                        await handleTrigger("REVOKE");
                        setIsLifecycleModalOpen(false);
                      } finally {
                        setIsModalActionBusy(false);
                      }
                    }}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 text-xs font-medium text-gray-800 transition hover:bg-gray-100 disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                  >
                    <Unlink className="h-3.5 w-3.5" />
                    <span>{tg("tier1Action")}</span>
                  </button>
                </div>
              )}

              {/* Tier 2: Purge .md from Cloudflare R2 (+ optional Reopen) */}
              {onPurgeArtifact && (
                <div className="space-y-3 px-5 py-3.5">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                          {tg("tier2Title")}
                        </span>
                        <span className="rounded border border-amber-200 bg-amber-50/70 px-1.5 py-0.5 font-mono text-[10px] text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300">
                          {tg("tier2Badge")}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                        {tg("tier2Desc")}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={isModalActionBusy || (!file && !reopenOnPurge)}
                      onClick={async () => {
                        setIsModalActionBusy(true);
                        try {
                          await onPurgeArtifact({
                            reopen: reopenOnPurge,
                            ...(reopenComment.trim()
                              ? { comment: reopenComment.trim() }
                              : {}),
                          });
                          setIsLifecycleModalOpen(false);
                          setReopenOnPurge(false);
                          setReopenComment("");
                        } finally {
                          setIsModalActionBusy(false);
                        }
                      }}
                      className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 text-xs font-semibold text-amber-900 transition hover:bg-amber-100 disabled:opacity-40 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-200"
                    >
                      <Database className="h-3.5 w-3.5" />
                      <span>
                        {reopenOnPurge
                          ? tg("tier2ActionReopen")
                          : tg("tier2Action")}
                      </span>
                    </button>
                  </div>

                  {canReopen && (
                    <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/60 p-3 dark:border-gray-800 dark:bg-gray-900/40">
                      <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={reopenOnPurge}
                          onChange={(e) => setReopenOnPurge(e.target.checked)}
                          className="h-3.5 w-3.5 rounded border-gray-300 accent-brand-500 text-brand-600 focus:ring-brand-500/20"
                        />
                        <span>{tg("tier2ReopenToggle")}</span>
                      </label>
                      {reopenOnPurge && (
                        <input
                          type="text"
                          value={reopenComment}
                          onChange={(e) => setReopenComment(e.target.value)}
                          placeholder={tg("tier2ReopenCommentPlaceholder")}
                          className="h-8 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs text-gray-800 outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Tier 3: Delete Entity (DB + SAG + R2) */}
              {onDeleteEntity && (
                <div className="flex flex-col justify-between gap-3 px-5 py-3.5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                        {tg("tier3Title")}
                      </span>
                      <span className="rounded border border-rose-200 bg-rose-50 px-1.5 py-0.5 font-mono text-[10px] text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-300">
                        {tg("tier3Badge")}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                      {tg("tier3Desc")}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={isModalActionBusy}
                    onClick={async () => {
                      setIsModalActionBusy(true);
                      try {
                        await onDeleteEntity();
                        setIsLifecycleModalOpen(false);
                      } finally {
                        setIsModalActionBusy(false);
                      }
                    }}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-rose-600 px-3 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>{tg("tier3Action")}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

export function ExtractedChunksInspector({
  status,
  knowledgeSync,
  chunksData,
  isPending,
  showEmptyState = false,
  variant = "card",
}: Readonly<{
  status: GovernanceReviewStatus;
  knowledgeSync?: DocumentKnowledgeStatus;
  chunksData?: DocumentKnowledgeChunksResponse;
  isPending?: boolean;
  showEmptyState?: boolean;
  variant?: "card" | "flush";
}>) {
  const t = useTranslations("workNotes.documents");
  const tg = useTranslations("workNotes.governance");
  const format = useFormatter();
  const [chunkFilter, setChunkFilter] = useState("");
  const [expandedChunkIds, setExpandedChunkIds] = useState<
    Record<string, boolean>
  >({});

  const normalizedStatus = normalizeToDocumentStatus(status);
  if (normalizedStatus !== "APPROVED") {
    return null;
  }

  const pipeline = resolvePipelineDisplay(normalizedStatus, knowledgeSync);
  const allChunks = chunksData?.items ?? [];
  const shouldShowSkeleton = pipeline.phase === "ready" && Boolean(isPending);
  const hasChunks = pipeline.phase !== "revoked" && allChunks.length > 0;
  const isFlush = variant === "flush";

  if (!shouldShowSkeleton && !hasChunks) {
    if (!showEmptyState) return null;
    return (
      <div
        className={cn(
          "px-4 py-8 text-center text-xs leading-relaxed text-gray-500 dark:text-gray-400",
          !isFlush &&
            "rounded-xl border border-dashed border-gray-200 bg-gray-50/40 dark:border-gray-800 dark:bg-gray-900/30",
        )}
      >
        {tg("noChunksYet")}
      </div>
    );
  }

  const normalizedQuery = chunkFilter.trim().toLowerCase();
  const filteredChunks = normalizedQuery
    ? allChunks.filter(
        (item) =>
          item.content.toLowerCase().includes(normalizedQuery) ||
          item.sectionPath.toLowerCase().includes(normalizedQuery),
      )
    : allChunks;
  const totalChunks = chunksData?.totalChunks ?? allChunks.length;
  const totalTokens = chunksData?.totalTokens ?? 0;

  return (
    <section
      aria-label={t("extractedChunksHeading")}
      className={cn(
        "bg-white dark:bg-gray-950",
        !isFlush &&
          "overflow-hidden rounded-xl border border-gray-200/90 shadow-theme-xs dark:border-gray-800",
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/50 px-4 py-2.5 dark:border-gray-800 dark:bg-gray-900/60">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-gray-700 dark:text-gray-300">
            {t("extractedChunksHeading")}
          </h3>
          {totalChunks > 0 && (
            <span className="rounded-md border border-gray-200 bg-white px-2 py-0.5 font-mono text-[10px] tabular-nums text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400">
              {totalTokens > 0
                ? t("extractedChunksMetaWithTokens", {
                    chunks: totalChunks,
                    tokens: format.number(totalTokens),
                  })
                : t("pipelineChunksBadge", {
                    count: totalChunks,
                  })}
            </span>
          )}
        </div>

        {allChunks.length >= 2 && (
          <div className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={chunkFilter}
              onChange={(event) => setChunkFilter(event.target.value)}
              placeholder={t("extractedChunksFilterPlaceholder")}
              aria-label={t("extractedChunksFilterPlaceholder")}
              className={cn(
                "h-7 w-44 rounded-lg border border-gray-200 bg-white ps-7 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200",
                chunkFilter ? "pe-6" : "pe-2.5",
              )}
            />
            {chunkFilter && (
              <button
                type="button"
                onClick={() => setChunkFilter("")}
                aria-label={t("extractedChunksFilterClear")}
                className="absolute end-1.5 top-1/2 inline-flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {shouldShowSkeleton ? (
        <div className="divide-y divide-gray-100 dark:divide-gray-800/80">
          <div className="h-16 animate-pulse bg-gray-50/50 dark:bg-gray-900/40" />
          <div className="h-16 animate-pulse bg-gray-50/30 dark:bg-gray-900/25" />
        </div>
      ) : filteredChunks.length === 0 ? (
        <div className="px-3.5 py-5 text-center text-xs text-gray-500 dark:text-gray-400">
          {t("extractedChunksFilterEmpty", {
            query: chunkFilter.trim(),
          })}
        </div>
      ) : (
        <div className="max-h-80 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800/80">
          {filteredChunks.map((chunk) => {
            const isExpanded = Boolean(expandedChunkIds[chunk.chunkId]);
            const isLong =
              chunk.content.length > 240 ||
              chunk.content.split("\n").length > 4;
            const isStructuredMono =
              chunk.blockType === "code" || chunk.blockType === "table";
            const previewContent =
              !isExpanded && isLong
                ? `${chunk.content.slice(0, 240).trimEnd()}…`
                : chunk.content;

            return (
              <article
                key={chunk.chunkId}
                className="px-3.5 py-3 transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-900/40"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                      #{chunk.ordinal}
                    </span>
                    <span className="truncate text-xs font-semibold text-gray-900 dark:text-gray-100">
                      {chunk.sectionPath ||
                        t("extractedChunkSectionFallback", {
                          index: chunk.ordinal,
                        })}
                    </span>
                    {isStructuredMono && (
                      <span className="shrink-0 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] uppercase text-gray-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                        {chunk.blockType}
                      </span>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] tabular-nums text-gray-500 dark:text-gray-400">
                    {chunk.pageFrom > 0 && (
                      <span>
                        {chunk.pageTo > chunk.pageFrom
                          ? t("extractedChunkPageRange", {
                              from: chunk.pageFrom,
                              to: chunk.pageTo,
                            })
                          : t("extractedChunkPageSingle", {
                              page: chunk.pageFrom,
                            })}
                      </span>
                    )}
                    {chunk.pageFrom > 0 && chunk.tokenCount > 0 && (
                      <span aria-hidden="true">·</span>
                    )}
                    {chunk.tokenCount > 0 && (
                      <span>
                        {t("extractedChunkTokensShort", {
                          count: chunk.tokenCount,
                        })}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2">
                  {isStructuredMono ? (
                    <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-gray-200 bg-gray-950 p-2.5 font-mono text-[11px] leading-relaxed text-gray-100 dark:border-gray-800">
                      <code>{previewContent}</code>
                    </pre>
                  ) : (
                    <MarkdownDocumentView
                      markdown={previewContent}
                      compact
                      className="text-xs"
                    />
                  )}
                </div>

                {isLong && (
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedChunkIds((prev) => ({
                        ...prev,
                        [chunk.chunkId]: !isExpanded,
                      }))
                    }
                    className="mt-1.5 text-[11px] font-medium text-gray-700 underline underline-offset-2 transition hover:text-gray-900 dark:text-gray-300 dark:hover:text-white"
                  >
                    {isExpanded
                      ? t("extractedChunkCollapse")
                      : t("extractedChunkExpand")}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export type BulkCommandAction =
  | "APPROVE"
  | "REQUEST_CHANGES"
  | "REJECT"
  | "SYNC"
  | "PAUSE"
  | "RESUME"
  | "REVOKE"
  | "PURGE_ARTIFACT"
  | "DELETE";

export function BulkGovernanceBar({
  selectedCount,
  reviewableCount,
  approvedControlCount,
  purgeableCount,
  deletableCount = 0,
  isBusy = false,
  feedbackMessage = null,
  onClearSelection,
  onExecute,
}: Readonly<{
  selectedCount: number;
  reviewableCount: number;
  approvedControlCount: number;
  purgeableCount: number;
  deletableCount?: number;
  isBusy?: boolean;
  feedbackMessage?: string | null;
  onClearSelection: () => void;
  onExecute: (action: BulkCommandAction, comment?: string) => void | Promise<void>;
}>) {
  const tg = useTranslations("workNotes.governance");
  const [commentPromptAction, setCommentPromptAction] = useState<
    "REQUEST_CHANGES" | "REJECT" | null
  >(null);
  const [comment, setComment] = useState("");
  const [isLifecycleMenuOpen, setIsLifecycleMenuOpen] = useState(false);

  useEffect(() => {
    if (selectedCount <= 0 || isBusy) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isLifecycleMenuOpen) {
        setIsLifecycleMenuOpen(false);
        return;
      }
      if (commentPromptAction) {
        setCommentPromptAction(null);
        return;
      }
      onClearSelection();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedCount,
    isBusy,
    isLifecycleMenuOpen,
    commentPromptAction,
    onClearSelection,
  ]);

  if (selectedCount <= 0 && !feedbackMessage) {
    return null;
  }

  const submitCommentAction = async () => {
    if (!commentPromptAction || !comment.trim()) return;
    const action = commentPromptAction;
    const text = comment.trim();
    setCommentPromptAction(null);
    setComment("");
    await onExecute(action, text);
  };

  const hasSecondaryLifecycle =
    approvedControlCount > 0 || purgeableCount > 0 || deletableCount > 0;
  const secondaryTargetCount = Math.max(
    approvedControlCount,
    purgeableCount,
    deletableCount,
  );
  const collapseLifecycleIntoPopover =
    hasSecondaryLifecycle &&
    (reviewableCount > 0 ||
      (approvedControlCount > 0 && (purgeableCount > 0 || deletableCount > 0)));

  const barNode = (
    <div
      role="region"
      aria-label={tg("bulkSelectedCount", { count: selectedCount })}
      className="fixed bottom-14 left-1/2 z-50 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 rounded-2xl border border-gray-200/90 bg-white/95 px-3.5 py-2 text-gray-900 shadow-theme-xl ring-1 ring-gray-900/5 backdrop-blur-md lg:left-[calc(50%+9rem)] lg:max-w-[calc(100vw-20rem)] dark:border-gray-700 dark:bg-gray-900/95 dark:text-white"
    >
      {selectedCount > 0 ? (
        <div className="space-y-2">
          {commentPromptAction && (
            <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-2 dark:border-gray-800">
              <input
                type="text"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={tg("bulkCommentPlaceholder")}
                className="h-8 min-w-56 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-gray-100"
              />
              <button
                type="button"
                disabled={isBusy || !comment.trim()}
                onClick={() => void submitCommentAction()}
                className="h-8 rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-40"
              >
                {tg("bulkCommentConfirm")}
              </button>
              <button
                type="button"
                onClick={() => setCommentPromptAction(null)}
                className="h-8 rounded-lg px-2.5 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                {tg("cancel")}
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 pe-1">
              <span className="inline-flex items-center rounded-full bg-brand-500 px-2.5 py-0.5 font-mono text-xs font-semibold tabular-nums text-white shadow-theme-xs">
                {tg("bulkSelectedCount", { count: selectedCount })}
              </span>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => {
                  setIsLifecycleMenuOpen(false);
                  setCommentPromptAction(null);
                  setComment("");
                  onClearSelection();
                }}
                className="text-xs font-medium text-gray-500 transition hover:text-gray-900 disabled:opacity-50 dark:text-gray-400 dark:hover:text-white"
              >
                {tg("bulkClearSelection")}
              </button>
              <kbd
                aria-hidden="true"
                className="hidden rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-400 sm:inline-block dark:border-gray-700 dark:bg-gray-800"
              >
                {tg("bulkEscHint")}
              </kbd>
            </div>

            <span
              aria-hidden="true"
              className="hidden h-4 w-px bg-gray-200 sm:inline-block dark:bg-gray-700"
            />

            <div className="flex flex-wrap items-center gap-1.5">
              {reviewableCount > 0 && (
                <>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void onExecute("APPROVE")}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand-500 px-3 text-xs font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                    <span>{tg("bulkApprove", { count: reviewableCount })}</span>
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      setCommentPromptAction((prev) =>
                        prev === "REQUEST_CHANGES" ? null : "REQUEST_CHANGES",
                      )
                    }
                    className={cn(
                      "inline-flex h-8 items-center rounded-lg border px-2.5 text-xs font-medium shadow-theme-xs transition disabled:opacity-50",
                      commentPromptAction === "REQUEST_CHANGES"
                        ? "border-brand-300 bg-brand-50 text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-300"
                        : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700",
                    )}
                  >
                    {tg("bulkRequestChanges", { count: reviewableCount })}
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() =>
                      setCommentPromptAction((prev) =>
                        prev === "REJECT" ? null : "REJECT",
                      )
                    }
                    className="inline-flex h-8 items-center rounded-lg border border-rose-200 bg-rose-50/70 px-2.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100/70 disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                  >
                    {tg("bulkReject", { count: reviewableCount })}
                  </button>
                </>
              )}

              {approvedControlCount > 0 && reviewableCount === 0 && (
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void onExecute("SYNC")}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 shadow-theme-xs transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  <HardDriveDownload className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                  <span>{tg("bulkSync", { count: approvedControlCount })}</span>
                </button>
              )}

              {collapseLifecycleIntoPopover ? (
                <div className="relative">
                  <button
                    type="button"
                    disabled={isBusy}
                    aria-expanded={isLifecycleMenuOpen}
                    onClick={() => setIsLifecycleMenuOpen((prev) => !prev)}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 shadow-theme-xs transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    <Layers className="h-3.5 w-3.5 text-gray-500" />
                    <span>
                      {tg("bulkLifecycleTrigger", {
                        count: secondaryTargetCount,
                      })}
                    </span>
                    <ChevronDown className="h-3 w-3 text-gray-400" />
                  </button>

                  {isLifecycleMenuOpen ? (
                    <div className="absolute right-0 bottom-full mb-2 w-56 rounded-xl border border-gray-200 bg-white p-1.5 shadow-theme-xl dark:border-gray-700 dark:bg-gray-900">
                      {approvedControlCount > 0 && (
                        <>
                          {reviewableCount > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setIsLifecycleMenuOpen(false);
                                void onExecute("SYNC");
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-xs font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                            >
                              <HardDriveDownload className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                              <span>
                                {tg("bulkSync", {
                                  count: approvedControlCount,
                                })}
                              </span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setIsLifecycleMenuOpen(false);
                              void onExecute("PAUSE");
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-xs font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                          >
                            <Pause className="h-3.5 w-3.5 text-amber-600" />
                            <span>
                              {tg("bulkPause", { count: approvedControlCount })}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsLifecycleMenuOpen(false);
                              void onExecute("RESUME");
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-xs font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                          >
                            <Play className="h-3.5 w-3.5 text-emerald-600" />
                            <span>
                              {tg("bulkResume", {
                                count: approvedControlCount,
                              })}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsLifecycleMenuOpen(false);
                              void onExecute("REVOKE");
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-xs font-medium text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-gray-800"
                          >
                            <Unlink className="h-3.5 w-3.5 text-gray-500" />
                            <span>
                              {tg("bulkRevoke", {
                                count: approvedControlCount,
                              })}
                            </span>
                          </button>
                        </>
                      )}

                      {purgeableCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsLifecycleMenuOpen(false);
                            void onExecute("PURGE_ARTIFACT");
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-xs font-medium text-amber-800 hover:bg-amber-50/70 dark:text-amber-300 dark:hover:bg-amber-500/10"
                        >
                          <Database className="h-3.5 w-3.5" />
                          <span>
                            {tg("bulkPurgeR2", { count: purgeableCount })}
                          </span>
                        </button>
                      )}

                      {deletableCount > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsLifecycleMenuOpen(false);
                            void onExecute("DELETE");
                          }}
                          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-start text-xs font-medium text-rose-700 hover:bg-rose-50/70 dark:text-rose-300 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          <span>
                            {tg("bulkDelete", { count: deletableCount })}
                          </span>
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : (
                <>
                  {approvedControlCount > 0 && (
                    <>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void onExecute("PAUSE")}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 shadow-theme-xs transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        <Pause className="h-3.5 w-3.5 text-amber-600" />
                        <span>
                          {tg("bulkPause", { count: approvedControlCount })}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void onExecute("RESUME")}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 shadow-theme-xs transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        <Play className="h-3.5 w-3.5 text-emerald-600" />
                        <span>
                          {tg("bulkResume", { count: approvedControlCount })}
                        </span>
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void onExecute("REVOKE")}
                        className="inline-flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 shadow-theme-xs transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        <Unlink className="h-3.5 w-3.5 text-gray-500" />
                        <span>
                          {tg("bulkRevoke", { count: approvedControlCount })}
                        </span>
                      </button>
                    </>
                  )}

                  {purgeableCount > 0 && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void onExecute("PURGE_ARTIFACT")}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-amber-200 bg-amber-50/75 px-2.5 text-xs font-medium text-amber-800 transition hover:bg-amber-100/80 disabled:opacity-50 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                    >
                      <Database className="h-3.5 w-3.5" />
                      <span>{tg("bulkPurgeR2", { count: purgeableCount })}</span>
                    </button>
                  )}

                  {deletableCount > 0 && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void onExecute("DELETE")}
                      className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50/75 px-2.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100/80 disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>{tg("bulkDelete", { count: deletableCount })}</span>
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {feedbackMessage && (
        <p
          role="status"
          className={cn(
            "flex items-center gap-1.5 text-xs font-medium text-gray-700 dark:text-gray-200",
            selectedCount > 0 &&
              "mt-2 border-t border-gray-100 pt-2 dark:border-gray-800",
          )}
        >
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
            <Check className="h-2.5 w-2.5 stroke-[3]" />
          </span>
          <span>{feedbackMessage}</span>
        </p>
      )}
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(barNode, document.body);
  }
  return barNode;
}

export interface GovernanceReviewHistoryEntry {
  readonly action: GovernanceReviewStatus;
  readonly actionLabel: string;
  readonly reviewerId: string;
  readonly actorLabel: string;
  readonly at: string;
  readonly formattedDate: string;
  readonly comment?: string;
}

export function PinnedReviewDecisionBar({
  status,
  comment,
  onCommentChange,
  commentAriaLabel,
  commentPlaceholder,
  commentRequiredMessage,
  approveLabel,
  requestChangesLabel,
  rejectLabel,
  inspectTriggerLabel,
  isBusy = false,
  error = null,
  onDecision,
  onOpenInspector,
}: Readonly<{
  status: GovernanceReviewStatus;
  comment: string;
  onCommentChange: (value: string) => void;
  commentAriaLabel: string;
  commentPlaceholder: string;
  commentRequiredMessage: string;
  approveLabel: string;
  requestChangesLabel: string;
  rejectLabel: string;
  inspectTriggerLabel?: string;
  isBusy?: boolean;
  error?: string | null;
  onDecision: (
    action: "approve" | "request-changes" | "reject",
  ) => void | Promise<void>;
  onOpenInspector?: () => void;
}>) {
  const tg = useTranslations("workNotes.governance");
  const [isCommentExpanded, setIsCommentExpanded] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const showCommentRow =
    isCommentExpanded || Boolean(comment.trim()) || Boolean(error || localError);
  const activeError = error || localError;

  const focusCommentInput = () => {
    setIsCommentExpanded(true);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
  };

  const handleNegativeAction = (action: "request-changes" | "reject") => {
    if (!comment.trim()) {
      setLocalError(commentRequiredMessage);
      focusCommentInput();
      return;
    }
    setLocalError(null);
    void onDecision(action);
  };

  return (
    <div
      data-testid="pinned-review-decision-bar"
      data-review-status={status}
      className="shrink-0 border-t border-gray-200/90 bg-gray-50/85 px-4 py-2 sm:px-5 dark:border-gray-800 dark:bg-gray-900/90"
    >
      {showCommentRow ? (
        <div className="mb-2 space-y-1.5">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              aria-label={commentAriaLabel}
              value={comment}
              onChange={(event) => {
                if (localError) setLocalError(null);
                onCommentChange(event.target.value);
              }}
              placeholder={commentPlaceholder}
              className="h-8 min-w-0 flex-1 rounded-lg border border-gray-200 bg-white px-3 text-xs text-gray-900 placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 focus:outline-none dark:border-gray-700 dark:bg-gray-950 dark:text-white dark:placeholder:text-gray-500"
            />
            {!comment.trim() && !activeError ? (
              <button
                type="button"
                onClick={() => setIsCommentExpanded(false)}
                className="h-8 shrink-0 rounded-lg px-2 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-200/60 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
              >
                {tg("hideReviewNote")}
              </button>
            ) : null}
          </div>
          {activeError ? (
            <p
              role="alert"
              className="text-xs font-medium text-rose-600 dark:text-rose-400"
            >
              {activeError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 sm:flex-nowrap">
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              if (showCommentRow && !comment.trim()) {
                setLocalError(null);
                setIsCommentExpanded(false);
              } else {
                focusCommentInput();
              }
            }}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium whitespace-nowrap text-gray-700 shadow-theme-xs transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <MessageSquarePlus className="h-3.5 w-3.5 shrink-0 text-gray-500" aria-hidden="true" />
            <span>
              {showCommentRow ? tg("hideReviewNote") : tg("addReviewNote")}
            </span>
          </button>

          {onOpenInspector ? (
            <button
              type="button"
              onClick={onOpenInspector}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium whitespace-nowrap text-gray-600 transition-colors hover:bg-gray-200/60 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <Layers className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
              <span>{inspectTriggerLabel || tg("inspectDrawerTrigger")}</span>
            </button>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            disabled={isBusy}
            onClick={() => {
              setLocalError(null);
              void onDecision("approve");
            }}
            className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-brand-500 px-2.5 text-xs font-semibold whitespace-nowrap text-white shadow-theme-xs transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            <Check className="h-3.5 w-3.5 shrink-0 stroke-[2.5]" aria-hidden="true" />
            <span>{approveLabel}</span>
          </button>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => handleNegativeAction("request-changes")}
            className="inline-flex h-8 shrink-0 items-center rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium whitespace-nowrap text-gray-700 shadow-theme-xs transition-colors hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            {requestChangesLabel}
          </button>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => handleNegativeAction("reject")}
            className="inline-flex h-8 shrink-0 items-center rounded-lg border border-rose-200 bg-rose-50/75 px-2.5 text-xs font-medium whitespace-nowrap text-rose-700 transition-colors hover:bg-rose-100/75 disabled:opacity-50 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
          >
            {rejectLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function KnowledgeTelemetryDock({
  status,
  knowledgeSync,
  file,
  storageReference,
  reviewHistoryCount = 0,
  canControl = false,
  isBusy = false,
  inspectTriggerLabel,
  onQuickSync,
  onOpenInspector,
}: Readonly<{
  status: GovernanceReviewStatus;
  knowledgeSync?: DocumentKnowledgeStatus;
  file?: ArtifactFileMetadata;
  storageReference?: DocumentStorageReference;
  reviewHistoryCount?: number;
  canControl?: boolean;
  isBusy?: boolean;
  inspectTriggerLabel?: string;
  onQuickSync?: () => void;
  onOpenInspector: () => void;
}>) {
  const td = useTranslations("workNotes.documents");
  const tg = useTranslations("workNotes.governance");
  const ta = useTranslations("workNotes.artifact");

  const docStatus = normalizeToDocumentStatus(status);
  const pipeline = resolvePipelineDisplay(docStatus, knowledgeSync);
  const isApproved = status === "APPROVED";
  const externalRefs = storageReference?.externalDocumentRefs ?? 0;
  const isLocalStorage = storageReference?.provider === "LOCAL";

  return (
    <div
      data-testid="knowledge-telemetry-dock"
      className="flex shrink-0 items-center justify-between gap-2.5 border-t border-gray-100 bg-gray-50/75 px-4 py-2 sm:px-5 dark:border-gray-800 dark:bg-gray-900/80"
    >
      {isApproved ? (
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-xs">
          <span className="inline-flex min-w-0 items-center gap-1.5 truncate font-medium text-gray-800 dark:text-gray-200">
            {pipeline.phase === "processing" ? (
              <UploadProgressArcIcon className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-500" />
            ) : pipeline.phase === "ready" ? (
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
            ) : pipeline.phase === "paused" ? (
              <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500" />
            ) : pipeline.phase === "failed" ? (
              <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />
            ) : (
              <span className="h-2 w-2 shrink-0 rounded-full bg-gray-400" />
            )}
            <span className="truncate">{td(pipeline.stageKey)}</span>
            {pipeline.phase === "processing" && pipeline.percent !== null ? (
              <span className="shrink-0 font-mono text-[11px] tabular-nums text-brand-600 dark:text-brand-400">
                {pipeline.percent}%
              </span>
            ) : null}
          </span>

          {pipeline.chunkCount > 0 ? (
            <span className="shrink-0 rounded-md border border-gray-200/90 bg-white px-1.5 py-0.5 font-mono text-[11px] font-medium tabular-nums text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
              {td("pipelineChunksBadge", { count: pipeline.chunkCount })}
            </span>
          ) : null}

          {file && storageReference ? (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-medium",
                externalRefs > 0
                  ? "border-amber-200/80 bg-amber-50/70 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300"
                  : "border-emerald-200/80 bg-emerald-50/60 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300",
              )}
            >
              {externalRefs > 0 ? (
                <Share2 className="h-2.5 w-2.5" aria-hidden="true" />
              ) : (
                <Database className="h-2.5 w-2.5" aria-hidden="true" />
              )}
              <span>
                {externalRefs > 0
                  ? ta(
                      isLocalStorage ? "localSharedBadge" : "r2SharedBadge",
                      { count: externalRefs + 1 },
                    )
                  : ta(isLocalStorage ? "localUniqueBadge" : "r2UniqueBadge")}
              </span>
            </span>
          ) : file?.size ? (
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
              R2 · {formatArtifactBytes(file.size)}
            </span>
          ) : (
            <span className="truncate text-[11px] text-amber-700 dark:text-amber-300">
              {ta("approvedFilePurgedNotice")}
            </span>
          )}
        </div>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden text-xs text-gray-500 dark:text-gray-400">
          <Lock className="h-3.5 w-3.5 shrink-0 text-gray-400" aria-hidden="true" />
          <span className="truncate">
            {status === "DRAFT"
              ? tg("dockGateDraft")
              : status === "REJECTED"
                ? tg("dockGateRejected")
                : tg("dockGatePending")}
          </span>
        </div>
      )}

      <div className="flex shrink-0 items-center gap-1.5">
        {canControl &&
        onQuickSync &&
        ((isApproved &&
          (pipeline.phase === "not_started" ||
            pipeline.phase === "failed" ||
            pipeline.phase === "revoked")) ||
          status === "PENDING_REVIEW") ? (
          <button
            type="button"
            disabled={isBusy}
            onClick={onQuickSync}
            className="inline-flex h-8 items-center gap-1 rounded-lg bg-brand-500 px-2.5 text-xs font-semibold text-white shadow-theme-xs transition-colors hover:bg-brand-600 disabled:opacity-50"
          >
            <RefreshCw
              className={cn("h-3 w-3", isBusy && "animate-spin")}
              aria-hidden="true"
            />
            <span>{tg("btnSyncSag")}</span>
          </button>
        ) : null}

        <button
          type="button"
          onClick={onOpenInspector}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 shadow-theme-xs transition-colors hover:border-brand-200 hover:bg-brand-50/40 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
        >
          <Layers className="h-3.5 w-3.5 text-brand-500" aria-hidden="true" />
          <span>{inspectTriggerLabel || tg("inspectDrawerTrigger")}</span>
          {reviewHistoryCount > 0 ? (
            <span className="rounded bg-gray-100 px-1.5 py-0.2 font-mono text-[10px] tabular-nums text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {reviewHistoryCount}
            </span>
          ) : null}
        </button>
      </div>
    </div>
  );
}

export function KnowledgeGovernanceDrawer({
  isOpen,
  onClose,
  title,
  status,
  statusLabel,
  version,
  previewFileName,
  previewByteLength = 0,
  file,
  storageReference,
  knowledgeSync,
  chunksData,
  isChunksPending = false,
  reviewHistory = [],
  canControl = false,
  canPurge = false,
  canReopen = false,
  isBusy = false,
  isDownloading = false,
  controlError = null,
  onDownload,
  onAction,
  onPurgeArtifact,
  onDeleteEntity,
}: Readonly<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  status: GovernanceReviewStatus;
  statusLabel: string;
  version: number;
  previewFileName: string;
  previewByteLength?: number;
  file?: ArtifactFileMetadata;
  storageReference?: DocumentStorageReference;
  knowledgeSync?: DocumentKnowledgeStatus;
  chunksData?: DocumentKnowledgeChunksResponse;
  isChunksPending?: boolean;
  reviewHistory?: readonly GovernanceReviewHistoryEntry[];
  canControl?: boolean;
  canPurge?: boolean;
  canReopen?: boolean;
  isBusy?: boolean;
  isDownloading?: boolean;
  controlError?: string | null;
  onDownload?: () => void;
  onAction?: (action: SagPipelineAction) => void | Promise<void>;
  onPurgeArtifact?: (options: PurgeArtifactOptions) => void | Promise<void>;
  onDeleteEntity?: () => void | Promise<void>;
}>) {
  const tg = useTranslations("workNotes.governance");
  const ta = useTranslations("workNotes.artifact");
  const [activeTab, setActiveTab] = useState<"knowledge" | "history">(
    "knowledge",
  );
  const [copiedSha, setCopiedSha] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (document.querySelector(".modal")) return;
      onClose();
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const isApproved = status === "APPROVED";
  const displayFileName = file?.name || previewFileName;
  const effectiveBytes =
    isApproved && file?.size ? file.size : previewByteLength;
  const shortSha =
    isApproved && file?.sha256 ? file.sha256.slice(0, 12) : undefined;
  const externalRefs = storageReference?.externalDocumentRefs ?? 0;
  const isLocalStorage = storageReference?.provider === "LOCAL";

  const handleCopySha = () => {
    if (
      !file?.sha256 ||
      typeof navigator === "undefined" ||
      !navigator.clipboard
    ) {
      return;
    }
    void navigator.clipboard.writeText(file.sha256).then(() => {
      setCopiedSha(true);
      setTimeout(() => setCopiedSha(false), 1800);
    });
  };

  const drawerNode = (
    <div
      role="dialog"
      aria-label={tg("inspectDrawerTitle")}
      data-testid="knowledge-governance-drawer"
      className="fixed inset-0 z-[99900] flex justify-end"
    >
      <div
        data-testid="knowledge-drawer-backdrop"
        onClick={onClose}
        className="fixed inset-0 bg-gray-950/30 backdrop-blur-[1px] transition-opacity"
      />

      <div className="relative z-10 flex h-full w-full max-w-[480px] flex-col border-s border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-900">
        {/* Drawer Sticky Header */}
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-gray-100 px-5 py-4 dark:border-gray-800">
          <div className="min-w-0 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                {tg("inspectDrawerTitle")}
              </span>
              <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                {tg("versionBadge", { version })}
              </span>
              <ApprovalStatusBadge status={status} label={statusLabel} />
            </div>
            <p className="line-clamp-2 text-sm font-semibold text-gray-900 dark:text-white">
              {title}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={tg("inspectDrawerClose")}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          {/* Artifact Provenance Summary Strip */}
          <div className="rounded-xl border border-gray-200/90 bg-gray-50/70 p-3.5 dark:border-gray-800 dark:bg-gray-950/60">
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-200/70 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/30">
                  <FileCode2 className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p
                    className="truncate font-mono text-xs font-semibold text-gray-900 dark:text-gray-100"
                    title={displayFileName}
                  >
                    {displayFileName}
                  </p>
                  <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                    {isApproved
                      ? file
                        ? isLocalStorage
                          ? ta("storedInLocalVault")
                          : ta("storedInR2")
                        : ta("approvedFilePurgedNotice")
                      : ta("pendingR2GateNotice")}
                  </p>
                </div>
              </div>

              {isApproved && onDownload ? (
                <button
                  type="button"
                  onClick={onDownload}
                  disabled={isDownloading}
                  title={isDownloading ? ta("downloading") : ta("downloadMd")}
                  className="inline-flex h-7.5 shrink-0 items-center gap-1 rounded-lg bg-brand-500 px-2.5 text-[11px] font-semibold text-white shadow-theme-xs transition-colors hover:bg-brand-600 disabled:opacity-50"
                >
                  <Download className="h-3 w-3" aria-hidden="true" />
                  <span>
                    {isDownloading ? ta("downloading") : ta("downloadShort")}
                  </span>
                </button>
              ) : null}
            </div>

            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-gray-200/70 pt-2.5 dark:border-gray-800">
              {effectiveBytes > 0 ? (
                <span className="rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[10px] tabular-nums text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  {formatArtifactBytes(effectiveBytes)}
                </span>
              ) : null}

              {shortSha ? (
                <button
                  type="button"
                  onClick={handleCopySha}
                  title={ta("copyShaTitle", { sha: file?.sha256 ?? shortSha })}
                  className="inline-flex items-center gap-1 rounded border border-gray-200 bg-white px-1.5 py-0.5 font-mono text-[10px] text-gray-600 transition-colors hover:border-brand-200 hover:text-brand-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                  <span>sha256:{shortSha}</span>
                  {copiedSha ? (
                    <Check className="h-2.5 w-2.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-2.5 w-2.5 text-gray-400" />
                  )}
                </button>
              ) : null}

              {isApproved && file && storageReference ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 font-mono text-[10px] font-medium",
                    externalRefs > 0
                      ? "border-amber-200/80 bg-amber-50/70 text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-300"
                      : "border-emerald-200/80 bg-emerald-50/60 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/30 dark:text-emerald-300",
                  )}
                >
                  {externalRefs > 0 ? (
                    <Share2 className="h-2.5 w-2.5" aria-hidden="true" />
                  ) : (
                    <Database className="h-2.5 w-2.5" aria-hidden="true" />
                  )}
                  <span>
                    {externalRefs > 0
                      ? ta(
                          isLocalStorage ? "localSharedBadge" : "r2SharedBadge",
                          { count: externalRefs + 1 },
                        )
                      : ta(isLocalStorage ? "localUniqueBadge" : "r2UniqueBadge")}
                  </span>
                </span>
              ) : null}
            </div>
          </div>

          {/* Drawer Tabs */}
          {reviewHistory.length > 0 ? (
            <div className="inline-flex w-full rounded-lg bg-gray-100/90 p-0.5 ring-1 ring-inset ring-gray-200/70 dark:bg-gray-800 dark:ring-gray-700">
              <button
                type="button"
                onClick={() => setActiveTab("knowledge")}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                  activeTab === "knowledge"
                    ? "bg-white text-gray-900 shadow-theme-xs ring-1 ring-gray-200/70 dark:bg-gray-900 dark:text-white dark:ring-gray-700"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
                )}
              >
                <Layers className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{tg("tabKnowledge")}</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("history")}
                className={cn(
                  "inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all",
                  activeTab === "history"
                    ? "bg-white text-gray-900 shadow-theme-xs ring-1 ring-gray-200/70 dark:bg-gray-900 dark:text-white dark:ring-gray-700"
                    : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
                )}
              >
                <History className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{tg("tabHistory", { count: reviewHistory.length })}</span>
              </button>
            </div>
          ) : null}

          {activeTab === "knowledge" || reviewHistory.length === 0 ? (
            <div className="space-y-4">
              <SagKnowledgePipelineCard
                status={status}
                knowledgeSync={knowledgeSync}
                file={file}
                storageReference={storageReference}
                canControl={canControl}
                canPurge={canPurge}
                canReopen={canReopen}
                isBusy={isBusy}
                controlError={controlError}
                onAction={onAction}
                onPurgeArtifact={onPurgeArtifact}
                onDeleteEntity={onDeleteEntity}
              />

              <ExtractedChunksInspector
                status={status}
                knowledgeSync={knowledgeSync}
                chunksData={chunksData}
                isPending={isChunksPending}
              />
            </div>
          ) : (
            <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-theme-xs dark:divide-gray-800 dark:border-gray-800 dark:bg-gray-950">
              {reviewHistory.map((evt, idx) => (
                <div
                  key={`${evt.at}-${idx}`}
                  className="space-y-1 px-4 py-3 text-xs"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ApprovalStatusBadge
                      status={evt.action}
                      label={evt.actionLabel}
                    />
                    <span className="font-mono text-[11px] tabular-nums text-gray-400">
                      {evt.formattedDate}
                    </span>
                  </div>
                  <p className="font-medium text-gray-700 dark:text-gray-300">
                    {evt.actorLabel}
                  </p>
                  {evt.comment ? (
                    <p className="whitespace-pre-wrap text-gray-600 dark:text-gray-300">
                      {evt.comment}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(drawerNode, document.body);
  }
  return drawerNode;
}

function clampSplitWidth(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function useResizableSplitWidth({
  storageKey,
  defaultWidth,
  minWidth = 250,
  maxWidth = 520,
}: Readonly<{
  storageKey: string;
  defaultWidth: number;
  minWidth?: number;
  maxWidth?: number;
}>) {
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === "undefined") return defaultWidth;
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed)) {
          return clampSplitWidth(parsed, minWidth, maxWidth);
        }
      }
    } catch {
      /* ignore storage errors */
    }
    return defaultWidth;
  });
  const [isDragging, setIsDragging] = useState(false);

  const updateWidth = (next: number) => {
    const clamped = clampSplitWidth(next, minWidth, maxWidth);
    setWidth(clamped);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(storageKey, String(clamped));
      } catch {
        /* ignore storage errors */
      }
    }
  };

  const resetWidth = () => {
    updateWidth(defaultWidth);
  };

  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const startX = event.clientX;
    const initialWidth = width;
    setIsDragging(true);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      updateWidth(initialWidth + deltaX);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  };

  return {
    width,
    minWidth,
    maxWidth,
    defaultWidth,
    isDragging,
    setWidth: updateWidth,
    resetWidth,
    startDrag,
  };
}

export function SplitWorkbenchResizer({
  width,
  minWidth,
  maxWidth,
  isDragging = false,
  onStartDrag,
  onStepWidth,
  onResetWidth,
  className,
}: Readonly<{
  width: number;
  minWidth: number;
  maxWidth: number;
  isDragging?: boolean;
  onStartDrag: (event: React.PointerEvent<HTMLDivElement>) => void;
  onStepWidth: (nextWidth: number) => void;
  onResetWidth: () => void;
  className?: string;
}>) {
  const tg = useTranslations("workNotes.governance");
  const label = tg("resizeSplitLabel");

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label={label}
      aria-valuemin={minWidth}
      aria-valuemax={maxWidth}
      aria-valuenow={width}
      title={label}
      data-testid="split-workbench-resizer"
      onPointerDown={onStartDrag}
      onDoubleClick={onResetWidth}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          onStepWidth(width - 16);
        } else if (event.key === "ArrowRight") {
          event.preventDefault();
          onStepWidth(width + 16);
        } else if (event.key === "Home") {
          event.preventDefault();
          onStepWidth(minWidth);
        } else if (event.key === "End") {
          event.preventDefault();
          onStepWidth(maxWidth);
        } else if (event.key === "Enter") {
          event.preventDefault();
          onResetWidth();
        }
      }}
      className={cn(
        "group relative z-10 w-2 shrink-0 cursor-col-resize select-none items-center justify-center outline-none focus-visible:bg-brand-500/15",
        className,
      )}
    >
      <div
        aria-hidden="true"
        className={cn(
          "h-full w-px transition-colors",
          isDragging
            ? "w-0.5 bg-brand-500"
            : "bg-gray-100 group-hover:w-0.5 group-hover:bg-brand-400 dark:bg-gray-800 dark:group-hover:bg-brand-500",
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute top-1/2 left-1/2 flex h-7 w-1.5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border transition-all",
          isDragging
            ? "border-brand-500 bg-brand-500 shadow-theme-xs"
            : "border-gray-200/90 bg-white/95 opacity-75 group-hover:border-brand-400 group-hover:bg-brand-50 group-hover:opacity-100 dark:border-gray-700 dark:bg-gray-900 dark:group-hover:border-brand-500",
        )}
      >
        <span
          className={cn(
            "h-3 w-0.5 rounded-full",
            isDragging
              ? "bg-white"
              : "bg-gray-300 group-hover:bg-brand-500 dark:bg-gray-600",
          )}
        />
      </span>
    </div>
  );
}

