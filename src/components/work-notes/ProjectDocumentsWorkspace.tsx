"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import Button from "@/components/ui/button/Button";
import { isAccessOrResourceUnavailableError } from "@/lib/api-client";
import {
  BackgroundRefreshError,
  UpdatingStatus,
} from "@/components/ui/loading/AsyncStatus";
import { Modal } from "@/components/ui/modal";
import {
  AlertIcon,
  ChatIcon,
  CheckCircleIcon,
  CheckLineIcon,
  CloseLineIcon,
  DocsIcon,
  DownloadIcon,
  InfoIcon,
  MoreDotIcon,
  PaperPlaneIcon,
  TrashBinIcon,
  UserCircleIcon,
} from "@/icons";
import { authKeys } from "@/lib/queries/auth/auth.keys";
import type { CurrentUserResponse } from "@/lib/queries/auth/useAuth";
import {
  useProjectMembersQuery,
  type ProjectMemberPage,
} from "@/lib/queries/projects/useProjectMembers";
import type { ProjectList } from "@/lib/queries/projects/useProjects";
import {
  UploadAlertCircleIcon,
  UploadCheckIcon,
  UploadChunkSearchIcon,
  UploadDedupeIcon,
  UploadDismissIcon,
  UploadDropzoneIcon,
  UploadFileDownloadIcon,
  UploadFileGlyph,
  UploadIndexDetachIcon,
  UploadIndexReadyIcon,
  UploadIndexSyncIcon,
  UploadPauseIcon,
  UploadProgressArcIcon,
  UploadResumeIcon,
  UploadRetryIcon,
  UploadRowOpenIcon,
} from "./UploadIcons";
import WorkNotesPageHeader from "./WorkNotesPageHeader";
import WorkNoteComposer from "./WorkNoteComposer";
import type { EditorSourceIdentity } from "@/lib/queries/work-notes/work-note-agent.api";
import {
  computeFileSha256,
  useDocumentKnowledgeChunksQuery,
  useDocumentKnowledgeStatusQuery,
  useDocumentQuery,
  useDocumentsQuery,
  useWorkNotesMutation,
  workNoteKeys,
  workNotesApi,
  type DocumentActivityAction,
  type DocumentActivityEvent,
  type DocumentKnowledgeControlAction,
  type DocumentKnowledgeStatus,
  type DocumentStatus,
  type ProjectDocumentSummary,
  type WorkNotesPage,
} from "@/lib/queries/work-notes/useWorkNotes";

const HASH_CONCURRENCY = 4;
const R2_UPLOAD_CONCURRENCY = 4;

type BatchQueueItem = {
  id: string;
  file: File;
  sha256: string;
  status:
    | "HASHING"
    | "QUEUED"
    | "UPLOADING"
    | "SUBMITTING"
    | "SYNCED"
    | "REQUESTED"
    | "SKIPPED_DUPLICATE"
    | "CANCELLED"
    | "FAILED";
  progress: number;
  invalidFormat?: boolean;
  documentId?: string;
  error?: string;
};

type PipelinePhase =
  | "awaiting_approval"
  | "changes_requested"
  | "rejected"
  | "archived"
  | "draft"
  | "not_started"
  | "processing"
  | "ready"
  | "paused"
  | "revoked"
  | "failed";

type PipelineStageKey =
  | "pipelineAwaitingApproval"
  | "pipelineChangesRequested"
  | "pipelineRejected"
  | "pipelineArchived"
  | "pipelineDraft"
  | "pipelineNotStarted"
  | "pipelineQueued"
  | "pipelineReceiving"
  | "pipelineParsing"
  | "pipelineExtracting"
  | "pipelineIndexing"
  | "pipelineFinalizing"
  | "pipelineProcessing"
  | "pipelineReady"
  | "pipelinePaused"
  | "pipelinePausing"
  | "pipelineRevoked"
  | "pipelineFailed"
  | "pipelineFailedParse"
  | "pipelineFailedExtract"
  | "pipelineFailedIndex";

type PipelineDisplayMeta = {
  phase: PipelinePhase;
  stageKey: PipelineStageKey;
  percent: number | null;
  stepIndex: 0 | 1 | 2 | 3 | 4;
  isActive: boolean;
  isPausing?: boolean;
  chunkCount: number;
  isDeduplicated: boolean;
  errorMessage: string | null;
};

function extractSyncErrorMessage(
  sync?: DocumentKnowledgeStatus,
): string | null {
  if (!sync) return null;
  if (typeof sync.lastError === "string" && sync.lastError.trim()) {
    return sync.lastError.trim();
  }
  if (typeof sync.error === "string" && sync.error.trim()) {
    return sync.error.trim();
  }
  if (sync.error && typeof sync.error === "object") {
    const record = sync.error as Record<string, unknown>;
    for (const key of ["message", "detail", "reason", "code"]) {
      const val = record[key];
      if (typeof val === "string" && val.trim()) {
        return val.trim();
      }
    }
  }
  return null;
}

function resolvePipelineDisplay(
  docStatus: DocumentStatus,
  sync?: DocumentKnowledgeStatus,
): PipelineDisplayMeta {
  const chunkCount =
    typeof sync?.chunkCount === "number" && sync.chunkCount > 0
      ? sync.chunkCount
      : 0;
  const isDeduplicated = Boolean(
    sync?.isDuplicate || sync?.deduplicatedStorage,
  );
  const errorMessage = extractSyncErrorMessage(sync);

  if (docStatus === "PENDING_REVIEW") {
    return {
      phase: "awaiting_approval",
      stageKey: "pipelineAwaitingApproval",
      percent: 0,
      stepIndex: 0,
      isActive: false,
      chunkCount: 0,
      isDeduplicated: false,
      errorMessage: null,
    };
  }
  if (docStatus === "CHANGES_REQUESTED") {
    return {
      phase: "changes_requested",
      stageKey: "pipelineChangesRequested",
      percent: 0,
      stepIndex: 0,
      isActive: false,
      chunkCount: 0,
      isDeduplicated: false,
      errorMessage: null,
    };
  }
  if (docStatus === "REJECTED") {
    return {
      phase: "rejected",
      stageKey: "pipelineRejected",
      percent: null,
      stepIndex: 0,
      isActive: false,
      chunkCount: 0,
      isDeduplicated: false,
      errorMessage: null,
    };
  }
  if (docStatus === "ARCHIVED") {
    return {
      phase: "archived",
      stageKey: "pipelineArchived",
      percent: null,
      stepIndex: 0,
      isActive: false,
      chunkCount: 0,
      isDeduplicated: false,
      errorMessage: null,
    };
  }
  if (docStatus === "DRAFT") {
    return {
      phase: "draft",
      stageKey: "pipelineDraft",
      percent: 0,
      stepIndex: 0,
      isActive: false,
      chunkCount: 0,
      isDeduplicated: false,
      errorMessage: null,
    };
  }

  const rawStatus = (sync?.status ?? "NOT_SYNCED").toUpperCase();
  const rawStage = (
    sync?.currentStage ??
    sync?.parserStatus ??
    ""
  ).toUpperCase();
  const rawDocStatus = (sync?.documentStatus ?? "").toUpperCase();
  const rawKnowledgeStatus = (sync?.knowledgeStatus ?? "").toUpperCase();
  const rawErrorStage =
    sync?.error &&
    typeof sync.error === "object" &&
    typeof (sync.error as Record<string, unknown>).stage === "string"
      ? String((sync.error as Record<string, unknown>).stage).toUpperCase()
      : "";

  if (
    rawStatus === "FAILED" ||
    rawStatus === "INDEX_FAILED" ||
    rawStatus === "ERROR" ||
    rawDocStatus === "FAILED"
  ) {
    const failContext = `${rawErrorStage} ${rawStage}`;
    const failedKey: PipelineStageKey = failContext.includes("PARSE")
      ? "pipelineFailedParse"
      : failContext.includes("EXTRACT") ||
          failContext.includes("DEDUP") ||
          failContext.includes("CHUNK")
        ? "pipelineFailedExtract"
        : failContext.includes("INDEX") ||
            failContext.includes("EMBED") ||
            failContext.includes("PERSIST")
          ? "pipelineFailedIndex"
          : "pipelineFailed";
    const stepIdx: 1 | 2 | 3 = failContext.includes("PARSE")
      ? 2
      : failContext.includes("EXTRACT") ||
          failContext.includes("DEDUP") ||
          failContext.includes("CHUNK") ||
          failContext.includes("INDEX") ||
          failContext.includes("EMBED") ||
          failContext.includes("PERSIST")
        ? 3
        : 1;
    return {
      phase: "failed",
      stageKey: failedKey,
      percent:
        typeof sync?.progress === "number"
          ? Math.min(99, Math.max(0, Math.round(sync.progress)))
          : 0,
      stepIndex: stepIdx,
      isActive: false,
      chunkCount,
      isDeduplicated,
      errorMessage,
    };
  }

  const isPausing =
    rawStatus === "PAUSING" ||
    rawStage === "PAUSING" ||
    rawDocStatus === "PAUSING";
  const isPaused =
    isPausing ||
    rawStatus === "PAUSED" ||
    rawStage === "PAUSED" ||
    rawDocStatus === "PAUSED";

  if (isPaused) {
    const pausedPct =
      typeof sync?.progress === "number"
        ? Math.min(99, Math.max(0, Math.round(sync.progress)))
        : 35;
    return {
      phase: "paused",
      stageKey: isPausing ? "pipelinePausing" : "pipelinePaused",
      percent: pausedPct,
      stepIndex: pausedPct >= 60 ? 3 : pausedPct >= 25 ? 2 : 1,
      isActive: isPausing,
      isPausing,
      chunkCount,
      isDeduplicated,
      errorMessage: null,
    };
  }

  if (rawStatus === "REVOKED") {
    return {
      phase: "revoked",
      stageKey: "pipelineRevoked",
      percent: 0,
      stepIndex: 0,
      isActive: false,
      chunkCount: 0,
      isDeduplicated: false,
      errorMessage: null,
    };
  }

  if (!sync || rawStatus === "NOT_SYNCED") {
    return {
      phase: "not_started",
      stageKey: "pipelineNotStarted",
      percent: 0,
      stepIndex: 0,
      isActive: false,
      chunkCount: 0,
      isDeduplicated: false,
      errorMessage: null,
    };
  }

  const isDocInFlight =
    rawDocStatus === "PENDING" ||
    rawDocStatus === "LOADING" ||
    rawDocStatus === "EXTRACTING";

  const isFullyReady =
    !isDocInFlight &&
    (rawStatus === "COMPLETED" ||
      rawStatus === "KNOWLEDGE_READY" ||
      rawStatus === "READY" ||
      ((rawStatus === "SEARCH_READY" ||
        sync.searchReady === true ||
        rawStage === "COMPLETE") &&
        (sync.knowledgeReady === true ||
          (!["PROCESSING", "EXTRACTING", "RUNNING", "QUEUED"].includes(
            rawKnowledgeStatus,
          ) &&
            (sync.progress ?? 100) >= 100))));

  if (isFullyReady) {
    return {
      phase: "ready",
      stageKey: "pipelineReady",
      percent: 100,
      stepIndex: 4,
      isActive: false,
      chunkCount,
      isDeduplicated,
      errorMessage: null,
    };
  }

  let stageKey: PipelineStageKey = "pipelineProcessing";
  let defaultPct = 45;
  let stepIndex: 1 | 2 | 3 = 2;

  if (
    rawStage.includes("INDEX") ||
    rawStage.includes("EMBED") ||
    rawStatus === "INDEXING"
  ) {
    stageKey = "pipelineIndexing";
    defaultPct = 85;
    stepIndex = 3;
  } else if (
    rawStage.includes("DEDUP") ||
    rawStage.includes("EXTRACT") ||
    rawStage.includes("CHUNK") ||
    rawStatus === "EXTRACTING" ||
    rawDocStatus === "EXTRACTING"
  ) {
    stageKey = "pipelineExtracting";
    defaultPct = 65;
    stepIndex = 3;
  } else if (
    rawStage.includes("PARSE") ||
    rawStage.includes("CANONICAL") ||
    rawStatus === "PARSING" ||
    rawDocStatus === "LOADING"
  ) {
    stageKey = "pipelineParsing";
    defaultPct = 35;
    stepIndex = 2;
  } else if (rawStatus === "SEARCH_READY" || sync.searchReady === true) {
    stageKey = "pipelineFinalizing";
    defaultPct = 92;
    stepIndex = 3;
  } else if (rawStatus === "UPLOADING") {
    stageKey = "pipelineReceiving";
    defaultPct = 12;
    stepIndex = 1;
  } else if (
    rawStatus === "QUEUED_OUTBOX" ||
    rawStage.includes("OUTBOX") ||
    rawStatus === "QUEUED" ||
    rawStage === "QUEUED" ||
    rawStage.includes("RECEIVE") ||
    rawStatus === "RECEIVED" ||
    rawDocStatus === "PENDING"
  ) {
    stageKey = "pipelineQueued";
    defaultPct = 5;
    stepIndex = 1;
  }

  const resolvedPct =
    typeof sync.progress === "number"
      ? sync.progress === 0 && stepIndex === 1
        ? 0
        : Math.min(99, Math.max(5, Math.round(sync.progress)))
      : defaultPct;

  return {
    phase: "processing",
    stageKey,
    percent: resolvedPct,
    stepIndex,
    isActive: true,
    chunkCount,
    isDeduplicated,
    errorMessage: null,
  };
}

const STATUSES: readonly (DocumentStatus | "ALL")[] = [
  "ALL",
  "PENDING_REVIEW",
  "APPROVED",
  "CHANGES_REQUESTED",
  "REJECTED",
  "DRAFT",
  "ARCHIVED",
];

const FIELD_CLASS =
  "w-full min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 outline-none transition placeholder:text-gray-400 focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200 dark:placeholder:text-gray-500";

const SUPPORTED_EXTENSIONS = [
  ".pdf",
  ".docx",
  ".doc",
  ".xlsx",
  ".xls",
  ".pptx",
  ".ppt",
  ".odt",
  ".ods",
  ".odp",
  ".rtf",
  ".txt",
  ".md",
  ".markdown",
  ".csv",
  ".tsv",
  ".json",
  ".yaml",
  ".yml",
  ".xml",
  ".drawio",
  ".sql",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
] as const;

const ACCEPTED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-powerpoint",
  "application/vnd.oasis.opendocument.text",
  "application/vnd.oasis.opendocument.spreadsheet",
  "application/vnd.oasis.opendocument.presentation",
  "application/rtf",
  "text/rtf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "text/csv",
  "text/tab-separated-values",
  "application/json",
  "application/yaml",
  "application/x-yaml",
  "text/yaml",
  "application/xml",
  "text/xml",
  "application/sql",
  "text/x-sql",
  "image/png",
  "image/jpeg",
  "image/webp",
];

const FILE_INPUT_ACCEPT = [
  ...SUPPORTED_EXTENSIONS,
  ...ACCEPTED_FILE_TYPES,
].join(",");

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileTypeBadge(name: string, contentType?: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".markdown") || lower.endsWith(".md")) return "MD";
  if (lower.endsWith(".yml") || lower.endsWith(".yaml")) return "YAML";
  if (lower.endsWith(".jpeg") || lower.endsWith(".jpg")) return "JPG";
  const matchedExt = SUPPORTED_EXTENSIONS.find((ext) => lower.endsWith(ext));
  if (matchedExt) return matchedExt.slice(1).toUpperCase();
  if (contentType === "application/pdf") return "PDF";
  if (contentType?.startsWith("text/")) return "TXT";
  return "FILE";
}

function isSupportedDocumentFile(candidate: File): boolean {
  const lower = candidate.name.toLowerCase();
  const baseType = candidate.type.split(";")[0]?.trim().toLowerCase() ?? "";
  const validExt = SUPPORTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
  const validType =
    baseType === "" ||
    baseType === "application/octet-stream" ||
    ACCEPTED_FILE_TYPES.includes(baseType);
  return (
    validExt &&
    validType &&
    candidate.size > 0 &&
    candidate.size <= 20 * 1024 * 1024
  );
}

const STATUS_BADGE_CLASSES: Record<DocumentStatus, string> = {
  DRAFT:
    "border-gray-200/90 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200",
  PENDING_REVIEW:
    "border-gray-200/90 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200",
  CHANGES_REQUESTED:
    "border-gray-200/90 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200",
  APPROVED:
    "border-gray-200/90 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200",
  REJECTED:
    "border-gray-200/90 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200",
  ARCHIVED:
    "border-gray-200/80 bg-gray-50 text-gray-500 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400",
};

const STATUS_DOT_CLASSES: Record<DocumentStatus, string> = {
  DRAFT: "bg-gray-400 dark:bg-gray-500",
  PENDING_REVIEW: "bg-brand-500 dark:bg-brand-400",
  CHANGES_REQUESTED: "bg-amber-500 dark:bg-amber-400",
  APPROVED: "bg-emerald-500 dark:bg-emerald-400",
  REJECTED: "bg-rose-500 dark:bg-rose-400",
  ARCHIVED: "bg-gray-400 dark:bg-gray-500",
};

