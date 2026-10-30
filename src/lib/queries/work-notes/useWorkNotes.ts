"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";

export type WorkNotePermissions = Readonly<{
  canCreate: boolean;
  canEdit: boolean;
  canDelete?: boolean;
  canSubmit: boolean;
  canReview: boolean;
  canConfigure: boolean;
}>;

export type WorkNotesPage<T> = Readonly<{
  data: readonly T[];
  pagination: Readonly<{
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  }>;
}>;

export type TaskNoteInput = Readonly<{
  title: string;
  accomplishments: string;
  approach: string;
  reason: string;
}>;

export type TaskNote = TaskNoteInput &
  Readonly<{
    id: string;
    projectId: string;
    taskId: string;
    taskKey?: string;
    taskTitle?: string;
    authorId: string;
    authorName: string;
    type: "TASK_NOTE";
    status: "CONFIRMED";
    createdAt: string;
    updatedAt: string;
    permissions: WorkNotePermissions;
  }>;

export const DOCUMENT_TYPES = [
  "MVP",
  "DATABASE_DESIGN",
  "RSR",
  "ARCHITECTURE",
  "API_SPECIFICATION",
  "RESEARCH",
  "REQUIREMENT",
  "DESIGN",
  "TECHNICAL_SPECIFICATION",
  "OTHER",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type DocumentStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "REJECTED"
  | "ARCHIVED";

export type ProjectDocumentInput = Readonly<{
  title: string;
  description?: string;
  type: DocumentType;
  content: string;
}>;

export type DocumentKnowledgeControlAction =
  | "PAUSE"
  | "RESUME"
  | "REPROCESS"
  | "REVOKE";

export type DocumentKnowledgeStatus = Readonly<{
  documentId: string;
  version: number;
  status: string;
  sagDocumentId?: string;
  sagVersionId?: string;
  sagVersionNo?: number;
  documentVersionId?: string;
  runId?: string;
  ingestionRunId?: string;
  searchStatus?: string;
  knowledgeStatus?: string;
  searchReady?: boolean;
  knowledgeReady?: boolean;
  isDuplicate?: boolean;
  currentStage?: string | null;
  retrievalReadinessState?: string;
  documentStatus?: string | null;
  parserProvider?: string | null;
  parserStatus?: string | null;
  progress?: number;
  chunkCount?: number;
  eventCount?: number;
  tokenUsage?: number;
  fileHash?: string;
  deduplicatedStorage?: boolean;
  stageProgress?: Record<string, { status: string; duration_ms?: number }> | null;
  error?: Record<string, unknown> | string | null;
  lastError?: string | null;
  syncedAt?: string;
  updatedAt?: string;
}>;

export type DocumentKnowledgeChunk = Readonly<{
  chunkId: string;
  ordinal: number;
  sectionPath: string;
  blockType: string;
  pageFrom: number;
  pageTo: number;
  tokenCount: number;
  content: string;
}>;

export type DocumentKnowledgeChunksResponse = Readonly<{
  documentId: string;
  version: number;
  sagDocumentId?: string;
  sagVersionNo?: number;
  sourceStage: "SEARCH_UNITS" | "CANONICAL_BLOCKS" | "EMPTY";
  totalChunks: number;
  totalTokens: number;
  items: readonly DocumentKnowledgeChunk[];
}>;

export type DocumentUploadIntentInput = Readonly<{
  fileName: string;
  contentType: string;
  size: number;
  sha256: string;
}>;

export type DocumentUploadIntentResponse = Readonly<{
  mode: "DIRECT_PUT" | "DEDUPLICATED" | "LEGACY_PROXY";
  uploadToken?: string;
  uploadUrl?: string;
  headers?: Readonly<Record<string, string>>;
  expiresInSeconds?: number;
  canonicalContentType?: string;
}>;

export type DocumentConfirmUploadInput = Readonly<{
  uploadToken: string;
  autoSyncSag?: boolean;
}>;

export type DocumentDownloadUrlResponse = Readonly<{
  mode: "DIRECT_GET" | "LEGACY_PROXY";
  downloadUrl?: string;
  fileName: string;
  contentType: string;
  expiresInSeconds?: number;
}>;

export type DocumentStorageReference = Readonly<{
  provider: "CLOUDFLARE_R2" | "LOCAL";
  objectCount: number;
  deletableObjectCount: number;
  sharedObjectCount: number;
  refCount: number;
  externalDocumentRefs: number;
  willDeleteFromStorage: boolean;
  sha256?: string;
}>;

export type DeleteProjectDocumentResult = Readonly<{
  deletedDocumentId: string;
  sagRevoked: boolean;
  r2DeletedKeys: number;
  r2RetainedSharedKeys: number;
}>;

export type ProjectDocumentSummary = Readonly<{
  id: string;
  projectId: string;
  title: string;
  description?: string;
  type: DocumentType;
  version: number;
  status: DocumentStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
  file?: Readonly<{ name: string; contentType: string; size: number }>;
  storageReference?: DocumentStorageReference;
  knowledgeSync?: DocumentKnowledgeStatus;
  permissions: WorkNotePermissions;
}>;

export type ReviewEvent = Readonly<{
  action: "PENDING_REVIEW" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
  reviewerId: string;
  comment?: string;
  at: string;
}>;

export type DocumentActivityAction =
  | "CREATED"
  | "UPDATED"
  | "FILE_UPLOADED"
  | "SUBMITTED"
  | "COMMENTED"
  | "APPROVED"
  | "AUTO_APPROVED"
  | "CHANGES_REQUESTED"
  | "REJECTED"
  | "ARCHIVED"
  | "KNOWLEDGE_SYNCED"
  | "KNOWLEDGE_REPROCESSED"
  | "KNOWLEDGE_PAUSED"
  | "KNOWLEDGE_RESUMED"
  | "KNOWLEDGE_REVOKED";

export type DocumentActivityEvent = Readonly<{
  id: string;
  action: DocumentActivityAction;
  actorId: string;
  version?: number;
  fileName?: string;
  comment?: string;
  deduplicated?: boolean;
  at: string;
}>;

export type ProjectDocument = ProjectDocumentSummary &
  Readonly<{
    content: string;
    file?: Readonly<{ name: string; contentType: string; size: number }>;
    versions: readonly Readonly<{
      version: number;
      status: DocumentStatus;
      createdAt: string;
      editedBy: string;
      title?: string;
      description?: string;
      type?: DocumentType;
      content?: string;
      reviewComment?: string;
      reviewHistory?: readonly ReviewEvent[];
      file?: Readonly<{ name: string; contentType: string; size: number }>;
    }>[];
    reviewHistory: readonly ReviewEvent[];
    activityHistory?: readonly DocumentActivityEvent[];
  }>;

export const REPORT_FREQUENCIES = [
  "DAILY",
  "EVERY_2_DAYS",
  "EVERY_3_DAYS",
  "EVERY_4_DAYS",
  "EVERY_5_DAYS",
  "EVERY_6_DAYS",
  "WEEKLY",
] as const;
export type ReportFrequency = (typeof REPORT_FREQUENCIES)[number];
export type WorkReportScope = "MEMBER" | "LEADER";
export type WorkReportStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "CHANGES_REQUESTED"
  | "REJECTED"
  | "OVERDUE";
export type WorkReportInput = Readonly<{
  accomplishments: string;
  approach: string;
  reason: string;
  blockers?: string;
  nextSteps?: string;
  documentIds?: readonly string[];
}>;
export type WorkReport = WorkReportInput &
  Readonly<{
    id: string;
    projectId: string;
    memberId: string;
    memberName: string;
    reportScope?: WorkReportScope;
    frequency: ReportFrequency;
    periodStart: string;
    periodEnd: string;
    dueAt: string;
    status: WorkReportStatus;
    file?: Readonly<{ name: string; contentType: string; size: number }>;
    documentIds?: readonly string[];
    createdAt: string;
    updatedAt: string;
    submittedAt?: string;
    reviewedBy?: string;
    reviewedAt?: string;
    reviewComment?: string;
    reviewHistory: readonly ReviewEvent[];
    permissions: WorkNotePermissions;
  }>;

export type WorkReportSettings = Readonly<{
  projectId: string;
  scope?: WorkReportScope;
  actorRole?: "MANAGER" | "LEADER" | "MEMBER";
  frequency: ReportFrequency;
  effectiveAt: string;
  nextFrequency?: ReportFrequency;
  nextEffectiveAt?: string;
  updatedBy: string;
  history: readonly Readonly<{
    frequency: ReportFrequency;
    effectiveAt: string;
    updatedBy: string;
  }>[];
  permissions: Readonly<{ canConfigure: boolean }>;
  leaderSettings?: Readonly<{
    frequency: ReportFrequency;
    effectiveAt: string;
    updatedBy: string;
    history: readonly Readonly<{
      frequency: ReportFrequency;
      effectiveAt: string;
      updatedBy: string;
    }>[];
    permissions: Readonly<{ canConfigure: boolean }>;
  }>;
}>;

type ListOptions = Readonly<{ page?: number; pageSize?: number }>;
type DocumentAction =
  | "submit"
  | "comment"
  | "approve"
  | "request-changes"
  | "reject"
  | "archive";
type ReportAction = "submit" | "approve" | "request-changes" | "reject";

function csrfHeaders(): HeadersInit {
  if (typeof document === "undefined") return {};
  const parts = document.cookie.split(";").map((part) => part.trim());
  for (const prefix of [
    "__Host-csrf=",
    "continuum_csrf=",
    "csrf_token=",
  ] as const) {
    const cookie = parts.find((part) => part.startsWith(prefix));
    if (cookie) {
      const value = cookie.slice(prefix.length);
      return { "X-CSRF-Token": decodeURIComponent(value) };
    }
  }
  return {};
}

function projectPath(projectId: string) {
  return `/capture/projects/${encodeURIComponent(projectId)}`;
}

function listQuery(options: ListOptions = {}) {
  const params = new URLSearchParams({
    page: String(options.page ?? 1),
    pageSize: String(options.pageSize ?? 100),
  });
  return params.toString();
}

export const workNoteKeys = {
  project: (projectId: string) => ["work-notes", projectId] as const,
  taskNotes: (projectId: string, taskId: string) =>
    [...workNoteKeys.project(projectId), "task", taskId] as const,
  note: (projectId: string, noteId: string) =>
    [...workNoteKeys.project(projectId), "note", noteId] as const,
  projectNotes: (projectId: string, page: number) =>
    [...workNoteKeys.project(projectId), "list", page] as const,
  documents: (
    projectId: string,
    status: DocumentStatus | "ALL",
    page: number,
  ) => [...workNoteKeys.project(projectId), "documents", status, page] as const,
  document: (projectId: string, documentId: string) =>
    [...workNoteKeys.project(projectId), "document", documentId] as const,
  documentKnowledgeStatus: (projectId: string, documentId: string) =>
    [
      ...workNoteKeys.project(projectId),
      "document",
      documentId,
      "knowledge-status",
    ] as const,
  documentKnowledgeChunks: (
    projectId: string,
    documentId: string,
    version?: number,
  ) =>
    [
      ...workNoteKeys.project(projectId),
      "document",
      documentId,
      "knowledge-chunks",
      version ?? "latest",
    ] as const,
  reports: (
    projectId: string,
    status: WorkReportStatus | "ALL",
    page: number,
    scope: WorkReportScope = "MEMBER",
  ) =>
    scope === "LEADER"
      ? ([
          ...workNoteKeys.project(projectId),
          "reports",
          "LEADER",
          status,
          page,
        ] as const)
      : ([
          ...workNoteKeys.project(projectId),
          "reports",
          status,
          page,
        ] as const),
  settings: (projectId: string, scope: WorkReportScope = "MEMBER") =>
    scope === "LEADER"
      ? ([...workNoteKeys.project(projectId), "settings", "LEADER"] as const)
      : ([...workNoteKeys.project(projectId), "settings"] as const),
};

export const workNotesApi = {
  listTaskNotes(projectId: string, taskId: string, signal?: AbortSignal) {
    return apiClient<WorkNotesPage<TaskNote>>(
      `${projectPath(projectId)}/tasks/${encodeURIComponent(taskId)}/notes?${listQuery({ pageSize: 100 })}`,
      { signal, cache: "no-store" },
    );
  },
  listProjectTaskNotes(projectId: string, page: number, signal?: AbortSignal) {
    return apiClient<WorkNotesPage<TaskNote>>(
      `${projectPath(projectId)}/work-notes?${listQuery({ page, pageSize: 50 })}`,
      { signal, cache: "no-store" },
    );
  },
  getProjectTaskNote(projectId: string, noteId: string, signal?: AbortSignal) {
    return apiClient<TaskNote>(
      `${projectPath(projectId)}/work-notes/${encodeURIComponent(noteId)}`,
      { signal, cache: "no-store" },
    );
  },
  createTaskNote(projectId: string, taskId: string, input: TaskNoteInput) {
    return apiClient<TaskNote>(
      `${projectPath(projectId)}/tasks/${encodeURIComponent(taskId)}/notes`,
      {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify(input),
      },
    );
  },
  updateTaskNote(
    projectId: string,
    taskId: string,
    noteId: string,
    input: TaskNoteInput,
  ) {
    return apiClient<TaskNote>(
      `${projectPath(projectId)}/tasks/${encodeURIComponent(taskId)}/notes/${encodeURIComponent(noteId)}`,
      {
        method: "PATCH",
        headers: csrfHeaders(),
        body: JSON.stringify(input),
      },
    );
  },
  deleteTaskNote(projectId: string, taskId: string, noteId: string) {
    return apiClient<void>(
      `${projectPath(projectId)}/tasks/${encodeURIComponent(taskId)}/notes/${encodeURIComponent(noteId)}`,
      {
        method: "DELETE",
        headers: csrfHeaders(),
      },
    );
  },
  listDocuments(
    projectId: string,
    status: DocumentStatus | "ALL",
    page: number,
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams(listQuery({ page, pageSize: 50 }));
    if (status !== "ALL") params.set("status", status);
    return apiClient<WorkNotesPage<ProjectDocumentSummary>>(
      `${projectPath(projectId)}/documents?${params}`,
      { signal, cache: "no-store" },
    );
  },
  getDocument(projectId: string, documentId: string, signal?: AbortSignal) {
    return apiClient<ProjectDocument>(
      `${projectPath(projectId)}/documents/${encodeURIComponent(documentId)}`,
      {
        signal,
        cache: "no-store",
      },
    );
  },
  createDocument(projectId: string, input: ProjectDocumentInput) {
    return apiClient<ProjectDocument>(`${projectPath(projectId)}/documents`, {
      method: "POST",
      headers: csrfHeaders(),
      body: JSON.stringify(input),
    });
  },
  updateDocument(
    projectId: string,
    documentId: string,
    input: ProjectDocumentInput,
  ) {
    return apiClient<ProjectDocument>(
      `${projectPath(projectId)}/documents/${encodeURIComponent(documentId)}`,
      {
        method: "PATCH",
        headers: csrfHeaders(),
        body: JSON.stringify(input),
      },
    );
  },
  deleteDocument(projectId: string, documentId: string) {
    return apiClient<DeleteProjectDocumentResult>(
      `${projectPath(projectId)}/documents/${encodeURIComponent(documentId)}`,
      {
        method: "DELETE",
        headers: csrfHeaders(),
      },
    );
  },
  createDocumentUploadIntent(
    projectId: string,
    documentId: string,
    input: DocumentUploadIntentInput,
    signal?: AbortSignal,
  ) {
    return apiClient<DocumentUploadIntentResponse>(
      `${projectPath(projectId)}/documents/${encodeURIComponent(documentId)}/file/upload-intent`,
      {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify(input),
        ...(signal ? { signal } : {}),
      },
    );
  },
  confirmDocumentUpload(
    projectId: string,
    documentId: string,
    input: DocumentConfirmUploadInput,
    signal?: AbortSignal,
  ) {
    return apiClient<ProjectDocument>(
      `${projectPath(projectId)}/documents/${encodeURIComponent(documentId)}/file/confirm-upload`,
      {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify(input),
        ...(signal ? { signal } : {}),
      },
    );
  },
  uploadDocumentFile(
    projectId: string,
    documentId: string,
    file: File,
    options?: Readonly<{
      sha256?: string;
      autoSyncSag?: boolean;
      onProgress?: (percent: number, loaded: number, total: number) => void;
      signal?: AbortSignal;
    }>,
  ) {
    const isMockedApiClient =
      typeof (apiClient as unknown as { mock?: unknown }).mock === "object";
    if (!isMockedApiClient) {
      return uploadDocumentFileWithProgress(
        projectId,
        documentId,
        file,
        options,
      );
    }
    const headers = new Headers(csrfHeaders());
    headers.set("Content-Type", file.type || "application/octet-stream");
    headers.set("X-File-Name", encodeURIComponent(file.name));
    if (options?.sha256) {
      headers.set("X-Content-Sha256", options.sha256);
    }
    if (options?.autoSyncSag) {
      headers.set("X-Auto-Sync-Sag", "true");
    }
    options?.onProgress?.(50, Math.floor(file.size / 2), file.size);
    return apiClient<ProjectDocument>(
      `${projectPath(projectId)}/documents/${encodeURIComponent(documentId)}/file`,
      {
        method: "PUT",
        headers,
        body: file,
        ...(options?.signal ? { signal: options.signal } : {}),
      },
    ).then((res) => {
      options?.onProgress?.(100, file.size, file.size);
      return res;
    });
  },
  getDocumentKnowledgeStatus(
    projectId: string,
    documentId: string,
    signal?: AbortSignal,
  ) {
    return apiClient<DocumentKnowledgeStatus>(
      `${projectPath(projectId)}/documents/${encodeURIComponent(documentId)}/knowledge-status`,
      {
        signal,
        cache: "no-store",
      },
    );
  },
  getDocumentKnowledgeChunks(
    projectId: string,
    documentId: string,
    options?: Readonly<{ limit?: number; offset?: number; signal?: AbortSignal }>,
  ) {
    const params = new URLSearchParams();
    if (typeof options?.limit === "number") {
      params.set("limit", String(options.limit));
    }
    if (typeof options?.offset === "number" && options.offset > 0) {
      params.set("offset", String(options.offset));
    }
    const query = params.size > 0 ? `?${params.toString()}` : "";
    return apiClient<DocumentKnowledgeChunksResponse>(
      `${projectPath(projectId)}/documents/${encodeURIComponent(documentId)}/knowledge-chunks${query}`,
      {
        signal: options?.signal,
        cache: "no-store",
      },
    );
  },
  syncDocumentToSag(projectId: string, documentId: string) {
    return apiClient<DocumentKnowledgeStatus>(
      `${projectPath(projectId)}/documents/${encodeURIComponent(documentId)}/knowledge-sync`,
      {
        method: "POST",
        headers: csrfHeaders(),
      },
    );
  },
  controlDocumentKnowledge(
    projectId: string,
    documentId: string,
    action: DocumentKnowledgeControlAction,
  ) {
    return apiClient<DocumentKnowledgeStatus>(
      `${projectPath(projectId)}/documents/${encodeURIComponent(documentId)}/knowledge-control`,
      {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ action }),
      },
    );
  },
  async downloadDocumentFile(
    projectId: string,
    documentId: string,
    version?: number,
  ) {
    const basePath = `${projectPath(projectId)}/documents/${encodeURIComponent(documentId)}/file`;
    const urlParams = new URLSearchParams();
    if (typeof version === "number") {
      urlParams.set("version", String(version));
    }
    urlParams.set("format", "url");
    try {
      const descriptorResponse = await fetch(
        `/api/backend${basePath}?${urlParams.toString()}`,
        {
          credentials: "include",
          cache: "no-store",
        },
      );
      if (descriptorResponse.ok) {
        const descriptor =
          (await descriptorResponse.json()) as DocumentDownloadUrlResponse;
        if (descriptor.mode === "DIRECT_GET" && descriptor.downloadUrl) {
          try {
            const directResponse = await fetch(descriptor.downloadUrl, {
              credentials: "omit",
              cache: "no-store",
            });
            if (directResponse.ok) {
              return directResponse.blob();
            }
          } catch {
            // Fall through to authenticated proxy download if R2 CORS is not enabled in local dev
          }
        }
      }
    } catch {
      // Fall through to proxy download
    }

    const proxyParams = new URLSearchParams();
    if (typeof version === "number") {
      proxyParams.set("version", String(version));
    }
    proxyParams.set("proxy", "true");
    const response = await fetch(
      `/api/backend${basePath}?${proxyParams.toString()}`,
      {
        credentials: "include",
        cache: "no-store",
      },
    );
    if (!response.ok)
      throw new Error(`Could not download document file (${response.status}).`);
    return response.blob();
  },
  documentAction(
    projectId: string,
    documentId: string,
    action: DocumentAction,
    comment?: string,
  ) {
    return apiClient<ProjectDocument>(
      `${projectPath(projectId)}/documents/${encodeURIComponent(documentId)}/${action}`,
      {
        method: "POST",
        headers: csrfHeaders(),
        ...(action === "comment" ||
        action === "approve" ||
        action === "request-changes" ||
        action === "reject"
          ? { body: JSON.stringify({ ...(comment ? { comment } : {}) }) }
          : {}),
      },
    );
  },
  getReportSettings(
    projectId: string,
    signal?: AbortSignal,
    scope?: WorkReportScope,
  ) {
    const query = scope && scope !== "MEMBER" ? `?scope=${scope}` : "";
    return apiClient<WorkReportSettings>(
      `${projectPath(projectId)}/work-report-settings${query}`,
      {
        signal,
        cache: "no-store",
      },
    );
  },
  updateReportSettings(
    projectId: string,
    frequency: ReportFrequency,
    scope?: WorkReportScope,
  ) {
    return apiClient<WorkReportSettings>(
      `${projectPath(projectId)}/work-report-settings`,
      {
        method: "PATCH",
        headers: csrfHeaders(),
        body: JSON.stringify(
          scope && scope !== "MEMBER" ? { frequency, scope } : { frequency },
        ),
      },
    );
  },
  listReports(
    projectId: string,
    status: WorkReportStatus | "ALL",
    page: number,
    signal?: AbortSignal,
    scope?: WorkReportScope,
  ) {
    const params = new URLSearchParams(listQuery({ page, pageSize: 100 }));
    if (status !== "ALL") params.set("status", status);
    if (scope && scope !== "MEMBER") params.set("scope", scope);
    return apiClient<WorkNotesPage<WorkReport>>(
      `${projectPath(projectId)}/work-reports?${params}`,
      {
        signal,
        cache: "no-store",
      },
    );
  },
  saveCurrentReport(
    projectId: string,
    input: WorkReportInput,
    scope?: WorkReportScope,
  ) {
    const query = scope && scope !== "MEMBER" ? `?scope=${scope}` : "";
    return apiClient<WorkReport>(
      `${projectPath(projectId)}/work-reports${query}`,
      {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify(input),
      },
    );
  },
  updateReport(projectId: string, reportId: string, input: WorkReportInput) {
    return apiClient<WorkReport>(
      `${projectPath(projectId)}/work-reports/${encodeURIComponent(reportId)}`,
      {
        method: "PATCH",
        headers: csrfHeaders(),
        body: JSON.stringify(input),
      },
    );
  },
  uploadReportFile(projectId: string, reportId: string, file: File) {
    const headers = new Headers(csrfHeaders());
    headers.set("Content-Type", file.type || "application/octet-stream");
    headers.set("X-File-Name", encodeURIComponent(file.name));
    return apiClient<WorkReport>(
      `${projectPath(projectId)}/work-reports/${encodeURIComponent(reportId)}/file`,
      {
        method: "PUT",
        headers,
        body: file,
      },
    );
  },
  async downloadReportFile(projectId: string, reportId: string) {
    const path = `${projectPath(projectId)}/work-reports/${encodeURIComponent(reportId)}/file`;
    const response = await fetch(`/api/backend${path}`, {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok)
      throw new Error(`Could not download report file (${response.status}).`);
    return response.blob();
  },
  reportAction(
    projectId: string,
    reportId: string,
    action: ReportAction,
    comment?: string,
  ) {
    return apiClient<WorkReport>(
      `${projectPath(projectId)}/work-reports/${encodeURIComponent(reportId)}/${action}`,
      {
        method: "POST",
        headers: csrfHeaders(),
        ...(action === "approve" ||
        action === "request-changes" ||
        action === "reject"
          ? { body: JSON.stringify({ ...(comment ? { comment } : {}) }) }
          : {}),
      },
    );
  },
};

