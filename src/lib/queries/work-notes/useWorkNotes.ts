"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import type { WorkNoteKind } from "@/components/work-notes/work-notes-types";

export type WorkNoteDto = Readonly<{
  id: string;
  organizationId: string;
  projectId: string;
  authorId: string;
  authorName: string;
  title: string;
  body: string;
  content?: string;
  kind: WorkNoteKind;
  category?: string;
  summary?: string;
  taskKey?: string | null;
  blocker?: string | null;
  unfinished?: string | null;
  nextStep?: string | null;
  tags: readonly string[];
  pinned?: boolean;
  mentionUserIds: readonly string[];
  createdAt: string;
  updatedAt: string;
}>;

export type BackendWorkNote = WorkNoteDto;

export type CreateWorkNotePayload = Readonly<{
  title: string;
  body?: string;
  content?: string;
  kind?: WorkNoteKind;
  category?: string;
  summary?: string;
  taskKey?: string;
  blocker?: string;
  unfinished?: string;
  nextStep?: string;
  tags?: readonly string[];
  pinned?: boolean;
  mentionUserIds?: readonly string[];
}>;

export type UpdateWorkNotePayload = Readonly<{
  title?: string;
  body?: string;
  content?: string;
  kind?: WorkNoteKind;
  category?: string;
  summary?: string;
  taskKey?: string;
  blocker?: string;
  unfinished?: string;
  nextStep?: string;
  tags?: readonly string[];
  pinned?: boolean;
  mentionUserIds?: readonly string[];
}>;

export type WorkNotePermissions = Readonly<{
  canCreate: boolean;
  canEdit: boolean;
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
  taskId?: string;
}>;

export type ProjectDocumentSummary = Readonly<{
  id: string;
  projectId: string;
  taskId?: string;
  title: string;
  description?: string;
  type: DocumentType;
  version: number;
  status: DocumentStatus;
  createdBy: string;
  updatedAt: string;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  reviewComment?: string;
  permissions: WorkNotePermissions;
}>;

export type ReviewEvent = Readonly<{
  action: "APPROVED" | "CHANGES_REQUESTED" | "REJECTED";
  reviewerId: string;
  comment?: string;
  at: string;
}>;

export type ProjectDocument = ProjectDocumentSummary &
  Readonly<{
    content: string;
    versions: readonly Readonly<{
      version: number;
      status: DocumentStatus;
      createdAt: string;
      editedBy: string;
    }>[];
    reviewHistory: readonly ReviewEvent[];
  }>;

export type ReportFrequency = "DAILY" | "EVERY_3_DAYS" | "WEEKLY";
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
}>;
export type WorkReport = WorkReportInput &
  Readonly<{
    id: string;
    projectId: string;
    memberId: string;
    memberName: string;
    frequency: ReportFrequency;
    periodStart: string;
    periodEnd: string;
    dueAt: string;
    status: WorkReportStatus;
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
  frequency: ReportFrequency;
  effectiveAt: string;
  nextEffectiveAt?: string;
  updatedBy: string;
  history: readonly Readonly<{
    frequency: ReportFrequency;
    effectiveAt: string;
    updatedBy: string;
  }>[];
  permissions: Readonly<{ canConfigure: boolean }>;
}>;

type ListOptions = Readonly<{ page?: number; pageSize?: number }>;
type DocumentAction =
  | "submit"
  | "approve"
  | "request-changes"
  | "reject"
  | "archive";
type ReportAction = "submit" | "approve" | "request-changes" | "reject";

const CSRF_COOKIE_PREFIXES = [
  "__Host-csrf=",
  "continuum_csrf=",
  "csrf_token=",
] as const;