export default function ProjectDocumentsWorkspace({
  projectId,
}: {
  projectId: string;
}) {
  const t = useTranslations("workNotes.documents");
  const common = useTranslations("workNotes");
  const format = useFormatter();
  const queryClient = useQueryClient();

  const [filter, setFilter] = useState<DocumentStatus | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<ProjectDocumentSummary | null>(null);
  const [agentSource, setAgentSource] = useState<EditorSourceIdentity | null>(
    null,
  );

  // Unified Role-Aware File Upload / Upload Request Modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [batchQueue, setBatchQueue] = useState<BatchQueueItem[]>([]);
  const [memberNote, setMemberNote] = useState("");
  const [batchIsDragging, setBatchIsDragging] = useState(false);
  const [isBatchRunning, setIsBatchRunning] = useState(false);
  const batchAbortControllersRef = useRef<Map<string, AbortController>>(
    new Map(),
  );
  const batchCancelAllRef = useRef(false);
  const batchFileInputRef = useRef<HTMLInputElement>(null);

  // File-First Version Replacement state (inside Detail Modal)
  const [isReplacingVersion, setIsReplacingVersion] = useState(false);
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [replacementSha256, setReplacementSha256] = useState("");
  const [replacementNote, setReplacementNote] = useState("");
  const [replacementDragging, setReplacementDragging] = useState(false);
  const [replacementError, setReplacementError] = useState("");
  const [replacementProgress, setReplacementProgress] = useState<number | null>(
    null,
  );
  const [isReplacementSubmitting, setIsReplacementSubmitting] = useState(false);
  const replacementAbortRef = useRef<AbortController | null>(null);
  const replacementFileInputRef = useRef<HTMLInputElement>(null);

  // Detail Modal & Row Action states
  const [confirmingRevokeSag, setConfirmingRevokeSag] = useState(false);
  const [reviewComment, setReviewComment] = useState("");
  const [validationError, setValidationError] = useState("");
  const [selectedVersionNumber, setSelectedVersionNumber] = useState<
    number | null
  >(null);
  const [showActionSuccess, setShowActionSuccess] = useState(false);
  const [moreActionsOpen, setMoreActionsOpen] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [removalTarget, setRemovalTarget] =
    useState<ProjectDocumentSummary | null>(null);
  const [removalBusyTier, setRemovalBusyTier] = useState<1 | 2 | 3 | null>(
    null,
  );
  const [removalModalError, setRemovalModalError] = useState("");
  const [removalBanner, setRemovalBanner] = useState("");
  const [chunkFilter, setChunkFilter] = useState("");
  const [expandedChunkIds, setExpandedChunkIds] = useState<
    Record<string, boolean>
  >({});
  const [busyRowId, setBusyRowId] = useState<string | null>(null);
  const [syncedDocIds, setSyncedDocIds] = useState<Record<string, boolean>>({});
  const [pipelineControlError, setPipelineControlError] = useState("");
  const prevDetailPhaseRef = useRef<PipelinePhase | null>(null);

  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasModalOpenRef = useRef(false);

  const cachedCurrentUser = queryClient.getQueryData<CurrentUserResponse>(
    authKeys.currentUser(),
  );
  const activeOrganizationId =
    cachedCurrentUser && "organizationId" in cachedCurrentUser
      ? (cachedCurrentUser.organizationId ?? "")
      : "";
  const projectMembers = useProjectMembersQuery(
    activeOrganizationId,
    projectId,
    { page: 1, pageSize: 100 },
  );
  const list = useDocumentsQuery(projectId, filter, page);
  const documentId = selected?.id ?? "";
  const detail = useDocumentQuery(projectId, documentId);

  const knowledgeStatusQuery = useDocumentKnowledgeStatusQuery(
    projectId,
    documentId,
    Boolean(
      selected &&
        !isReplacingVersion &&
        (selected.status === "APPROVED" ||
          selected.knowledgeSync ||
          detail.data?.knowledgeSync ||
          syncedDocIds[documentId]),
    ),
  );

  const detailLiveSync =
    knowledgeStatusQuery.data ??
    detail.data?.knowledgeSync ??
    selected?.knowledgeSync;
  const detailPipelineForChunks = useMemo(() => {
    const status = detail.data?.status ?? selected?.status;
    return status ? resolvePipelineDisplay(status, detailLiveSync) : null;
  }, [detail.data?.status, detailLiveSync, selected?.status]);

  const knowledgeChunksQuery = useDocumentKnowledgeChunksQuery(
    projectId,
    documentId,
    Boolean(
      selected &&
        !isReplacingVersion &&
        selectedVersionNumber === null &&
        detailPipelineForChunks &&
        (detailPipelineForChunks.phase === "ready" ||
          (detailPipelineForChunks.phase === "paused" &&
            detailPipelineForChunks.stepIndex >= 2) ||
          (detailPipelineForChunks.phase === "processing" &&
            detailPipelineForChunks.stepIndex >= 3)),
    ),
    detailPipelineForChunks?.phase === "ready"
      ? (detailLiveSync?.sagVersionNo ?? detail.data?.version ?? 1) * 10 + 1
      : (detailLiveSync?.sagVersionNo ?? detail.data?.version ?? 1) * 10,
  );

  function updateCachedDocumentSync(
    targetDocId: string,
    nextSync: DocumentKnowledgeStatus | undefined,
    forceApproved = false,
  ) {
    if (nextSync) {
      queryClient.setQueryData(
        workNoteKeys.documentKnowledgeStatus(projectId, targetDocId),
        nextSync,
      );
    }
    queryClient.setQueriesData<WorkNotesPage<ProjectDocumentSummary>>(
      { queryKey: ["work-notes", projectId, "documents"] },
      (oldPage) => {
        if (!oldPage) return oldPage;
        return {
          ...oldPage,
          data: oldPage.data.map((row) =>
            row.id === targetDocId
              ? {
                  ...row,
                  ...(forceApproved && row.status !== "ARCHIVED"
                    ? { status: "APPROVED" as const }
                    : {}),
                  ...(nextSync ? { knowledgeSync: nextSync } : {}),
                }
              : row,
          ),
        };
      },
    );
    setSelected((prev) =>
      prev && prev.id === targetDocId
        ? {
            ...prev,
            ...(forceApproved && prev.status !== "ARCHIVED"
              ? { status: "APPROVED" }
              : {}),
            ...(nextSync ? { knowledgeSync: nextSync } : {}),
          }
        : prev,
    );
  }

  function buildOptimisticZeroSync(
    targetDocId: string,
    baseSync?: DocumentKnowledgeStatus,
    fallbackVersion = 1,
  ): DocumentKnowledgeStatus {
    return {
      ...(baseSync ?? {}),
      documentId: targetDocId,
      version: baseSync?.version ?? fallbackVersion,
      status: "RECEIVED",
      searchStatus: "PENDING",
      knowledgeStatus: "NOT_STARTED",
      searchReady: false,
      knowledgeReady: false,
      isDuplicate: false,
      currentStage: "RECEIVE",
      documentStatus: "pending",
      progress: 0,
      chunkCount: 0,
      stageProgress: {},
      error: null,
      lastError: null,
      syncedAt: new Date().toISOString(),
    };
  }

  useEffect(() => {
    const nextPhase = detailPipelineForChunks?.phase ?? null;
    const prevPhase = prevDetailPhaseRef.current;
    prevDetailPhaseRef.current = nextPhase;
    if (
      documentId &&
      prevPhase === "processing" &&
      (nextPhase === "ready" || nextPhase === "failed")
    ) {
      void queryClient.invalidateQueries({
        queryKey: ["work-notes", projectId, "documents"],
      });
      void queryClient.invalidateQueries({
        queryKey: [
          "work-notes",
          projectId,
          "document",
          documentId,
          "knowledge-chunks",
        ],
      });
    }
  }, [detailPipelineForChunks?.phase, documentId, projectId, queryClient]);

  const syncKnowledge = useWorkNotesMutation(
    async () => {
      const res = await workNotesApi.syncDocumentToSag(projectId, documentId);
      setSyncedDocIds((prev) => ({ ...prev, [documentId]: true }));
      updateCachedDocumentSync(documentId, res, true);
      return res;
    },
    [workNoteKeys.document(projectId, documentId)],
  );

  const controlKnowledge = useWorkNotesMutation(
    async (controlAction: DocumentKnowledgeControlAction) => {
      const res = await workNotesApi.controlDocumentKnowledge(
        projectId,
        documentId,
        controlAction,
      );
      setSyncedDocIds((prev) => ({ ...prev, [documentId]: true }));
      updateCachedDocumentSync(documentId, res, false);
      return res;
    },
    [workNoteKeys.document(projectId, documentId)],
  );

  const deleteDocumentMutation = useWorkNotesMutation(
    () => workNotesApi.deleteDocument(projectId, documentId),
    [workNoteKeys.project(projectId)],
  );

  const action = useWorkNotesMutation(
    (
      input: Readonly<{
        action:
          | "submit"
          | "comment"
          | "approve"
          | "request-changes"
          | "reject"
          | "archive";
        comment?: string;
      }>,
    ) =>
      workNotesApi.documentAction(
        projectId,
        documentId,
        input.action,
        input.comment,
      ),
    [workNoteKeys.project(projectId)],
  );

  const listAccessLost = isAccessOrResourceUnavailableError(list.error);
  const detailAccessLost = isAccessOrResourceUnavailableError(detail.error);
  const visibleList = listAccessLost ? undefined : list.data;
  const current = detailAccessLost ? undefined : detail.data;

  const reviewableDocuments = useMemo(
    () => (visibleList?.data ?? []).filter((doc) => doc.permissions.canReview),
    [visibleList?.data],
  );

  const isProjectLeader = useMemo(() => {
    if (
      current?.permissions.canConfigure ||
      current?.permissions.canReview ||
      selected?.permissions.canConfigure ||
      selected?.permissions.canReview
    ) {
      return true;
    }
    if (
      (visibleList?.data ?? []).some(
        (doc) => doc.permissions.canConfigure || doc.permissions.canReview,
      )
    ) {
      return true;
    }
    const currentUserId = cachedCurrentUser?.id?.toLowerCase();
    if (currentUserId) {
      const projectQueries = queryClient.getQueriesData<ProjectList>({
        queryKey: ["projects"],
      });
      for (const [, data] of projectQueries) {
        for (const proj of data?.data ?? []) {
          if (
            proj.id === projectId &&
            (proj.leaders ?? []).some(
              (leader) => leader.userId?.toLowerCase() === currentUserId,
            )
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }, [
    cachedCurrentUser?.id,
    current?.permissions.canConfigure,
    current?.permissions.canReview,
    projectId,
    queryClient,
    selected?.permissions.canConfigure,
    selected?.permissions.canReview,
    visibleList?.data,
  ]);

  const workspaceStats = useMemo(() => {
    const items = visibleList?.data ?? [];
    let processingCount = 0;
    let pendingCount = 0;
    for (const doc of items) {
      if (doc.status === "PENDING_REVIEW") pendingCount += 1;
      const meta = resolvePipelineDisplay(doc.status, doc.knowledgeSync);
      if (meta.isActive) processingCount += 1;
    }
    return { processingCount, pendingCount };
  }, [visibleList?.data]);

  const userLookup = useMemo(() => {
    const map = new Map<string, string>();
    if (cachedCurrentUser?.id) {
      map.set(
        cachedCurrentUser.id.toLowerCase(),
        cachedCurrentUser.name || cachedCurrentUser.email,
      );
    }
    for (const member of projectMembers.data?.data ?? []) {
      const label = member.user?.fullName || member.user?.email;
      if (member.userId && label) {
        map.set(member.userId.toLowerCase(), label);
      }
    }
    const projectQueries = queryClient.getQueriesData<ProjectList>({
      queryKey: ["projects"],
    });
    for (const [, data] of projectQueries) {
      for (const proj of data?.data ?? []) {
        for (const leader of proj.leaders ?? []) {
          if (leader.userId && (leader.fullName || leader.email)) {
            map.set(
              leader.userId.toLowerCase(),
              leader.fullName || leader.email,
            );
          }
        }
        for (const preview of proj.memberPreviews ?? []) {
          if (preview.userId && (preview.fullName || preview.email)) {
            map.set(
              preview.userId.toLowerCase(),
              preview.fullName || preview.email,
            );
          }
        }
      }
    }
    const memberQueries = queryClient.getQueriesData<ProjectMemberPage>({
      queryKey: ["project-members"],
    });
    for (const [, pageData] of memberQueries) {
      for (const member of pageData?.data ?? []) {
        const label = member.user?.fullName || member.user?.email;
        if (member.userId && label) {
          map.set(member.userId.toLowerCase(), label);
        }
      }
    }
    return map;
  }, [cachedCurrentUser, projectMembers.data?.data, queryClient]);

  function resolveActorLabel(
    actorId: string | undefined,
    roleHint: "author" | "reviewer",
  ): string {
    if (!actorId) {
      return roleHint === "author" ? t("authorActor") : t("reviewerActor");
    }
    const normalized = actorId.trim();
    const mapped = userLookup.get(normalized.toLowerCase());
    if (mapped) {
      if (
        cachedCurrentUser?.id &&
        cachedCurrentUser.id.toLowerCase() === normalized.toLowerCase()
      ) {
        return t("youSuffix", { name: mapped });
      }
      return mapped;
    }
    if (!/^[a-f0-9]{24}$/i.test(normalized)) {
      return normalized;
    }
    if (current && normalized === current.createdBy) {
      return t("authorActor");
    }
    return roleHint === "author" ? t("authorActor") : t("reviewerActor");
  }

  const sortedVersions = useMemo(
    () =>
      current
        ? [...current.versions].sort((a, b) => b.version - a.version)
        : [],
    [current],
  );
  const latestApprovedVersion = useMemo(
    () =>
      current?.versions
        .filter((v) => v.status === "APPROVED")
        .reduce((max, v) => Math.max(max, v.version), 0) ?? 0,
    [current?.versions],
  );
  const viewedVersion = useMemo(() => {
    if (!current) return null;
    const targetVersion = selectedVersionNumber ?? current.version;
    return (
      current.versions.find((v) => v.version === targetVersion) ??
      current.versions.find((v) => v.version === current.version) ??
      current.versions.at(-1) ??
      null
    );
  }, [current, selectedVersionNumber]);

  const isViewingHistoricalVersion = Boolean(
    current && viewedVersion && viewedVersion.version !== current.version,
  );

  const activeFile = useMemo(() => {
    if (!current) return undefined;
    if (viewedVersion) {
      if (viewedVersion.file) return viewedVersion.file;
      if (viewedVersion.version === current.version) return current.file;
      return undefined;
    }
    return current.file;
  }, [current, viewedVersion]);

  const activeContent = useMemo(() => {
    if (!current) return "";
    if (viewedVersion && typeof viewedVersion.content === "string") {
      return viewedVersion.content;
    }
    return current.content;
  }, [current, viewedVersion]);

  const canArchiveDocument = Boolean(
    current &&
      (current.permissions.canConfigure ||
        current.permissions.canReview ||
        isProjectLeader) &&
      current.status !== "ARCHIVED" &&
      (current.status === "APPROVED" ||
        current.versions.some((v) => v.status === "APPROVED")),
  );

  const canDeleteDocument = Boolean(
    current &&
      (current.permissions.canDelete ||
        isProjectLeader ||
        (cachedCurrentUser?.id &&
          cachedCurrentUser.id.toLowerCase() ===
            current.createdBy.toLowerCase() &&
          current.status !== "APPROVED" &&
          current.status !== "ARCHIVED")),
  );

  useEffect(() => {
    if (!showActionSuccess) return;
    const timer = window.setTimeout(() => {
      setShowActionSuccess(false);
    }, 4500);
    return () => window.clearTimeout(timer);
  }, [showActionSuccess]);

  useEffect(() => {
    let active = true;
    if (!replacementFile) {
      setReplacementSha256("");
      return;
    }
    void computeFileSha256(replacementFile).then((hash) => {
      if (active) setReplacementSha256(hash);
    });
    return () => {
      active = false;
    };
  }, [replacementFile]);

  function pauseBatchItem(itemId: string) {
    batchAbortControllersRef.current.get(itemId)?.abort();
  }

  function pauseAllBatchUploads() {
    batchCancelAllRef.current = true;
    for (const controller of batchAbortControllersRef.current.values()) {
      controller.abort();
    }
  }

  async function enqueueBatchFiles(files: FileList | null) {
    if (!files?.length) return;
    const existingHashes = new Set(
      (visibleList?.data ?? [])
        .map((doc) => doc.knowledgeSync?.fileHash?.toLowerCase())
        .filter((h): h is string => Boolean(h)),
    );
    const seenHashes = new Set<string>([
      ...existingHashes,
      ...batchQueue.map((item) => item.sha256.toLowerCase()).filter(Boolean),
    ]);

    const candidates = Array.from(files);
    const validToHash: Array<{ id: string; file: File }> = [];
    const initialItems: BatchQueueItem[] = candidates.map((candidate) => {
      const id = `${candidate.name}-${candidate.size}-${Date.now()}-${Math.random()}`;
      if (!isSupportedDocumentFile(candidate)) {
        return {
          id,
          file: candidate,
          sha256: "",
          status: "FAILED",
          progress: 0,
          invalidFormat: true,
          error: t("queueUnsupported"),
        };
      }
      validToHash.push({ id, file: candidate });
      return {
        id,
        file: candidate,
        sha256: "",
        status: "HASHING",
        progress: 0,
      };
    });

    setBatchQueue((prev) => [...prev, ...initialItems]);
    setUploadModalOpen(true);

    if (validToHash.length === 0) return;

    let hashCursor = 0;
    const hashWorkerCount = Math.min(HASH_CONCURRENCY, validToHash.length);
    await Promise.all(
      Array.from({ length: hashWorkerCount }, async () => {
        while (true) {
          const idx = hashCursor;
          hashCursor += 1;
          if (idx >= validToHash.length) break;
          const entry = validToHash[idx];
          const sha256 = await computeFileSha256(entry.file).catch(() => "");
          const normalized = sha256.toLowerCase();
          const isDuplicate =
            Boolean(normalized) && seenHashes.has(normalized);
          if (normalized) {
            seenHashes.add(normalized);
          }
          setBatchQueue((prev) =>
            prev.map((q) => {
              if (q.id !== entry.id) return q;
              if (q.status !== "HASHING") {
                return sha256 && !q.sha256 ? { ...q, sha256 } : q;
              }
              return {
                ...q,
                sha256,
                status: isDuplicate ? "SKIPPED_DUPLICATE" : "QUEUED",
                progress: isDuplicate ? 100 : 0,
              };
            }),
          );
        }
      }),
    );
  }

  async function runBatchUploadQueue(onlyItemId?: string) {
    if (isBatchRunning && !onlyItemId) return;
    if (!onlyItemId) {
      batchCancelAllRef.current = false;
    }
    setIsBatchRunning(true);
    const trimmedNote = memberNote.trim();
    try {
      const itemsToRun = batchQueue.filter(
        (item) =>
          !item.invalidFormat &&
          (onlyItemId
            ? item.id === onlyItemId
            : item.status === "HASHING" ||
              item.status === "QUEUED" ||
              item.status === "CANCELLED" ||
              item.status === "FAILED"),
      );
      if (itemsToRun.length === 0) return;

      let uploadCursor = 0;
      const workerCount = onlyItemId
        ? 1
        : Math.min(R2_UPLOAD_CONCURRENCY, itemsToRun.length);

      const uploadSingleItem = async (item: BatchQueueItem) => {
        if (!isSupportedDocumentFile(item.file)) return;
        if (!onlyItemId && batchCancelAllRef.current) return;

        const controller = new AbortController();
        batchAbortControllersRef.current.set(item.id, controller);
        setBatchQueue((prev) =>
          prev.map((q) =>
            q.id === item.id
              ? { ...q, status: "UPLOADING", progress: 0, error: undefined }
              : q,
          ),
        );

        try {
          let resolvedSha256 = item.sha256;
          if (!resolvedSha256) {
            resolvedSha256 = await computeFileSha256(item.file);
            if (controller.signal.aborted) {
              throw new DOMException("Upload cancelled by user", "AbortError");
            }
            setBatchQueue((prev) =>
              prev.map((q) =>
                q.id === item.id ? { ...q, sha256: resolvedSha256 } : q,
              ),
            );
          }

          let docId = item.documentId;
          if (!docId) {
            const baseTitle =
              item.file.name.replace(/\.[^.]+$/, "").slice(0, 200) ||
              item.file.name;
            const created = await workNotesApi.createDocument(projectId, {
              title: baseTitle,
              ...(!isProjectLeader && trimmedNote
                ? { description: trimmedNote }
                : {}),
              type: "OTHER",
              content: "",
            });
            docId = created.id;
            setBatchQueue((prev) =>
              prev.map((q) =>
                q.id === item.id ? { ...q, documentId: docId } : q,
              ),
            );
          }

          await workNotesApi.uploadDocumentFile(projectId, docId, item.file, {
            sha256: resolvedSha256 || undefined,
            autoSyncSag: isProjectLeader,
            signal: controller.signal,
            onProgress: (percent) => {
              setBatchQueue((prev) =>
                prev.map((q) =>
                  q.id === item.id ? { ...q, progress: percent } : q,
                ),
              );
            },
          });

          if (!isProjectLeader) {
            setBatchQueue((prev) =>
              prev.map((q) =>
                q.id === item.id
                  ? { ...q, status: "SUBMITTING", progress: 95 }
                  : q,
              ),
            );
            await workNotesApi.documentAction(projectId, docId, "submit");
          }

          setBatchQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? {
                    ...q,
                    status: isProjectLeader ? "SYNCED" : "REQUESTED",
                    progress: 100,
                  }
                : q,
            ),
          );
          if (isProjectLeader) {
            setSyncedDocIds((prev) => ({ ...prev, [docId!]: true }));
          }
          void queryClient.invalidateQueries({
            queryKey: ["work-notes", projectId, "documents"],
          });
        } catch (err) {
          const isAborted =
            (err instanceof DOMException && err.name === "AbortError") ||
            controller.signal.aborted;
          setBatchQueue((prev) =>
            prev.map((q) =>
              q.id === item.id
                ? {
                    ...q,
                    status: isAborted ? "CANCELLED" : "FAILED",
                    error: isAborted
                      ? t("queuePaused")
                      : err instanceof Error
                        ? err.message
                        : t("queueFailed"),
                  }
                : q,
            ),
          );
        } finally {
          batchAbortControllersRef.current.delete(item.id);
        }
      };

      await Promise.all(
        Array.from({ length: workerCount }, async () => {
          while (onlyItemId || !batchCancelAllRef.current) {
            const idx = uploadCursor;
            uploadCursor += 1;
            if (idx >= itemsToRun.length) break;
            await uploadSingleItem(itemsToRun[idx]);
          }
        }),
      );
      await queryClient.invalidateQueries({
        queryKey: ["work-notes", projectId, "documents"],
      });
    } finally {
      if (batchAbortControllersRef.current.size === 0) {
        setIsBatchRunning(false);
      }
    }
  }

  async function handleRowQuickApprove(doc: ProjectDocumentSummary) {
    if (busyRowId) return;
    setBusyRowId(doc.id);
    try {
      await workNotesApi.documentAction(projectId, doc.id, "approve");
      await workNotesApi.syncDocumentToSag(projectId, doc.id).catch(() => undefined);
      setSyncedDocIds((prev) => ({ ...prev, [doc.id]: true }));
      await queryClient.invalidateQueries({
        queryKey: workNoteKeys.project(projectId),
      });
    } finally {
      setBusyRowId(null);
    }
  }

  async function handleRowPipelineControl(
    doc: ProjectDocumentSummary,
    control: "SYNC" | DocumentKnowledgeControlAction,
  ) {
    if (busyRowId) return;
    setBusyRowId(doc.id);
    setPipelineControlError("");
    const previousSync =
      queryClient.getQueryData<DocumentKnowledgeStatus>(
        workNoteKeys.documentKnowledgeStatus(projectId, doc.id),
      ) ?? doc.knowledgeSync;

    if (control === "SYNC" || control === "REPROCESS") {
      await queryClient.cancelQueries({
        queryKey: workNoteKeys.documentKnowledgeStatus(projectId, doc.id),
      });
      const optimisticZero = buildOptimisticZeroSync(
        doc.id,
        previousSync,
        doc.version,
      );
      setSyncedDocIds((prev) => ({ ...prev, [doc.id]: true }));
      updateCachedDocumentSync(
        doc.id,
        optimisticZero,
        control === "SYNC",
      );
    }

    try {
      const nextStatus =
        control === "SYNC"
          ? await workNotesApi.syncDocumentToSag(projectId, doc.id)
          : await workNotesApi.controlDocumentKnowledge(
              projectId,
              doc.id,
              control,
            );
      setSyncedDocIds((prev) => ({ ...prev, [doc.id]: true }));
      updateCachedDocumentSync(doc.id, nextStatus, control === "SYNC");
      void queryClient.invalidateQueries({
        queryKey: workNoteKeys.document(projectId, doc.id),
      });
    } catch (err) {
      if (previousSync) {
        updateCachedDocumentSync(doc.id, previousSync, false);
      }
      setPipelineControlError(
        err instanceof Error ? err.message : t("pipelineFailedHint"),
      );
    } finally {
      setBusyRowId(null);
    }
  }

  async function handleDetailPipelineControl(
    control: "SYNC" | DocumentKnowledgeControlAction,
  ) {
    if (!documentId || syncKnowledge.isPending || controlKnowledge.isPending) {
      return;
    }
    setPipelineControlError("");
    if (control !== "REVOKE") {
      setConfirmingRevokeSag(false);
    }

    const previousSync =
      queryClient.getQueryData<DocumentKnowledgeStatus>(
        workNoteKeys.documentKnowledgeStatus(projectId, documentId),
      ) ??
      current?.knowledgeSync ??
      selected?.knowledgeSync;

    if (control === "SYNC" || control === "REPROCESS") {
      await queryClient.cancelQueries({
        queryKey: workNoteKeys.documentKnowledgeStatus(projectId, documentId),
      });
      const optimisticZero = buildOptimisticZeroSync(
        documentId,
        previousSync,
        current?.version ?? selected?.version ?? 1,
      );
      setSyncedDocIds((prev) => ({ ...prev, [documentId]: true }));
      updateCachedDocumentSync(
        documentId,
        optimisticZero,
        control === "SYNC",
      );
    }

    try {
      if (control === "SYNC") {
        await syncKnowledge.mutateAsync(undefined);
      } else {
        await controlKnowledge.mutateAsync(control);
        if (control === "REVOKE") {
          setConfirmingRevokeSag(false);
        }
      }
    } catch (err) {
      if (previousSync) {
        updateCachedDocumentSync(documentId, previousSync, false);
      }
      setPipelineControlError(
        err instanceof Error ? err.message : t("pipelineFailedHint"),
      );
    }
  }

  function handleReplacementFileSelect(file: File | null) {
    setReplacementError("");
    if (file && !isSupportedDocumentFile(file)) {
      setReplacementError(t("fileInvalid"));
      setReplacementFile(file);
      return;
    }
    setReplacementFile(file);
  }

  async function submitVersionReplacement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!current) return;
    if (!replacementFile) {
      setReplacementError(t("fileInvalid"));
      return;
    }
    if (!isSupportedDocumentFile(replacementFile)) {
      setReplacementError(t("fileInvalid"));
      return;
    }
    setReplacementError("");
    setIsReplacementSubmitting(true);
    const controller = new AbortController();
    replacementAbortRef.current = controller;
    setReplacementProgress(0);
    try {
      const nextTitle =
        replacementFile.name.replace(/\.[^.]+$/, "").slice(0, 200) ||
        current.title;
      const nextDescription =
        replacementNote.trim() || current.description || "";
      await workNotesApi.updateDocument(projectId, current.id, {
        title: nextTitle,
        ...(nextDescription ? { description: nextDescription } : {}),
        type: current.type ?? "OTHER",
        content: current.content ?? "",
      });
      const uploaded = await workNotesApi.uploadDocumentFile(
        projectId,
        current.id,
        replacementFile,
        {
          ...(replacementSha256 ? { sha256: replacementSha256 } : {}),
          autoSyncSag: isProjectLeader,
          onProgress: (pct) => setReplacementProgress(pct),
          signal: controller.signal,
        },
      );
      let finalDoc = uploaded;
      if (!isProjectLeader) {
        finalDoc = await workNotesApi.documentAction(
          projectId,
          current.id,
          "submit",
        );
      } else {
        setSyncedDocIds((prev) => ({ ...prev, [current.id]: true }));
      }
      setSelected(finalDoc);
      setSelectedVersionNumber(null);
      setIsReplacingVersion(false);
      setReplacementFile(null);
      setReplacementNote("");
      setReplacementProgress(null);
      await queryClient.invalidateQueries({
        queryKey: workNoteKeys.project(projectId),
      });
    } catch (err) {
      const isAborted =
        (err instanceof DOMException && err.name === "AbortError") ||
        controller.signal.aborted;
      setReplacementError(
        isAborted
          ? t("queuePaused")
          : err instanceof Error
            ? err.message
            : t("queueFailed"),
      );
    } finally {
      replacementAbortRef.current = null;
      setReplacementProgress(null);
      setIsReplacementSubmitting(false);
    }
  }

  async function runAction(
    actionName:
      | "submit"
      | "comment"
      | "approve"
      | "request-changes"
      | "reject"
      | "archive",
  ) {
    action.reset();
    setShowActionSuccess(false);
    const comment = reviewComment.trim();
    const effectiveComment =
      comment ||
      ((actionName === "request-changes" || actionName === "reject") &&
      current?.reviewComment?.trim()
        ? current.reviewComment.trim()
        : "");
    if (
      (actionName === "comment" && !comment) ||
      ((actionName === "request-changes" || actionName === "reject") &&
        !effectiveComment)
    ) {
      setValidationError(t("reviewCommentRequired"));
      return;
    }
    setValidationError("");
    try {
      const result = await action.mutateAsync({
        action: actionName,
        ...(effectiveComment ? { comment: effectiveComment } : {}),
      });
      if (actionName === "approve" && documentId) {
        await workNotesApi
          .syncDocumentToSag(projectId, documentId)
          .catch(() => undefined);
        setSyncedDocIds((prev) => ({ ...prev, [documentId]: true }));
        await queryClient.invalidateQueries({
          queryKey: workNoteKeys.project(projectId),
        });
      }
      setSelected(result);
      setReviewComment("");
      setConfirmingArchive(false);
      setMoreActionsOpen(false);
      setShowActionSuccess(true);
    } catch {
      // Mutation error is displayed in the modal.
    }
  }

  async function handleConfirmPermanentDelete() {
    if (!documentId || deleteDocumentMutation.isPending) return;
    setDeleteError("");
    const targetName = activeFile?.name ?? current?.title ?? selected?.title ?? "";
    try {
      const outcome = await deleteDocumentMutation.mutateAsync(undefined);
      if (outcome.r2DeletedKeys > 0) {
        setRemovalBanner(
          t("removalFeedbackDeletedR2", {
            name: targetName,
            count: outcome.r2DeletedKeys,
          }),
        );
      } else if (outcome.r2RetainedSharedKeys > 0) {
        setRemovalBanner(
          t("removalFeedbackDeletedSharedR2", {
            name: targetName,
            count: outcome.r2RetainedSharedKeys,
          }),
        );
      } else {
        setRemovalBanner(
          t("removalFeedbackDeletedNoFile", { name: targetName }),
        );
      }
      closeDetailModal();
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : t("permissionDenied"),
      );
    }
  }

  function openRemovalModal(target: ProjectDocumentSummary) {
    setMoreActionsOpen(false);
    setConfirmingDelete(false);
    setConfirmingArchive(false);
    setRemovalModalError("");
    setRemovalBusyTier(null);
    setRemovalTarget(target);
  }

  function closeRemovalModal() {
    if (removalBusyTier !== null) return;
    setRemovalModalError("");
    setRemovalTarget(null);
  }

  async function executeRemovalTier(tier: 1 | 2 | 3) {
    if (!removalTarget || removalBusyTier !== null) return;
    const targetDoc = removalTarget;
    const targetName = targetDoc.file?.name || targetDoc.title;
    setRemovalModalError("");
    setRemovalBusyTier(tier);
    try {
      if (tier === 1) {
        const res = await workNotesApi.controlDocumentKnowledge(
          projectId,
          targetDoc.id,
          "REVOKE",
        );
        updateCachedDocumentSync(targetDoc.id, res, false);
        await queryClient.invalidateQueries({
          queryKey: workNoteKeys.project(projectId),
        });
        setRemovalBanner(t("removalFeedbackRevoked", { name: targetName }));
        setRemovalTarget(null);
      } else if (tier === 2) {
        const archived = await workNotesApi.documentAction(
          projectId,
          targetDoc.id,
          "archive",
        );
        if (selected?.id === targetDoc.id) {
          setSelected(archived);
        }
        await queryClient.invalidateQueries({
          queryKey: workNoteKeys.project(projectId),
        });
        setRemovalBanner(t("removalFeedbackArchived", { name: targetName }));
        setRemovalTarget(null);
      } else {
        const outcome = await workNotesApi.deleteDocument(
          projectId,
          targetDoc.id,
        );
        if (selected?.id === targetDoc.id) {
          closeDetailModal();
        }
        await queryClient.invalidateQueries({
          queryKey: workNoteKeys.project(projectId),
        });
        if (outcome.r2DeletedKeys > 0) {
          setRemovalBanner(
            t("removalFeedbackDeletedR2", {
              name: targetName,
              count: outcome.r2DeletedKeys,
            }),
          );
        } else if (outcome.r2RetainedSharedKeys > 0) {
          setRemovalBanner(
            t("removalFeedbackDeletedSharedR2", {
              name: targetName,
              count: outcome.r2RetainedSharedKeys,
            }),
          );
        } else {
          setRemovalBanner(
            t("removalFeedbackDeletedNoFile", { name: targetName }),
          );
        }
        setRemovalTarget(null);
      }
    } catch (err) {
      setRemovalModalError(
        err instanceof Error ? err.message : t("permissionDenied"),
      );
    } finally {
      setRemovalBusyTier(null);
    }
  }

  function openDocument(document: ProjectDocumentSummary) {
    action.reset();
    syncKnowledge.reset();
    controlKnowledge.reset();
    deleteDocumentMutation.reset();
    setPipelineControlError("");
    setDeleteError("");
    setChunkFilter("");
    setExpandedChunkIds({});
    setSelected(document);
    setSelectedVersionNumber(null);
    setShowActionSuccess(false);
    setMoreActionsOpen(false);
    setConfirmingArchive(false);
    setConfirmingDelete(false);
    setConfirmingRevokeSag(false);
    setIsReplacingVersion(false);
    setReplacementFile(null);
    setReplacementNote(document.description ?? "");
    setReplacementError("");
    setReviewComment("");
    setValidationError("");
  }

  function closeDetailModal() {
    replacementAbortRef.current?.abort();
    replacementAbortRef.current = null;
    action.reset();
    syncKnowledge.reset();
    controlKnowledge.reset();
    deleteDocumentMutation.reset();
    setPipelineControlError("");
    setDeleteError("");
    setChunkFilter("");
    setExpandedChunkIds({});
    setSelected(null);
    setSelectedVersionNumber(null);
    setShowActionSuccess(false);
    setMoreActionsOpen(false);
    setConfirmingArchive(false);
    setConfirmingDelete(false);
    setConfirmingRevokeSag(false);
    setIsReplacingVersion(false);
    setReplacementFile(null);
    setReplacementError("");
    setReplacementProgress(null);
  }

  function openUploadModal() {
    const allFinished =
      batchQueue.length > 0 &&
      batchQueue.every(
        (i) =>
          i.status === "SYNCED" ||
          i.status === "REQUESTED" ||
          i.status === "SKIPPED_DUPLICATE",
      );
    if (allFinished) {
      setBatchQueue([]);
      setMemberNote("");
    }
    setUploadModalOpen(true);
  }

  const detailModalOpen = Boolean(selected);

  useEffect(() => {
    if (detailModalOpen) {
      if (!wasModalOpenRef.current) {
        returnFocusRef.current =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
      }
      dialogRef.current
        ?.querySelector<HTMLElement>(
          "input:not([disabled]):not(.sr-only), select:not([disabled]), textarea:not([disabled]), button:not([disabled])",
        )
        ?.focus();
    } else if (wasModalOpenRef.current) {
      returnFocusRef.current?.focus();
    }
    wasModalOpenRef.current = detailModalOpen;
  }, [detailModalOpen, isReplacingVersion, current?.id]);

  function trapDialogFocus(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const nodes = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]):not(.sr-only), select:not([disabled]), textarea:not([disabled])",
    );
    if (!nodes?.length) return;
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

  const batchSummary = useMemo(() => {
    const totalBytes = batchQueue.reduce(
      (sum, item) => sum + item.file.size,
      0,
    );
    const processedCount = batchQueue.filter(
      (i) => i.status === "SYNCED" || i.status === "REQUESTED",
    ).length;
    const duplicateCount = batchQueue.filter(
      (i) => i.status === "SKIPPED_DUPLICATE",
    ).length;
    const doneCount = processedCount + duplicateCount;
    const actionableCount = batchQueue.filter(
      (i) =>
        !i.invalidFormat &&
        (i.status === "HASHING" ||
          i.status === "QUEUED" ||
          i.status === "CANCELLED" ||
          i.status === "FAILED"),
    ).length;
    const activeItems = batchQueue.filter(
      (i) => i.status === "UPLOADING" || i.status === "SUBMITTING",
    );
    const uploadableTotal =
      processedCount + actionableCount + activeItems.length;
    const validTotal = batchQueue.filter((i) => !i.invalidFormat).length;
    const aggregateProgressSum =
      processedCount * 100 +
      activeItems.reduce((acc, item) => acc + item.progress, 0);
    const activePercent =
      uploadableTotal > 0
        ? Math.min(99, Math.round(aggregateProgressSum / uploadableTotal))
        : 0;
    return {
      totalBytes,
      processedCount,
      duplicateCount,
      doneCount,
      actionableCount,
      uploadableTotal,
      validTotal,
      activePercent,
    };
  }, [batchQueue]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-24 sm:px-6 lg:px-8">
      <WorkNotesPageHeader projectId={projectId} active="documents" />

      <input
        ref={batchFileInputRef}
        type="file"
        multiple
        accept={FILE_INPUT_ACCEPT}
        onChange={(event) => {
          void enqueueBatchFiles(event.target.files);
          event.target.value = "";
        }}
        className="sr-only"
      />

      <section
        aria-labelledby="project-documents-heading"
        className="overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
      >
        {/* Workspace Toolbar */}
        <div className="flex flex-col gap-3 border-b border-gray-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              id="project-documents-heading"
              className="text-base font-semibold text-gray-900 dark:text-white/90"
            >
              {t("title")}
            </h2>
            {visibleList !== undefined && (
              <>
                <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 tabular-nums dark:bg-gray-800 dark:text-gray-400">
                  {t("documentCount", {
                    count: visibleList.pagination.totalItems,
                  })}
                </span>
                {workspaceStats.processingCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-brand-200/80 bg-brand-50/70 px-2 py-0.5 text-xs font-medium text-brand-700 tabular-nums dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-500" />
                    {t("activeProcessingSummary", {
                      count: workspaceStats.processingCount,
                    })}
                  </span>
                )}
                {workspaceStats.pendingCount > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-xs font-medium text-gray-700 tabular-nums dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    {t("pendingApprovalSummary", {
                      count: workspaceStats.pendingCount,
                    })}
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:flex-nowrap">
            <select
              aria-label={t("filterLabel")}
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value as DocumentStatus | "ALL");
                setPage(1);
              }}
              className="h-9 min-w-38 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 shadow-theme-xs outline-none transition focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-200"
            >
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status === "ALL" ? t("allStatuses") : t(`status.${status}`)}
                </option>
              ))}
            </select>

            {visibleList !== undefined && (
              <Button
                size="sm"
                className="h-9 !py-0 px-3.5 text-xs whitespace-nowrap"
                startIcon={
                  isBatchRunning ? (
                    <UploadProgressArcIcon className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <UploadDropzoneIcon className="h-3.5 w-3.5" />
                  )
                }
                onClick={openUploadModal}
              >
                {isBatchRunning
                  ? t("uploadActiveBadge", {
                      done: Math.min(
                        batchSummary.doneCount + 1,
                        Math.max(1, batchSummary.validTotal),
                      ),
                      total: Math.max(1, batchSummary.validTotal),
                      percent: batchSummary.activePercent,
                    })
                  : isProjectLeader
                    ? t("leaderUploadCta")
                    : t("memberRequestCta")}
              </Button>
            )}
            {visibleList !== undefined &&
              process.env.NEXT_PUBLIC_WORKNOTE_SHARED_EDITOR_ENABLED ===
                "true" && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 !py-0 px-3.5 text-xs whitespace-nowrap"
                  onClick={() =>
                    setAgentSource({
                      workflow: "PROJECT_DOCUMENT",
                      documentType: "OTHER",
                    })
                  }
                >
                  {common("agent.newDocument")}
                </Button>
              )}
          </div>
        </div>

        {visibleList !== undefined &&
          !listAccessLost &&
          (list.isFetching || list.isRefetchError) && (
            <div className="border-b border-gray-100 px-5 py-2 dark:border-gray-800">
              {list.isFetching && (
                <UpdatingStatus>{common("loading")}</UpdatingStatus>
              )}
              {list.isRefetchError && (
                <BackgroundRefreshError
                  retryLabel={common("retry")}
                  onRetry={() => void list.refetch()}
                >
                  {common("updateFailed")}
                </BackgroundRefreshError>
              )}
            </div>
          )}

        {Boolean(removalBanner) && (
          <div
            role="status"
            className="flex items-center justify-between gap-2.5 border-b border-emerald-200/80 bg-emerald-50/65 px-5 py-2.5 text-xs text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
          >
            <div className="flex min-w-0 items-center gap-2">
              <CheckCircleIcon className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate font-medium">{removalBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setRemovalBanner("")}
              aria-label={t("close")}
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-emerald-600 transition hover:bg-emerald-100 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
            >
              <UploadDismissIcon className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {list.isPending && !visibleList ? (
          <div
            role="status"
            aria-label={common("loading")}
            className="space-y-3 p-5"
          >
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-14 motion-safe:animate-pulse rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900"
              />
            ))}
          </div>
        ) : list.isError && !visibleList ? (
          <div className="p-5">
            <div
              role="alert"
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error-200 bg-error-50 px-4 py-3.5 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
            >
              <span>
                {list.error instanceof Error
                  ? list.error.message
                  : common("saveFailed")}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="h-8 !py-0 px-3 text-xs"
                onClick={() => void list.refetch()}
              >
                {common("retry")}
              </Button>
            </div>
          </div>
        ) : visibleList?.data.length ? (
          <div>
            {reviewableDocuments.length > 0 && (
              <div
                role="region"
                aria-label={t("reviewQueueBannerLabel")}
                className="flex flex-col gap-2.5 border-b border-gray-100 bg-gray-50/75 px-5 py-2.5 sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 dark:bg-gray-800/40"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 shrink-0 rounded-full bg-brand-500 dark:bg-brand-400"
                  />
                  <p className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">
                    {t("reviewQueueTitle", {
                      count: reviewableDocuments.length,
                    })}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {filter !== "PENDING_REVIEW" && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 !py-0 px-3 text-xs"
                      onClick={() => {
                        setFilter("PENDING_REVIEW");
                        setPage(1);
                      }}
                    >
                      {t("filterPendingReview")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    className="h-8 !py-0 px-3 text-xs"
                    onClick={() => openDocument(reviewableDocuments[0])}
                  >
                    {t("reviewNextDocument")}
                  </Button>
                </div>
              </div>
            )}

            {!detailModalOpen && Boolean(pipelineControlError) && (
              <div className="flex items-center justify-between gap-2 border-b border-rose-200/80 bg-rose-50/60 px-5 py-2.5 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                <span className="truncate">{pipelineControlError}</span>
                <button
                  type="button"
                  onClick={() => setPipelineControlError("")}
                  aria-label={t("cancel")}
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500/20"
                >
                  <UploadDismissIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[46rem] border-collapse text-start text-sm lg:table-fixed">
                <thead className="border-b border-gray-100 bg-gray-50/60 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-800/30 dark:text-gray-400">
                  <tr>
                    <th className="py-3 pr-3 pl-5 text-left font-medium whitespace-nowrap">
                      {t("columnDocument")}
                    </th>
                    <th className="w-[128px] px-3 py-3 text-left font-medium whitespace-nowrap">
                      {t("columnApproval")}
                    </th>
                    <th className="w-[212px] px-3 py-3 text-left font-medium whitespace-nowrap xl:w-[248px]">
                      {t("columnPipeline")}
                    </th>
                    <th className="w-[104px] px-3 py-3 text-left font-medium whitespace-nowrap">
                      {t("updatedLabel")}
                    </th>
                    <th className="w-[216px] py-3 pr-5 pl-3 text-right font-medium whitespace-nowrap">
                      {t("actionsLabel")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                  {visibleList.data.map((document) => {
                    const pipeline = resolvePipelineDisplay(
                      document.status,
                      document.knowledgeSync,
                    );
                    const isRowBusy = busyRowId === document.id;
                    const isOwner = Boolean(
                      cachedCurrentUser?.id &&
                        cachedCurrentUser.id.toLowerCase() ===
                          document.createdBy.toLowerCase(),
                    );
                    const canControlPipeline =
                      document.status === "APPROVED" &&
                      (isProjectLeader || isOwner);
                    const rowCanDelete = Boolean(
                      document.permissions.canDelete ||
                        isProjectLeader ||
                        (isOwner &&
                          document.status !== "APPROVED" &&
                          document.status !== "ARCHIVED"),
                    );
                    const rowCanArchive = Boolean(
                      (document.permissions.canConfigure ||
                        document.permissions.canReview ||
                        isProjectLeader) &&
                        document.status === "APPROVED",
                    );
                    const rowCanRevoke = Boolean(
                      isProjectLeader &&
                        document.status === "APPROVED" &&
                        (pipeline.phase === "ready" ||
                          pipeline.phase === "paused" ||
                          pipeline.phase === "processing"),
                    );
                    const canOpenRemoval =
                      rowCanDelete || rowCanArchive || rowCanRevoke;
                    const displayFileName =
                      document.file?.name || document.title;

                    return (
                      <tr
                        key={document.id}
                        className="group transition-colors hover:bg-gray-50/80 dark:hover:bg-gray-800/40"
                      >
                        {/* 1. Document File & Metadata */}
                        <td className="py-3.5 pr-3 pl-5">
                          <div className="flex items-start gap-3">
                            <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200/80 bg-gray-50/80 text-gray-500 dark:border-gray-800 dark:bg-gray-800/70 dark:text-gray-400">
                              <UploadFileGlyph
                                fileName={document.file?.name ?? document.title}
                                contentType={document.file?.contentType}
                                className="h-4 w-4"
                              />
                            </span>
                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => openDocument(document)}
                                className="block max-w-full truncate text-start text-sm font-semibold text-gray-900 transition-colors hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-brand-500 dark:text-white/90 dark:hover:text-brand-400"
                                title={displayFileName}
                              >
                                {displayFileName}
                              </button>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 tabular-nums dark:text-gray-400">
                                {document.file && (
                                  <>
                                    <span className="font-medium text-gray-600 dark:text-gray-300">
                                      {getFileTypeBadge(
                                        document.file.name,
                                        document.file.contentType,
                                      )}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                    <span>
                                      {formatFileSize(document.file.size)}
                                    </span>
                                    <span aria-hidden="true">·</span>
                                  </>
                                )}
                                <span className="font-mono">
                                  v{document.version}
                                </span>
                                {document.storageReference &&
                                  document.storageReference.objectCount > 0 && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <span
                                        title={
                                          document.storageReference
                                            .externalDocumentRefs > 0
                                            ? t("r2RefStatusSharedTitle", {
                                                refs: document.storageReference
                                                  .refCount,
                                              })
                                            : t("r2RefStatusUniqueTitle")
                                        }
                                        className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                                          document.storageReference
                                            .externalDocumentRefs > 0
                                            ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                                            : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                                        }`}
                                      >
                                        {document.storageReference
                                          .externalDocumentRefs > 0 && (
                                          <UploadDedupeIcon className="h-3 w-3 shrink-0" />
                                        )}
                                        <span>
                                          {document.storageReference
                                            .externalDocumentRefs > 0
                                            ? t("r2BadgeShared", {
                                                count:
                                                  document.storageReference
                                                    .refCount,
                                              })
                                            : t("r2BadgeUnique")}
                                        </span>
                                      </span>
                                    </>
                                  )}
                                <span aria-hidden="true">·</span>
                                <span className="truncate">
                                  {t("uploadedByShort", {
                                    actor: resolveActorLabel(
                                      document.createdBy,
                                      "author",
                                    ),
                                  })}
                                </span>
                              </div>
                              {document.description && (
                                <p className="mt-1 line-clamp-1 text-xs text-gray-500 dark:text-gray-400">
                                  {document.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* 2. Approval Status */}
                        <td className="px-3 py-3.5 align-middle whitespace-nowrap">
                          <span
                            className={`inline-flex h-6 items-center rounded-md border px-2.5 text-xs font-medium whitespace-nowrap ${STATUS_BADGE_CLASSES[document.status]}`}
                          >
                            <span
                              className={`mr-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT_CLASSES[document.status]}`}
                            />
                            <span>{t(`status.${document.status}`)}</span>
                          </span>
                        </td>

                        {/* 3. Explicit Pipeline Stage & % Progress (Visible to BOTH Member & Leader) */}
                        <td className="px-3 py-3.5 align-middle">
                          <div className="w-full min-w-0">
                            <div className="flex items-center justify-between gap-2 text-xs">
                              <span
                                className={`inline-flex min-w-0 items-center gap-1.5 font-medium ${
                                  pipeline.phase === "processing"
                                    ? "text-brand-700 dark:text-brand-300"
                                    : pipeline.phase === "ready"
                                      ? "text-gray-800 dark:text-gray-200"
                                      : pipeline.phase === "failed"
                                        ? "text-rose-600 dark:text-rose-400"
                                        : pipeline.phase === "paused"
                                          ? "text-amber-700 dark:text-amber-300"
                                          : "text-gray-500 dark:text-gray-400"
                                }`}
                              >
                                {pipeline.phase === "processing" ? (
                                  <UploadProgressArcIcon className="h-3.5 w-3.5 shrink-0 animate-spin text-brand-500" />
                                ) : pipeline.phase === "ready" ? (
                                  <UploadIndexReadyIcon className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                ) : pipeline.phase === "paused" ? (
                                  <UploadPauseIcon className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                                ) : pipeline.phase === "failed" ? (
                                  <UploadAlertCircleIcon className="h-3.5 w-3.5 shrink-0 text-rose-500" />
                                ) : null}
                                <span className="truncate">
                                  {t(pipeline.stageKey)}
                                </span>
                              </span>

                              <span
                                className={`shrink-0 font-mono text-xs tabular-nums ${
                                  pipeline.phase === "ready"
                                    ? "font-semibold text-emerald-600 dark:text-emerald-400"
                                    : pipeline.phase === "processing"
                                      ? "font-semibold text-brand-600 dark:text-brand-400"
                                      : pipeline.phase === "failed"
                                        ? "font-medium text-rose-600 dark:text-rose-400"
                                        : "text-gray-500 dark:text-gray-400"
                                }`}
                              >
                                {pipeline.percent !== null
                                  ? `${pipeline.percent}%`
                                  : "—"}
                              </span>
                            </div>

                            {/* Crisp Progress Track */}
                            <div
                              role="progressbar"
                              aria-label={`${displayFileName}: ${t(pipeline.stageKey)}`}
                              aria-valuenow={pipeline.percent ?? 0}
                              aria-valuemin={0}
                              aria-valuemax={100}
                              className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"
                            >
                              <div
                                className={`h-full rounded-full ${
                                  pipeline.phase === "processing" &&
                                  (pipeline.percent ?? 0) === 0
                                    ? "transition-none"
                                    : "transition-all duration-300"
                                } ${
                                  pipeline.phase === "ready"
                                    ? "bg-emerald-500 dark:bg-emerald-400"
                                    : pipeline.phase === "processing"
                                      ? "bg-brand-500 dark:bg-brand-400"
                                      : pipeline.phase === "paused"
                                        ? "bg-amber-500 dark:bg-amber-400"
                                        : pipeline.phase === "failed"
                                          ? "bg-rose-500 dark:bg-rose-400"
                                          : "bg-gray-300 dark:bg-gray-700"
                                }`}
                                style={{
                                  width: `${
                                    pipeline.phase === "failed"
                                      ? Math.max(12, pipeline.percent ?? 12)
                                      : Math.max(0, pipeline.percent ?? 0)
                                  }%`,
                                }}
                              />
                            </div>

                            {pipeline.phase === "ready" &&
                              pipeline.chunkCount > 0 && (
                                <p className="mt-1 text-[11px] text-gray-500 tabular-nums dark:text-gray-400">
                                  {t("pipelineChunksBadge", {
                                    count: pipeline.chunkCount,
                                  })}
                                </p>
                              )}

                            {pipeline.phase === "failed" &&
                              pipeline.errorMessage && (
                                <p
                                  className="mt-1 line-clamp-1 text-[11px] text-rose-600 dark:text-rose-400"
                                  title={pipeline.errorMessage}
                                >
                                  {pipeline.errorMessage}
                                </p>
                              )}
                          </div>
                        </td>

                        {/* 4. Updated Timestamp */}
                        <td className="px-3 py-3.5 align-middle text-xs whitespace-nowrap text-gray-500 tabular-nums dark:text-gray-400">
                          {format.dateTime(new Date(document.updatedAt), {
                            dateStyle: "medium",
                            timeZone: "UTC",
                          })}
                        </td>

                        {/* 5. Surgical Contextual Row Actions */}
                        <td className="py-3.5 pr-5 pl-3 text-end align-middle whitespace-nowrap">
                          <div className="inline-flex items-center justify-end gap-1">
                            {document.permissions.canReview && (
                              <button
                                type="button"
                                disabled={isRowBusy}
                                onClick={() =>
                                  void handleRowQuickApprove(document)
                                }
                                aria-label={`${t("quickApproveAction")}: ${displayFileName}`}
                                title={t("quickApproveAction")}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200/90 bg-white text-emerald-600 transition hover:border-emerald-300 hover:bg-emerald-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-emerald-400 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-500/10"
                              >
                                {isRowBusy ? (
                                  <UploadProgressArcIcon className="h-4 w-4 animate-spin" />
                                ) : (
                                  <UploadCheckIcon className="h-4 w-4" />
                                )}
                              </button>
                            )}

                            {canControlPipeline &&
                              pipeline.phase === "processing" && (
                                <button
                                  type="button"
                                  disabled={isRowBusy}
                                  onClick={() =>
                                    void handleRowPipelineControl(
                                      document,
                                      "PAUSE",
                                    )
                                  }
                                  aria-label={`${t("aiPause")}: ${displayFileName}`}
                                  title={t("aiPause")}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                                >
                                  {isRowBusy ? (
                                    <UploadProgressArcIcon className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <UploadPauseIcon className="h-4 w-4" />
                                  )}
                                </button>
                              )}

                            {canControlPipeline &&
                              pipeline.phase === "paused" && (
                                <button
                                  type="button"
                                  disabled={isRowBusy || Boolean(pipeline.isPausing)}
                                  onClick={() =>
                                    void handleRowPipelineControl(
                                      document,
                                      "RESUME",
                                    )
                                  }
                                  aria-label={`${
                                    pipeline.isPausing
                                      ? t("pipelinePausing")
                                      : t("aiResume")
                                  }: ${displayFileName}`}
                                  title={
                                    pipeline.isPausing
                                      ? t("pipelinePausing")
                                      : t("aiResume")
                                  }
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-amber-600 transition hover:bg-amber-50 disabled:opacity-50 dark:text-amber-400 dark:hover:bg-amber-500/10"
                                >
                                  {isRowBusy || pipeline.isPausing ? (
                                    <UploadProgressArcIcon className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <UploadResumeIcon className="h-4 w-4" />
                                  )}
                                </button>
                              )}

                            {canControlPipeline &&
                              (pipeline.phase === "failed" ||
                                (isProjectLeader &&
                                  (pipeline.phase === "not_started" ||
                                    pipeline.phase === "revoked"))) && (
                                <button
                                  type="button"
                                  disabled={isRowBusy}
                                  onClick={() =>
                                    void handleRowPipelineControl(
                                      document,
                                      pipeline.phase === "failed" &&
                                        document.knowledgeSync?.sagDocumentId
                                        ? "REPROCESS"
                                        : "SYNC",
                                    )
                                  }
                                  aria-label={`${
                                    pipeline.phase === "failed"
                                      ? t("aiReprocess")
                                      : t("aiSyncNow")
                                  }: ${displayFileName}`}
                                  title={
                                    pipeline.phase === "failed"
                                      ? t("aiReprocess")
                                      : t("aiSyncNow")
                                  }
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                                >
                                  {isRowBusy ? (
                                    <UploadProgressArcIcon className="h-4 w-4 animate-spin" />
                                  ) : pipeline.phase === "failed" ? (
                                    <UploadRetryIcon className="h-4 w-4" />
                                  ) : (
                                    <UploadIndexSyncIcon className="h-4 w-4" />
                                  )}
                                </button>
                              )}

                            {document.file && (
                              <a
                                href={`/api/backend/capture/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(document.id)}/file`}
                                aria-label={`${t("downloadAction")}: ${displayFileName}`}
                                title={t("downloadFile", {
                                  name: document.file.name,
                                })}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                              >
                                <UploadFileDownloadIcon className="h-4 w-4" />
                              </a>
                            )}

                            {canOpenRemoval && (
                              <button
                                type="button"
                                disabled={isRowBusy}
                                onClick={() => openRemovalModal(document)}
                                aria-label={`${t("removeLifecycleAction")}: ${displayFileName}`}
                                title={t("removeLifecycleAction")}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50 dark:text-gray-500 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                              >
                                <TrashBinIcon className="h-4 w-4" />
                              </button>
                            )}

                            {document.permissions.canReview ? (
                              <button
                                type="button"
                                onClick={() => openDocument(document)}
                                className="inline-flex h-8 items-center gap-1 rounded-lg bg-gray-900 px-2.5 text-xs font-medium text-white shadow-theme-xs transition hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
                              >
                                <span>{t("reviewAction")}</span>
                                <UploadRowOpenIcon className="h-3.5 w-3.5" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => openDocument(document)}
                                aria-label={t("viewAction")}
                                title={t("viewAction")}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200/80 bg-white text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                              >
                                <UploadRowOpenIcon className="h-4 w-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="px-5 py-16 text-center">
            <div className="mx-auto inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200/80 bg-gray-50 text-gray-500 dark:border-gray-800 dark:bg-gray-800/70 dark:text-gray-400">
              <UploadDropzoneIcon className="h-5 w-5" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-gray-900 dark:text-white/90">
              {t("empty")}
            </h3>
            <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-gray-500 dark:text-gray-400">
              {isProjectLeader
                ? t("leaderUploadModalSubtitle")
                : t("memberRequestModalSubtitle")}
            </p>
            <div className="mt-4">
              <Button
                size="sm"
                className="h-9 !py-0 px-4 text-xs"
                startIcon={<UploadDropzoneIcon className="h-3.5 w-3.5" />}
                onClick={openUploadModal}
              >
                {isProjectLeader
                  ? t("leaderUploadCta")
                  : t("memberRequestCta")}
              </Button>
            </div>
          </div>
        )}

        {visibleList && visibleList.pagination.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-100 px-5 py-3.5 text-xs dark:border-gray-800">
            <span className="text-gray-500 tabular-nums dark:text-gray-400">
              {common("pagination.total", {
                count: visibleList.pagination.totalItems,
              })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 !py-0 px-3 text-xs"
                disabled={page <= 1}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                {common("pagination.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 !py-0 px-3 text-xs"
                disabled={page >= visibleList.pagination.totalPages}
                onClick={() => setPage((value) => value + 1)}
              >
                {common("pagination.next")}
              </Button>
            </div>
          </div>
        )}
      </section>

      {/* =====================================================================
          UNIFIED ROLE-AWARE UPLOAD / UPLOAD REQUEST MODAL
          (Wide Dropzone with Selected Files Embedded INSIDE the Dropzone Frame)
          ===================================================================== */}
      <Modal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onBackdropClick={() => setUploadModalOpen(false)}
        backdropClassName="bg-gray-900/35 backdrop-blur-[2px] dark:bg-gray-950/60"
        showCloseButton={false}
        className="mx-3 max-w-xl overflow-hidden rounded-xl border border-gray-200 shadow-theme-lg dark:border-gray-800"
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="unified-upload-dialog-title"
          className="flex max-h-[min(88vh,48rem)] flex-col overflow-hidden bg-white dark:bg-gray-900"
        >
          {/* Role-Accurate Header */}
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 px-6 pt-5 pb-4 dark:border-gray-800">
            <div className="min-w-0">
              <h2
                id="unified-upload-dialog-title"
                className="text-base font-semibold tracking-tight text-gray-900 dark:text-white/95"
              >
                {isProjectLeader
                  ? t("leaderUploadModalTitle")
                  : t("memberRequestModalTitle")}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                {isProjectLeader
                  ? t("leaderUploadModalSubtitle")
                  : t("memberRequestModalSubtitle")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setUploadModalOpen(false)}
              aria-label={t("close")}
              title={t("close")}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
            >
              <UploadDismissIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Modal Body: Dropzone Container (Empty OR Files Embedded Inside) + Member Note */}
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setBatchIsDragging(true);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setBatchIsDragging(false);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                setBatchIsDragging(false);
                void enqueueBatchFiles(event.dataTransfer.files);
              }}
              className={`rounded-xl border-2 border-dashed transition-all ${
                batchIsDragging
                  ? "border-brand-500 bg-brand-50/40 ring-4 ring-brand-500/10 dark:border-brand-400 dark:bg-brand-500/10"
                  : batchQueue.length === 0
                    ? "border-gray-200 bg-gray-50/50 hover:border-brand-300 hover:bg-brand-50/15 dark:border-gray-700 dark:bg-gray-950/50 dark:hover:border-brand-500/40"
                    : "border-gray-200/90 bg-gray-50/45 dark:border-gray-700/90 dark:bg-gray-950/45"
              }`}
            >
              {batchQueue.length === 0 ? (
                /* Empty State: Generous, Inviting Dropzone */
                <button
                  type="button"
                  onClick={() => batchFileInputRef.current?.click()}
                  className="flex min-h-[224px] w-full cursor-pointer flex-col items-center justify-center px-6 py-10 text-center focus-visible:outline-2 focus-visible:outline-brand-500"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200/90 bg-white text-brand-600 shadow-theme-xs dark:border-gray-700 dark:bg-gray-800 dark:text-brand-400">
                    <UploadDropzoneIcon className="h-5 w-5" />
                  </span>
                  <span className="mt-3.5 text-sm font-medium text-gray-900 dark:text-white/95">
                    {t("dropzonePromptLead")}{" "}
                    <span className="text-brand-600 underline decoration-brand-500/40 underline-offset-4 dark:text-brand-400">
                      {t("dropzonePromptAction")}
                    </span>
                  </span>
                  <span className="mt-1.5 max-w-sm text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                    {t("dropzoneFormatContract")}
                  </span>
                </button>
              ) : (
                /* Populated State: Selected File Cards Embedded INSIDE the Dropzone Frame */
                <div className="flex flex-col">
                  <div className="flex items-center justify-between gap-2 border-b border-gray-200/70 px-3.5 py-2.5 dark:border-gray-800">
                    <span className="text-xs font-medium text-gray-700 tabular-nums dark:text-gray-300">
                      {t("dropzoneSelectedCount", {
                        count: batchQueue.length,
                      })}{" "}
                      · {formatFileSize(batchSummary.totalBytes)}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => batchFileInputRef.current?.click()}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 shadow-theme-xs transition hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                      >
                        <span aria-hidden="true">+</span>
                        <span>{t("dropzoneAddMore")}</span>
                      </button>
                      {!isBatchRunning && (
                        <button
                          type="button"
                          onClick={() => setBatchQueue([])}
                          className="inline-flex h-7 items-center rounded-md px-2 text-xs font-medium text-gray-400 transition hover:bg-gray-200/60 hover:text-gray-700 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                        >
                          {t("dropzoneClearAll")}
                        </button>
                      )}
                    </div>
                  </div>

                  <ul className="max-h-[252px] space-y-2 overflow-y-auto p-2.5">
                    {batchQueue.map((item) => {
                      const statusDotClass =
                        item.status === "FAILED"
                          ? "bg-rose-500 dark:bg-rose-400"
                          : item.status === "SYNCED" ||
                              item.status === "REQUESTED" ||
                              item.status === "SKIPPED_DUPLICATE"
                            ? "bg-emerald-500 dark:bg-emerald-400"
                            : item.status === "CANCELLED"
                              ? "bg-amber-500 dark:bg-amber-400"
                              : item.status === "UPLOADING" ||
                                  item.status === "SUBMITTING" ||
                                  item.status === "HASHING"
                                ? "animate-pulse bg-brand-500 dark:bg-brand-400"
                                : "bg-gray-300 dark:bg-gray-600";

                      const canRetryItem =
                        (item.status === "CANCELLED" ||
                          item.status === "FAILED") &&
                        !item.invalidFormat;

                      const statusText =
                        item.status === "HASHING"
                          ? t("queueHashing")
                          : item.status === "SKIPPED_DUPLICATE"
                            ? t("queueDuplicateProject")
                            : item.status === "SYNCED"
                              ? t("queueSyncedLeader")
                              : item.status === "REQUESTED"
                                ? t("queueRequestedMember")
                                : item.status === "SUBMITTING"
                                  ? t("queueSubmittingRequest")
                                  : item.status === "UPLOADING"
                                    ? t("queueUploading", {
                                        progress: item.progress,
                                      })
                                    : item.status === "CANCELLED"
                                      ? t("queuePaused")
                                      : item.status === "FAILED"
                                        ? item.invalidFormat
                                          ? t("queueUnsupported")
                                          : item.error || t("queueFailed")
                                        : isProjectLeader
                                          ? t("queueReadyLeader")
                                          : t("queueReadyMember");

                      return (
                        <li
                          key={item.id}
                          className="flex items-center justify-between gap-3 rounded-lg border border-gray-200/80 bg-white px-3 py-2.5 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-3">
                            <span
                              title={
                                item.sha256
                                  ? `SHA-256: ${item.sha256}`
                                  : undefined
                              }
                              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200/80 bg-gray-50 text-gray-500 dark:border-gray-800 dark:bg-gray-800/80 dark:text-gray-400"
                            >
                              <UploadFileGlyph
                                fileName={item.file.name}
                                contentType={item.file.type}
                                invalid={Boolean(item.invalidFormat)}
                                className="h-4 w-4"
                              />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="truncate text-sm font-medium text-gray-900 dark:text-white/90">
                                  {item.file.name}
                                </p>
                                <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] font-medium text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                                  {getFileTypeBadge(
                                    item.file.name,
                                    item.file.type,
                                  )}
                                </span>
                              </div>
                              <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 tabular-nums dark:text-gray-400">
                                <span>{formatFileSize(item.file.size)}</span>
                                <span
                                  aria-hidden="true"
                                  className="text-gray-300 dark:text-gray-600"
                                >
                                  ·
                                </span>
                                <span
                                  className={`inline-flex items-center gap-1.5 ${
                                    item.status === "FAILED"
                                      ? "text-rose-600 dark:text-rose-400"
                                      : "text-gray-600 dark:text-gray-300"
                                  }`}
                                >
                                  <span
                                    aria-hidden="true"
                                    className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass}`}
                                  />
                                  <span>{statusText}</span>
                                </span>
                              </p>
                              {(item.status === "UPLOADING" ||
                                item.status === "SUBMITTING") && (
                                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                                  <div
                                    className="h-full rounded-full bg-brand-600 transition-all duration-150 dark:bg-brand-400"
                                    style={{
                                      width: `${Math.max(6, item.progress)}%`,
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-0.5">
                            {item.status === "UPLOADING" ? (
                              <button
                                type="button"
                                onClick={() => pauseBatchItem(item.id)}
                                aria-label={t("queueActionPause")}
                                title={t("queueActionPause")}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                              >
                                <UploadPauseIcon className="h-4 w-4" />
                              </button>
                            ) : canRetryItem ? (
                              <button
                                type="button"
                                onClick={() =>
                                  void runBatchUploadQueue(item.id)
                                }
                                aria-label={t("queueActionRetry")}
                                title={t("queueActionRetry")}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                              >
                                <UploadRetryIcon className="h-4 w-4" />
                              </button>
                            ) : null}

                            {item.status !== "UPLOADING" &&
                              item.status !== "SUBMITTING" && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setBatchQueue((prev) =>
                                      prev.filter((q) => q.id !== item.id),
                                    )
                                  }
                                  aria-label={t("queueActionRemove")}
                                  title={t("queueActionRemove")}
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                                >
                                  <UploadDismissIcon className="h-4 w-4" />
                                </button>
                              )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="border-t border-gray-200/60 px-3.5 py-2 text-center text-[11px] text-gray-400 dark:border-gray-800/80 dark:text-gray-500">
                    {t("dropzoneInnerFooterHint")}
                  </div>
                </div>
              )}
            </div>

            {/* Member-only Optional Note for Project Leader */}
            {!isProjectLeader && (
              <div className="space-y-1.5">
                <label
                  htmlFor="member-upload-request-note"
                  className="flex items-center justify-between gap-2 text-xs font-medium text-gray-700 dark:text-gray-300"
                >
                  <span>{t("memberNoteLabel")}</span>
                  <span className="font-normal text-gray-400 dark:text-gray-500">
                    {t("optional")}
                  </span>
                </label>
                <textarea
                  id="member-upload-request-note"
                  rows={2}
                  maxLength={500}
                  disabled={isBatchRunning}
                  value={memberNote}
                  onChange={(event) => setMemberNote(event.target.value)}
                  placeholder={t("memberNotePlaceholder")}
                  className={`${FIELD_CLASS} resize-none text-xs leading-relaxed`}
                />
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-gray-100 bg-gray-50/70 px-6 py-3.5 dark:border-gray-800 dark:bg-gray-900/90">
            <div className="text-xs text-gray-500 tabular-nums dark:text-gray-400">
              {batchQueue.length > 0 &&
                (batchSummary.processedCount > 0
                  ? isProjectLeader
                    ? t("summaryFilesUploaded", {
                        done: batchSummary.processedCount,
                        total: Math.max(
                          batchSummary.processedCount,
                          batchSummary.uploadableTotal,
                        ),
                      })
                    : t("summaryRequestsSent", {
                        done: batchSummary.processedCount,
                        total: Math.max(
                          batchSummary.processedCount,
                          batchSummary.uploadableTotal,
                        ),
                      })
                  : batchSummary.actionableCount > 0
                    ? t("bulkUploadSummaryReady", {
                        count: batchSummary.actionableCount,
                      })
                    : batchSummary.duplicateCount > 0
                      ? t("queueDuplicateProject")
                      : null)}
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 !py-0 px-3.5 text-xs"
                onClick={() => setUploadModalOpen(false)}
              >
                {batchSummary.doneCount > 0 && batchSummary.actionableCount === 0
                  ? t("close")
                  : t("cancel")}
              </Button>

              {isBatchRunning ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 !py-0 px-3.5 text-xs"
                  startIcon={<UploadPauseIcon className="h-3.5 w-3.5" />}
                  onClick={pauseAllBatchUploads}
                >
                  {t("bulkUploadPauseAll")}
                </Button>
              ) : batchSummary.actionableCount > 0 ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-9 !py-0 px-4 text-xs"
                  onClick={() => void runBatchUploadQueue()}
                >
                  {isProjectLeader
                    ? t("leaderStartUploadCount", {
                        count: batchSummary.actionableCount,
                      })
                    : t("memberSendRequestCount", {
                        count: batchSummary.actionableCount,
                      })}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </Modal>

      {/* =====================================================================
          DOCUMENT DETAIL, PIPELINE INSPECTION & LEADER REVIEW MODAL
          ===================================================================== */}
      <Modal
        isOpen={detailModalOpen}
        onClose={() => {
          if (!removalTarget) closeDetailModal();
        }}
        onBackdropClick={() => {
          if (!removalTarget) closeDetailModal();
        }}
        backdropClassName="bg-gray-900/35 backdrop-blur-[2px] dark:bg-gray-950/60"
        showCloseButton={false}
        className={`overflow-hidden border border-gray-200 shadow-theme-lg dark:border-gray-800 ${
          isReplacingVersion
            ? "mx-3 max-w-xl rounded-xl"
            : "max-md:mx-0 max-md:h-dvh max-md:w-full max-md:rounded-none md:mx-4 md:max-w-4xl md:rounded-2xl"
        }`}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="document-dialog-title"
          onKeyDown={trapDialogFocus}
          className="flex max-h-[min(90vh,52rem)] flex-col overflow-hidden bg-white dark:bg-gray-900"
        >
          {/* Detail Modal Header */}
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 bg-white px-5 py-4 sm:px-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="min-w-0 flex-1">
              <h2
                id="document-dialog-title"
                className="text-base sm:text-lg font-semibold tracking-tight break-words text-gray-900 dark:text-white/95"
              >
                {isReplacingVersion && current
                  ? isProjectLeader
                    ? t("uploadNewVersionTitleLeader", {
                        version: current.version + 1,
                      })
                    : t("uploadNewVersionTitleMember", {
                        version: current.version + 1,
                      })
                  : (activeFile?.name ??
                    current?.title ??
                    (detailAccessLost ? undefined : selected?.title) ??
                    t("open"))}
              </h2>

              {isReplacingVersion && current ? (
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {isProjectLeader
                    ? t("uploadNewVersionSubtitleLeader", {
                        version: current.version + 1,
                      })
                    : t("uploadNewVersionSubtitleMember", {
                        version: current.version + 1,
                      })}
                </p>
              ) : current ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASSES[viewedVersion?.status ?? current.status]}`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASSES[viewedVersion?.status ?? current.status]}`}
                    />
                    {t(`status.${viewedVersion?.status ?? current.status}`)}
                  </span>
                  <span className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-xs font-medium text-gray-700 tabular-nums dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    v{viewedVersion?.version ?? current.version}
                  </span>
                  <span className="text-xs text-gray-500 tabular-nums dark:text-gray-400">
                    {t("uploadedByShort", {
                      actor: resolveActorLabel(current.createdBy, "author"),
                    })}{" "}
                    ·{" "}
                    {format.dateTime(
                      new Date(viewedVersion?.createdAt ?? current.createdAt),
                      { dateStyle: "medium", timeZone: "UTC" },
                    )}
                  </span>
                </div>
              ) : null}
            </div>

            <button
              type="button"
              onClick={closeDetailModal}
              aria-label={t("close")}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-white"
            >
              <CloseLineIcon className="h-4 w-4 fill-current" />
            </button>
          </div>

          {/* Mode A: File-First Version Replacement Dropzone */}
          {isReplacingVersion && current ? (
            <form
              onSubmit={(event) => void submitVersionReplacement(event)}
              className="flex min-h-0 flex-1 flex-col"
            >
              <input
                ref={replacementFileInputRef}
                type="file"
                accept={FILE_INPUT_ACCEPT}
                onChange={(event) => {
                  handleReplacementFileSelect(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
                className="sr-only"
              />

              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                {replacementError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-error-200 bg-error-50 px-3.5 py-2.5 text-xs text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
                  >
                    <AlertIcon className="mt-0.5 h-4 w-4 shrink-0 fill-current" />
                    <span>{replacementError}</span>
                  </div>
                )}

                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setReplacementDragging(true);
                  }}
                  onDragLeave={() => setReplacementDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setReplacementDragging(false);
                    const file = event.dataTransfer.files?.[0] ?? null;
                    if (file) handleReplacementFileSelect(file);
                  }}
                  className={`rounded-xl border-2 border-dashed transition-all ${
                    replacementDragging
                      ? "border-brand-500 bg-brand-50/40 ring-4 ring-brand-500/10 dark:border-brand-400 dark:bg-brand-500/10"
                      : "border-gray-200 bg-gray-50/50 hover:border-brand-300 dark:border-gray-700 dark:bg-gray-950/50"
                  }`}
                >
                  {!replacementFile ? (
                    <button
                      type="button"
                      onClick={() => replacementFileInputRef.current?.click()}
                      className="flex min-h-[200px] w-full cursor-pointer flex-col items-center justify-center px-6 py-8 text-center"
                    >
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200/90 bg-white text-brand-600 shadow-theme-xs dark:border-gray-700 dark:bg-gray-800 dark:text-brand-400">
                        <UploadDropzoneIcon className="h-5 w-5" />
                      </span>
                      <span className="mt-3 text-sm font-medium text-gray-900 dark:text-white/95">
                        {t("dropzonePromptLead")}{" "}
                        <span className="text-brand-600 underline decoration-brand-500/40 underline-offset-4 dark:text-brand-400">
                          {t("dropzonePromptAction")}
                        </span>
                      </span>
                      <span className="mt-1.5 max-w-sm text-xs text-gray-500 dark:text-gray-400">
                        {t("dropzoneFormatContract")}
                      </span>
                    </button>
                  ) : (
                    <div className="p-3">
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200/80 bg-white px-3.5 py-3 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900">
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200/80 bg-gray-50 text-gray-500 dark:border-gray-800 dark:bg-gray-800 dark:text-gray-400">
                            <UploadFileGlyph
                              fileName={replacementFile.name}
                              contentType={replacementFile.type}
                              className="h-4 w-4"
                            />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900 dark:text-white/90">
                              {replacementFile.name}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-500 tabular-nums dark:text-gray-400">
                              {formatFileSize(replacementFile.size)} ·{" "}
                              {isReplacementSubmitting &&
                              typeof replacementProgress === "number"
                                ? t("queueUploading", {
                                    progress: replacementProgress,
                                  })
                                : isProjectLeader
                                  ? t("queueReadyLeader")
                                  : t("queueReadyMember")}
                            </p>
                            {isReplacementSubmitting &&
                              typeof replacementProgress === "number" && (
                                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                                  <div
                                    className="h-full rounded-full bg-brand-600 transition-all duration-150 dark:bg-brand-400"
                                    style={{
                                      width: `${Math.max(6, replacementProgress)}%`,
                                    }}
                                  />
                                </div>
                              )}
                          </div>
                        </div>

                        {!isReplacementSubmitting && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                replacementFileInputRef.current?.click()
                              }
                              className="rounded-md border border-gray-200 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                            >
                              {t("replaceFile")}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleReplacementFileSelect(null)}
                              aria-label={t("removeFile")}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800"
                            >
                              <UploadDismissIcon className="h-4 w-4" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {!isProjectLeader && (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="replacement-member-note"
                      className="flex items-center justify-between gap-2 text-xs font-medium text-gray-700 dark:text-gray-300"
                    >
                      <span>{t("memberNoteLabel")}</span>
                      <span className="font-normal text-gray-400">
                        {t("optional")}
                      </span>
                    </label>
                    <textarea
                      id="replacement-member-note"
                      rows={2}
                      maxLength={500}
                      value={replacementNote}
                      onChange={(event) =>
                        setReplacementNote(event.target.value)
                      }
                      placeholder={t("memberNotePlaceholder")}
                      className={`${FIELD_CLASS} resize-none text-xs`}
                    />
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/70 px-6 py-3.5 dark:border-gray-800 dark:bg-gray-900/90">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 !py-0 px-3.5 text-xs"
                  onClick={() => {
                    replacementAbortRef.current?.abort();
                    setIsReplacingVersion(false);
                    setReplacementFile(null);
                    setReplacementError("");
                  }}
                >
                  {t("cancel")}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  className="h-9 !py-0 px-4 text-xs"
                  disabled={!replacementFile}
                  isLoading={isReplacementSubmitting}
                >
                  {isProjectLeader
                    ? t("uploadNewVersionSubmitLeader", {
                        version: current.version + 1,
                      })
                    : t("uploadNewVersionSubmitMember", {
                        version: current.version + 1,
                      })}
                </Button>
              </div>
            </form>
          ) : detail.isPending && !current ? (
            <div
              role="status"
              className="p-6 text-sm text-gray-500 dark:text-gray-400"
            >
              {common("loading")}
            </div>
          ) : detail.isError && !current ? (
            <div
              role="alert"
              className="p-6 text-sm text-error-700 dark:text-error-300"
            >
              {detail.error instanceof Error
                ? detail.error.message
                : common("saveFailed")}{" "}
              <Button
                variant="outline"
                size="sm"
                onClick={() => void detail.refetch()}
              >
                {common("retry")}
              </Button>
            </div>
          ) : current ? (
            /* Mode B: Detail Inspection & Leader Review */
            <>
              {!detailAccessLost && detail.isFetching && (
                <UpdatingStatus>{common("loading")}</UpdatingStatus>
              )}
              {!detailAccessLost && detail.isRefetchError && (
                <BackgroundRefreshError
                  retryLabel={common("retry")}
                  onRetry={() => void detail.refetch()}
                >
                  {common("updateFailed")}
                </BackgroundRefreshError>
              )}

              <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
                {showActionSuccess && action.isSuccess && (
                  <div
                    role="status"
                    className="flex items-center justify-between gap-3 rounded-xl border border-success-200 bg-success-50/90 px-4 py-2.5 text-sm text-success-800 dark:border-success-500/30 dark:bg-success-500/15 dark:text-success-200"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircleIcon className="h-4 w-4 shrink-0 text-success-600 dark:text-success-400" />
                      <span className="font-medium">{t("actionSuccess")}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowActionSuccess(false)}
                      aria-label={t("close")}
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-success-700 hover:bg-success-100 dark:text-success-300 dark:hover:bg-success-500/20"
                    >
                      <CloseLineIcon className="h-3.5 w-3.5 fill-current" />
                    </button>
                  </div>
                )}

                {validationError && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-xl border border-error-200 bg-error-50 px-4 py-2.5 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
                  >
                    <AlertIcon className="h-4 w-4 shrink-0" />
                    <span>{validationError}</span>
                  </div>
                )}

                {action.isError && (
                  <div
                    role="alert"
                    className="flex items-center gap-2 rounded-xl border border-error-200 bg-error-50 px-4 py-2.5 text-sm text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-300"
                  >
                    <AlertIcon className="h-4 w-4 shrink-0" />
                    <span>
                      {action.error instanceof Error
                        ? action.error.message
                        : t("permissionDenied")}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
                  {/* Left Column (~60%): File Attachment, Processing Pipeline & %, Uploader Note, Review Decision */}
                  <div className="space-y-4 lg:col-span-7">
                    {isViewingHistoricalVersion && viewedVersion && (
                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50/75 px-3.5 py-2.5 text-xs text-brand-900 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
                        <span className="font-semibold">
                          {t("viewingHistoricalVersion", {
                            version: viewedVersion.version,
                            status: t(`status.${viewedVersion.status}`),
                          })}
                        </span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 !py-0 px-3 text-xs"
                          onClick={() => {
                            setChunkFilter("");
                            setExpandedChunkIds({});
                            setSelectedVersionNumber(null);
                          }}
                        >
                          {t("returnToLatestVersion", {
                            version: current.version,
                          })}
                        </Button>
                      </div>
                    )}

                    {/* 1. Primary File Card (Native Download + Authentic File Metadata — No Fragile Browser Binary Preview) */}
                    <section
                      aria-labelledby="detail-attachment-heading"
                      className="space-y-2"
                    >
                      <h3
                        id="detail-attachment-heading"
                        className="text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                      >
                        {t("attachmentHeading")}
                      </h3>
                      {activeFile ? (
                        <div className="rounded-xl border border-gray-200/90 bg-gray-50/50 p-3.5 dark:border-gray-800 dark:bg-gray-900/60">
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-gray-200/80 bg-white text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                                <UploadFileGlyph
                                  fileName={activeFile.name}
                                  contentType={activeFile.contentType}
                                  className="h-4.5 w-4.5"
                                />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-gray-900 dark:text-white/90">
                                  {activeFile.name}
                                </p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-500 tabular-nums dark:text-gray-400">
                                  <span>
                                    {getFileTypeBadge(
                                      activeFile.name,
                                      activeFile.contentType,
                                    )}{" "}
                                    · {formatFileSize(activeFile.size)}
                                  </span>
                                  {!isViewingHistoricalVersion &&
                                    (current.storageReference?.sha256 ??
                                      detailLiveSync?.fileHash) && (
                                      <>
                                        <span
                                          aria-hidden="true"
                                          className="text-gray-300 dark:text-gray-600"
                                        >
                                          ·
                                        </span>
                                        <span className="font-mono text-[11px] text-gray-400 dark:text-gray-500">
                                          SHA-256{" "}
                                          {(
                                            current.storageReference?.sha256 ??
                                            detailLiveSync?.fileHash ??
                                            ""
                                          ).slice(0, 8)}
                                        </span>
                                      </>
                                    )}
                                  {!isViewingHistoricalVersion &&
                                    current.storageReference &&
                                    current.storageReference.objectCount > 0 && (
                                      <>
                                        <span
                                          aria-hidden="true"
                                          className="text-gray-300 dark:text-gray-600"
                                        >
                                          ·
                                        </span>
                                        <span
                                          title={
                                            current.storageReference
                                              .externalDocumentRefs > 0
                                              ? t("r2RefStatusSharedTitle", {
                                                  refs: current.storageReference
                                                    .refCount,
                                                })
                                              : t("r2RefStatusUniqueTitle")
                                          }
                                          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                                            current.storageReference
                                              .externalDocumentRefs > 0
                                              ? "bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300"
                                              : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                                          }`}
                                        >
                                          {current.storageReference
                                            .externalDocumentRefs > 0 && (
                                            <UploadDedupeIcon className="h-3 w-3 shrink-0" />
                                          )}
                                          <span>
                                            {current.storageReference
                                              .externalDocumentRefs > 0
                                              ? t("r2BadgeShared", {
                                                  count:
                                                    current.storageReference
                                                      .refCount,
                                                })
                                              : t("r2BadgeUnique")}
                                          </span>
                                        </span>
                                      </>
                                    )}
                                </div>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center">
                              <a
                                aria-label={t("downloadFile", {
                                  name: activeFile.name,
                                })}
                                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 shadow-theme-xs transition hover:bg-gray-50 hover:text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700"
                                href={`/api/backend/capture/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(current.id)}/file${isViewingHistoricalVersion && viewedVersion ? `?version=${viewedVersion.version}` : ""}`}
                              >
                                <UploadFileDownloadIcon className="h-3.5 w-3.5" />
                                {t("downloadAction")}
                              </a>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/40 px-4 py-3 text-xs text-gray-500 dark:border-gray-800 dark:bg-gray-900/30 dark:text-gray-400">
                          {t("noAttachment")}
                        </div>
                      )}
                    </section>

                    {/* 2. Explicit Processing Pipeline & % Card (Visible to BOTH Member & Leader) */}
                    {!isViewingHistoricalVersion && (
                      <section
                        aria-labelledby="detail-pipeline-heading"
                        className="space-y-3 rounded-xl border border-gray-200/90 bg-white p-4 shadow-theme-xs dark:border-gray-800 dark:bg-gray-900/70"
                      >
                        {(() => {
                          const liveSync =
                            knowledgeStatusQuery.data ?? current.knowledgeSync;
                          const pipeline = resolvePipelineDisplay(
                            current.status,
                            liveSync,
                          );
                          const isBusy =
                            syncKnowledge.isPending ||
                            controlKnowledge.isPending;
                          const isOwner = Boolean(
                            cachedCurrentUser?.id &&
                              cachedCurrentUser.id.toLowerCase() ===
                                current.createdBy.toLowerCase(),
                          );
                          const canControl =
                            current.status === "APPROVED" &&
                            (isProjectLeader || isOwner);

                          const steps = [
                            { idx: 1, label: t("pipelineStepQueued") },
                            { idx: 2, label: t("pipelineStepParsing") },
                            { idx: 3, label: t("pipelineStepExtracting") },
                            { idx: 4, label: t("pipelineStepIndexed") },
                          ] as const;

                          return (
                            <>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex min-w-0 flex-1 items-center gap-1.5 text-xs">
                                  {pipeline.phase === "processing" ? (
                                    <UploadProgressArcIcon className="h-4 w-4 shrink-0 animate-spin text-brand-500" />
                                  ) : pipeline.phase === "ready" ? (
                                    <UploadIndexReadyIcon className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                  ) : pipeline.phase === "paused" ? (
                                    <UploadPauseIcon className="h-4 w-4 shrink-0 text-amber-500" />
                                  ) : pipeline.phase === "failed" ? (
                                    <UploadAlertCircleIcon className="h-4 w-4 shrink-0 text-rose-500" />
                                  ) : (
                                    <UploadIndexSyncIcon className="h-4 w-4 shrink-0 text-gray-400" />
                                  )}
                                  <h3
                                    id="detail-pipeline-heading"
                                    className="shrink-0 font-semibold text-gray-900 dark:text-white/90"
                                  >
                                    {t("pipelineHeading")}
                                  </h3>
                                  <span aria-hidden="true" className="shrink-0 text-gray-300 dark:text-gray-600">
                                    ·
                                  </span>
                                  <span className="truncate font-medium text-gray-700 dark:text-gray-300">
                                    {t(pipeline.stageKey)}
                                  </span>
                                  {pipeline.chunkCount > 0 && (
                                    <>
                                      <span aria-hidden="true" className="shrink-0 text-gray-300 dark:text-gray-600">
                                        ·
                                      </span>
                                      <span className="shrink-0 text-gray-500 tabular-nums dark:text-gray-400">
                                        {t("pipelineChunksBadge", {
                                          count: pipeline.chunkCount,
                                        })}
                                      </span>
                                    </>
                                  )}
                                  {pipeline.isDeduplicated && (
                                    <span
                                      title={t("aiDeduplicatedTooltip")}
                                      className="inline-flex shrink-0 text-gray-400"
                                    >
                                      <UploadDedupeIcon className="h-3.5 w-3.5" />
                                    </span>
                                  )}
                                </div>

                                <div className="flex shrink-0 items-center gap-2">
                                  {pipeline.percent !== null && (
                                    <span className="font-mono text-xs font-semibold text-gray-900 tabular-nums dark:text-white">
                                      {pipeline.percent}%
                                    </span>
                                  )}

                                  {canControl && (
                                    <div className="flex items-center gap-1">
                                      {(pipeline.phase === "failed" ||
                                        (isProjectLeader &&
                                          (pipeline.phase === "not_started" ||
                                            pipeline.phase === "revoked"))) && (
                                          <button
                                            type="button"
                                            disabled={isBusy}
                                            aria-label={
                                              pipeline.phase === "failed"
                                                ? t("aiReprocess")
                                                : t("aiSyncNow")
                                            }
                                            title={
                                              pipeline.phase === "failed"
                                                ? t("aiReprocess")
                                                : t("aiSyncNow")
                                            }
                                            onClick={() => {
                                              if (
                                                pipeline.phase === "failed" &&
                                                liveSync?.sagDocumentId
                                              ) {
                                                void handleDetailPipelineControl(
                                                  "REPROCESS",
                                                );
                                              } else {
                                                void handleDetailPipelineControl(
                                                  "SYNC",
                                                );
                                              }
                                            }}
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                          >
                                            {isBusy ? (
                                              <UploadProgressArcIcon className="h-3.5 w-3.5 animate-spin" />
                                            ) : pipeline.phase === "failed" ? (
                                              <UploadRetryIcon className="h-3.5 w-3.5" />
                                            ) : (
                                              <UploadIndexSyncIcon className="h-3.5 w-3.5" />
                                            )}
                                          </button>
                                        )}

                                      {pipeline.phase === "processing" && (
                                        <button
                                          type="button"
                                          disabled={isBusy}
                                          aria-label={t("aiPause")}
                                          title={t("aiPause")}
                                          onClick={() => {
                                            void handleDetailPipelineControl(
                                              "PAUSE",
                                            );
                                          }}
                                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 transition hover:bg-gray-50 hover:text-gray-900 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300"
                                        >
                                          {isBusy ? (
                                            <UploadProgressArcIcon className="h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            <UploadPauseIcon className="h-3.5 w-3.5" />
                                          )}
                                        </button>
                                      )}

                                      {pipeline.phase === "paused" && (
                                        <button
                                          type="button"
                                          disabled={
                                            isBusy || Boolean(pipeline.isPausing)
                                          }
                                          aria-label={
                                            pipeline.isPausing
                                              ? t("pipelinePausing")
                                              : t("aiResume")
                                          }
                                          title={
                                            pipeline.isPausing
                                              ? t("pipelinePausing")
                                              : t("aiResume")
                                          }
                                          onClick={() => {
                                            void handleDetailPipelineControl(
                                              "RESUME",
                                            );
                                          }}
                                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200"
                                        >
                                          {isBusy || pipeline.isPausing ? (
                                            <UploadProgressArcIcon className="h-3.5 w-3.5 animate-spin" />
                                          ) : (
                                            <UploadResumeIcon className="h-3.5 w-3.5" />
                                          )}
                                        </button>
                                      )}

                                      {isProjectLeader &&
                                        pipeline.phase === "ready" && (
                                          <button
                                            type="button"
                                            disabled={isBusy}
                                            aria-label={t("aiReprocess")}
                                            title={t("aiReprocess")}
                                            onClick={() => {
                                              void handleDetailPipelineControl(
                                                "REPROCESS",
                                              );
                                            }}
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                                          >
                                            {isBusy ? (
                                              <UploadProgressArcIcon className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                              <UploadRetryIcon className="h-3.5 w-3.5" />
                                            )}
                                          </button>
                                        )}

                                      {isProjectLeader &&
                                        (pipeline.phase === "ready" ||
                                          pipeline.phase === "paused") && (
                                          <button
                                            type="button"
                                            disabled={isBusy}
                                            aria-label={t("aiRevoke")}
                                            title={t("aiRevoke")}
                                            onClick={() =>
                                              setConfirmingRevokeSag(
                                                (prev) => !prev,
                                              )
                                            }
                                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                                          >
                                            <UploadIndexDetachIcon className="h-3.5 w-3.5" />
                                          </button>
                                        )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Progress Bar */}
                              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                                <div
                                  className={`h-full rounded-full ${
                                    pipeline.phase === "processing" &&
                                    (pipeline.percent ?? 0) === 0
                                      ? "transition-none"
                                      : "transition-all duration-300"
                                  } ${
                                    pipeline.phase === "ready"
                                      ? "bg-emerald-500 dark:bg-emerald-400"
                                      : pipeline.phase === "processing"
                                        ? "bg-brand-500 dark:bg-brand-400"
                                        : pipeline.phase === "paused"
                                          ? "bg-amber-500 dark:bg-amber-400"
                                          : pipeline.phase === "failed"
                                            ? "bg-rose-500 dark:bg-rose-400"
                                            : "bg-gray-300 dark:bg-gray-700"
                                  }`}
                                  style={{
                                    width: `${
                                      pipeline.phase === "failed"
                                        ? Math.max(12, pipeline.percent ?? 12)
                                        : Math.max(0, pipeline.percent ?? 0)
                                    }%`,
                                  }}
                                />
                              </div>

                              {/* 4-Stage Stepper */}
                              <div className="grid grid-cols-4 gap-2 pt-0.5">
                                {steps.map((step) => {
                                  const completed =
                                    pipeline.phase === "ready" ||
                                    pipeline.stepIndex > step.idx;
                                  const active =
                                    pipeline.phase !== "ready" &&
                                    pipeline.stepIndex === step.idx;
                                  const failedHere =
                                    pipeline.phase === "failed" &&
                                    pipeline.stepIndex === step.idx;
                                  return (
                                    <div
                                      key={step.idx}
                                      className="flex items-center gap-1.5 text-[11px]"
                                    >
                                      <span
                                        className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                                          failedHere
                                            ? "bg-rose-500"
                                            : completed
                                              ? "bg-emerald-500"
                                              : active
                                                ? "animate-pulse bg-brand-500"
                                                : "bg-gray-300 dark:bg-gray-700"
                                        }`}
                                      />
                                      <span
                                        className={`truncate ${
                                          failedHere
                                            ? "font-medium text-rose-600 dark:text-rose-400"
                                            : completed || active
                                              ? "font-medium text-gray-800 dark:text-gray-200"
                                              : "text-gray-400 dark:text-gray-500"
                                        }`}
                                      >
                                        {step.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>

                              {(pipeline.phase === "failed" ||
                                Boolean(pipelineControlError)) && (
                                <p className="rounded-lg border border-rose-200/80 bg-rose-50/60 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
                                  {pipelineControlError ||
                                    pipeline.errorMessage ||
                                    t("pipelineFailedHint")}
                                </p>
                              )}

                              {confirmingRevokeSag && isProjectLeader && (
                                <div className="flex items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs dark:border-gray-700 dark:bg-gray-800/80">
                                  <span className="font-medium text-gray-700 dark:text-gray-200">
                                    {t("aiRevokeConfirmPrompt")}
                                  </span>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() =>
                                        setConfirmingRevokeSag(false)
                                      }
                                      className="rounded-md px-2 py-1 text-gray-500 hover:bg-gray-200/60 dark:hover:bg-gray-700"
                                    >
                                      {t("cancel")}
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => {
                                        void handleDetailPipelineControl(
                                          "REVOKE",
                                        );
                                      }}
                                      className="rounded-md bg-gray-900 px-2.5 py-1 font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-gray-900"
                                    >
                                      {t("aiRevokeConfirmAction")}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </section>
                    )}

                    {/* 3. Extracted Chunks Inspector (SAG Canonical Content — Replaces Brittle File Preview) */}
                    {!isViewingHistoricalVersion &&
                      (() => {
                        const chunksData = knowledgeChunksQuery.data;
                        const allChunks = chunksData?.items ?? [];
                        const shouldShowSkeleton =
                          detailPipelineForChunks?.phase === "ready" &&
                          knowledgeChunksQuery.isPending;
                        const hasChunks =
                          detailPipelineForChunks?.phase !== "revoked" &&
                          allChunks.length > 0;

                        if (!shouldShowSkeleton && !hasChunks) {
                          return null;
                        }

                        const normalizedQuery = chunkFilter.trim().toLowerCase();
                        const filteredChunks = normalizedQuery
                          ? allChunks.filter(
                              (item) =>
                                item.content
                                  .toLowerCase()
                                  .includes(normalizedQuery) ||
                                item.sectionPath
                                  .toLowerCase()
                                  .includes(normalizedQuery),
                            )
                          : allChunks;
                        const totalChunks =
                          chunksData?.totalChunks ?? allChunks.length;
                        const totalTokens = chunksData?.totalTokens ?? 0;

                        return (
                          <section
                            aria-labelledby="detail-extracted-chunks-heading"
                            className="overflow-hidden rounded-xl border border-gray-200/90 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900/70"
                          >
                            <div className="flex items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/60 px-3.5 py-2.5 dark:border-gray-800 dark:bg-gray-900/80">
                              <div className="flex min-w-0 flex-1 items-center gap-2">
                                <h3
                                  id="detail-extracted-chunks-heading"
                                  className="shrink-0 text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                                >
                                  {t("extractedChunksHeading")}
                                </h3>
                                {totalChunks > 0 && (
                                  <span className="truncate text-xs text-gray-400 tabular-nums dark:text-gray-500">
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

                              {allChunks.length >= 3 && (
                                <div className="relative shrink-0">
                                  <UploadChunkSearchIcon className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
                                  <input
                                    type="search"
                                    value={chunkFilter}
                                    onChange={(event) =>
                                      setChunkFilter(event.target.value)
                                    }
                                    placeholder={t(
                                      "extractedChunksFilterPlaceholder",
                                    )}
                                    aria-label={t(
                                      "extractedChunksFilterPlaceholder",
                                    )}
                                    className={`h-7 w-36 rounded-lg border border-gray-200/90 bg-white ps-7 text-xs text-gray-700 placeholder:text-gray-400 focus:border-brand-400 focus:outline-none sm:w-[9.5rem] dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:placeholder:text-gray-500 ${chunkFilter ? "pe-6" : "pe-2.5"}`}
                                  />
                                  {chunkFilter && (
                                    <button
                                      type="button"
                                      onClick={() => setChunkFilter("")}
                                      aria-label={t(
                                        "extractedChunksFilterClear",
                                      )}
                                      className="absolute end-1.5 top-1/2 inline-flex h-4 w-4 -translate-y-1/2 items-center justify-center rounded text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                                    >
                                      <UploadDismissIcon className="h-3 w-3" />
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
                              <div className="px-3.5 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
                                {t("extractedChunksFilterEmpty", {
                                  query: chunkFilter.trim(),
                                })}
                              </div>
                            ) : (
                              <div className="max-h-64 divide-y divide-gray-100 overflow-y-auto dark:divide-gray-800/80">
                                {filteredChunks.map((chunk) => {
                                  const isExpanded = Boolean(
                                    expandedChunkIds[chunk.chunkId],
                                  );
                                  const isLong =
                                    chunk.content.length > 210 ||
                                    chunk.content.split("\n").length > 3;
                                  const isStructuredMono =
                                    chunk.blockType === "code" ||
                                    chunk.blockType === "table";

                                  return (
                                    <article
                                      key={chunk.chunkId}
                                      className="px-3.5 py-3 transition-colors hover:bg-gray-50/60 dark:hover:bg-gray-800/35"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <div className="flex min-w-0 flex-1 items-center gap-2">
                                          <span className="shrink-0 font-mono text-[11px] font-semibold text-gray-400 tabular-nums dark:text-gray-500">
                                            #{chunk.ordinal}
                                          </span>
                                          <span className="truncate text-xs font-medium text-gray-800 dark:text-gray-200">
                                            {chunk.sectionPath ||
                                              t(
                                                "extractedChunkSectionFallback",
                                                {
                                                  index: chunk.ordinal,
                                                },
                                              )}
                                          </span>
                                          {isStructuredMono && (
                                            <span className="shrink-0 rounded border border-gray-200/90 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 uppercase dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400">
                                              {chunk.blockType}
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex shrink-0 items-center gap-1.5 font-mono text-[11px] text-gray-400 tabular-nums dark:text-gray-500">
                                          {chunk.pageFrom > 0 && (
                                            <span>
                                              {chunk.pageTo > chunk.pageFrom
                                                ? t("extractedChunkPageRange", {
                                                    from: chunk.pageFrom,
                                                    to: chunk.pageTo,
                                                  })
                                                : t(
                                                    "extractedChunkPageSingle",
                                                    {
                                                      page: chunk.pageFrom,
                                                    },
                                                  )}
                                            </span>
                                          )}
                                          {chunk.pageFrom > 0 &&
                                            chunk.tokenCount > 0 && (
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

                                      <p
                                        className={`mt-1.5 break-words text-gray-600 dark:text-gray-300 ${
                                          isStructuredMono
                                            ? "font-mono text-[11px] leading-relaxed"
                                            : "text-xs leading-relaxed"
                                        } ${
                                          !isExpanded && isLong
                                            ? "line-clamp-3"
                                            : "whitespace-pre-wrap"
                                        }`}
                                      >
                                        {chunk.content}
                                      </p>

                                      {isLong && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setExpandedChunkIds((prev) => ({
                                              ...prev,
                                              [chunk.chunkId]: !isExpanded,
                                            }))
                                          }
                                          className="mt-1.5 text-[11px] font-medium text-brand-600 transition hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
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
                      })()}

                    {/* Status Feedback Banners for Author */}
                    {current.status === "CHANGES_REQUESTED" && (
                      <div className="space-y-2 rounded-xl border border-warning-200 bg-warning-50/70 px-4 py-3 text-xs text-warning-900 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200">
                        <p className="font-semibold">
                          {t("changesRequestedBannerTitle")}
                        </p>
                        {current.reviewComment && (
                          <p className="rounded-lg border border-warning-200/80 bg-white/80 px-3 py-2 text-warning-950 dark:border-warning-500/20 dark:bg-gray-950/60 dark:text-warning-100">
                            <span className="font-semibold">
                              {t("reviewComment")}:
                            </span>{" "}
                            {current.reviewComment}
                          </p>
                        )}
                      </div>
                    )}

                    {current.status === "REJECTED" && (
                      <div className="space-y-2 rounded-xl border border-error-200 bg-error-50/70 px-4 py-3 text-xs text-error-900 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-200">
                        <p className="font-semibold">
                          {t("rejectedBannerTitle")}
                        </p>
                        {current.reviewComment && (
                          <p className="rounded-lg border border-error-200/80 bg-white/80 px-3 py-2 text-error-950 dark:border-error-500/20 dark:bg-gray-950/60 dark:text-error-100">
                            <span className="font-semibold">
                              {t("reviewComment")}:
                            </span>{" "}
                            {current.reviewComment}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Uploader Note (only rendered when non-empty) */}
                    {current.description?.trim() && (
                      <section
                        aria-labelledby="detail-description-heading"
                        className="space-y-1.5"
                      >
                        <h3
                          id="detail-description-heading"
                          className="text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                        >
                          {t("uploaderNoteHeading")}
                        </h3>
                        <div className="rounded-xl border border-gray-200/80 bg-gray-50/40 px-4 py-3 text-xs leading-relaxed break-words whitespace-pre-wrap text-gray-700 dark:border-gray-800 dark:bg-gray-900/40 dark:text-gray-300">
                          {current.description}
                        </div>
                      </section>
                    )}

                    {/* Legacy text content fallback (only rendered if legacy document actually has written text and no SAG chunks are displayed) */}
                    {activeContent.trim() &&
                      (isViewingHistoricalVersion ||
                        detailPipelineForChunks?.phase === "revoked" ||
                        (!(
                          detailPipelineForChunks?.phase === "ready" &&
                          knowledgeChunksQuery.isPending
                        ) &&
                          (knowledgeChunksQuery.data?.items.length ?? 0) ===
                            0)) && (
                      <section
                        aria-labelledby="detail-document-content-heading"
                        className="space-y-1.5"
                      >
                        <h3
                          id="detail-document-content-heading"
                          className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                        >
                          <DocsIcon className="h-3.5 w-3.5 text-gray-400" />
                          {t("contentLabel")}
                        </h3>
                        <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-200/90 bg-white p-4 text-sm leading-6 break-words whitespace-pre-wrap text-gray-800 dark:border-gray-800 dark:bg-gray-900/70 dark:text-gray-200">
                          {activeContent}
                        </div>
                      </section>
                    )}

                    {/* Leader Review Panel */}
                    {current.permissions.canReview &&
                      !isViewingHistoricalVersion && (
                        <section
                          aria-labelledby="leader-review-panel-heading"
                          className="space-y-3 rounded-xl border border-gray-200 bg-gray-50/70 p-4 dark:border-gray-800 dark:bg-gray-800/40"
                        >
                          <div>
                            <h3
                              id="leader-review-panel-heading"
                              className="text-sm font-semibold text-gray-900 dark:text-white/90"
                            >
                              {t("leaderReviewPanelTitle")}
                            </h3>
                            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                              {t("reviewCommentHint")}
                            </p>
                          </div>
                          <textarea
                            aria-label={t("reviewComment")}
                            value={reviewComment}
                            onChange={(event) => {
                              setReviewComment(event.target.value);
                              setValidationError("");
                            }}
                            placeholder={t("reviewCommentPlaceholder")}
                            rows={2}
                            maxLength={5000}
                            className={`${FIELD_CLASS} resize-y bg-white text-xs dark:bg-gray-950`}
                          />
                          <div className="flex items-center justify-end">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 !py-0 px-3 text-xs"
                              disabled={!reviewComment.trim() || action.isPending}
                              isLoading={action.isPending}
                              onClick={() => void runAction("comment")}
                            >
                              {t("sendComment")}
                            </Button>
                          </div>
                        </section>
                      )}
                  </div>

                  {/* Right Column (~40%): Version History & Review Timeline */}
                  <aside className="space-y-4 lg:col-span-5">
                    <section
                      aria-labelledby="detail-version-history-heading"
                      className="rounded-xl border border-gray-200/90 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/60"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3
                          id="detail-version-history-heading"
                          className="text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                        >
                          {t("history")}
                        </h3>
                        <span className="inline-flex rounded-md bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600 tabular-nums dark:bg-gray-800 dark:text-gray-300">
                          {current.versions.length}
                        </span>
                      </div>
                      <ol className="mt-3 space-y-2">
                        {sortedVersions.map((version) => {
                          const isSelected =
                            (viewedVersion?.version ?? current.version) ===
                            version.version;
                          const lifecycleLabel =
                            version.version === latestApprovedVersion
                              ? t("latestApprovedVersion")
                              : version.version === current.version &&
                                  version.status === "DRAFT"
                                ? t("currentDraftVersion")
                                : version.version === current.version &&
                                    version.status === "PENDING_REVIEW"
                                  ? t("currentPendingVersion")
                                  : version.version === current.version
                                    ? t("currentVersionBadge")
                                    : version.status === "APPROVED"
                                      ? t("supersededApprovedVersion")
                                      : t("previousVersionBadge");
                          return (
                            <li key={version.version}>
                              <div
                                className={`rounded-xl border p-3 transition-colors ${
                                  isSelected
                                    ? "border-brand-300 bg-brand-50/40 dark:border-brand-500/40 dark:bg-brand-500/10"
                                    : "border-gray-100 bg-gray-50/40 hover:border-gray-200 dark:border-gray-800 dark:bg-gray-950/40"
                                }`}
                              >
                                <button
                                  type="button"
                                  aria-pressed={isSelected}
                                  onClick={() => {
                                    setChunkFilter("");
                                    setExpandedChunkIds({});
                                    setSelectedVersionNumber(
                                      version.version === current.version
                                        ? null
                                        : version.version,
                                    );
                                  }}
                                  className="w-full text-start focus-visible:outline-2 focus-visible:outline-brand-500"
                                >
                                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <span className="font-semibold text-gray-900 dark:text-white/90">
                                      v{version.version} ·{" "}
                                      {t(`status.${version.status}`)}
                                    </span>
                                    <time className="text-gray-500 tabular-nums dark:text-gray-400">
                                      {format.dateTime(
                                        new Date(version.createdAt),
                                        {
                                          dateStyle: "medium",
                                          timeZone: "UTC",
                                        },
                                      )}
                                    </time>
                                  </div>
                                  <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500 dark:text-gray-400">
                                    <span>{lifecycleLabel}</span>
                                    <span>
                                      {resolveActorLabel(
                                        version.editedBy,
                                        "author",
                                      )}
                                    </span>
                                  </div>
                                </button>
                                {version.file &&
                                  version.version !== current.version && (
                                    <div className="mt-2 border-t border-gray-200/70 pt-2 dark:border-gray-800">
                                      <a
                                        aria-label={t("downloadVersion", {
                                          version: version.version,
                                          name: version.file.name,
                                        })}
                                        title={t("downloadVersion", {
                                          version: version.version,
                                          name: version.file.name,
                                        })}
                                        className="inline-flex max-w-full items-center gap-1.5 text-xs font-medium text-gray-600 transition hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200"
                                        href={`/api/backend/capture/projects/${encodeURIComponent(projectId)}/documents/${encodeURIComponent(current.id)}/file?version=${version.version}`}
                                      >
                                        <UploadFileDownloadIcon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                                        <span className="truncate">
                                          {version.file.name}
                                        </span>
                                      </a>
                                    </div>
                                  )}
                              </div>
                            </li>
                          );
                        })}
                      </ol>
                    </section>

                    <section
                      aria-labelledby="detail-review-activity-heading"
                      className="rounded-xl border border-gray-200/90 bg-white p-4 dark:border-gray-800 dark:bg-gray-900/60"
                    >
                      <h3
                        id="detail-review-activity-heading"
                        className="text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-gray-400"
                      >
                        {t("activityHeading")}
                      </h3>
                      {(() => {
                        const timelineEvents: readonly DocumentActivityEvent[] =
                          current.activityHistory &&
                          current.activityHistory.length > 0
                            ? current.activityHistory
                            : [
                                {
                                  id: `fallback-created-${current.id}`,
                                  action: "CREATED" as const,
                                  actorId: current.createdBy,
                                  version: current.versions[0]?.version ?? 1,
                                  at:
                                    current.versions[0]?.createdAt ||
                                    current.createdAt,
                                },
                                ...(current.file
                                  ? [
                                      {
                                        id: `fallback-file-${current.id}`,
                                        action: "FILE_UPLOADED" as const,
                                        actorId: current.createdBy,
                                        version: current.version,
                                        fileName: current.file.name,
                                        at: current.createdAt,
                                      },
                                    ]
                                  : []),
                                ...(current.submittedAt &&
                                !current.reviewHistory.some(
                                  (e) =>
                                    e.action === "PENDING_REVIEW" && !e.comment,
                                )
                                  ? [
                                      {
                                        id: `fallback-submit-${current.id}`,
                                        action: "SUBMITTED" as const,
                                        actorId: current.createdBy,
                                        version: current.version,
                                        at: current.submittedAt,
                                      },
                                    ]
                                  : []),
                                ...current.reviewHistory.map((ev, idx) => ({
                                  id: `fallback-rh-${idx}-${ev.at}`,
                                  action: (ev.action === "PENDING_REVIEW"
                                    ? "COMMENTED"
                                    : ev.action) as DocumentActivityAction,
                                  actorId: ev.reviewerId,
                                  version: current.version,
                                  ...(ev.comment ? { comment: ev.comment } : {}),
                                  at: ev.at,
                                })),
                              ];

                        const labelForAction = (
                          act: DocumentActivityAction,
                        ): string => {
                          switch (act) {
                            case "CREATED":
                              return t("activityCreated");
                            case "UPDATED":
                              return t("activityUpdated");
                            case "FILE_UPLOADED":
                              return t("activityFileUploaded");
                            case "SUBMITTED":
                              return t("activitySubmitted");
                            case "COMMENTED":
                              return t("activityCommented");
                            case "APPROVED":
                              return t("activityApproved");
                            case "AUTO_APPROVED":
                              return t("activityAutoApproved");
                            case "CHANGES_REQUESTED":
                              return t("activityChangesRequested");
                            case "REJECTED":
                              return t("activityRejected");
                            case "ARCHIVED":
                              return t("activityArchived");
                            case "KNOWLEDGE_SYNCED":
                              return t("activityKnowledgeSynced");
                            case "KNOWLEDGE_REPROCESSED":
                              return t("activityKnowledgeReprocessed");
                            case "KNOWLEDGE_PAUSED":
                              return t("activityKnowledgePaused");
                            case "KNOWLEDGE_RESUMED":
                              return t("activityKnowledgeResumed");
                            case "KNOWLEDGE_REVOKED":
                              return t("activityKnowledgeRevoked");
                          }
                        };

                        const styleForAction = (act: DocumentActivityAction) => {
                          switch (act) {
                            case "APPROVED":
                            case "AUTO_APPROVED":
                              return {
                                ring: "bg-success-100 text-success-700 dark:bg-success-500/20 dark:text-success-300",
                                role: "reviewer" as const,
                                icon: (
                                  <CheckLineIcon className="h-3.5 w-3.5 shrink-0" />
                                ),
                              };
                            case "KNOWLEDGE_SYNCED":
                              return {
                                ring: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
                                role: "reviewer" as const,
                                icon: (
                                  <UploadIndexReadyIcon className="h-3.5 w-3.5 shrink-0" />
                                ),
                              };
                            case "KNOWLEDGE_REPROCESSED":
                              return {
                                ring: "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300",
                                role: "reviewer" as const,
                                icon: (
                                  <UploadRetryIcon className="h-3.5 w-3.5 shrink-0" />
                                ),
                              };
                            case "KNOWLEDGE_RESUMED":
                              return {
                                ring: "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300",
                                role: "reviewer" as const,
                                icon: (
                                  <UploadResumeIcon className="h-3.5 w-3.5 shrink-0" />
                                ),
                              };
                            case "KNOWLEDGE_PAUSED":
                              return {
                                ring: "bg-warning-100 text-warning-800 dark:bg-warning-500/20 dark:text-warning-300",
                                role: "reviewer" as const,
                                icon: (
                                  <UploadPauseIcon className="h-3.5 w-3.5 shrink-0" />
                                ),
                              };
                            case "KNOWLEDGE_REVOKED":
                              return {
                                ring: "bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
                                role: "reviewer" as const,
                                icon: (
                                  <UploadIndexDetachIcon className="h-3.5 w-3.5 shrink-0" />
                                ),
                              };
                            case "CHANGES_REQUESTED":
                              return {
                                ring: "bg-warning-100 text-warning-800 dark:bg-warning-500/20 dark:text-warning-300",
                                role: "reviewer" as const,
                                icon: (
                                  <InfoIcon className="h-3.5 w-3.5 shrink-0" />
                                ),
                              };
                            case "REJECTED":
                              return {
                                ring: "bg-error-100 text-error-700 dark:bg-error-500/20 dark:text-error-300",
                                role: "reviewer" as const,
                                icon: (
                                  <InfoIcon className="h-3.5 w-3.5 shrink-0" />
                                ),
                              };
                            case "ARCHIVED":
                              return {
                                ring: "bg-gray-200 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
                                role: "reviewer" as const,
                                icon: (
                                  <TrashBinIcon className="h-3.5 w-3.5 shrink-0" />
                                ),
                              };
                            case "COMMENTED":
                              return {
                                ring: "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300",
                                role: "reviewer" as const,
                                icon: (
                                  <ChatIcon className="h-3.5 w-3.5 shrink-0" />
                                ),
                              };
                            case "SUBMITTED":
                              return {
                                ring: "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300",
                                role: "author" as const,
                                icon: (
                                  <PaperPlaneIcon className="h-3.5 w-3.5 shrink-0" />
                                ),
                              };
                            case "FILE_UPLOADED":
                              return {
                                ring: "bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300",
                                role: "author" as const,
                                icon: (
                                  <UploadDropzoneIcon className="h-3.5 w-3.5 shrink-0" />
                                ),
                              };
                            case "CREATED":
                            case "UPDATED":
                            default:
                              return {
                                ring: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
                                role: "author" as const,
                                icon: (
                                  <DocsIcon className="h-3.5 w-3.5 shrink-0" />
                                ),
                              };
                          }
                        };

                        return timelineEvents.length > 0 ? (
                          <ol className="mt-3 max-h-80 overflow-y-auto pr-1">
                            {timelineEvents.map((event, idx) => {
                              const meta = styleForAction(event.action);
                              const isLast = idx === timelineEvents.length - 1;
                              return (
                                <li
                                  key={event.id}
                                  className="flex gap-3 text-xs"
                                >
                                  <div className="flex shrink-0 flex-col items-center">
                                    <span
                                      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${meta.ring}`}
                                    >
                                      {meta.icon}
                                    </span>
                                    {!isLast && (
                                      <span
                                        aria-hidden="true"
                                        className="my-1 w-px flex-1 bg-gray-200 dark:bg-gray-700/80"
                                      />
                                    )}
                                  </div>
                                  <div
                                    className={`min-w-0 flex-1 pt-0.5 ${isLast ? "pb-0.5" : "pb-3.5"}`}
                                  >
                                    <div className="flex flex-wrap items-center gap-1.5 leading-5">
                                      <span className="font-semibold text-gray-900 dark:text-white/90">
                                        {labelForAction(event.action)}
                                      </span>
                                      {typeof event.version === "number" && (
                                        <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] leading-none font-medium text-gray-600 tabular-nums dark:bg-gray-800 dark:text-gray-300">
                                          v{event.version}
                                        </span>
                                      )}
                                    </div>
                                    <p className="mt-0.5 leading-4 text-gray-500 dark:text-gray-400">
                                      {t("activityByActor", {
                                        actor: resolveActorLabel(
                                          event.actorId,
                                          meta.role,
                                        ),
                                      })}
                                    </p>
                                    <time className="mt-0.5 block text-[11px] leading-4 text-gray-400 tabular-nums dark:text-gray-500">
                                      {format.dateTime(new Date(event.at), {
                                        dateStyle: "medium",
                                        timeStyle: "short",
                                        timeZone: "UTC",
                                      })}
                                    </time>
                                    {event.fileName && (
                                      <div className="mt-1.5 inline-flex max-w-full items-center gap-1.5 rounded-md border border-gray-200/80 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-300">
                                        <span className="truncate">
                                          {event.fileName}
                                        </span>
                                        {event.deduplicated && (
                                          <span
                                            title={t("aiDeduplicatedTooltip")}
                                            className="shrink-0 text-gray-400"
                                          >
                                            <UploadDedupeIcon className="h-3 w-3" />
                                          </span>
                                        )}
                                      </div>
                                    )}
                                    {event.comment && (
                                      <div className="mt-1.5 rounded-lg border border-gray-100 bg-gray-50/90 px-3 py-2 text-xs break-words whitespace-pre-wrap text-gray-700 dark:border-gray-800 dark:bg-gray-950 dark:text-gray-200">
                                        {event.comment}
                                      </div>
                                    )}
                                  </div>
                                </li>
                              );
                            })}
                          </ol>
                        ) : (
                          <p className="mt-2 rounded-lg border border-dashed border-gray-200 px-3 py-2.5 text-xs text-gray-500 dark:border-gray-800 dark:text-gray-400">
                            {t("noReviewActivity")}
                          </p>
                        );
                      })()}
                    </section>
                  </aside>
                </div>
              </div>

              {/* Detail Modal Aligned Sticky Footer */}
              <div className="shrink-0 border-t border-gray-100 bg-gray-50/80 px-5 py-3.5 sm:px-6 dark:border-gray-800 dark:bg-gray-900/90">
                {confirmingDelete ? (
                  <div
                    role="alertdialog"
                    aria-label={t("deleteConfirmTitle")}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-error-700 dark:text-error-300">
                        {t("deleteConfirmTitle")}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        {deleteError || t("deleteConfirmDescription")}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 !py-0 px-3.5 text-xs"
                        disabled={deleteDocumentMutation.isPending}
                        onClick={() => {
                          setConfirmingDelete(false);
                          setDeleteError("");
                        }}
                      >
                        {t("cancel")}
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        className="h-9 !py-0 px-3.5 text-xs"
                        isLoading={deleteDocumentMutation.isPending}
                        onClick={() => void handleConfirmPermanentDelete()}
                      >
                        {t("confirmDeletePermanently")}
                      </Button>
                    </div>
                  </div>
                ) : confirmingArchive ? (
                  <div
                    role="alertdialog"
                    aria-label={t("archiveConfirmTitle")}
                    className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-gray-900 dark:text-white/90">
                        {t("archiveConfirmTitle")}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        {t("archiveConfirmDescription")}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-9 !py-0 px-3.5 text-xs"
                        onClick={() => setConfirmingArchive(false)}
                      >
                        {t("cancel")}
                      </Button>
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        className="h-9 !py-0 px-3.5 text-xs"
                        isLoading={action.isPending}
                        onClick={() => void runAction("archive")}
                      >
                        {t("confirmArchive")}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="relative flex flex-wrap items-center gap-2.5">
                      {(canArchiveDocument ||
                        canDeleteDocument ||
                        Boolean(
                          isProjectLeader &&
                            current.status === "APPROVED" &&
                            detailPipelineForChunks &&
                            (detailPipelineForChunks.phase === "ready" ||
                              detailPipelineForChunks.phase === "paused" ||
                              detailPipelineForChunks.phase === "processing"),
                        )) && (
                        <button
                          type="button"
                          onClick={() => openRemovalModal(current)}
                          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 shadow-theme-xs transition hover:border-rose-200 hover:bg-rose-50/70 hover:text-rose-700 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:border-rose-500/40 dark:hover:bg-rose-500/10 dark:hover:text-rose-300"
                        >
                          <TrashBinIcon className="h-3.5 w-3.5" />
                          <span>{t("removeLifecycleAction")}</span>
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      {current.permissions.canEdit &&
                        !isViewingHistoricalVersion &&
                        process.env
                          .NEXT_PUBLIC_WORKNOTE_SHARED_EDITOR_ENABLED ===
                          "true" && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 !py-0 px-3.5 text-xs"
                            onClick={() => {
                              setAgentSource({
                                workflow: "PROJECT_DOCUMENT",
                                resourceId: current.id,
                              });
                              closeDetailModal();
                            }}
                          >
                            {common("agent.openEditor")}
                          </Button>
                        )}
                      {current.permissions.canEdit &&
                        !isViewingHistoricalVersion && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 !py-0 px-3.5 text-xs"
                            onClick={() => {
                              setReplacementFile(null);
                              setReplacementNote(current.description ?? "");
                              setReplacementError("");
                              setIsReplacingVersion(true);
                            }}
                          >
                            {t("uploadNewVersionCta")}
                          </Button>
                        )}

                      {current.permissions.canSubmit && (
                        <Button
                          type="button"
                          size="sm"
                          className="h-9 !py-0 px-3.5 text-xs"
                          isLoading={action.isPending}
                          onClick={() => void runAction("submit")}
                        >
                          {t("submit")}
                        </Button>
                      )}

                      {current.permissions.canReview &&
                        !isViewingHistoricalVersion && (
                          <>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 !py-0 px-3.5 text-xs text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
                              isLoading={action.isPending}
                              onClick={() => void runAction("reject")}
                            >
                              {t("reject")}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-9 !py-0 px-3.5 text-xs"
                              isLoading={action.isPending}
                              onClick={() => void runAction("request-changes")}
                            >
                              {t("requestChanges")}
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              className="h-9 !py-0 px-4 text-xs"
                              isLoading={action.isPending}
                              onClick={() => void runAction("approve")}
                            >
                              {t("quickApproveAction")}
                            </Button>
                          </>
                        )}

                      {!current.permissions.canReview &&
                        !current.permissions.canSubmit && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-9 !py-0 px-3.5 text-xs"
                            onClick={closeDetailModal}
                          >
                            {t("close")}
                          </Button>
                        )}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </Modal>

      {/* =====================================================================
          3-TIER DOCUMENT & CLOUDFLARE R2 REMOVAL MODAL (WITH REF-COUNT SAFETY)
          ===================================================================== */}
      <Modal
        isOpen={Boolean(removalTarget)}
        onClose={closeRemovalModal}
        onBackdropClick={closeRemovalModal}
        backdropClassName="bg-gray-900/45 backdrop-blur-[2px] dark:bg-gray-950/70"
        showCloseButton={false}
        className="mx-3 max-w-xl overflow-hidden rounded-xl border border-gray-200 shadow-theme-lg dark:border-gray-800"
      >
        {removalTarget
          ? (() => {
              const targetDoc =
                current && current.id === removalTarget.id
                  ? current
                  : removalTarget;
              const targetDisplayName =
                targetDoc.file?.name || targetDoc.title;
              const targetLiveSync =
                current && current.id === targetDoc.id
                  ? detailLiveSync
                  : targetDoc.knowledgeSync;
              const targetPipeline = resolvePipelineDisplay(
                targetDoc.status,
                targetLiveSync,
              );
              const targetStorageRef = targetDoc.storageReference;
              const targetIsOwner = Boolean(
                cachedCurrentUser?.id &&
                  cachedCurrentUser.id.toLowerCase() ===
                    targetDoc.createdBy.toLowerCase(),
              );
              const tier1Enabled = Boolean(
                isProjectLeader &&
                  targetDoc.status === "APPROVED" &&
                  (targetPipeline.phase === "ready" ||
                    targetPipeline.phase === "paused" ||
                    targetPipeline.phase === "processing"),
              );
              const targetHasApprovedVersion =
                targetDoc.status === "APPROVED" ||
                ("versions" in targetDoc &&
                  Array.isArray(targetDoc.versions) &&
                  targetDoc.versions.some((v) => v.status === "APPROVED"));
              const tier2Enabled = Boolean(
                (targetDoc.permissions.canConfigure ||
                  targetDoc.permissions.canReview ||
                  isProjectLeader) &&
                  targetDoc.status !== "ARCHIVED" &&
                  targetHasApprovedVersion,
              );
              const tier3Enabled = Boolean(
                targetDoc.permissions.canDelete ||
                  isProjectLeader ||
                  (targetIsOwner &&
                    targetDoc.status !== "APPROVED" &&
                    targetDoc.status !== "ARCHIVED"),
              );

              const hasStoredObjects = Boolean(
                targetDoc.file ||
                  (targetStorageRef && targetStorageRef.objectCount > 0),
              );
              const isSharedOnly = Boolean(
                targetStorageRef &&
                  targetStorageRef.sharedObjectCount > 0 &&
                  targetStorageRef.deletableObjectCount === 0,
              );
              const isMixedRefs = Boolean(
                targetStorageRef &&
                  targetStorageRef.sharedObjectCount > 0 &&
                  targetStorageRef.deletableObjectCount > 0,
              );

              return (
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="three-tier-removal-dialog-title"
                  className="flex max-h-[min(88vh,48rem)] flex-col overflow-hidden bg-white dark:bg-gray-900"
                >
                  {/* Header */}
                  <div className="flex shrink-0 items-start justify-between gap-4 border-b border-gray-100 px-6 pt-5 pb-4 dark:border-gray-800">
                    <div className="min-w-0">
                      <h2
                        id="three-tier-removal-dialog-title"
                        className="text-base font-semibold tracking-tight text-gray-900 dark:text-white/95"
                      >
                        {t("removeModalTitle")}
                      </h2>
                      <p className="mt-1 truncate text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                        {t("removeModalSubtitle", { name: targetDisplayName })}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={removalBusyTier !== null}
                      onClick={closeRemovalModal}
                      aria-label={t("close")}
                      title={t("close")}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-gray-400 transition hover:bg-gray-100 hover:text-gray-800 disabled:opacity-50 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-200"
                    >
                      <UploadDismissIcon className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Body */}
                  <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-6 py-5">
                    {/* Cloudflare R2 Reference-Count Inspection Card */}
                    <div
                      className={`rounded-xl border p-3.5 text-xs ${
                        !hasStoredObjects
                          ? "border-gray-200 bg-gray-50/70 text-gray-600 dark:border-gray-800 dark:bg-gray-800/40 dark:text-gray-300"
                          : isSharedOnly
                            ? "border-amber-200/90 bg-amber-50/60 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
                            : "border-gray-200/90 bg-gray-50/80 text-gray-800 dark:border-gray-800 dark:bg-gray-800/50 dark:text-gray-200"
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-current/15 bg-white/80 dark:bg-gray-900/70">
                          {isSharedOnly || isMixedRefs ? (
                            <UploadDedupeIcon className="h-3.5 w-3.5" />
                          ) : (
                            <InfoIcon className="h-3.5 w-3.5" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1 space-y-1">
                          {!hasStoredObjects ? (
                            <p className="font-medium">
                              {t("r2RefStatusNoFile")}
                            </p>
                          ) : isSharedOnly && targetStorageRef ? (
                            <>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-semibold">
                                  {t("r2RefStatusSharedTitle", {
                                    refs: targetStorageRef.refCount,
                                  })}
                                </p>
                                {targetStorageRef.sha256 && (
                                  <span className="font-mono text-[11px] opacity-75">
                                    SHA-256{" "}
                                    {targetStorageRef.sha256.slice(0, 8)}
                                  </span>
                                )}
                              </div>
                              <p className="leading-relaxed opacity-90">
                                {t("r2RefStatusSharedDesc", {
                                  external:
                                    targetStorageRef.externalDocumentRefs,
                                })}
                              </p>
                            </>
                          ) : isMixedRefs && targetStorageRef ? (
                            <>
                              <p className="font-semibold">
                                {t("r2RefStatusMixedTitle", {
                                  refs: targetStorageRef.refCount,
                                })}
                              </p>
                              <p className="leading-relaxed opacity-90">
                                {t("r2RefStatusMixedDesc", {
                                  deletable:
                                    targetStorageRef.deletableObjectCount,
                                  shared: targetStorageRef.sharedObjectCount,
                                })}
                              </p>
                            </>
                          ) : (
                            <>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="font-semibold">
                                  {t("r2RefStatusUniqueTitle")}
                                </p>
                                {(targetStorageRef?.sha256 ??
                                  targetLiveSync?.fileHash) && (
                                  <span className="font-mono text-[11px] text-gray-500 dark:text-gray-400">
                                    SHA-256{" "}
                                    {(
                                      targetStorageRef?.sha256 ??
                                      targetLiveSync?.fileHash ??
                                      ""
                                    ).slice(0, 8)}
                                  </span>
                                )}
                              </div>
                              <p className="leading-relaxed text-gray-600 dark:text-gray-300">
                                {t("r2RefStatusUniqueDesc", {
                                  count:
                                    targetStorageRef?.deletableObjectCount ?? 1,
                                })}
                              </p>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {Boolean(removalModalError) && (
                      <div
                        role="alert"
                        className="flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50/80 px-3.5 py-2.5 text-xs text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                      >
                        <AlertIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{removalModalError}</span>
                      </div>
                    )}

                    {/* Tier 1: Remove from AI Search (SAG Only) */}
                    {tier1Enabled && (
                      <div className="rounded-xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-gray-700">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-900 dark:text-white/95">
                                <UploadIndexDetachIcon className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                                {t("tier1Title")}
                              </span>
                              <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                {t("tier1Badge")}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                              {t("tier1Desc")}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 shrink-0 !py-0 px-3 text-xs"
                            disabled={
                              removalBusyTier !== null && removalBusyTier !== 1
                            }
                            isLoading={removalBusyTier === 1}
                            onClick={() => void executeRemovalTier(1)}
                          >
                            {t("tier1Cta")}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Tier 2: Governance Archive */}
                    {tier2Enabled && (
                      <div className="rounded-xl border border-gray-200 bg-white p-4 transition hover:border-gray-300 dark:border-gray-800 dark:bg-gray-900/60 dark:hover:border-gray-700">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-900 dark:text-white/95">
                                <DocsIcon className="h-3.5 w-3.5 text-gray-500 dark:text-gray-400" />
                                {t("tier2Title")}
                              </span>
                              <span className="rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
                                {t("tier2Badge")}
                              </span>
                            </div>
                            <p className="text-xs leading-relaxed text-gray-500 dark:text-gray-400">
                              {t("tier2Desc")}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 shrink-0 !py-0 px-3 text-xs"
                            disabled={
                              removalBusyTier !== null && removalBusyTier !== 2
                            }
                            isLoading={removalBusyTier === 2}
                            onClick={() => void executeRemovalTier(2)}
                          >
                            {t("tier2Cta")}
                          </Button>
                        </div>
                      </div>
                    )}

                    {/* Tier 3: Permanent Delete (DB + SAG + Ref-Counted Cloudflare R2) */}
                    {tier3Enabled && (
                      <div className="rounded-xl border border-rose-200/90 bg-rose-50/35 p-4 dark:border-rose-500/30 dark:bg-rose-500/5">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-300">
                                <TrashBinIcon className="h-3.5 w-3.5" />
                                {t("tier3Title")}
                              </span>
                              {hasStoredObjects && (
                                <span
                                  className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${
                                    isSharedOnly
                                      ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300"
                                      : "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300"
                                  }`}
                                >
                                  {isSharedOnly
                                    ? t("tier3BadgeRetainSharedR2")
                                    : t("tier3BadgeDeleteR2")}
                                </span>
                              )}
                            </div>
                            <p className="text-xs leading-relaxed text-gray-600 dark:text-gray-300">
                              {t("tier3Desc")}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="danger"
                            size="sm"
                            className="h-8 shrink-0 !py-0 px-3.5 text-xs"
                            disabled={
                              removalBusyTier !== null && removalBusyTier !== 3
                            }
                            isLoading={removalBusyTier === 3}
                            onClick={() => void executeRemovalTier(3)}
                          >
                            {t("tier3Cta")}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="flex shrink-0 items-center justify-end border-t border-gray-100 bg-gray-50/70 px-6 py-3.5 dark:border-gray-800 dark:bg-gray-900/90">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 !py-0 px-3.5 text-xs"
                      disabled={removalBusyTier !== null}
                      onClick={closeRemovalModal}
                    >
                      {t("cancel")}
                    </Button>
                  </div>
                </div>
              );
            })()
          : null}
      </Modal>
      {agentSource && (
        <WorkNoteComposer
          projectId={projectId}
          source={agentSource}
          onClose={() => setAgentSource(null)}
          onSaved={() => setAgentSource(null)}
        />
      )}
    </main>
  );
}