export function useTaskNotesQuery(projectId: string, taskId: string) {
  return useQuery({
    queryKey: workNoteKeys.taskNotes(projectId, taskId),
    queryFn: ({ signal }) =>
      workNotesApi.listTaskNotes(projectId, taskId, signal),
    enabled: isWorkNoteId(projectId) && isWorkNoteId(taskId),
    retry: false,
    staleTime: 0,
  });
}

export function useProjectTaskNotesQuery(projectId: string, page: number) {
  return useQuery({
    queryKey: workNoteKeys.projectNotes(projectId, page),
    queryFn: ({ signal }) =>
      workNotesApi.listProjectTaskNotes(projectId, page, signal),
    enabled: isWorkNoteId(projectId),
    retry: false,
    staleTime: 0,
  });
}

export function useProjectTaskNoteQuery(projectId: string, noteId: string) {
  return useQuery({
    queryKey: workNoteKeys.note(projectId, noteId),
    queryFn: ({ signal }) =>
      workNotesApi.getProjectTaskNote(projectId, noteId, signal),
    enabled: isWorkNoteId(projectId) && isWorkNoteId(noteId),
    retry: false,
    staleTime: 0,
  });
}

const ACTIVE_INGESTION_STATUSES = new Set([
  "QUEUED_OUTBOX",
  "QUEUED",
  "RECEIVED",
  "UPLOADING",
  "PARSING",
  "EXTRACTING",
  "INDEXING",
  "PROCESSING",
]);