function csrfHeaders(): HeadersInit {
  if (typeof document === "undefined") return {};
  for (const part of document.cookie.split(";")) {
    const trimmed = part.trim();
    for (const prefix of CSRF_COOKIE_PREFIXES) {
      if (trimmed.startsWith(prefix)) {
        return {
          "X-CSRF-Token": decodeURIComponent(trimmed.slice(prefix.length)),
        };
      }
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

function normalizeWorkNoteDto(raw: Record<string, unknown>): WorkNoteDto {
  const kindRaw = (
    typeof raw.kind === "string"
      ? raw.kind
      : typeof raw.category === "string"
        ? raw.category
        : "WORK_UPDATE"
  ).toUpperCase();
  const kind: WorkNoteKind =
    kindRaw === "WEEKLY_SUMMARY" || kindRaw === "KNOWLEDGE" || kindRaw === "DECISION"
      ? kindRaw
      : "WORK_UPDATE";
  const body =
    typeof raw.body === "string"
      ? raw.body
      : typeof raw.content === "string"
        ? raw.content
        : "";
  return {
    id: String(raw.id ?? ""),
    organizationId: String(raw.organizationId ?? ""),
    projectId: String(raw.projectId ?? ""),
    authorId: String(raw.authorId ?? ""),
    authorName: String(raw.authorName ?? "Member"),
    title: String(raw.title ?? ""),
    body,
    content: body,
    kind,
    category: kind,
    summary: typeof raw.summary === "string" ? raw.summary : "",
    taskKey: typeof raw.taskKey === "string" ? raw.taskKey : null,
    blocker: typeof raw.blocker === "string" ? raw.blocker : null,
    unfinished: typeof raw.unfinished === "string" ? raw.unfinished : null,
    nextStep: typeof raw.nextStep === "string" ? raw.nextStep : null,
    tags: Array.isArray(raw.tags)
      ? raw.tags.filter((t): t is string => typeof t === "string")
      : [],
    pinned: Boolean(raw.pinned),
    mentionUserIds: Array.isArray(raw.mentionUserIds)
      ? raw.mentionUserIds.filter((id): id is string => typeof id === "string")
      : [],
    createdAt:
      typeof raw.createdAt === "string"
        ? raw.createdAt
        : new Date().toISOString(),
    updatedAt:
      typeof raw.updatedAt === "string"
        ? raw.updatedAt
        : new Date().toISOString(),
  };
}

export const workNoteKeys = {
  all: (projectId: string) => ["projects", projectId, "work-notes"] as const,
  detail: (projectId: string, noteId: string) =>
    ["projects", projectId, "work-notes", noteId] as const,
  project: (projectId: string) => ["work-notes", projectId] as const,
  taskNotes: (projectId: string, taskId: string) =>
    ["work-notes", projectId, "task", taskId] as const,
  projectNotes: (projectId: string, page: number) =>
    ["work-notes", projectId, "list", page] as const,
  documents: (
    projectId: string,
    status: DocumentStatus | "ALL",
    page: number,
  ) => ["work-notes", projectId, "documents", status, page] as const,
  document: (projectId: string, documentId: string) =>
    ["work-notes", projectId, "document", documentId] as const,
  reports: (
    projectId: string,
    status: WorkReportStatus | "ALL",
    page: number,
  ) => ["work-notes", projectId, "reports", status, page] as const,
  settings: (projectId: string) =>
    ["work-notes", projectId, "settings"] as const,
};

export const workNotesApi = {
  list: async (
    projectId: string,
    signal?: AbortSignal,
  ): Promise<{ items: readonly WorkNoteDto[] }> => {
    const res = await apiClient<{
      items?: readonly Record<string, unknown>[];
      data?: readonly Record<string, unknown>[];
    }>(`/projects/${encodeURIComponent(projectId)}/work-notes`, {
      signal,
      cache: "no-store",
    });
    const list = res.items ?? res.data ?? [];
    return {
      items: list.map((item) => normalizeWorkNoteDto(item)),
    };
  },

  get: async (
    projectId: string,
    noteId: string,
    signal?: AbortSignal,
  ): Promise<WorkNoteDto> => {
    const raw = await apiClient<Record<string, unknown>>(
      `/projects/${encodeURIComponent(projectId)}/work-notes/${encodeURIComponent(noteId)}`,
      { signal, cache: "no-store" },
    );
    return normalizeWorkNoteDto(raw);
  },

  create: async (
    projectId: string,
    payload: CreateWorkNotePayload,
  ): Promise<WorkNoteDto> => {
    const content = payload.content ?? payload.body ?? "";
    const category = payload.category ?? payload.kind ?? "WORK_UPDATE";
    const raw = await apiClient<Record<string, unknown>>(
      `/projects/${encodeURIComponent(projectId)}/work-notes`,
      {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({
          ...payload,
          content,
          category,
        }),
      },
    );
    return normalizeWorkNoteDto(raw);
  },

  update: async (
    projectId: string,
    noteId: string,
    payload: UpdateWorkNotePayload,
  ): Promise<WorkNoteDto> => {
    const raw = await apiClient<Record<string, unknown>>(
      `/projects/${encodeURIComponent(projectId)}/work-notes/${encodeURIComponent(noteId)}`,
      {
        method: "PATCH",
        headers: csrfHeaders(),
        body: JSON.stringify({
          ...payload,
          ...(payload.body !== undefined && payload.content === undefined
            ? { content: payload.body }
            : {}),
          ...(payload.kind !== undefined && payload.category === undefined
            ? { category: payload.kind }
            : {}),
        }),
      },
    );
    return normalizeWorkNoteDto(raw);
  },

  delete: (projectId: string, noteId: string) =>
    apiClient<{ deleted: true; id: string }>(
      `/projects/${encodeURIComponent(projectId)}/work-notes/${encodeURIComponent(noteId)}`,
      { method: "DELETE", headers: csrfHeaders() },
    ),

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
        ...(action === "approve" ||
        action === "request-changes" ||
        action === "reject"
          ? { body: JSON.stringify({ ...(comment ? { comment } : {}) }) }
          : {}),
      },
    );
  },
  getReportSettings(projectId: string, signal?: AbortSignal) {
    return apiClient<WorkReportSettings>(
      `${projectPath(projectId)}/work-report-settings`,
      {
        signal,
        cache: "no-store",
      },
    );
  },
  updateReportSettings(projectId: string, frequency: ReportFrequency) {
    return apiClient<WorkReportSettings>(
      `${projectPath(projectId)}/work-report-settings`,
      {
        method: "PATCH",
        headers: csrfHeaders(),
        body: JSON.stringify({ frequency }),
      },
    );
  },
  listReports(
    projectId: string,
    status: WorkReportStatus | "ALL",
    page: number,
    signal?: AbortSignal,
  ) {
    const params = new URLSearchParams(listQuery({ page, pageSize: 100 }));
    if (status !== "ALL") params.set("status", status);
    return apiClient<WorkNotesPage<WorkReport>>(
      `${projectPath(projectId)}/work-reports?${params}`,
      {
        signal,
        cache: "no-store",
      },
    );
  },
  saveCurrentReport(projectId: string, input: WorkReportInput) {
    return apiClient<WorkReport>(`${projectPath(projectId)}/work-reports`, {
      method: "POST",
      headers: csrfHeaders(),
      body: JSON.stringify(input),
    });
  },
  updateReport(
    projectId: string,
    reportId: string,
    input: WorkReportInput,
  ) {
    return apiClient<WorkReport>(
      `${projectPath(projectId)}/work-reports/${encodeURIComponent(reportId)}`,
      {
        method: "PATCH",
        headers: csrfHeaders(),
        body: JSON.stringify(input),
      },
    );
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

export function useProjectWorkNotesQuery(projectId: string, enabled = true) {
  return useQuery({
    queryKey: workNoteKeys.all(projectId),
    queryFn: ({ signal }) => workNotesApi.list(projectId, signal),
    enabled: Boolean(projectId && enabled),
  });
}

export function useProjectWorkNoteDetailQuery(
  projectId: string,
  noteId: string | null | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: workNoteKeys.detail(projectId, noteId ?? ""),
    queryFn: ({ signal }) => workNotesApi.get(projectId, noteId!, signal),
    enabled: Boolean(projectId && noteId && enabled),
    retry: false,
  });
}

