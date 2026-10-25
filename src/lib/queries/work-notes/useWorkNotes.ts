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
  permissions: WorkNotePermissions;
}>;

export type ReviewEvent = Readonly<{
  action: "PENDING_REVIEW" | "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
  reviewerId: string;
  comment?: string;
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
  uploadDocumentFile(projectId: string, documentId: string, file: File) {
    const headers = new Headers(csrfHeaders());
    headers.set("Content-Type", file.type || "application/octet-stream");
    headers.set("X-File-Name", encodeURIComponent(file.name));
    return apiClient<ProjectDocument>(
      `${projectPath(projectId)}/documents/${encodeURIComponent(documentId)}/file`,
      {
        method: "PUT",
        headers,
        body: file,
      },
    );
  },
  async downloadDocumentFile(
    projectId: string,
    documentId: string,
    version?: number,
  ) {
    const path = `${projectPath(projectId)}/documents/${encodeURIComponent(documentId)}/file${version ? `?version=${version}` : ""}`;
    const response = await fetch(`/api/backend${path}`, {
      credentials: "include",
      cache: "no-store",
    });
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