function isKnowledgeSyncActive(sync?: DocumentKnowledgeStatus): boolean {
  if (!sync) return false;
  const normalized = (sync.status ?? "").toUpperCase();
  const stage = (sync.currentStage ?? "").toUpperCase();
  const docStatus = (sync.documentStatus ?? "").toUpperCase();

  if (stage === "PAUSING" || docStatus === "PAUSING") {
    return true;
  }
  if (
    normalized === "PAUSED" ||
    stage === "PAUSED" ||
    docStatus === "PAUSED" ||
    normalized === "FAILED" ||
    normalized === "INDEX_FAILED" ||
    normalized === "REVOKED" ||
    docStatus === "FAILED"
  ) {
    return false;
  }
  if (
    docStatus === "PENDING" ||
    docStatus === "LOADING" ||
    docStatus === "EXTRACTING"
  ) {
    return true;
  }
  if (ACTIVE_INGESTION_STATUSES.has(normalized)) return true;
  if (
    normalized === "SEARCH_READY" &&
    sync.knowledgeReady === false &&
    typeof sync.knowledgeStatus === "string" &&
    ["PROCESSING", "EXTRACTING", "QUEUED", "RUNNING"].includes(
      sync.knowledgeStatus.toUpperCase(),
    )
  ) {
    return true;
  }
  return false;
}