export function useCreateWorkNoteMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateWorkNotePayload) =>
      workNotesApi.create(projectId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: workNoteKeys.all(projectId),
      });
    },
  });
}

export function useUpdateWorkNoteMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      noteId,
      payload,
    }: {
      noteId: string;
      payload: UpdateWorkNotePayload;
    }) => workNotesApi.update(projectId, noteId, payload),
    onSuccess: (_data, variables) => {
      void queryClient.invalidateQueries({
        queryKey: workNoteKeys.all(projectId),
      });
      void queryClient.invalidateQueries({
        queryKey: workNoteKeys.detail(projectId, variables.noteId),
      });
    },
  });
}

export function useDeleteWorkNoteMutation(projectId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (noteId: string) => workNotesApi.delete(projectId, noteId),
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: workNoteKeys.all(projectId),
      });
    },
  });
}

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
) {
  return useQuery({
    queryKey: workNoteKeys.reports(projectId, status, page),
    queryFn: ({ signal }) =>
      workNotesApi.listReports(projectId, status, page, signal),
    enabled: isWorkNoteId(projectId),
    retry: false,
    staleTime: 0,
  });
}

export function useWorkReportSettingsQuery(projectId: string) {
  return useQuery({
    queryKey: workNoteKeys.settings(projectId),
    queryFn: ({ signal }) =>
      workNotesApi.getReportSettings(projectId, signal),
    enabled: isWorkNoteId(projectId),
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