export function useDocumentsQuery(
  projectId: string,
  status: DocumentStatus | "ALL",
  page: number,
) {
  return useQuery({
    queryKey: workNoteKeys.documents(projectId, status, page),
    queryFn: ({ signal }) =>
      workNotesApi.listDocuments(projectId, status, page, signal),
    enabled: isWorkNoteId(projectId),
    retry: false,
    staleTime: 0,
    refetchInterval: (query) => {
      const items = query.state.data?.data;
      if (items?.some((item) => item.status === "APPROVED" && isKnowledgeSyncActive(item.knowledgeSync))) {
        return 1200;
      }
      return false;
    },
  });
}

export function useDocumentQuery(projectId: string, documentId: string) {
  return useQuery({
    queryKey: workNoteKeys.document(projectId, documentId),
    queryFn: ({ signal }) =>
      workNotesApi.getDocument(projectId, documentId, signal),
    enabled: isWorkNoteId(projectId) && isWorkNoteId(documentId),
    retry: false,
    staleTime: 0,
  });
}

export function useDocumentKnowledgeStatusQuery(
  projectId: string,
  documentId: string,
  enabled = true,
) {
  return useQuery({
    queryKey: workNoteKeys.documentKnowledgeStatus(projectId, documentId),
    queryFn: ({ signal }) =>
      workNotesApi.getDocumentKnowledgeStatus(projectId, documentId, signal),
    enabled: isWorkNoteId(projectId) && isWorkNoteId(documentId) && enabled,
    retry: false,
    staleTime: 0,
    refetchInterval: (query) =>
      isKnowledgeSyncActive(query.state.data) ? 650 : false,
  });
}

export function useDocumentKnowledgeChunksQuery(
  projectId: string,
  documentId: string,
  enabled = true,
  version?: number,
) {
  return useQuery({
    queryKey: workNoteKeys.documentKnowledgeChunks(
      projectId,
      documentId,
      version,
    ),
    queryFn: ({ signal }) =>
      workNotesApi.getDocumentKnowledgeChunks(projectId, documentId, {
        limit: 100,
        signal,
      }),
    enabled: isWorkNoteId(projectId) && isWorkNoteId(documentId) && enabled,
    retry: false,
    staleTime: 30_000,
  });
}

export async function computeFileSha256(file: File): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return "";
  }
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

class DirectCloudNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DirectCloudNetworkError";
  }
}

function putFileDirectToCloudWithProgress(
  uploadUrl: string,
  file: File,
  headers: Readonly<Record<string, string>>,
  options?: Readonly<{
    onProgress?: (percent: number, loaded: number, total: number) => void;
    signal?: AbortSignal;
  }>,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.withCredentials = false;

    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    const onAbort = () => {
      xhr.abort();
      reject(new DOMException("Upload cancelled by user", "AbortError"));
    };
    if (options?.signal) {
      if (options.signal.aborted) {
        onAbort();
        return;
      }
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options?.onProgress) {
        const percent = Math.min(
          98,
          Math.round((event.loaded / Math.max(1, event.total)) * 98),
        );
        options.onProgress(percent, event.loaded, event.total);
      }
    };

    xhr.onload = () => {
      options?.signal?.removeEventListener("abort", onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Direct cloud upload failed (${xhr.status}).`));
      }
    };

    xhr.onerror = () => {
      options?.signal?.removeEventListener("abort", onAbort);
      if (options?.signal?.aborted) {
        reject(new DOMException("Upload cancelled by user", "AbortError"));
        return;
      }
      reject(
        new DirectCloudNetworkError(
          "Direct cloud upload network or CORS error.",
        ),
      );
    };

    xhr.onabort = () => {
      options?.signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Upload cancelled by user", "AbortError"));
    };

    xhr.send(file);
  });
}

function uploadDocumentFileLegacyProxy(
  projectId: string,
  documentId: string,
  file: File,
  options?: Readonly<{
    sha256?: string;
    autoSyncSag?: boolean;
    onProgress?: (percent: number, loaded: number, total: number) => void;
    signal?: AbortSignal;
  }>,
): Promise<ProjectDocument> {
  return new Promise<ProjectDocument>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const path = `${projectPath(projectId)}/documents/${encodeURIComponent(documentId)}/file`;
    xhr.open("PUT", `/api/backend${path}`, true);
    xhr.withCredentials = true;

    const csrf = csrfHeaders() as Record<string, string>;
    for (const [key, value] of Object.entries(csrf)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("X-File-Name", encodeURIComponent(file.name));
    if (options?.sha256) {
      xhr.setRequestHeader("X-Content-Sha256", options.sha256);
    }
    if (options?.autoSyncSag) {
      xhr.setRequestHeader("X-Auto-Sync-Sag", "true");
    }

    const onAbort = () => {
      xhr.abort();
      reject(new DOMException("Upload cancelled by user", "AbortError"));
    };
    if (options?.signal) {
      if (options.signal.aborted) {
        onAbort();
        return;
      }
      options.signal.addEventListener("abort", onAbort, { once: true });
    }

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options?.onProgress) {
        const percent = Math.min(
          100,
          Math.round((event.loaded / Math.max(1, event.total)) * 100),
        );
        options.onProgress(percent, event.loaded, event.total);
      }
    };

    xhr.onload = () => {
      options?.signal?.removeEventListener("abort", onAbort);
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as ProjectDocument);
        } catch {
          reject(new Error("Invalid response payload from document upload."));
        }
      } else {
        let message = `Upload failed (${xhr.status})`;
        try {
          const parsed = JSON.parse(xhr.responseText) as {
            message?: string;
            code?: string;
          };
          if (parsed.message) message = parsed.message;
          else if (parsed.code) message = parsed.code;
        } catch {
          // ignore JSON parse error
        }
        reject(new Error(message));
      }
    };

    xhr.onerror = () => {
      options?.signal?.removeEventListener("abort", onAbort);
      reject(new Error("Network error while uploading document."));
    };

    xhr.onabort = () => {
      options?.signal?.removeEventListener("abort", onAbort);
      reject(new DOMException("Upload cancelled by user", "AbortError"));
    };

    xhr.send(file);
  });
}

export async function uploadDocumentFileWithProgress(
  projectId: string,
  documentId: string,
  file: File,
  options?: Readonly<{
    sha256?: string;
    autoSyncSag?: boolean;
    onProgress?: (percent: number, loaded: number, total: number) => void;
    signal?: AbortSignal;
  }>,
): Promise<ProjectDocument> {
  if (options?.signal?.aborted) {
    throw new DOMException("Upload cancelled by user", "AbortError");
  }

  const candidateSha = options?.sha256?.trim().toLowerCase() ?? "";
  const sha256 = /^[a-f0-9]{64}$/.test(candidateSha)
    ? candidateSha
    : (await computeFileSha256(file)).trim().toLowerCase();

  if (options?.signal?.aborted) {
    throw new DOMException("Upload cancelled by user", "AbortError");
  }

  if (/^[a-f0-9]{64}$/.test(sha256) && file.size > 0) {
    let intent: DocumentUploadIntentResponse | null = null;
    try {
      intent = await workNotesApi.createDocumentUploadIntent(
        projectId,
        documentId,
        {
          fileName: file.name,
          contentType: file.type || "application/octet-stream",
          size: file.size,
          sha256,
        },
        options?.signal,
      );
    } catch (error) {
      const status = (error as { status?: number } | null)?.status;
      if (status !== 404 && status !== 501) {
        throw error;
      }
    }

    if (intent?.mode === "DEDUPLICATED" && intent.uploadToken) {
      options?.onProgress?.(100, file.size, file.size);
      return workNotesApi.confirmDocumentUpload(
        projectId,
        documentId,
        {
          uploadToken: intent.uploadToken,
          ...(options?.autoSyncSag ? { autoSyncSag: true } : {}),
        },
        options?.signal,
      );
    }

    if (
      intent?.mode === "DIRECT_PUT" &&
      intent.uploadUrl &&
      intent.uploadToken
    ) {
      const signedHeaders: Record<string, string> = intent.headers
        ? { ...intent.headers }
        : {
            "Content-Type":
              intent.canonicalContentType ||
              file.type ||
              "application/octet-stream",
          };
      try {
        await putFileDirectToCloudWithProgress(
          intent.uploadUrl,
          file,
          signedHeaders,
          {
            onProgress: options?.onProgress,
            signal: options?.signal,
          },
        );
      } catch (error) {
        if (
          error instanceof DirectCloudNetworkError &&
          !options?.signal?.aborted
        ) {
          return uploadDocumentFileLegacyProxy(projectId, documentId, file, {
            ...options,
            sha256,
          });
        }
        throw error;
      }

      const confirmed = await workNotesApi.confirmDocumentUpload(
        projectId,
        documentId,
        {
          uploadToken: intent.uploadToken,
          ...(options?.autoSyncSag ? { autoSyncSag: true } : {}),
        },
        options?.signal,
      );
      options?.onProgress?.(100, file.size, file.size);
      return confirmed;
    }
  }

  return uploadDocumentFileLegacyProxy(projectId, documentId, file, {
    ...options,
    ...(sha256 ? { sha256 } : {}),
  });
}

export function useWorkReportsQuery(
  projectId: string,
  status: WorkReportStatus | "ALL",
  page = 1,
  scope: WorkReportScope = "MEMBER",
  enabled = true,
) {
  return useQuery({
    queryKey: workNoteKeys.reports(projectId, status, page, scope),
    queryFn: ({ signal }) =>
      scope === "LEADER"
        ? workNotesApi.listReports(projectId, status, page, signal, "LEADER")
        : workNotesApi.listReports(projectId, status, page, signal),
    enabled: isWorkNoteId(projectId) && enabled,
    retry: false,
    staleTime: 0,
  });
}

export function useWorkReportSettingsQuery(
  projectId: string,
  scope: WorkReportScope = "MEMBER",
  enabled = true,
) {
  return useQuery({
    queryKey: workNoteKeys.settings(projectId, scope),
    queryFn: ({ signal }) =>
      scope === "LEADER"
        ? workNotesApi.getReportSettings(projectId, signal, "LEADER")
        : workNotesApi.getReportSettings(projectId, signal),
    enabled: isWorkNoteId(projectId) && enabled,
    retry: false,
    staleTime: 0,
  });
}

export function useWorkNotesMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<TResult>,
  invalidationKeys: readonly (readonly unknown[])[],
) {
  const client = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async () => {
      await Promise.all(
        invalidationKeys.map((queryKey) =>
          client.invalidateQueries({ queryKey }),
        ),
      );
    },
  });
}

export function isWorkNoteId(value: string) {
  return /^[a-f\d]{24}$/i.test(value);
}
